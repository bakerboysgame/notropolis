// Asset generation routes
// Environment bindings needed:
// - env.DB (D1)
// - env.R2_PRIVATE (private R2 bucket for refs/raw)
// - env.R2_PUBLIC (public R2 bucket for game-ready assets)
// - env.GEMINI_API_KEY
// - env.REMOVAL_AI_API_KEY

// R2 Public URL Configuration:
// Public bucket URL: https://pub-874867b18f8b4b4882277d8a2b7dfe80.r2.dev
// Custom domain (if configured): https://assets.notropolis.net
const R2_PUBLIC_URL = 'https://assets.notropolis.net';

// Audit logging helper
async function logAudit(env, action, assetId, actor, details = {}) {
    await env.DB.prepare(`
        INSERT INTO asset_audit_log (action, asset_id, actor, details)
        VALUES (?, ?, ?, ?)
    `).bind(action, assetId, actor || 'system', JSON.stringify(details)).run();
}

// Hash string helper for cache invalidation
async function hashString(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

// Gemini API helper - Uses Nano Banana Pro (gemini-3-pro-image-preview)
async function generateWithGemini(env, prompt) {
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${env.GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        responseModalities: ['IMAGE', 'TEXT'],
                        responseMimeType: 'image/png'
                    }
                })
            }
        );

        if (!response.ok) {
            const error = await response.text();
            return { success: false, error };
        }

        const data = await response.json();

        // Extract image from response
        const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (!imagePart) {
            return { success: false, error: 'No image in response' };
        }

        const imageBuffer = Uint8Array.from(atob(imagePart.inlineData.data), c => c.charCodeAt(0));
        return { success: true, imageBuffer };

    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Route handler for asset management
export async function handleAssetRoutes(request, env, path, method, user) {
    const url = new URL(request.url);

    // Parse route
    // /api/admin/assets/list/:category
    // /api/admin/assets/queue
    // /api/admin/assets/generate
    // etc.

    const pathParts = path.replace('/api/admin/assets', '').split('/').filter(Boolean);
    const action = pathParts[0];
    const param1 = pathParts[1];
    const param2 = pathParts[2];
    const param3 = pathParts[3];

    try {
        // GET /api/admin/assets/list/:category - List all assets by category
        if (action === 'list' && method === 'GET' && param1) {
            const category = param1;
            const assets = await env.DB.prepare(`
                SELECT * FROM generated_assets
                WHERE category = ?
                ORDER BY asset_key, variant
            `).bind(category).all();

            return Response.json({ assets: assets.results });
        }

        // GET /api/admin/assets/queue - Get generation queue status
        if (action === 'queue' && method === 'GET') {
            const queue = await env.DB.prepare(`
                SELECT q.*, a.category, a.asset_key
                FROM asset_generation_queue q
                JOIN generated_assets a ON q.asset_id = a.id
                WHERE q.status IN ('queued', 'processing')
                ORDER BY q.priority, q.created_at
            `).all();

            return Response.json({ queue: queue.results });
        }

        // POST /api/admin/assets/generate - Generate a new asset
        if (action === 'generate' && method === 'POST') {
            const { category, asset_key, prompt, variant = 1 } = await request.json();

            // Create asset record
            const result = await env.DB.prepare(`
                INSERT INTO generated_assets (category, asset_key, variant, base_prompt, current_prompt, status, generation_model)
                VALUES (?, ?, ?, ?, ?, 'pending', 'gemini-3-pro-image-preview')
                ON CONFLICT(category, asset_key, variant)
                DO UPDATE SET base_prompt = excluded.base_prompt, current_prompt = excluded.current_prompt, status = 'pending', updated_at = CURRENT_TIMESTAMP
                RETURNING id
            `).bind(category, asset_key, variant, prompt, prompt).first();

            // Add to queue
            await env.DB.prepare(`
                INSERT INTO asset_generation_queue (asset_id, priority)
                VALUES (?, 5)
            `).bind(result.id).run();

            // Trigger generation (could be async/queued)
            const generated = await generateWithGemini(env, prompt);

            if (generated.success) {
                // Determine storage path based on category
                // All originals go to PRIVATE bucket (not publicly accessible)
                let r2Key;
                if (category.endsWith('_ref')) {
                    // Reference sheets go to refs/
                    r2Key = `refs/${asset_key}_ref_v${variant}.png`;
                } else if (category === 'scene') {
                    // Scene originals go to scenes/
                    r2Key = `scenes/${asset_key}_v${variant}.png`;
                } else {
                    // Sprites go to raw/ (will be processed later)
                    r2Key = `raw/${category}_${asset_key}_raw_v${variant}.png`;
                }

                // Store in PRIVATE bucket (originals not publicly accessible)
                await env.R2_PRIVATE.put(r2Key, generated.imageBuffer, {
                    httpMetadata: { contentType: 'image/png' }
                });

                // Update asset record (r2_url left null for private assets)
                await env.DB.prepare(`
                    UPDATE generated_assets
                    SET status = 'completed', r2_key_private = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).bind(r2Key, result.id).run();

                // Update queue
                await env.DB.prepare(`
                    UPDATE asset_generation_queue
                    SET status = 'completed', completed_at = CURRENT_TIMESTAMP
                    WHERE asset_id = ?
                `).bind(result.id).run();

                await logAudit(env, 'generate', result.id, user?.username, { category, asset_key, variant });

                return Response.json({
                    success: true,
                    asset_id: result.id,
                    r2_key: r2Key,
                    bucket: 'private',
                    note: 'Original stored in private bucket. Use POST /process/:id to create game-ready WebP in public bucket.'
                });
            } else {
                await env.DB.prepare(`
                    UPDATE generated_assets
                    SET status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).bind(generated.error, result.id).run();

                return Response.json({ success: false, error: generated.error }, { status: 500 });
            }
        }

        // POST /api/admin/assets/remove-background/:id - Remove background from asset
        if (action === 'remove-background' && method === 'POST' && param1) {
            const id = param1;

            const asset = await env.DB.prepare(`
                SELECT * FROM generated_assets WHERE id = ?
            `).bind(id).first();

            if (!asset || !asset.r2_key_private) {
                return Response.json({ error: 'Asset not found' }, { status: 404 });
            }

            // Fetch the image from private bucket
            const originalObj = await env.R2_PRIVATE.get(asset.r2_key_private);
            if (!originalObj) {
                return Response.json({ error: 'Original image not found in R2' }, { status: 404 });
            }

            // Convert to base64 for Removal.ai API
            const arrayBuffer = await originalObj.arrayBuffer();
            const base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

            // Call Removal.ai API with base64 image
            const formData = new FormData();
            formData.append('image_base64', base64Image);

            const removalResponse = await fetch('https://api.removal.ai/3.0/remove', {
                method: 'POST',
                headers: {
                    'Rm-Token': env.REMOVAL_AI_API_KEY
                },
                body: formData
            });

            if (!removalResponse.ok) {
                const error = await removalResponse.text();
                return Response.json({ error: `Background removal failed: ${error}` }, { status: 500 });
            }

            const result = await removalResponse.json();

            if (!result.url) {
                return Response.json({ error: 'No result URL from Removal.ai' }, { status: 500 });
            }

            // Fetch the processed image
            const processedResponse = await fetch(result.url);
            const transparentBuffer = await processedResponse.arrayBuffer();

            // Store transparent version in private bucket (still an original, not game-ready)
            const newR2Key = asset.r2_key_private.replace('.png', '_transparent.png');
            await env.R2_PRIVATE.put(newR2Key, transparentBuffer, {
                httpMetadata: { contentType: 'image/png' }
            });

            // Update record
            await env.DB.prepare(`
                UPDATE generated_assets
                SET background_removed = TRUE, r2_key_private = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).bind(newR2Key, id).run();

            await logAudit(env, 'remove_bg', parseInt(id), user?.username);

            return Response.json({
                success: true,
                r2_key: newR2Key,
                bucket: 'private',
                note: 'Transparent version stored. Use POST /process/:id to create game-ready WebP.'
            });
        }

        // PUT /api/admin/assets/approve/:id - Approve an asset
        if (action === 'approve' && method === 'PUT' && param1) {
            const id = param1;

            await env.DB.prepare(`
                UPDATE generated_assets
                SET status = 'approved', approved_at = CURRENT_TIMESTAMP, approved_by = ?
                WHERE id = ?
            `).bind(user?.username || 'admin', id).run();

            await logAudit(env, 'approve', parseInt(id), user?.username);

            return Response.json({ success: true });
        }

        // PUT /api/admin/assets/reject/:id - Reject an asset WITH feedback
        if (action === 'reject' && method === 'PUT' && param1) {
            const id = param1;
            const { reason, incorporate_feedback = true } = await request.json();

            if (!reason) {
                return Response.json({ error: 'Rejection reason is required' }, { status: 400 });
            }

            // Get current asset
            const asset = await env.DB.prepare(`
                SELECT * FROM generated_assets WHERE id = ?
            `).bind(id).first();

            if (!asset) {
                return Response.json({ error: 'Asset not found' }, { status: 404 });
            }

            // Store rejection in history
            await env.DB.prepare(`
                INSERT INTO asset_rejections (asset_id, rejected_by, rejection_reason, prompt_at_rejection, prompt_version, r2_key_rejected)
                VALUES (?, ?, ?, ?, ?, ?)
            `).bind(id, user?.username || 'admin', reason, asset.current_prompt, asset.prompt_version, asset.r2_key_private).run();

            // Update the prompt with feedback if requested
            let newPrompt = asset.current_prompt;
            if (incorporate_feedback) {
                // Append feedback to prompt for next generation
                newPrompt = `${asset.base_prompt}

IMPORTANT FEEDBACK FROM PREVIOUS ATTEMPT:
${reason}

Please address the above feedback in this generation.`;
            }

            // Update asset status and prompt
            await env.DB.prepare(`
                UPDATE generated_assets
                SET status = 'rejected',
                    current_prompt = ?,
                    prompt_version = prompt_version + 1,
                    rejection_count = rejection_count + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).bind(newPrompt, id).run();

            await logAudit(env, 'reject', parseInt(id), user?.username, { reason, incorporate_feedback });

            return Response.json({
                success: true,
                message: 'Asset rejected. Prompt updated with feedback.',
                new_prompt_version: asset.prompt_version + 1,
                feedback_incorporated: incorporate_feedback
            });
        }

        // POST /api/admin/assets/regenerate/:id - Regenerate a rejected asset
        if (action === 'regenerate' && method === 'POST' && param1) {
            const id = param1;

            const asset = await env.DB.prepare(`
                SELECT * FROM generated_assets WHERE id = ?
            `).bind(id).first();

            if (!asset) {
                return Response.json({ error: 'Asset not found' }, { status: 404 });
            }

            // Use the current_prompt which includes any incorporated feedback
            const generated = await generateWithGemini(env, asset.current_prompt);

            if (generated.success) {
                // Store new version (overwrite old in private bucket)
                const r2Key = asset.r2_key_private || `raw/${asset.category}_${asset.asset_key}_v${asset.variant}.png`;

                await env.R2_PRIVATE.put(r2Key, generated.imageBuffer, {
                    httpMetadata: { contentType: 'image/png' }
                });

                // Update to review status
                await env.DB.prepare(`
                    UPDATE generated_assets
                    SET status = 'review',
                        r2_key_private = ?,
                        background_removed = FALSE,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).bind(r2Key, id).run();

                await logAudit(env, 'regenerate', parseInt(id), user?.username, { prompt_version: asset.prompt_version });

                return Response.json({
                    success: true,
                    asset_id: id,
                    prompt_version: asset.prompt_version,
                    message: 'Asset regenerated with updated prompt. Ready for review.'
                });
            } else {
                await env.DB.prepare(`
                    UPDATE generated_assets
                    SET error_message = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).bind(generated.error, id).run();

                return Response.json({ success: false, error: generated.error }, { status: 500 });
            }
        }

        // GET /api/admin/assets/rejections/:id - Get rejection history
        if (action === 'rejections' && method === 'GET' && param1) {
            const id = param1;

            const rejections = await env.DB.prepare(`
                SELECT * FROM asset_rejections
                WHERE asset_id = ?
                ORDER BY created_at DESC
            `).bind(id).all();

            return Response.json({ rejections: rejections.results });
        }

        // POST /api/admin/assets/generate-from-ref/:refId - Generate sprite from approved ref
        if (action === 'generate-from-ref' && method === 'POST' && param1) {
            const refId = param1;
            const { sprite_prompt, variant = 1 } = await request.json();

            // Get the approved reference
            const ref = await env.DB.prepare(`
                SELECT ga.*, ac.id as cat_id
                FROM generated_assets ga
                JOIN asset_categories ac ON ga.category = ac.id
                WHERE ga.id = ? AND ga.status = 'approved'
            `).bind(refId).first();

            if (!ref) {
                return Response.json({
                    error: 'Reference not found or not approved. Approve the reference sheet first.'
                }, { status: 400 });
            }

            // Find the sprite category for this ref
            const spriteCategory = await env.DB.prepare(`
                SELECT * FROM asset_categories WHERE parent_category = ?
            `).bind(ref.category).first();

            if (!spriteCategory) {
                return Response.json({
                    error: `No sprite category found for reference category ${ref.category}`
                }, { status: 400 });
            }

            // Create sprite record linked to parent ref
            const result = await env.DB.prepare(`
                INSERT INTO generated_assets (
                    category, asset_key, variant, base_prompt, current_prompt,
                    parent_asset_id, status, generation_model
                )
                VALUES (?, ?, ?, ?, ?, ?, 'pending', 'gemini-3-pro-image-preview')
                ON CONFLICT(category, asset_key, variant)
                DO UPDATE SET
                    base_prompt = excluded.base_prompt,
                    current_prompt = excluded.current_prompt,
                    parent_asset_id = excluded.parent_asset_id,
                    status = 'pending',
                    prompt_version = prompt_version + 1,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING id
            `).bind(
                spriteCategory.id,
                ref.asset_key,
                variant,
                sprite_prompt,
                sprite_prompt,
                refId
            ).first();

            // Generate the sprite
            const generated = await generateWithGemini(env, sprite_prompt);

            if (generated.success) {
                const r2Key = `raw/${spriteCategory.id}_${ref.asset_key}_v${variant}.png`;

                await env.R2_PRIVATE.put(r2Key, generated.imageBuffer, {
                    httpMetadata: { contentType: 'image/png' }
                });

                await env.DB.prepare(`
                    UPDATE generated_assets
                    SET status = 'review', r2_key_private = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).bind(r2Key, result.id).run();

                await logAudit(env, 'generate_from_ref', result.id, user?.username, {
                    parent_ref_id: refId,
                    category: spriteCategory.id
                });

                return Response.json({
                    success: true,
                    sprite_id: result.id,
                    parent_ref_id: refId,
                    category: spriteCategory.id,
                    message: 'Sprite generated from approved reference. Ready for review.'
                });
            } else {
                await env.DB.prepare(`
                    UPDATE generated_assets
                    SET status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).bind(generated.error, result.id).run();

                return Response.json({ success: false, error: generated.error }, { status: 500 });
            }
        }

        // GET /api/admin/assets/approved-refs - Get approved refs ready for sprite generation
        if (action === 'approved-refs' && method === 'GET') {
            const refs = await env.DB.prepare(`
                SELECT ga.*, ac.name as category_name,
                       (SELECT COUNT(*) FROM generated_assets child
                        WHERE child.parent_asset_id = ga.id AND child.status = 'approved') as approved_sprites
                FROM generated_assets ga
                JOIN asset_categories ac ON ga.category = ac.id
                WHERE ga.status = 'approved'
                  AND ga.category LIKE '%_ref'
                ORDER BY ga.asset_key
            `).all();

            return Response.json({ refs: refs.results });
        }

        // POST /api/admin/assets/reset-prompt/:id - Reset prompt to base
        if (action === 'reset-prompt' && method === 'POST' && param1) {
            const id = param1;

            await env.DB.prepare(`
                UPDATE generated_assets
                SET current_prompt = base_prompt,
                    prompt_version = prompt_version + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).bind(id).run();

            await logAudit(env, 'reset_prompt', parseInt(id), user?.username);

            return Response.json({ success: true, message: 'Prompt reset to base. Feedback removed.' });
        }

        // GET /api/admin/assets/audit/:assetId - Get audit log for specific asset
        if (action === 'audit' && method === 'GET' && param1) {
            const assetId = param1;

            const logs = await env.DB.prepare(`
                SELECT * FROM asset_audit_log
                WHERE asset_id = ?
                ORDER BY created_at DESC
            `).bind(assetId).all();

            return Response.json({ logs: logs.results });
        }

        // GET /api/admin/assets/audit - Get recent audit log (all assets)
        if (action === 'audit' && method === 'GET' && !param1) {
            const limit = url.searchParams.get('limit') || '50';
            const actionFilter = url.searchParams.get('action');

            let query = `SELECT * FROM v_recent_audit`;
            const params = [];

            if (actionFilter) {
                query = `SELECT * FROM asset_audit_log al
                         LEFT JOIN generated_assets ga ON al.asset_id = ga.id
                         WHERE al.action = ?
                         ORDER BY al.created_at DESC
                         LIMIT ?`;
                params.push(actionFilter, parseInt(limit));
            } else {
                query += ` LIMIT ?`;
                params.push(parseInt(limit));
            }

            const logs = await env.DB.prepare(query).bind(...params).all();
            return Response.json({ logs: logs.results });
        }

        // GET /api/admin/assets/buildings - List all building types with configurations
        if (action === 'buildings' && method === 'GET' && !param1) {
            const buildings = await env.DB.prepare(`
                SELECT * FROM v_building_manager
                ORDER BY building_name
            `).all();

            return Response.json({ buildings: buildings.results });
        }

        // GET /api/admin/assets/buildings/:buildingType/sprites - Get available sprites
        if (action === 'buildings' && method === 'GET' && param1 && param2 === 'sprites') {
            const buildingType = param1;

            const sprites = await env.DB.prepare(`
                SELECT ga.*,
                       (SELECT bc.active_sprite_id FROM building_configurations bc
                        WHERE bc.building_type_id = ?) = ga.id as is_active
                FROM generated_assets ga
                WHERE ga.category = 'building_sprite'
                  AND ga.asset_key = ?
                  AND ga.status = 'approved'
                ORDER BY ga.created_at DESC
            `).bind(buildingType, buildingType).all();

            return Response.json({ sprites: sprites.results });
        }

        // PUT /api/admin/assets/buildings/:buildingType - Update building configuration
        if (action === 'buildings' && method === 'PUT' && param1 && !param2) {
            const buildingType = param1;
            const { active_sprite_id, cost_override, base_profit_override } = await request.json();

            // Validate sprite belongs to this building type
            if (active_sprite_id) {
                const sprite = await env.DB.prepare(`
                    SELECT * FROM generated_assets
                    WHERE id = ? AND category = 'building_sprite' AND asset_key = ? AND status = 'approved'
                `).bind(active_sprite_id, buildingType).first();

                if (!sprite) {
                    return Response.json({
                        error: 'Invalid sprite. Must be an approved building sprite for this building type.'
                    }, { status: 400 });
                }
            }

            // Upsert configuration
            await env.DB.prepare(`
                INSERT INTO building_configurations (building_type_id, active_sprite_id, cost_override, base_profit_override)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(building_type_id)
                DO UPDATE SET
                    active_sprite_id = COALESCE(excluded.active_sprite_id, active_sprite_id),
                    cost_override = excluded.cost_override,
                    base_profit_override = excluded.base_profit_override,
                    updated_at = CURRENT_TIMESTAMP
            `).bind(buildingType, active_sprite_id, cost_override, base_profit_override).run();

            await logAudit(env, 'update_building_config', active_sprite_id, user?.username, {
                building_type: buildingType,
                cost_override,
                base_profit_override
            });

            return Response.json({ success: true, message: 'Building configuration updated.' });
        }

        // POST /api/admin/assets/buildings/:buildingType/publish - Publish building config
        if (action === 'buildings' && method === 'POST' && param1 && param2 === 'publish') {
            const buildingType = param1;

            // Check configuration exists and has a sprite
            const config = await env.DB.prepare(`
                SELECT * FROM building_configurations WHERE building_type_id = ?
            `).bind(buildingType).first();

            if (!config || !config.active_sprite_id) {
                return Response.json({
                    error: 'Cannot publish: no sprite selected for this building type.'
                }, { status: 400 });
            }

            // Mark as published
            await env.DB.prepare(`
                UPDATE building_configurations
                SET is_published = TRUE,
                    published_at = CURRENT_TIMESTAMP,
                    published_by = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE building_type_id = ?
            `).bind(user?.username || 'admin', buildingType).run();

            await logAudit(env, 'publish_building', config.active_sprite_id, user?.username, {
                building_type: buildingType
            });

            return Response.json({ success: true, message: 'Building configuration published.' });
        }

        // POST /api/admin/assets/buildings/:buildingType/unpublish - Unpublish building
        if (action === 'buildings' && method === 'POST' && param1 && param2 === 'unpublish') {
            const buildingType = param1;

            await env.DB.prepare(`
                UPDATE building_configurations
                SET is_published = FALSE,
                    updated_at = CURRENT_TIMESTAMP
                WHERE building_type_id = ?
            `).bind(buildingType).run();

            await logAudit(env, 'unpublish_building', null, user?.username, {
                building_type: buildingType
            });

            return Response.json({ success: true, message: 'Building unpublished.' });
        }

        // POST /api/admin/assets/avatar/composite/:companyId - Generate/update avatar composite
        if (action === 'avatar' && param1 === 'composite' && method === 'POST' && param2) {
            const companyId = param2;
            const body = await request.json();
            const context = body.context || 'main';
            const imageData = body.imageData;

            // Get current avatar selection
            const selection = await env.DB.prepare(`
                SELECT * FROM company_avatars WHERE company_id = ?
            `).bind(companyId).first();

            if (!selection) {
                return Response.json({ error: 'No avatar configured for this company' }, { status: 404 });
            }

            // Generate hash of selection for cache invalidation
            const selectionItems = [
                selection.background_id,
                selection.base_id,
                selection.skin_id,
                selection.outfit_id,
                selection.hair_id,
                selection.headwear_id,
                selection.accessory_id,
            ].filter(Boolean).sort().join('|');

            const avatarHash = await hashString(selectionItems);

            // Check if composite already exists with same hash
            const existing = await env.DB.prepare(`
                SELECT * FROM avatar_composites WHERE company_id = ? AND context = ?
            `).bind(companyId, context).first();

            if (existing && existing.avatar_hash === avatarHash && !imageData) {
                return Response.json({
                    success: true,
                    message: 'Composite already up to date',
                    r2_url: existing.r2_url,
                    cached: true
                });
            }

            if (!imageData) {
                // Return layer info for client-side compositing
                const itemIds = [
                    selection.background_id,
                    selection.base_id,
                    selection.skin_id,
                    selection.outfit_id,
                    selection.hair_id,
                    selection.headwear_id,
                    selection.accessory_id,
                ].filter(Boolean);

                if (itemIds.length === 0) {
                    return Response.json({ error: 'No avatar items selected' }, { status: 400 });
                }

                const placeholders = itemIds.map(() => '?').join(',');
                const items = await env.DB.prepare(`
                    SELECT id, r2_key, category FROM avatar_items WHERE id IN (${placeholders})
                `).bind(...itemIds).all();

                const categoryOrder = ['background', 'base', 'skin', 'outfit', 'hair', 'headwear', 'accessory'];
                const layers = categoryOrder
                    .map(cat => items.results.find(i => i.category === cat))
                    .filter(Boolean);

                return Response.json({
                    success: false,
                    error: 'Client must provide composited imageData',
                    layers: layers.map(l => ({
                        category: l.category,
                        r2_key: l.r2_key
                    })),
                    message: 'Composite client-side and include imageData in request'
                }, { status: 400 });
            }

            // Decode base64 image
            const imageBuffer = Uint8Array.from(atob(imageData.split(',')[1] || imageData), c => c.charCodeAt(0));

            // Store in public bucket
            const r2Key = `composites/avatar_${companyId}_${context}.png`;
            await env.R2_PUBLIC.put(r2Key, imageBuffer, {
                httpMetadata: { contentType: 'image/png' }
            });

            const r2Url = `${R2_PUBLIC_URL}/${r2Key}`;

            // Upsert composite record
            await env.DB.prepare(`
                INSERT INTO avatar_composites (company_id, context, r2_key, r2_url, avatar_hash)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(company_id, context)
                DO UPDATE SET
                    r2_key = excluded.r2_key,
                    r2_url = excluded.r2_url,
                    avatar_hash = excluded.avatar_hash,
                    updated_at = CURRENT_TIMESTAMP
            `).bind(companyId, context, r2Key, r2Url, avatarHash).run();

            // Invalidate any cached scenes using this avatar
            await env.DB.prepare(`
                DELETE FROM composed_scene_cache WHERE company_id = ?
            `).bind(companyId).run();

            await logAudit(env, 'avatar_composite_updated', null, user?.username, {
                company_id: companyId,
                context,
                avatar_hash: avatarHash
            });

            return Response.json({
                success: true,
                r2_url: r2Url,
                avatar_hash: avatarHash,
                cached: false
            });
        }

        // GET /api/admin/assets/avatar/composite/:companyId - Get avatar composite URL
        if (action === 'avatar' && param1 === 'composite' && method === 'GET' && param2) {
            const companyId = param2;
            const context = url.searchParams.get('context') || 'main';

            const composite = await env.DB.prepare(`
                SELECT * FROM avatar_composites WHERE company_id = ? AND context = ?
            `).bind(companyId, context).first();

            if (composite) {
                return Response.json({
                    success: true,
                    cached: true,
                    r2_url: composite.r2_url,
                    avatar_hash: composite.avatar_hash,
                    updated_at: composite.updated_at
                });
            }

            // Not cached - return layer info for client-side compositing
            const selection = await env.DB.prepare(`
                SELECT * FROM company_avatars WHERE company_id = ?
            `).bind(companyId).first();

            if (!selection) {
                return Response.json({ success: false, error: 'No avatar configured' }, { status: 404 });
            }

            // Get layer URLs
            const itemIds = [
                selection.background_id,
                selection.base_id,
                selection.skin_id,
                selection.outfit_id,
                selection.hair_id,
                selection.headwear_id,
                selection.accessory_id,
            ].filter(Boolean);

            if (itemIds.length === 0) {
                return Response.json({
                    success: true,
                    cached: false,
                    layers: [],
                    message: 'No avatar items selected'
                });
            }

            const placeholders = itemIds.map(() => '?').join(',');
            const items = await env.DB.prepare(`
                SELECT id, r2_key, category FROM avatar_items WHERE id IN (${placeholders})
            `).bind(...itemIds).all();

            const categoryOrder = ['background', 'base', 'skin', 'outfit', 'hair', 'headwear', 'accessory'];
            const layers = categoryOrder
                .map(cat => {
                    const item = items.results.find(i => i.category === cat);
                    if (item) {
                        return { category: cat, url: `${R2_PUBLIC_URL}/${item.r2_key}` };
                    }
                    return null;
                })
                .filter(Boolean);

            return Response.json({
                success: true,
                cached: false,
                layers,
                message: 'Composite not cached. Use layers for client-side compositing.'
            });
        }

        // GET /api/admin/assets/scenes/templates - List all active scene templates
        if (action === 'scenes' && param1 === 'templates' && method === 'GET' && !param2) {
            const templates = await env.DB.prepare(`
                SELECT * FROM v_scene_templates ORDER BY id
            `).all();

            const result = templates.results.map(t => ({
                ...t,
                background_url: `${R2_PUBLIC_URL}/${t.background_r2_key}`,
                foreground_url: t.foreground_r2_key ? `${R2_PUBLIC_URL}/${t.foreground_r2_key}` : null,
                avatar_slot: JSON.parse(t.avatar_slot)
            }));

            return Response.json({ success: true, templates: result });
        }

        // GET /api/admin/assets/scenes/templates/:sceneId - Get specific scene template
        if (action === 'scenes' && param1 === 'templates' && method === 'GET' && param2) {
            const sceneId = param2;

            const template = await env.DB.prepare(`
                SELECT * FROM scene_templates WHERE id = ?
            `).bind(sceneId).first();

            if (!template) {
                return Response.json({ error: 'Scene template not found' }, { status: 404 });
            }

            return Response.json({
                success: true,
                template: {
                    ...template,
                    background_url: `${R2_PUBLIC_URL}/${template.background_r2_key}`,
                    foreground_url: template.foreground_r2_key ? `${R2_PUBLIC_URL}/${template.foreground_r2_key}` : null,
                    avatar_slot: JSON.parse(template.avatar_slot)
                }
            });
        }

        // PUT /api/admin/assets/scenes/templates/:sceneId - Create/update scene template
        if (action === 'scenes' && param1 === 'templates' && method === 'PUT' && param2) {
            const sceneId = param2;
            const { name, description, background_r2_key, foreground_r2_key, avatar_slot, width, height } = await request.json();

            if (!name || !background_r2_key || !avatar_slot) {
                return Response.json({
                    error: 'name, background_r2_key, and avatar_slot are required'
                }, { status: 400 });
            }

            // Validate avatar_slot JSON structure
            const slot = typeof avatar_slot === 'string' ? JSON.parse(avatar_slot) : avatar_slot;
            if (typeof slot.x !== 'number' || typeof slot.y !== 'number' ||
                typeof slot.width !== 'number' || typeof slot.height !== 'number') {
                return Response.json({
                    error: 'avatar_slot must have x, y, width, height as numbers'
                }, { status: 400 });
            }

            const avatarSlotJson = JSON.stringify(slot);

            await env.DB.prepare(`
                INSERT INTO scene_templates (id, name, description, background_r2_key, foreground_r2_key, avatar_slot, width, height)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id)
                DO UPDATE SET
                    name = excluded.name,
                    description = excluded.description,
                    background_r2_key = excluded.background_r2_key,
                    foreground_r2_key = excluded.foreground_r2_key,
                    avatar_slot = excluded.avatar_slot,
                    width = COALESCE(excluded.width, width),
                    height = COALESCE(excluded.height, height),
                    updated_at = CURRENT_TIMESTAMP
            `).bind(sceneId, name, description, background_r2_key, foreground_r2_key, avatarSlotJson, width || 1920, height || 1080).run();

            // Invalidate all cached scenes for this template
            await env.DB.prepare(`
                DELETE FROM composed_scene_cache WHERE scene_template_id = ?
            `).bind(sceneId).run();

            await logAudit(env, 'scene_template_updated', null, user?.username, {
                scene_id: sceneId,
                name
            });

            return Response.json({ success: true, message: 'Scene template saved.' });
        }

        // GET /api/admin/assets/scenes/compose/:sceneId/:companyId - Get composed scene
        if (action === 'scenes' && param1 === 'compose' && method === 'GET' && param2 && param3) {
            const sceneId = param2;
            const companyId = param3;

            // Get scene template
            const template = await env.DB.prepare(`
                SELECT * FROM scene_templates WHERE id = ? AND is_active = TRUE
            `).bind(sceneId).first();

            if (!template) {
                return Response.json({ error: 'Scene template not found or inactive' }, { status: 404 });
            }

            // Get avatar composite hash
            const avatarComposite = await env.DB.prepare(`
                SELECT * FROM avatar_composites WHERE company_id = ? AND context = 'main'
            `).bind(companyId).first();

            // Check cache
            if (avatarComposite) {
                const templateHash = await hashString(`${template.background_r2_key}|${template.foreground_r2_key || ''}`);

                const cached = await env.DB.prepare(`
                    SELECT * FROM composed_scene_cache
                    WHERE scene_template_id = ? AND company_id = ?
                `).bind(sceneId, companyId).first();

                if (cached &&
                    cached.avatar_hash === avatarComposite.avatar_hash &&
                    cached.template_hash === templateHash) {
                    // Update last accessed for LRU
                    await env.DB.prepare(`
                        UPDATE composed_scene_cache SET last_accessed_at = CURRENT_TIMESTAMP WHERE id = ?
                    `).bind(cached.id).run();

                    return Response.json({
                        success: true,
                        cached: true,
                        r2_url: cached.r2_url
                    });
                }
            }

            // Not cached - return compositing info for client
            // Get avatar layers if no composite exists
            let avatarInfo;
            if (avatarComposite) {
                avatarInfo = { cached: true, url: avatarComposite.r2_url };
            } else {
                // Get layer info for client-side compositing
                const selection = await env.DB.prepare(`
                    SELECT * FROM company_avatars WHERE company_id = ?
                `).bind(companyId).first();

                if (selection) {
                    const itemIds = [
                        selection.background_id,
                        selection.base_id,
                        selection.skin_id,
                        selection.outfit_id,
                        selection.hair_id,
                        selection.headwear_id,
                        selection.accessory_id,
                    ].filter(Boolean);

                    if (itemIds.length > 0) {
                        const placeholders = itemIds.map(() => '?').join(',');
                        const items = await env.DB.prepare(`
                            SELECT id, r2_key, category FROM avatar_items WHERE id IN (${placeholders})
                        `).bind(...itemIds).all();

                        const categoryOrder = ['background', 'base', 'skin', 'outfit', 'hair', 'headwear', 'accessory'];
                        const layers = categoryOrder
                            .map(cat => {
                                const item = items.results.find(i => i.category === cat);
                                if (item) {
                                    return { category: cat, url: `${R2_PUBLIC_URL}/${item.r2_key}` };
                                }
                                return null;
                            })
                            .filter(Boolean);

                        avatarInfo = { cached: false, layers };
                    } else {
                        avatarInfo = { cached: false, layers: [] };
                    }
                } else {
                    avatarInfo = { cached: false, layers: [] };
                }
            }

            return Response.json({
                success: true,
                cached: false,
                scene: {
                    id: sceneId,
                    name: template.name,
                    width: template.width,
                    height: template.height,
                    background_url: `${R2_PUBLIC_URL}/${template.background_r2_key}`,
                    foreground_url: template.foreground_r2_key ? `${R2_PUBLIC_URL}/${template.foreground_r2_key}` : null,
                    avatar_slot: JSON.parse(template.avatar_slot)
                },
                avatar: avatarInfo,
                message: 'Compose client-side using scene layers and avatar'
            });
        }

        // POST /api/admin/assets/scenes/compose/:sceneId/:companyId/cache - Cache composed scene
        if (action === 'scenes' && param1 === 'compose' && method === 'POST' && param2 && param3 === 'cache') {
            // Path is /scenes/compose/:sceneId/:companyId/cache but we have a mismatch
            // Let's fix: param2 = sceneId, param3 should be companyId
            // But param3 = 'cache' means the path parsing needs adjustment
            // Actually the path would be: /scenes/compose/sceneId/companyId/cache
            // So pathParts = ['scenes', 'compose', 'sceneId', 'companyId', 'cache']
            // param1 = 'compose', param2 = sceneId, param3 = companyId
            // We need to check pathParts[4] === 'cache'
        }

        // Handle the cache route separately with full path parsing
        if (pathParts.length === 5 && pathParts[0] === 'scenes' && pathParts[1] === 'compose' && pathParts[4] === 'cache' && method === 'POST') {
            const sceneId = pathParts[2];
            const companyId = pathParts[3];
            const { imageData } = await request.json();

            if (!imageData) {
                return Response.json({ error: 'imageData is required (base64 PNG)' }, { status: 400 });
            }

            // Get template for hash
            const template = await env.DB.prepare(`
                SELECT * FROM scene_templates WHERE id = ?
            `).bind(sceneId).first();

            if (!template) {
                return Response.json({ error: 'Scene template not found' }, { status: 404 });
            }

            // Get avatar hash
            const avatarComposite = await env.DB.prepare(`
                SELECT avatar_hash FROM avatar_composites WHERE company_id = ? AND context = 'main'
            `).bind(companyId).first();

            if (!avatarComposite) {
                return Response.json({
                    error: 'Avatar composite must be cached first. Call POST /avatar/composite/:companyId'
                }, { status: 400 });
            }

            const templateHash = await hashString(`${template.background_r2_key}|${template.foreground_r2_key || ''}`);

            // Decode and store
            const imageBuffer = Uint8Array.from(atob(imageData.split(',')[1] || imageData), c => c.charCodeAt(0));

            const r2Key = `scenes/composed/${sceneId}_${companyId}.png`;
            await env.R2_PUBLIC.put(r2Key, imageBuffer, {
                httpMetadata: { contentType: 'image/png' }
            });

            const r2Url = `${R2_PUBLIC_URL}/${r2Key}`;

            // Upsert cache record
            await env.DB.prepare(`
                INSERT INTO composed_scene_cache (scene_template_id, company_id, r2_key, r2_url, avatar_hash, template_hash)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(scene_template_id, company_id)
                DO UPDATE SET
                    r2_key = excluded.r2_key,
                    r2_url = excluded.r2_url,
                    avatar_hash = excluded.avatar_hash,
                    template_hash = excluded.template_hash,
                    last_accessed_at = CURRENT_TIMESTAMP
            `).bind(sceneId, companyId, r2Key, r2Url, avatarComposite.avatar_hash, templateHash).run();

            return Response.json({ success: true, r2_url: r2Url });
        }

        // POST /api/admin/assets/process/:id - Process asset for game use
        if (action === 'process' && method === 'POST' && param1) {
            const id = param1;
            const { targetWidth, targetHeight, outputFormat = 'webp' } = await request.json();

            const asset = await env.DB.prepare(`
                SELECT * FROM generated_assets WHERE id = ?
            `).bind(id).first();

            if (!asset || !asset.r2_key_private) {
                return Response.json({ error: 'Asset not found' }, { status: 404 });
            }

            // Determine game-ready path in PUBLIC bucket
            let gameReadyKey;
            if (asset.category.endsWith('_ref')) {
                // Reference sheets stay as PNG (for admin preview only)
                return Response.json({
                    error: 'Reference sheets are not processed to game-ready. Use sprite generation instead.'
                }, { status: 400 });
            } else if (asset.category === 'scene') {
                gameReadyKey = `scenes/${asset.asset_key}_v${asset.variant}.${outputFormat}`;
            } else {
                // Sprites: buildings, terrain, effects, overlays, ui, npc
                gameReadyKey = `sprites/${asset.category}/${asset.asset_key}_v${asset.variant}.${outputFormat}`;
            }

            // Fetch original from PRIVATE bucket
            const originalObj = await env.R2_PRIVATE.get(asset.r2_key_private);
            if (!originalObj) {
                return Response.json({ error: 'Original not found in private bucket' }, { status: 404 });
            }

            // Store in PUBLIC bucket (game-ready)
            // Note: WebP conversion would require image processing library
            await env.R2_PUBLIC.put(gameReadyKey, originalObj.body, {
                httpMetadata: { contentType: `image/${outputFormat}` }
            });

            // Public bucket URL
            const gameReadyUrl = `${R2_PUBLIC_URL}/${gameReadyKey}`;

            // Update record with game-ready URL
            await env.DB.prepare(`
                UPDATE generated_assets
                SET r2_key_public = ?, r2_url = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).bind(gameReadyKey, gameReadyUrl, id).run();

            await logAudit(env, 'process', parseInt(id), user?.username, { format: outputFormat });

            return Response.json({
                success: true,
                game_ready_url: gameReadyUrl,
                public_key: gameReadyKey,
                format: outputFormat,
                note: 'Asset published to public bucket. For resizing, use Cloudflare Images or process client-side.'
            });
        }

        // POST /api/admin/assets/batch-generate - Batch generate multiple assets
        if (action === 'batch-generate' && method === 'POST') {
            const { assets } = await request.json();
            // assets = [{ category, asset_key, prompt, variant }, ...]

            const results = [];
            for (const asset of assets) {
                // Create records and queue
                const result = await env.DB.prepare(`
                    INSERT INTO generated_assets (category, asset_key, variant, base_prompt, current_prompt, status)
                    VALUES (?, ?, ?, ?, ?, 'queued')
                    ON CONFLICT(category, asset_key, variant)
                    DO UPDATE SET base_prompt = excluded.base_prompt, current_prompt = excluded.current_prompt, status = 'queued'
                    RETURNING id
                `).bind(asset.category, asset.asset_key, asset.variant || 1, asset.prompt, asset.prompt).first();

                await env.DB.prepare(`
                    INSERT INTO asset_generation_queue (asset_id)
                    VALUES (?)
                `).bind(result.id).run();

                results.push({ id: result.id, asset_key: asset.asset_key });
            }

            return Response.json({ success: true, queued: results.length, assets: results });
        }

        // GET /api/admin/assets/categories - Get all asset categories
        if (action === 'categories' && method === 'GET') {
            const categories = await env.DB.prepare(`
                SELECT * FROM asset_categories ORDER BY id
            `).all();

            return Response.json({ categories: categories.results });
        }

        // Default: route not found
        return Response.json({ error: 'Asset route not found', path, method }, { status: 404 });

    } catch (error) {
        console.error('Asset route error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}
