// Asset generation routes
// Environment bindings needed:
// - env.DB (D1)
// - env.R2_PRIVATE (private R2 bucket for refs/raw)
// - env.R2_PUBLIC (public R2 bucket for game-ready assets)
// - env.GEMINI_API_KEY
// - env.SLAZZER_API_KEY (for background removal)
// Note: Resize/WebP conversion uses Cloudflare Image Transformations (enabled on zone)

// R2 Public URL Configuration:
// Public bucket URL: https://pub-874867b18f8b4b4882277d8a2b7dfe80.r2.dev
// Custom domain (if configured): https://assets.notropolis.net
const R2_PUBLIC_URL = 'https://assets.notropolis.net';

// Categories that go through post-approval pipeline (bg removal → trim → resize → publish)
const SPRITE_CATEGORIES = [
    'building_sprite',
    'terrain',
    'npc',
    'effect',
    'vehicle',
    'avatar'
];

// Stage 5a: Sprite requirements per reference type
// Defines what sprites need to be generated for each reference category
const SPRITE_REQUIREMENTS = {
    building_ref: [
        { spriteCategory: 'building_sprite', variant: 'main', displayName: 'Building Sprite', required: true }
    ],
    terrain_ref: [
        { spriteCategory: 'terrain', variant: 'straight', displayName: 'Straight', required: true },
        { spriteCategory: 'terrain', variant: 'corner', displayName: 'Corner', required: true },
        { spriteCategory: 'terrain', variant: 't_junction', displayName: 'T-Junction', required: true },
        { spriteCategory: 'terrain', variant: 'crossroads', displayName: 'Crossroads', required: true },
        { spriteCategory: 'terrain', variant: 'end', displayName: 'Dead End', required: true }
    ],
    character_ref: [
        { spriteCategory: 'npc', variant: 'walk_1', displayName: 'Walk Frame 1', required: true },
        { spriteCategory: 'npc', variant: 'walk_2', displayName: 'Walk Frame 2', required: true }
    ],
    vehicle_ref: [
        { spriteCategory: 'vehicle', variant: 'sprite', displayName: 'Vehicle Sprite', required: true }
    ],
    effect_ref: [
        { spriteCategory: 'effect', variant: 'main', displayName: 'Effect Sprite', required: true }
    ]
};

// Stage 5a: Valid sprite-reference relationships
// Maps sprite categories to the reference categories they can be created from
const VALID_SPRITE_REF_RELATIONSHIPS = {
    'building_sprite': ['building_ref'],
    'terrain': ['terrain_ref'],
    'npc': ['character_ref'],
    'vehicle': ['vehicle_ref'],
    'effect': ['effect_ref']
};

/**
 * Stage 5a: Validate that a sprite category can be created from a reference category
 */
function validateSpriteRefRelationship(spriteCategory, refCategory) {
    const allowedRefs = VALID_SPRITE_REF_RELATIONSHIPS[spriteCategory];
    return allowedRefs && allowedRefs.includes(refCategory);
}

// Audit logging helper
async function logAudit(env, action, assetId, actor, details = {}) {
    await env.DB.prepare(`
        INSERT INTO asset_audit_log (action, asset_id, actor, details)
        VALUES (?, ?, ?, ?)
    `).bind(action, assetId ?? null, actor || 'system', JSON.stringify(details)).run();
}

// Hash string helper for cache invalidation
async function hashString(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

/**
 * Resize image and convert to WebP using Cloudflare Image Transformations
 * Requires Image Resizing to be enabled on the zone
 * @param {Object} env - Worker environment with R2_PUBLIC binding
 * @param {ArrayBuffer} imageBuffer - The source image buffer (PNG)
 * @param {string} tempKey - Temporary R2 key for the source image
 * @param {number} width - Target width
 * @param {number} height - Target height
 * @returns {Promise<ArrayBuffer>} - The resized WebP buffer
 */
async function resizeViaCloudflare(env, imageBuffer, tempKey, width, height) {
    // Step 1: Upload source image temporarily to public R2
    console.log(`[Resize] Uploading temp image: ${tempKey} (${imageBuffer.byteLength} bytes)`);
    await env.R2_PUBLIC.put(tempKey, imageBuffer, {
        httpMetadata: { contentType: 'image/png' }
    });

    // Small delay to ensure R2 propagation before transform request
    await new Promise(r => setTimeout(r, 500));

    try {
        // Step 2: Fetch with Cloudflare Image Resizing
        // Using scale-down instead of contain to ensure we don't upscale small images
        // and to properly fit within target dimensions
        const imageUrl = `${R2_PUBLIC_URL}/${tempKey}`;
        console.log(`[Resize] Fetching with cf.image transform: ${imageUrl}`);

        const response = await fetch(imageUrl, {
            cf: {
                image: {
                    width: width,
                    height: height,
                    fit: 'scale-down',  // Scale down to fit, don't upscale
                    format: 'webp',
                    quality: 95  // High quality for crisp sprites
                }
            }
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'No error body');
            throw new Error(`Image resize failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const contentType = response.headers.get('content-type');
        console.log(`[Resize] Response content-type: ${contentType}`);

        // Check if we actually got a transformed image
        if (contentType && !contentType.includes('webp') && !contentType.includes('image')) {
            const body = await response.text();
            throw new Error(`Unexpected response type: ${contentType}. Body: ${body.slice(0, 200)}`);
        }

        const resizedBuffer = await response.arrayBuffer();
        console.log(`[Resize] Got resized buffer: ${resizedBuffer.byteLength} bytes`);

        // Step 3: Clean up temp file
        await env.R2_PUBLIC.delete(tempKey);

        return resizedBuffer;
    } catch (err) {
        console.error(`[Resize] Failed for ${tempKey}:`, err.message);
        // Clean up on error
        await env.R2_PUBLIC.delete(tempKey).catch(() => {});
        throw err;
    }
}

/**
 * Fetch and resize a reference image for generation
 * Uses Cloudflare Image Transformations to reduce large images
 * @param {Object} env - Worker environment
 * @param {string} r2Key - R2 key in private bucket
 * @param {number} maxSize - Maximum dimension (width or height), default 1024
 * @returns {Promise<{ buffer: Uint8Array, mimeType: string }>}
 */
async function fetchResizedReferenceImage(env, r2Key, maxSize = 1024) {
    // Get original from private bucket
    const object = await env.R2_PRIVATE.get(r2Key);
    if (!object) {
        throw new Error(`Reference image not found: ${r2Key}`);
    }

    const originalBuffer = await object.arrayBuffer();
    const originalSize = originalBuffer.byteLength;

    // If image is small enough (< 500KB), use it directly
    if (originalSize < 500 * 1024) {
        console.log(`Reference image small enough (${(originalSize / 1024).toFixed(1)}KB), using directly`);
        return {
            buffer: new Uint8Array(originalBuffer),
            mimeType: object.httpMetadata?.contentType || 'image/png'
        };
    }

    // Image is large - resize via Cloudflare
    console.log(`Resizing large reference image (${(originalSize / 1024 / 1024).toFixed(2)}MB) to ${maxSize}px`);

    // Create a unique temp key
    const tempKey = `temp/ref_resize_${Date.now()}_${Math.random().toString(36).slice(2)}.png`;

    try {
        // Use existing resize function
        const resizedBuffer = await resizeViaCloudflare(env, originalBuffer, tempKey, maxSize, maxSize);
        console.log(`Resized reference: ${(originalSize / 1024 / 1024).toFixed(2)}MB -> ${(resizedBuffer.byteLength / 1024).toFixed(1)}KB`);

        return {
            buffer: new Uint8Array(resizedBuffer),
            mimeType: 'image/webp'
        };
    } catch (err) {
        console.error('Reference resize failed, using original:', err.message);
        // Fall back to original if resize fails
        return {
            buffer: new Uint8Array(originalBuffer),
            mimeType: object.httpMetadata?.contentType || 'image/png'
        };
    }
}

/**
 * Post-approval processing pipeline for sprites
 * Runs asynchronously via executionCtx.waitUntil() after approval
 *
 * Steps:
 * 1. Fetch original image from R2_PRIVATE
 * 2. Background removal (Slazzer API)
 * 3. Trim transparent pixels (placeholder)
 * 4. Save processed PNG to R2_PRIVATE
 * 5. Resize + WebP conversion (Cloudflare)
 * 6. Save to R2_PUBLIC for game
 * 7. Update database with public URL
 *
 * @param {Object} env - Worker environment
 * @param {number} assetId - Asset ID
 * @param {Object} asset - Full asset row from database
 * @param {string} approvedBy - Username who approved
 */
async function postApprovalPipeline(env, assetId, asset, approvedBy) {
    console.log(`[Pipeline] Starting for asset ${assetId} (${asset.category}/${asset.asset_key})`);

    try {
        // Update status to processing
        await env.DB.prepare(`
            UPDATE generated_assets
            SET pipeline_status = 'processing',
                pipeline_started_at = CURRENT_TIMESTAMP,
                pipeline_error = NULL
            WHERE id = ?
        `).bind(assetId).run();

        // Step 1: Fetch original image from private bucket
        if (!asset.r2_key_private) {
            throw new Error('No r2_key_private found for asset');
        }

        const originalObject = await env.R2_PRIVATE.get(asset.r2_key_private);
        if (!originalObject) {
            throw new Error(`Original image not found: ${asset.r2_key_private}`);
        }
        let imageBuffer = await originalObject.arrayBuffer();
        console.log(`[Pipeline] Fetched original image: ${imageBuffer.byteLength} bytes`);

        // Step 2: Background removal via Slazzer API
        // Skip for grass_bg - it IS the background, no transparency needed
        const skipBgRemoval = asset.category === 'terrain' && asset.asset_key === 'grass_bg';
        let bgRemovedBuffer;

        if (skipBgRemoval) {
            console.log('[Pipeline] Skipping background removal for grass_bg (it IS the background)');
            bgRemovedBuffer = imageBuffer;
        } else {
            console.log('[Pipeline] Removing background via Slazzer...');
            const formData = new FormData();
            formData.append('source_image_file', new Blob([imageBuffer], { type: 'image/png' }), 'image.png');
            formData.append('crop', 'true');

            const slazzerResponse = await fetch('https://api.slazzer.com/v2.0/remove_image_background', {
                method: 'POST',
                headers: { 'API-KEY': env.SLAZZER_API_KEY },
                body: formData
            });

            if (!slazzerResponse.ok) {
                const errorText = await slazzerResponse.text();
                throw new Error(`Slazzer API error: ${slazzerResponse.status} - ${errorText}`);
            }

            bgRemovedBuffer = await slazzerResponse.arrayBuffer();
            console.log(`[Pipeline] Background removed: ${bgRemovedBuffer.byteLength} bytes`);
        }

        // Step 3: Trim transparent pixels (placeholder - returns as-is for now)
        // TODO: Implement actual trimming with WASM-based image library if needed
        const trimmedBuffer = bgRemovedBuffer;
        console.log('[Pipeline] Trim step (placeholder)');

        // Step 4: Save processed PNG to private bucket
        const processedKey = `processed/${asset.category}/${asset.asset_key}_v${asset.variant}_${Date.now()}.png`;
        await env.R2_PRIVATE.put(processedKey, trimmedBuffer, {
            httpMetadata: { contentType: 'image/png' }
        });
        console.log(`[Pipeline] Saved processed PNG: ${processedKey}`);

        // Also update r2_key_private to point to the transparent version
        const transparentKey = asset.r2_key_private.replace('.png', '_transparent.png');
        await env.R2_PRIVATE.put(transparentKey, trimmedBuffer, {
            httpMetadata: { contentType: 'image/png' }
        });

        // Step 5: Resize + WebP conversion via Cloudflare
        const targetDims = getTargetDimensions(asset.category, asset.asset_key);
        let finalBuffer = trimmedBuffer;
        let resized = false;

        if (targetDims) {
            console.log(`[Pipeline] Resizing to ${targetDims.width}x${targetDims.height}...`);
            try {
                const tempKey = `_temp/${asset.category}_${asset.asset_key}_${Date.now()}.png`;
                finalBuffer = await resizeViaCloudflare(
                    env,
                    trimmedBuffer,
                    tempKey,
                    targetDims.width,
                    targetDims.height
                );
                resized = true;
                console.log(`[Pipeline] Resized to WebP: ${finalBuffer.byteLength} bytes`);
            } catch (resizeErr) {
                // Log the actual error for debugging - this should not fail silently
                console.error('[Pipeline] Cloudflare resize failed:', resizeErr.message, resizeErr.stack);
                // Record the resize failure in the database so we can track it
                await env.DB.prepare(`
                    UPDATE generated_assets
                    SET pipeline_error = ?
                    WHERE id = ?
                `).bind(`Resize failed: ${resizeErr.message}`, assetId).run();
                // Still continue with original - but it won't be resized
                console.error('[Pipeline] Continuing with unresized PNG - NEEDS MANUAL FIX');
            }
        }

        // Step 6: Save to public bucket
        const publicKey = `sprites/${asset.category}/${asset.asset_key}_v${asset.variant}.webp`;
        await env.R2_PUBLIC.put(publicKey, finalBuffer, {
            httpMetadata: { contentType: resized ? 'image/webp' : 'image/png' }
        });
        console.log(`[Pipeline] Saved to public bucket: ${publicKey}`);

        // Step 7: Update database with all URLs and mark pipeline complete
        const publicUrl = `${R2_PUBLIC_URL}/${publicKey}`;
        await env.DB.prepare(`
            UPDATE generated_assets
            SET r2_key_private = ?,
                r2_key_processed = ?,
                r2_key_public = ?,
                r2_url = ?,
                background_removed = ?,
                pipeline_status = 'completed',
                pipeline_completed_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).bind(transparentKey, processedKey, publicKey, publicUrl, !skipBgRemoval, assetId).run();

        console.log(`[Pipeline] Completed for asset ${assetId}. Public URL: ${publicUrl}`);

        // Log audit for pipeline completion
        await logAudit(env, 'pipeline_complete', assetId, 'system', {
            processedKey,
            publicKey,
            publicUrl,
            resized,
            targetDimensions: targetDims
        });

    } catch (error) {
        console.error(`[Pipeline] Failed for asset ${assetId}:`, error.message);

        // Update status to failed with error message
        await env.DB.prepare(`
            UPDATE generated_assets
            SET pipeline_status = 'failed',
                pipeline_error = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).bind(error.message, assetId).run();

        // Log audit for pipeline failure
        await logAudit(env, 'pipeline_failed', assetId, 'system', {
            error: error.message
        });
    }
}

/**
 * Generate Cloudflare Image Transform URL for on-the-fly transforms
 * Used as fallback if we can't resize at upload time
 * @see https://developers.cloudflare.com/images/transform-images/
 */
function buildImageTransformUrl(originalUrl, width, height, format = 'webp') {
    const baseUrl = 'https://assets.notropolis.net';
    const path = originalUrl.replace(baseUrl, '');
    return `${baseUrl}/cdn-cgi/image/width=${width},height=${height},format=${format},fit=contain/${path.startsWith('/') ? path.slice(1) : path}`;
}

/**
 * Get target dimensions for an asset based on its category
 * Uses tiered output sizes for consistent sprite quality
 * @param {string} category - Asset category (building_sprite, terrain, etc.)
 * @param {string} assetKey - The asset key (not used in tiered system, kept for API compatibility)
 * @returns {{ width: number, height: number } | null} - Target dimensions or null if no resize needed
 */
function getTargetDimensions(category, assetKey) {
    // Special case: grass_bg uses 512x512 (not the default terrain 320x320)
    if (category === 'terrain' && assetKey === 'grass_bg') {
        const size = SPRITE_OUTPUT_SIZES.terrain_grass_bg;
        return { width: size, height: size };
    }

    const size = SPRITE_OUTPUT_SIZES[category];
    if (size) {
        return { width: size, height: size };
    }
    // No resize for other categories (scenes, avatars, refs)
    return null;
}

/**
 * Get the default map_scale for an asset based on its category and key
 * Used when database doesn't have a map_scale value set
 * @param {string} category - Asset category
 * @param {string} assetKey - The asset key (used for building-specific scales)
 * @returns {number} - Default map scale (0.1 to 1.0)
 */
function getDefaultMapScale(category, assetKey) {
    if (category === 'building_sprite') {
        return BUILDING_SIZE_CLASSES[assetKey]?.default_map_scale ?? 1.0;
    }
    return DEFAULT_MAP_SCALES[category] ?? 1.0;
}

/**
 * Get image dimensions from buffer by parsing image headers
 * Supports PNG and JPEG formats
 * @param {Uint8Array} buffer - Image buffer
 * @returns {{ width: number, height: number }} - Image dimensions
 */
function getImageDimensions(buffer) {
    // PNG: width at bytes 16-19, height at bytes 20-23 (big-endian)
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
        const width = (buffer[16] << 24) | (buffer[17] << 16) | (buffer[18] << 8) | buffer[19];
        const height = (buffer[20] << 24) | (buffer[21] << 16) | (buffer[22] << 8) | buffer[23];
        return { width, height };
    }

    // JPEG: Need to find SOF0 marker (0xFF 0xC0) or SOF2 (0xFF 0xC2)
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
        let offset = 2;
        while (offset < buffer.length - 8) {
            if (buffer[offset] !== 0xFF) {
                offset++;
                continue;
            }
            const marker = buffer[offset + 1];
            // SOF0, SOF1, SOF2 markers contain dimensions
            if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
                const height = (buffer[offset + 5] << 8) | buffer[offset + 6];
                const width = (buffer[offset + 7] << 8) | buffer[offset + 8];
                return { width, height };
            }
            // Skip to next marker
            const length = (buffer[offset + 2] << 8) | buffer[offset + 3];
            offset += 2 + length;
        }
    }

    // GIF: width at bytes 6-7, height at bytes 8-9 (little-endian)
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
        const width = buffer[6] | (buffer[7] << 8);
        const height = buffer[8] | (buffer[9] << 8);
        return { width, height };
    }

    // WebP: More complex, check for RIFF header
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
        // VP8 chunk starts at offset 12 for lossy WebP
        if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38 && buffer[15] === 0x20) {
            // VP8 lossy format - dimensions at offset 26-29
            const width = (buffer[26] | (buffer[27] << 8)) & 0x3FFF;
            const height = (buffer[28] | (buffer[29] << 8)) & 0x3FFF;
            return { width, height };
        }
        // VP8L chunk for lossless WebP
        if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38 && buffer[15] === 0x4C) {
            const bits = buffer[21] | (buffer[22] << 8) | (buffer[23] << 16) | (buffer[24] << 24);
            const width = (bits & 0x3FFF) + 1;
            const height = ((bits >> 14) & 0x3FFF) + 1;
            return { width, height };
        }
    }

    // Default fallback
    return { width: 0, height: 0 };
}

// ============================================================================
// STYLE GUIDE - Shared across all asset types
// ============================================================================

const STYLE_GUIDE = `
STYLE: Pixar in 2050.
- Chunky, geometric, slightly exaggerated shapes
- Ultra-modern photorealistic rendering
- Soft lighting, perfect materials
- Inviting and polished finish
- NOT flat, NOT cel-shaded, NOT low-poly
`;

// Unused - keeping for reference
const REFERENCE_SHEET_TEMPLATE_UNUSED = `
REFERENCE SHEET TEMPLATE LAYOUT (CRITICAL - FOLLOW EXACTLY):

Canvas: 16:9 landscape, neutral gray background (#808080)

LAYOUT - 6 SEPARATE BOXES arranged in a 3x2 grid:
ROW 1 (top):
  [FRONT VIEW] - Building viewed straight-on from the front entrance side
  [LEFT SIDE VIEW] - Building viewed from the left side (90 degrees from front)
  [BACK VIEW] - Building viewed from the back (opposite of front entrance)

ROW 2 (bottom):
  [RIGHT SIDE VIEW] - Building viewed from the right side (90 degrees from front)
  [ISOMETRIC VIEW] - 45-degree angle view, entrance/door on LEFT FACE (facing the viewer)
  [DETAIL CLOSEUPS] - 3-4 material/texture detail shots

CRITICAL LAYOUT RULES:
- Each view must be in its OWN SEPARATE BOX with white border
- Views must NOT overlap or blend into each other
- Each box has a bold label at the top (e.g., "FRONT VIEW", "BACK VIEW")
- Title at very top: "BUILDING REFERENCE SHEET: [BUILDING NAME]"
- All 6 boxes should be roughly equal size
- EVERY VIEW shows the COMPLETE building, not cropped

This is a professional orthographic reference sheet like game studios use for 3D modeling.`;

// Building-specific distinctive features
// These describe WHAT the building looks like - the system prompt handles angle/canvas/style
// Reference the attached reference sheet for consistency
const BUILDING_FEATURES = {
    restaurant: `Use the attached reference sheet for this building.

A classic restaurant with:
- Illuminated "RESTAURANT" sign on facade
- Fork and knife crossed logo
- Red and white striped awning over entrance
- Large windows showing tables with white tablecloths inside
- Steam rising from chimney
- Elegant double doors
- Two stories tall`,

    bank: `Use the attached reference sheet for this building.

A grand bank with:
- Massive stone columns at entrance (Greek temple style)
- "BANK" text carved into stone or on brass plaque
- Vault door visible as decorative element
- Gold/brass trim on door handles, window frames
- Clock mounted above entrance
- Security bars on windows
- Heavy bronze double doors
- Stone steps leading to entrance`,

    temple: `Use the attached reference sheet for this building.

A spiritual temple with:
- Multi-tiered pagoda-style roof with curved eaves
- Ornate roof decorations (dragons, phoenixes, or spiritual symbols)
- Grand stone staircase to main entrance
- Large ceremonial doors with intricate carvings
- Incense burner at entrance
- Bell tower or prayer bell
- Decorative columns
- Roof tiles in terracotta or gold`,

    casino: `Use the attached reference sheet for this building.

A flashy casino with:
- Massive illuminated "CASINO" sign with light bulbs
- Giant playing card suits on facade
- Dice or roulette wheel decorations
- Red carpet and velvet rope entrance
- Gold and red color scheme
- Flashing lights on facade
- Grand double doors with golden handles`,

    police_station: `Use the attached reference sheet for this building.

A police station with:
- "POLICE" text prominently displayed
- Classic blue police lamp outside entrance
- Blue and white color scheme
- Badge or shield emblem on facade
- Heavy reinforced double doors
- Barred windows on lower level
- Security cameras visible
- Brick and concrete construction`,

    manor: `Use the attached reference sheet for this building.

A wealthy manor with:
- Grand columned entrance portico with stone steps
- Multiple stories with tall windows
- Ornate cornices and decorative stonework
- Multiple chimneys on steep rooflines
- Coat of arms or family crest on facade
- Manicured topiary at entrance
- Stained glass or arched windows`,

    high_street_store: `Use the attached reference sheet for this building.

A department store with:
- Two-story Victorian retail building
- "DEPARTMENT STORE" signage
- Display windows with mannequins visible
- Revolving door entrance
- Ornate upper floor with decorative moldings
- Awning over each display window`,

    motel: `Use the attached reference sheet for this building.

A roadside motel with:
- Tall neon "MOTEL" sign
- "VACANCY" sign underneath
- Single-story row of rooms with numbered doors
- Ice machine and vending machine alcove
- Office with "RECEPTION" sign
- Classic Americana roadside aesthetic`,

    burger_bar: `Use the attached reference sheet for this building.

A burger restaurant with:
- Giant hamburger model on the roof
- Neon "BURGERS" sign
- 1950s chrome diner aesthetic
- Red and white color scheme
- Large windows showing checkered floor inside
- Counter stools visible through windows
- Menu board with burger pictures`,

    shop: `Use the attached reference sheet for this building.

A small corner shop with:
- "SHOP" or "OPEN" sign displayed
- Striped fabric awning over entrance
- Display window with goods visible
- Small A-frame sign outside
- Brass door handle
- Friendly welcoming appearance`,

    campsite: `Use the attached reference sheet for this building.

A campsite with:
- Large canvas A-frame tent as centerpiece
- Stone campfire ring with flames/smoke
- "CAMP" flag or wooden sign
- Cooking pot over fire
- Wooden supply crates and barrels
- Oil lantern on post
- Sleeping bag visible at tent entrance`,

    hot_dog_stand: `Use the attached reference sheet for this building.

A hot dog stand with:
- Giant hot dog model on top
- "HOT DOGS" sign displayed
- Large striped umbrella
- Mustard and ketchup bottles visible
- Steamer box with steam rising
- Menu board with prices`,

    market_stall: `Use the attached reference sheet for this building.

A market stall with:
- Wooden vendor booth with canvas awning
- Crates overflowing with colorful produce
- Hand-painted price signs
- Weighing scale on counter
- Hanging baskets of goods
- "FRESH" or "MARKET" signage`,

    claim_stake: `A simple land claim marker:
- Wooden stake/post in the ground
- Small "SOLD" or "CLAIMED" sign hanging from post
- Rope or ribbon tied near the top
- Just the stake - no building
- Weathered but sturdy
- Maybe a small surveyor's flag`,

    demolished: `A demolished building site:
- Pile of rubble and debris (bricks, wood, concrete)
- Broken walls at different heights
- Exposed rebar and twisted metal
- Dust clouds or settling debris
- "CONDEMNED" sign or yellow caution tape
- Construction barriers around perimeter
- Scorch marks and broken glass`
};

/**
 * Build a complete prompt for building reference sheet generation
 * Combines style guide + template layout + building-specific features
 */
function buildBuildingRefPrompt(buildingType, customDetails = '') {
    const buildingName = buildingType.replace(/_/g, ' ').toUpperCase();
    const features = BUILDING_FEATURES[buildingType] || customDetails;

    if (!features) {
        throw new Error(`No features defined for building type: ${buildingType}. Provide customDetails.`);
    }

    return `Create a REFERENCE SHEET for a ${buildingName}.

LAYOUT: 6 views in a 3x2 grid on gray background (#808080)

ROW 1 (top):
- FRONT VIEW - Straight-on view of the entrance
- LEFT SIDE VIEW - 90 degrees from front
- BACK VIEW - Opposite of entrance

ROW 2 (bottom):
- RIGHT SIDE VIEW - 90 degrees from front
- GAME VIEW - See below
- DETAIL CLOSEUPS - Textures, signage, materials

=== GAME VIEW (CRITICAL) ===
This is how the building appears in-game:
- Looking from street level, slightly elevated
- FRONT FACE is dominant, facing bottom-left of the image
- Hint of RIGHT SIDE visible for depth
- Hint of ROOF visible - you're looking slightly down
- Door/entrance clearly visible on front

Each view in its own labeled box. Show the COMPLETE building in each view.

THE ${buildingName}:
${features}

STYLE: Pixar in 2050 - chunky, geometric, slightly exaggerated shapes with ultra-modern photorealistic rendering. Soft lighting, perfect materials, inviting and polished.

${customDetails ? `NOTES: ${customDetails}` : ''}`;
}

// ============================================================================
// ASSET CATEGORY PROMPT BUILDERS
// All prompts reference approved reference sheets for style consistency
// ============================================================================

/**
 * Core style reference that all non-ref assets should include
 * References the approved building reference sheets as style anchors
 */
const STYLE_REFERENCE_ANCHOR = `
STYLE CONSISTENCY (CRITICAL):
Your output MUST match the established art style from the approved building reference sheets.
Reference these approved assets for visual consistency:
- Same chunky, slightly exaggerated 90s CGI proportions
- Same modern rendering quality (smooth surfaces, soft ambient occlusion)
- Same top-left lighting at 45 degrees
- Same muted but vibrant color palette
- Same clean, anti-aliased edges
- Same "Pixar's The Incredibles / Two Point Hospital" aesthetic

If in doubt, match the style of the restaurant or temple reference sheets exactly.`;

// ============================================================================
// REFERENCE SHEET BUILDERS (Non-Building)
// These establish the style for each asset category before sprites are made
// ============================================================================

const CHARACTER_REF_TEMPLATE = `
CHARACTER REFERENCE SHEET TEMPLATE LAYOUT (CRITICAL - FOLLOW EXACTLY):

Canvas: 16:9 landscape, neutral gray background (#808080)

LAYOUT - 6 SEPARATE BOXES arranged in a 3x2 grid:
ROW 1 (top):
  [FRONT VIEW] - Character viewed straight-on from front
  [SIDE PROFILE] - Character viewed from left side (90 degrees)
  [BACK VIEW] - Character viewed from behind

ROW 2 (bottom):
  [TOP-DOWN VIEW] - Character viewed from directly above (bird's eye) - CRITICAL for sprite generation
  [3/4 FRONT VIEW] - 45-degree front angle (shows depth)
  [DETAIL CLOSEUPS] - Face closeup, hands, shoes, material textures

CRITICAL LAYOUT RULES:
- Each view in its OWN SEPARATE BOX with white border
- Views must NOT overlap or blend into each other
- Bold label at top of each box
- Title at very top: "CHARACTER REFERENCE SHEET: [CHARACTER NAME]"
- EVERY VIEW shows the COMPLETE character, same pose
- Same lighting across all views (top-left at 45 degrees)
- TOP-DOWN VIEW is ESSENTIAL - shows head/shoulders from above for directional walk sprites`;

const VEHICLE_REF_TEMPLATE = `
VEHICLE REFERENCE SHEET TEMPLATE LAYOUT (CRITICAL - FOLLOW EXACTLY):

Canvas: 16:9 landscape, neutral gray background (#808080)

LAYOUT - 6 SEPARATE BOXES arranged in a 3x2 grid:
ROW 1 (top):
  [FRONT VIEW] - Vehicle viewed straight-on from front
  [SIDE VIEW] - Vehicle viewed from driver's side
  [BACK VIEW] - Vehicle viewed from behind

ROW 2 (bottom):
  [TOP-DOWN VIEW] - Vehicle viewed from directly above
  [ISOMETRIC VIEW] - 45-degree isometric angle (game view)
  [DETAIL CLOSEUPS] - Wheels, headlights, interior glimpse, material textures

CRITICAL LAYOUT RULES:
- Each view in its OWN SEPARATE BOX with white border
- Views must NOT overlap
- Bold label at top of each box
- Title at very top: "VEHICLE REFERENCE SHEET: [VEHICLE NAME]"
- Same vehicle in every view
- Same lighting (top-left at 45 degrees)`;

const EFFECT_REF_TEMPLATE = `
EFFECT REFERENCE SHEET TEMPLATE LAYOUT (CRITICAL - FOLLOW EXACTLY):

Canvas: 16:9 landscape, neutral gray background (#808080)

LAYOUT - 6 SEPARATE BOXES arranged in a 3x2 grid:
ROW 1 (top):
  [EFFECT OVERVIEW] - Full effect from isometric game view angle
  [FRONT VIEW] - Effect viewed straight-on
  [SIDE VIEW] - Effect from side angle

ROW 2 (bottom):
  [TOP-DOWN VIEW] - Effect from above
  [ANIMATION FRAMES] - 3-4 key frames showing effect progression/variation
  [ELEMENT BREAKDOWN] - Individual particles, flames, smoke, debris isolated

CRITICAL LAYOUT RULES:
- Each view in its OWN SEPARATE BOX with white border
- Effect on TRANSPARENT background within each box (gray shows through)
- Bold label at top of each box
- Title at very top: "EFFECT REFERENCE SHEET: [EFFECT NAME]"
- This is the reference for creating overlays that work on ANY building`;

// Character reference features (for pedestrians and avatar base)
const CHARACTER_REF_FEATURES = {
    pedestrian: `PEDESTRIAN CHARACTER - generic city walker for ambient animation:
- REALISTIC human proportions (7-8 heads tall like a real adult), NOT blocky/Roblox
- Think Toy Story or Incredibles humans - normal proportions, stylized 90s CGI rendering
- Simple but well-defined geometry - proper arms, legs, torso proportions
- Business casual attire (polo shirt, trousers, sensible shoes)
- Neutral expression, casual walking demeanor
- Generic adult that blends into city background
- NO specific ethnicity - neutral skin tone placeholder
When approved, this generates directional walk sprites (N/S/E/W) automatically.
This establishes the character style for ALL ambient pedestrian NPCs.`,

    pedestrian_business: `BUSINESS PEDESTRIAN - adult in professional attire:
- REALISTIC human proportions (7-8 heads tall), NOT blocky/Roblox
- Think Toy Story or Incredibles humans - normal proportions, stylized rendering
- Business suit or smart casual (shirt, trousers, shoes)
- Neutral expression, professional demeanor
- Generic adult, gender-neutral or male
- NO specific ethnicity focus - neutral skin tone placeholder
This establishes the character style for all business NPCs.`,

    pedestrian_casual: `CASUAL PEDESTRIAN - everyday citizen:
- REALISTIC human proportions (7-8 heads tall), NOT blocky/Roblox
- Think Toy Story or Incredibles humans - normal proportions, stylized rendering
- Relaxed posture, casual clothing (t-shirt, jeans, sneakers)
- Slightly less formal stance
- Could carry shopping bag or nothing
- Generic everyday person walking around the city
This establishes the style for casual NPC citizens.`,

    avatar_base: `AVATAR BASE CHARACTER - player character foundation:
- REALISTIC human proportions (7-8 heads tall), NOT blocky/Roblox
- Think Toy Story or Incredibles humans - normal proportions, stylized rendering
- Neutral standing pose, arms slightly away from body
- PLACEHOLDER appearance - gray silhouette body
- This is the BASE that outfits, hair, accessories layer onto
- Must be perfectly centered for layer compositing
- Shows body shape that all avatar items must fit
This is the master reference for all avatar assets.`
};

// Vehicle reference features
// VIEW: TOP-DOWN OVERHEAD (bird's eye view looking straight down) for all vehicles
const VEHICLE_REF_FEATURES = {
    car_sedan: `SEDAN CAR - generic city vehicle (TOP-DOWN OVERHEAD VIEW):
- 90s CGI SHAPES with PHOTOREALISTIC MODERN RENDERING
- TOP-DOWN view showing roof, hood, trunk from directly above
- Stocky, geometric proportions (90s game aesthetic) but rendered with PBR materials
- 4-door sedan shape, compact and readable silhouette from above
- PHOTOREALISTIC paint finish with clear coat reflections and metallic flake
- Visible sunroof or roof details, windshield reflections
- Wheels visible at corners, realistic rubber texture
- Neutral color (gray/silver/dark blue) to show material quality
- NO brand logos, badges, or text
This establishes the car style for all vehicles - 90s SHAPES, TOP-DOWN VIEW.`,

    car_police: `POLICE CAR - law enforcement vehicle (TOP-DOWN OVERHEAD VIEW):
- 90s CGI SHAPES with PHOTOREALISTIC MODERN RENDERING
- TOP-DOWN view showing roof, light bar, hood from directly above
- Black and white police livery clearly visible from above
- LIGHT BAR on roof is the key feature - red and blue lights visible
- "POLICE" text on roof or hood if visible from above
- Same stocky sedan proportions as civilian cars
- PHOTOREALISTIC paint finish, chrome/metallic details
- Classic American police cruiser aesthetic
- NO specific department markings
This is the police variant - same 90s SHAPES, TOP-DOWN VIEW.`,

    car_sports: `SPORTS CAR - flashy vehicle (TOP-DOWN OVERHEAD VIEW):
- Same 90s CGI proportions as sedan but lower, sportier profile
- TOP-DOWN view showing sleek roof, spoiler from above
- 2-door coupe shape with aerodynamic lines visible from above
- PHOTOREALISTIC paint with candy apple red or metallic gold finish
- Real specular highlights, clear coat depth, metallic flake visible
- Spoiler visible from above, aggressive stance
- Aggressive alloy wheels visible at corners
- NO brand logos
Sporty variant - same 90s SHAPES, TOP-DOWN VIEW.`,

    car_van: `VAN/DELIVERY VEHICLE (TOP-DOWN OVERHEAD VIEW):
- Stocky, boxy 90s proportions with photorealistic surfaces
- TOP-DOWN view showing large roof from directly above
- Taller than sedan, utility shape, larger roof footprint
- PHOTOREALISTIC white paint with realistic dust/dirt accumulation
- Roof rack or vents visible from above
- Side panel (could have generic "DELIVERY" text)
- Realistic tire treads, steel wheels visible at corners
- NO specific company branding
Work/utility vehicle - 90s SHAPES, TOP-DOWN VIEW.`,

    car_taxi: `TAXI CAB (TOP-DOWN OVERHEAD VIEW):
- Same proportions as sedan
- TOP-DOWN view showing roof and "TAXI" sign from above
- Distinctive yellow color
- "TAXI" sign on roof (lit) - key identifying feature from above
- Checkered stripe optional
- Generic taxi appearance
- NO specific city/company markings
City taxi variant - TOP-DOWN VIEW.`
};

// Effect reference features
const EFFECT_REF_FEATURES = {
    fire: `FIRE/ARSON EFFECT:
- Bright orange and yellow flames in multiple layers
- Dark smoke plumes rising above flames
- Glowing embers floating upward
- Base of fire (where it contacts surface - will be transparent)
- Heat shimmer/distortion suggestion
- Flames at different heights and intensities
- NO building visible - just the fire effect itself
Universal fire effect for any building type.`,

    cluster_bomb: `CLUSTER BOMB/EXPLOSION EFFECT:
- Multiple impact points across the area
- Smoke plumes (gray/black) at various heights
- Fire bursts scattered
- Debris clouds (generic gray particles)
- Sparks and flash elements
- Scorch marks (as floating elements)
- Dust/dirt kicked up
Explosive damage covering building footprint.`,

    vandalism: `VANDALISM EFFECT:
- Spray paint marks (bright colors - pink, green, blue)
- Floating/splattered paint drips
- Generic trash debris
- Broken glass shards
- Graffiti shapes (abstract, no readable text)
- Scattered mess appearance
Surface vandalism overlay.`,

    robbery: `ROBBERY/BREAK-IN EFFECT:
- Shattered glass (door/window shaped void)
- Scattered papers and debris
- Flashlight beam suggestion
- Open safe/drawer elements
- Broken lock/handle
- Signs of forced entry
Post-robbery scene overlay.`,

    poisoning: `POISONING/TOXIC EFFECT:
- Green toxic clouds/gas
- Bubbling green puddles
- Wilted/dead plant elements
- Sickly yellow-green color palette
- Dripping toxic substance
- Fumes rising
Toxic contamination overlay.`,

    blackout: `BLACKOUT/ELECTRICAL EFFECT:
- Darkness/shadow overlay
- Blue electrical sparks/arcs
- Broken light fixture elements
- Flickering light suggestion
- Exposed wiring sparks
- Power-out atmosphere
Electrical failure overlay.`,

    smoke_bomb: `SMOKE BOMB EFFECT:
- Thick billowing smoke clouds in gray and white
- Puffy cartoon-style clouds expanding outward
- Wisps and tendrils drifting in multiple directions
- Semi-transparent layered smoke
- Smoke rising upward and spreading horizontally
- Classic "POOF" smoke bomb effect
- NO fire, just dense smoke
Obscuring smoke cloud overlay.`,

    stink_bomb: `STINK BOMB EFFECT:
- Green and yellow tinted stink clouds
- Wavy stink lines rising upward (comic book style)
- Cartoon-style odor waves emanating outward
- Small flies buzzing around
- Sickly green vapor wisps
- Puffy toxic-looking clouds
- Classic cartoon "stench" visual language
Noxious odor cloud overlay.`,

    destruction_bomb: `DESTRUCTION BOMB EFFECT:
- Massive explosion with huge central fireball
- Intense orange, red, and white flames
- Thick black smoke columns rising high
- Large debris field with chunks flying outward
- Visible shockwave rings expanding
- Extreme scorch marks and burn patterns
- Heavy sparks and embers everywhere
- Maximum devastation - near total destruction
Catastrophic explosion overlay.`,

    graffiti: `GRAFFITI EFFECT:
- Spray paint tags in bright neon colors
- Pink, green, blue, orange paint marks
- Dripping paint effects running downward
- Abstract shapes, squiggles, and symbols
- Floating spray paint cans
- Paint splatters and overspray mist
- Urban street art vandalism style
- NO readable text or specific symbols
Street art vandalism overlay.`
};

/**
 * Build prompt for CHARACTER reference sheet
 */
function buildCharacterRefPrompt(characterType, customDetails = '') {
    const characterName = characterType.replace(/_/g, ' ').toUpperCase();
    const features = CHARACTER_REF_FEATURES[characterType] || customDetails;

    if (!features) {
        throw new Error(`No features defined for character type: ${characterType}. Provide customDetails.`);
    }

    return `Create a character reference sheet for a ${characterName}.

${CHARACTER_REF_TEMPLATE}

Title: "CHARACTER REFERENCE SHEET: 90s CGI ${characterName}"

THE CHARACTER:
${features}

${STYLE_GUIDE}

${customDetails ? `ADDITIONAL NOTES:\n${customDetails}` : ''}

Remember: All views must show the exact same character. This reference establishes the character proportions and style that all pedestrian NPCs and avatar assets must match.`;
}

/**
 * Build prompt for VEHICLE reference sheet
 */
function buildVehicleRefPrompt(vehicleType, customDetails = '') {
    const vehicleName = vehicleType.replace(/_/g, ' ').toUpperCase();
    const features = VEHICLE_REF_FEATURES[vehicleType] || customDetails;

    if (!features) {
        throw new Error(`No features defined for vehicle type: ${vehicleType}. Provide customDetails.`);
    }

    return `Create a vehicle reference sheet for a ${vehicleName}.

${VEHICLE_REF_TEMPLATE}

Title: "VEHICLE REFERENCE SHEET: 90s CGI ${vehicleName}"

THE VEHICLE:
${features}

${STYLE_GUIDE}

VEHICLE-SPECIFIC RULES:
- NO brand logos, badges, or manufacturer markings
- Country-neutral (no specific license plate style)
- Chunky, toy-like proportions matching the building style
- Same top-left lighting as buildings

${customDetails ? `ADDITIONAL NOTES:\n${customDetails}` : ''}

Remember: All views must show the exact same vehicle. This reference establishes the vehicle style that all car sprites must match.`;
}

/**
 * Build prompt for EFFECT reference sheet
 */
function buildEffectRefPrompt(effectType, customDetails = '') {
    const effectName = effectType.replace(/_/g, ' ').toUpperCase();
    const features = EFFECT_REF_FEATURES[effectType] || customDetails;

    if (!features) {
        throw new Error(`No features defined for effect type: ${effectType}. Provide customDetails.`);
    }

    return `Create an effect reference sheet for ${effectName}.

${EFFECT_REF_TEMPLATE}

Title: "EFFECT REFERENCE SHEET: ${effectName}"

THE EFFECT:
${features}

${STYLE_GUIDE}

EFFECT-SPECIFIC RULES:
- NO building or structure visible - effect elements ONLY
- Must work as overlay on ANY building (tent, shack, temple, etc.)
- Use only universal elements (fire, smoke, sparks, generic debris)
- NO specific building materials in the debris
- Effect should be dramatic but readable at small game sizes

${customDetails ? `ADDITIONAL NOTES:\n${customDetails}` : ''}

Remember: This reference establishes how this effect looks from all angles. The game sprite will be extracted from the isometric view.`;
}

// ============================================================================
// TERRAIN TILE SYSTEM - SIMPLE, CLEAN PROMPTS
// ============================================================================

// All terrain tiles are ISOMETRIC DIAMONDS (rhombus shape, 2:1 ratio like 128x64)
// The diamond points are: TOP, RIGHT, BOTTOM, LEFT
// Edges connect adjacent points: top-right edge, right-bottom edge, bottom-left edge, left-top edge

const TERRAIN_FEATURES = {
    grass: `Green grass tile. Seamless texture.`,
    trees: `Trees on grass base.`,
    mountain: `Rocky mountain terrain.`,
    sand: `Sandy beach/desert tile.`,

    // Reference sheet descriptions (simple)
    water: `Water tiles reference sheet. Show: 1 full water tile, 4 edge tiles (shore on one side), 4 outer corners (shore on two sides), 4 inner corners (small shore in one corner).`,
    road: `Road tiles reference sheet. Dark gray asphalt with light sidewalks. Show all connection types: 2 straights, 4 corners, 4 T-junctions, 1 crossroads, 4 dead ends.`,
    dirt: `Dirt path tiles reference sheet. Brown path through green grass. Show: 2 straights, 4 corners.`,

    // Sprite base descriptions (simple)
    road_base: `Dark gray asphalt road with narrow light sidewalks on edges. No grass. Road is 70% of tile width.`,
    dirt_base: `Brown dirt path through green grass. Path is 40% of tile width.`,
    water_edge_base: `Blue water with sandy shore strip where it meets land.`
};

// ============================================================================
// TERRAIN VARIATION AUTO-GENERATION MAPPINGS
// When a base terrain type is approved, auto-generate all its variations
// ============================================================================

const TERRAIN_VARIATIONS = {
    // Grass: base tile approved → generate the seamless grass tile
    grass: ['grass_tile'],

    // Road: 5 base tiles (rotate in game engine for other orientations)
    road: [
        'road_straight',    // Horizontal straight (rotate 90° for vertical)
        'road_corner',      // Top-to-right corner (rotate for other corners)
        'road_tjunction',   // T-junction (rotate for other orientations)
        'road_crossroad',   // 4-way intersection (no rotation needed)
        'road_deadend'      // Dead end (rotate for other directions)
    ],

    // Dirt: base tile approved → generate all 6 connection variants
    dirt: [
        'dirt_ns', 'dirt_ew',                                           // Straights (2)
        'dirt_ne', 'dirt_nw', 'dirt_se', 'dirt_sw'                      // Corners (4)
    ],

    // Water: base tile approved → generate full tile + 12 edge/corner variants = 13 tiles
    water: [
        'water_full',  // Pure water tile, no edges (1)
        'water_edge_n', 'water_edge_e', 'water_edge_s', 'water_edge_w', // Edges (4)
        'water_corner_ne', 'water_corner_nw', 'water_corner_se', 'water_corner_sw', // Outer corners (4)
        'water_inner_ne', 'water_inner_nw', 'water_inner_se', 'water_inner_sw'      // Inner corners (4)
    ]
};

// Simple tile descriptions - minimal text, let the AI interpret
const WATER_TILE_DESCRIPTIONS = {
    water_full: `Pure water, no shore.`,
    water_edge_n: `Shore on N edge (top-right). Water fills rest.`,
    water_edge_e: `Shore on E edge (bottom-right). Water fills rest.`,
    water_edge_s: `Shore on S edge (bottom-left). Water fills rest.`,
    water_edge_w: `Shore on W edge (top-left). Water fills rest.`,
    water_corner_ne: `Shore on N and E edges (outer corner at right point). Water in SW.`,
    water_corner_nw: `Shore on N and W edges (outer corner at top point). Water in SE.`,
    water_corner_se: `Shore on S and E edges (outer corner at bottom point). Water in NW.`,
    water_corner_sw: `Shore on S and W edges (outer corner at left point). Water in NE.`,
    water_inner_ne: `Small shore in NE corner only. Water everywhere else.`,
    water_inner_nw: `Small shore in NW corner only. Water everywhere else.`,
    water_inner_se: `Small shore in SE corner only. Water everywhere else.`,
    water_inner_sw: `Small shore in SW corner only. Water everywhere else.`
};

// Road tile descriptions - tell Gemini which tile from the 5-tile reference sheet
const ROAD_TILE_DESCRIPTIONS = {
    road_straight: `Extract the 1st tile (STRAIGHT) from the reference. Vertical road through center of square.`,

    road_corner: `Extract the 2nd tile (CORNER) from the reference. L-shaped 90 degree turn.`,

    road_tjunction: `Extract the 3rd tile (T-JUNCTION) from the reference. Three-way intersection.`,

    road_crossroad: `Extract the 4th tile (CROSSROAD) from the reference. Four-way intersection.`,

    road_deadend: `Extract the 5th tile (DEAD-END) from the reference. Cul-de-sac with U-turn.`
};

// Simple dirt path descriptions
const DIRT_TILE_DESCRIPTIONS = {
    dirt_ns: `Straight path: N to S. Grass on sides.`,
    dirt_ew: `Straight path: E to W. Grass on sides.`,
    dirt_ne: `Corner path: N to E. Grass fills SW.`,
    dirt_nw: `Corner path: N to W. Grass fills SE.`,
    dirt_se: `Corner path: S to E. Grass fills NW.`,
    dirt_sw: `Corner path: S to W. Grass fills NE.`
};

// Terrain reference sheet layouts - defines grid positions for all variations
const TERRAIN_REF_LAYOUTS = {
    grass: {
        grid: '1x1', // Single tile - establishes the grass style
        tiles: [
            { key: 'grass_tile', label: 'Seamless Grass', pos: 'center' }
        ]
    },
    road: {
        grid: '4x4', // 4 columns, 4 rows = 16 slots (15 tiles + 1 empty)
        tiles: [
            // Row 1: Straights and 4-way
            { key: 'road_ns', label: 'N-S Straight', pos: 'top-left' },
            { key: 'road_ew', label: 'E-W Straight', pos: 'top-2nd' },
            { key: 'road_nesw', label: '4-Way', pos: 'top-3rd' },
            { key: 'empty', label: '', pos: 'top-right' },
            // Row 2: Corners
            { key: 'road_ne', label: 'NE Corner', pos: '2nd-left' },
            { key: 'road_nw', label: 'NW Corner', pos: '2nd-2nd' },
            { key: 'road_se', label: 'SE Corner', pos: '2nd-3rd' },
            { key: 'road_sw', label: 'SW Corner', pos: '2nd-right' },
            // Row 3: T-junctions
            { key: 'road_nes', label: 'T (NES)', pos: '3rd-left' },
            { key: 'road_new', label: 'T (NEW)', pos: '3rd-2nd' },
            { key: 'road_nsw', label: 'T (NSW)', pos: '3rd-3rd' },
            { key: 'road_esw', label: 'T (ESW)', pos: '3rd-right' },
            // Row 4: Dead ends
            { key: 'road_n', label: 'Dead End N', pos: 'bottom-left' },
            { key: 'road_e', label: 'Dead End E', pos: 'bottom-2nd' },
            { key: 'road_s', label: 'Dead End S', pos: 'bottom-3rd' },
            { key: 'road_w', label: 'Dead End W', pos: 'bottom-right' },
        ]
    },
    dirt: {
        grid: '3x2', // 3 columns, 2 rows = 6 tiles
        tiles: [
            // Row 1: Straights and corners
            { key: 'dirt_ns', label: 'N-S Straight', pos: 'top-left' },
            { key: 'dirt_ew', label: 'E-W Straight', pos: 'top-center' },
            { key: 'dirt_ne', label: 'NE Corner', pos: 'top-right' },
            // Row 2: More corners
            { key: 'dirt_nw', label: 'NW Corner', pos: 'bottom-left' },
            { key: 'dirt_se', label: 'SE Corner', pos: 'bottom-center' },
            { key: 'dirt_sw', label: 'SW Corner', pos: 'bottom-right' },
        ]
    },
    water: {
        grid: '5x3', // 5 columns, 3 rows = 15 slots (13 tiles + 2 empty)
        tiles: [
            // Row 1: Full water + Edge tiles - shore on one side, water on other three
            { key: 'water_full', label: 'Full Water (no edges)', pos: 'top-left' },
            { key: 'water_edge_n', label: 'N Edge (shore at north)', pos: 'top-2nd' },
            { key: 'water_edge_e', label: 'E Edge (shore at east)', pos: 'top-3rd' },
            { key: 'water_edge_s', label: 'S Edge (shore at south)', pos: 'top-4th' },
            { key: 'water_edge_w', label: 'W Edge (shore at west)', pos: 'top-right' },
            // Row 2: Outer corners - shore on two adjacent sides (water pokes into land)
            { key: 'water_corner_ne', label: 'NE Outer Corner', pos: '2nd-left' },
            { key: 'water_corner_nw', label: 'NW Outer Corner', pos: '2nd-2nd' },
            { key: 'water_corner_se', label: 'SE Outer Corner', pos: '2nd-3rd' },
            { key: 'water_corner_sw', label: 'SW Outer Corner', pos: '2nd-right' },
            // Row 3: Inner corners - land pokes into water at one corner (mostly water)
            { key: 'water_inner_ne', label: 'NE Inner Corner', pos: 'bottom-left' },
            { key: 'water_inner_nw', label: 'NW Inner Corner', pos: 'bottom-2nd' },
            { key: 'water_inner_se', label: 'SE Inner Corner', pos: 'bottom-3rd' },
            { key: 'water_inner_sw', label: 'SW Inner Corner', pos: 'bottom-right' },
        ]
    }
};

/**
 * Build prompt for terrain REFERENCE SHEET - SIMPLIFIED
 */
function buildTerrainRefPrompt(terrainType, customDetails = '') {
    // Road reference - 5 interlocking road tiles
    if (terrainType === 'road') {
        return `5 road tiles in a row. Smooth modern style. NOT pixel art.

ROAD: Dark gray asphalt, yellow/orange dashed centerline, thin gray curb ONLY around road edges.
BACKGROUND: Transparent or white - NOT pavement. Sidewalk does NOT fill empty areas.

CRITICAL ALIGNMENT: Road exits at exactly 50% (middle) of each tile edge. Road width is 60% of tile.

5 TILES left to right:
1. STRAIGHT - vertical road through center
2. CORNER - L-SHAPE 90° turn (NOT S-curve). Road enters LEFT edge center, turns RIGHT ANGLE, exits BOTTOM edge center. Top-right is empty.
3. T-JUNCTION - road at center of LEFT, RIGHT, BOTTOM edges. Empty at top.
4. CROSSROAD - road at center of all 4 edges
5. DEAD-END - road from center of BOTTOM edge, U-turn at top

Sidewalk wraps road only. Empty space is transparent, not paved.${customDetails ? `\n\n${customDetails}` : ''}`;
    }

    // Water reference
    if (terrainType === 'water') {
        return `Create a WATER TILES reference sheet for an isometric game.

TILE SHAPE: Diamond (rhombus), 2:1 ratio. Points at: top, right, bottom, left.

WATER STYLE:
- Blue water with subtle ripples
- Sandy shore where water meets land (shore is INSIDE the water tile)

SHOW 13 TILES in a 5x3 grid:
Row 1: Full-water, N-edge, E-edge, S-edge, W-edge
Row 2: NE-outer, NW-outer, SE-outer, SW-outer, empty
Row 3: NE-inner, NW-inner, SE-inner, SW-inner, empty

Edge tiles: Shore runs along that full edge (diagonal line).
Outer corners: Shore on two adjacent edges.
Inner corners: Small shore in one corner only, rest is water.

Background: white or light gray.${customDetails ? `\n\n${customDetails}` : ''}`;
    }

    // Dirt reference
    if (terrainType === 'dirt') {
        return `Create a DIRT PATH TILES reference sheet for an isometric game.

TILE SHAPE: Diamond (rhombus), 2:1 ratio.

DIRT STYLE:
- Brown/tan dirt path (40% of tile width)
- Green grass fills areas without path

SHOW 6 TILES in a 3x2 grid:
Row 1: NS-straight, EW-straight, NE-corner
Row 2: NW-corner, SE-corner, SW-corner

Path enters/exits at center of each edge for seamless connection.

Background: white or light gray.${customDetails ? `\n\n${customDetails}` : ''}`;
    }

    // Grass reference
    if (terrainType === 'grass') {
        return `Create a GRASS TILE for an isometric game.

TILE SHAPE: Diamond (rhombus), 2:1 ratio.

Simple green grass with subtle texture. Seamless tiling.

Background: white or light gray.${customDetails ? `\n\n${customDetails}` : ''}`;
    }

    throw new Error(`No reference prompt for terrain type: ${terrainType}`);
}

// NPC/Vehicle directional sprite mappings
// When base character/vehicle reference is approved, auto-generate all direction variants
const DIRECTIONAL_SPRITE_VARIANTS = {
    // Pedestrian: 2 animation frames (can be rotated/flipped for any direction in-game)
    // These become {refAssetKey}_walk_1, {refAssetKey}_walk_2 (e.g., pedestrian_walk_1)
    pedestrian: ['walk_1', 'walk_2'],

    // Car: 1 top-down sprite (can be rotated in-game for any direction)
    // Becomes {refAssetKey}_sprite (e.g., car_sedan_sprite)
    car: ['sprite']
};

/**
 * Build prompt for terrain tile sprite - SIMPLIFIED
 */
function buildTerrainPrompt(terrainType, customDetails = '') {
    // Get the tile description
    const tileDesc = ROAD_TILE_DESCRIPTIONS[terrainType] ||
                     DIRT_TILE_DESCRIPTIONS[terrainType] ||
                     WATER_TILE_DESCRIPTIONS[terrainType] ||
                     terrainType;

    // Road tiles - SQUARE with horizontal/vertical roads (top-down with subtle 3D)
    if (terrainType.startsWith('road_')) {
        return `${tileDesc}

Match the attached reference image EXACTLY - same road width, same sidewalk width, same colors. Road must connect seamlessly when tiles placed together.${customDetails ? `\n\n${customDetails}` : ''}`;
    }

    // Dirt tiles
    if (terrainType.startsWith('dirt_')) {
        return `Create a single DIRT PATH TILE for an isometric game: ${terrainType}

SHAPE: Diamond (rhombus), 128x64 pixels, transparent background.

STYLE: Brown dirt path (40% width) through green grass.
Match the approved dirt reference exactly.

THIS TILE: ${tileDesc}

Path enters/exits at the CENTER of each connecting edge.${customDetails ? `\n\n${customDetails}` : ''}`;
    }

    // Water tiles
    if (terrainType.startsWith('water_')) {
        return `Create a single WATER TILE for an isometric game: ${terrainType}

SHAPE: Diamond (rhombus), 128x64 pixels, transparent background.

STYLE: Blue water with ripples. Sandy shore where water meets land.
Match the approved water reference exactly.

THIS TILE: ${tileDesc}${customDetails ? `\n\n${customDetails}` : ''}`;
    }

    // Grass tile
    if (terrainType === 'grass_tile') {
        return `Create a single GRASS TILE for an isometric game.

SHAPE: Diamond (rhombus), 128x64 pixels, transparent background.

Simple green grass with subtle texture. Seamless tiling.${customDetails ? `\n\n${customDetails}` : ''}`;
    }

    throw new Error(`Unknown terrain type: ${terrainType}`);
}

// ============================================================================
// BUILDING SPRITE (GAME-READY) - Different from reference sheets
// ============================================================================

const BUILDING_SIZE_CLASSES = {
    claim_stake: { canvas: '64x64', class: 'TINY', default_map_scale: 0.2 },
    demolished: { canvas: '128x128', class: 'SHORT', default_map_scale: 0.4 },
    market_stall: { canvas: '128x128', class: 'SHORT', default_map_scale: 0.4 },
    hot_dog_stand: { canvas: '128x128', class: 'SHORT', default_map_scale: 0.4 },
    campsite: { canvas: '128x128', class: 'SHORT', default_map_scale: 0.4 },
    shop: { canvas: '192x192', class: 'MEDIUM', default_map_scale: 0.6 },
    burger_bar: { canvas: '192x192', class: 'MEDIUM', default_map_scale: 0.6 },
    motel: { canvas: '192x192', class: 'MEDIUM', default_map_scale: 0.6 },
    high_street_store: { canvas: '256x256', class: 'TALL', default_map_scale: 0.8 },
    restaurant: { canvas: '256x256', class: 'TALL', default_map_scale: 0.8 },
    manor: { canvas: '256x256', class: 'TALL', default_map_scale: 0.8 },
    police_station: { canvas: '256x256', class: 'TALL', default_map_scale: 0.8 },
    casino: { canvas: '320x320', class: 'VERY_TALL', default_map_scale: 1.0 },
    temple: { canvas: '320x320', class: 'VERY_TALL', default_map_scale: 1.0 },
    bank: { canvas: '320x320', class: 'VERY_TALL', default_map_scale: 1.0 }
};

// ============================================
// SPRITE OUTPUT SIZES (Tiered by category)
// All sprites are resized to these dimensions on output
// ============================================

const SPRITE_OUTPUT_SIZES = {
    building_sprite: 512,     // All sprites now 512px for max quality
    effect: 512,              // Match building size for overlays
    terrain: 512,             // Standardized to 512
    terrain_grass_bg: 512,    // grass_bg is a 512x512 seamless tile
    vehicle: 512,             // Standardized to 512
    npc: 512,                 // Standardized to 512
    overlay: 512,             // Standardized to 512
    ui: 512,                  // Standardized to 512
    dirty_trick_icon: 512,    // Icon shown in attack modal UI
    dirty_trick_overlay: 512  // Overlay shown on damaged buildings
};

// ============================================
// DEFAULT MAP SCALES (For game client rendering)
// ============================================

const DEFAULT_MAP_SCALES = {
    building_sprite: 1.0,  // Per-building overrides in BUILDING_SIZE_CLASSES
    effect: 1.0,
    terrain: 1.0,
    vehicle: 0.4,
    npc: 0.1,
    overlay: 0.4,
    ui: 0.2,
    dirty_trick_icon: 1.0,    // UI icons don't need map scaling
    dirty_trick_overlay: 0.5  // Building overlays at half scale
};

// Terrain tile dimensions (isometric diamond)
const TERRAIN_DIMENSIONS = { width: 64, height: 32 };

/**
 * Build prompt for building game sprite (references the approved ref sheet)
 */
function buildBuildingSpritePrompt(buildingType, customDetails = '') {
    const buildingName = buildingType.replace(/_/g, ' ').toUpperCase();
    const sizeInfo = BUILDING_SIZE_CLASSES[buildingType];
    const features = BUILDING_FEATURES[buildingType];

    if (!sizeInfo) {
        throw new Error(`No size class defined for building type: ${buildingType}`);
    }

    return `Create a ${buildingName} sprite for a tile-based city builder game.

=== VIEWING ANGLE ===

You are looking at the building from street level, slightly elevated.
- The FRONT of the building faces the BOTTOM-LEFT corner of the image
- The front face is the dominant feature - this is what you see most of
- A hint of the RIGHT SIDE is visible, giving depth
- A hint of the ROOF is visible, showing you're looking slightly down

Think: standing on a street corner, looking at a building across the intersection.

=== CANVAS & PLACEMENT ===

- Square canvas: ${sizeInfo.canvas}px × ${sizeInfo.canvas}px
- Building fills the canvas edge-to-edge
- Front corner near bottom-left, back corner near top-right

=== CRITICAL RULES ===

NO GROUND OR BASE:
- Transparent background only
- NO floor, platform, shadow blob, or tile underneath
- The building floats - walls go straight to transparency
- These sprites tile on a map, any base would break the tiling

ENTRANCE:
- Main door/entrance on the FRONT FACE (facing bottom-left)
- Clearly visible and recognizable

THE ${buildingName}:
${features || customDetails || 'A distinctive building of this type.'}

STYLE: Pixar in 2050 - chunky, geometric, slightly exaggerated shapes with ultra-modern photorealistic rendering. Soft lighting, perfect materials, inviting and polished.

${customDetails ? `NOTES: ${customDetails}` : ''}`;
}

// ============================================================================
// EFFECT OVERLAYS (Dirty Tricks, Damage, Status)
// ============================================================================

const EFFECT_FEATURES = {
    // Dirty trick effects
    fire: `Bright orange and yellow flames rising upward. Dark smoke plumes billowing. Glowing embers floating. Heat distortion suggestion. Flickering fire tongues at different heights. ARSON attack effect.`,

    cluster_bomb: `Multiple smoke plumes and fire bursts scattered across the footprint. Grey dust clouds. Sparks flying. Scorch marks. Multiple impact points suggesting explosive damage.`,

    vandalism: `Spray paint marks in bright colors (floating, not on surface). Generic trash and debris scattered. Broken glass shards floating. Graffiti suggestion without readable text.`,

    robbery: `Broken glass shards. Open/damaged door imagery. Scattered papers and debris. Flashlight beams. Signs of forced entry.`,

    poisoning: `Green toxic clouds floating. Wilted/dying plant elements. Bubbling green puddles. Toxic fumes rising. Sickly color palette.`,

    blackout: `Darkness overlay with electrical sparks. Broken light elements. Blue electrical arcs. Flickering/failing light suggestion.`,

    smoke_bomb: `Thick billowing smoke clouds in gray and white. Puffy cartoon-style clouds expanding outward. Wisps and tendrils drifting. Semi-transparent layers. Smoke rising upward and spreading. Classic smoke bomb poof effect.`,

    stink_bomb: `Green and yellow tinted stink clouds. Wavy stink lines rising upward. Cartoon-style odor waves. Small flies buzzing around. Sickly green vapor wisps. Comic book style "stench" effect. Puffy toxic-looking clouds.`,

    destruction_bomb: `Massive explosion with huge fireball. Intense orange and red flames. Thick black smoke columns. Large debris field with chunks flying outward. Shockwave rings. Extreme scorch marks. Heavy sparks and embers everywhere. Maximum devastation effect.`,

    graffiti: `Spray paint tags and street art marks. Bright neon colors (pink, green, blue, orange). Dripping paint effects. Abstract shapes and squiggles. Floating spray paint cans. Paint splatters and overspray. Urban street art vandalism aesthetic.`,

    // Damage levels
    damage_25: `Light damage - scattered dust and small debris particles. Thin wisps of smoke. Minor scuff marks. A few floating broken glass shards. Subtle wear.`,

    damage_50: `Medium damage - more prominent dust clouds and debris. Multiple smoke wisps. Larger floating debris (generic gray rubble). Scorch marks and soot patches. Structural warping suggestion.`,

    damage_75: `Heavy damage - heavy dust and smoke clouds. Thick smoke columns. Significant floating debris field. Large scorch marks. Sparks and embers. Structural collapse suggestion. Near-destruction state.`,

    // Status indicators
    for_sale: `Small wooden or metal sign post with hanging "FOR SALE" placard. Red and white coloring. Classic real estate sign style. 24x24 pixel detail level.`,

    security: `Shield shape with checkmark or lock symbol, OR small security camera. Blue and silver coloring. Protective, secure feeling. 24x24 pixel detail level.`
};

/**
 * Build prompt for effect overlay generation
 */
function buildEffectPrompt(effectType, customDetails = '') {
    const effectName = effectType.replace(/_/g, ' ').toUpperCase();
    const features = EFFECT_FEATURES[effectType];

    const isSmallIcon = ['for_sale', 'security'].includes(effectType);

    if (!features) {
        throw new Error(`No features defined for effect type: ${effectType}. Provide customDetails.`);
    }

    if (isSmallIcon) {
        return `Create a small status indicator icon: ${effectName}.

FORMAT REQUIREMENTS:
- Small icon with slight 3D perspective
- Background: TRANSPARENT (PNG with alpha channel)
- Size: Small icon, approximately 24x24 pixels worth of detail
- Purpose: Positioned at corner of building tile

THE ICON:
${features}

${STYLE_GUIDE}

${STYLE_REFERENCE_ANCHOR}

${customDetails ? `ADDITIONAL NOTES:\n${customDetails}` : ''}`;
    }

    // Dirty trick / damage effect overlay
    return `Create a TRANSPARENT OVERLAY for a building: ${effectName} EFFECT.

=== THIS IS AN OVERLAY IMAGE WITH TRANSPARENT BACKGROUND ===
This image will be placed ON TOP OF any building sprite to show the effect is happening to that building.
Think: A layer in Photoshop that sits above the building layer.

FORMAT REQUIREMENTS:
- 45-degree isometric view matching the building sprite angle
- Background: COMPLETELY TRANSPARENT (PNG with alpha channel, NO solid color background)
- Canvas: Square canvas, same size as building sprites (e.g., 256x256 or 320x320)
- Output: PNG with transparency - only the effect elements visible, background is see-through

PURPOSE:
- This overlay is placed directly ON TOP of a building
- The building shows through the transparent areas
- The effect (fire, smoke, etc.) appears to be happening TO the building
- Same overlay works on restaurants, banks, temples, shacks - any building

THE EFFECT ELEMENTS (floating on transparent background, NO BUILDING):
${features}

CRITICAL RULES:
- ABSOLUTELY NO BUILDING in this image
- NO ground, NO base, NO platform, NO background color
- Background must be TRANSPARENT (alpha channel = 0), not any solid color
- ONLY show fire, smoke, sparks, debris, effects floating on transparency
- Effects should fill the canvas appropriately to cover a building when overlaid
- Effects must be universal - work on wooden shack OR stone temple
- NO building materials (no bricks, no wood, no concrete)

CENTERING:
- Center the effect on the canvas
- When overlaid on a centered building, the effect should align

${STYLE_GUIDE}

${STYLE_REFERENCE_ANCHOR}

${customDetails ? `ADDITIONAL NOTES:\n${customDetails}` : ''}`;
}

// ============================================================================
// SCENE ILLUSTRATIONS
// ============================================================================

const SCENE_FEATURES = {
    // Background scenes (no character slot needed)
    arrest_bg: `Exterior scene - street or building entrance at dusk/night. Police lights (blue/red) illuminating the area. Dramatic lighting. Space in center-foreground for character placement.`,

    court_bg: `Courtroom interior. Judge's bench visible. Wooden courtroom furniture. High ceilings. Formal, imposing legal atmosphere. Scales of justice optional. Space in foreground for defendant.`,

    prison_bg: `Prison cell interior. Concrete/brick walls. Bars visible (cell door or window). Basic bunk bed. Harsh institutional lighting. Confined, punishing atmosphere. Space for prisoner.`,

    hero_bg: `Celebration scene - could be yacht deck, tropical beach, or mansion terrace. Bright, sunny, successful atmosphere. Confetti elements optional. Space for triumphant character.`,

    bank_interior_bg: `Grand bank interior. Marble floors and columns. Teller windows/counters. High ceilings. Vault door in background. Brass fixtures. Wealthy, institutional atmosphere.`,

    temple_interior_bg: `Peaceful temple interior. Soft light filtering through windows or from candles. Altar/shrine area. Wooden beams. Spiritual, contemplative atmosphere.`,

    offshore_bg: `Tropical paradise with hidden wealth. Palm trees, crystal blue water, white sand. Small elegant bank building among palms. Secretive luxury.`,

    dirty_trick_bg: `Nighttime urban scene. Shadowy alley or building exterior. Dramatic noir lighting - moonlight, shadows, streetlamp. Suspenseful atmosphere.`,

    // Foreground layers (for compositing over character)
    arrest_fg: `Police officer arms/hands reaching to grab/escort. Handcuffs visible. Dramatic angle. MUST have transparent center for character placement.`,

    prison_fg: `Prison bars in foreground. Institutional frame elements. MUST have transparent center for character placement behind bars.`,

    hero_fg: `Champagne bottle/glass being raised. Confetti falling. Celebratory hands. MUST have transparent center for character placement.`,

    dirty_trick_fg: `Shadowy hands holding spray can, lighter, or suspicious package. Noir lighting. MUST have transparent center for character placement.`
};

/**
 * Build prompt for scene illustration generation
 */
function buildScenePrompt(sceneType, customDetails = '') {
    const sceneName = sceneType.replace(/_/g, ' ').toUpperCase();
    const features = SCENE_FEATURES[sceneType];
    const isForeground = sceneType.endsWith('_fg');
    const isBackground = sceneType.endsWith('_bg');

    if (!features) {
        throw new Error(`No features defined for scene type: ${sceneType}. Provide customDetails.`);
    }

    return `Create a scene ${isForeground ? 'FOREGROUND layer' : 'BACKGROUND'} illustration: ${sceneName}.

FORMAT REQUIREMENTS:
- Aspect ratio: 16:9 widescreen (1920x1080, will be resized to 1280x720)
- ${isForeground ? 'Background: TRANSPARENT - this is a foreground layer for compositing' : 'Full scene with complete background'}
- Purpose: ${isForeground ? 'Composited OVER character avatar in scene' : 'Background layer, character avatar composited on top'}

THE SCENE:
${features}

CHARACTER INTEGRATION:
${isForeground
    ? '- Leave transparent center area where character will be placed BEHIND this layer'
    : '- Leave clear space in the composition where a character avatar will be placed ON TOP'}
- Characters in this game are chunky 90s CGI style - match that aesthetic

${STYLE_GUIDE}

${STYLE_REFERENCE_ANCHOR}

CRITICAL:
- Country-neutral (no flags, national symbols, specific currency)
- Match the 90s CGI aesthetic from building reference sheets
- ${isForeground ? 'Transparent background with elements only at edges/corners' : 'Complete background scene'}

${customDetails ? `ADDITIONAL NOTES:\n${customDetails}` : ''}`;
}

// ============================================================================
// NPC SPRITES (Pedestrians and Vehicles)
// ============================================================================

const NPC_FEATURES = {
    // === PEDESTRIAN DIRECTIONAL WALK CYCLES ===
    // Each direction gets 2 separate sprites (frame 1 and frame 2) for walk animation
    // Frame 1: Left foot forward, right foot back
    // Frame 2: Right foot forward, left foot back
    // Game alternates between frames to create walking animation
    // VIEW: TOP-DOWN OVERHEAD (bird's eye view looking straight down)
    //
    // CHARACTER PROPORTIONS (CRITICAL - NOT ROBLOX/CHIBI):
    // - Normal human proportions (7-8 heads tall), NOT blocky or stubby
    // - 90s CGI means slightly simplified geometry, NOT deformed proportions
    // - Think Toy Story humans, Incredibles civilians - realistic proportions with stylized rendering
    // - Arms and legs are normal length, NOT short stumpy limbs
    // - Head is normal size relative to body, NOT oversized

    // Pedestrian walk sprites - only 2 frames needed, game rotates/flips for direction
    walk_1: `SINGLE SPRITE: 32x32 pixels.
TOP-DOWN OVERHEAD VIEW (bird's eye, looking straight down from above).
Pedestrian walking. Top of head and shoulders visible from above.
FRAME 1 of walk cycle: Right leg forward, left leg back - mid-stride pose.
Business casual clothing visible from above. Right arm back, left arm forward (opposite to legs).
90s CGI stylized rendering. NOT isometric, NOT angled - pure top-down overhead view.
This sprite will be rotated in-game for different walking directions.`,

    walk_2: `SINGLE SPRITE: 32x32 pixels.
TOP-DOWN OVERHEAD VIEW (bird's eye, looking straight down from above).
Pedestrian walking. Top of head and shoulders visible from above.
FRAME 2 of walk cycle: Left leg forward, right leg back - opposite mid-stride pose.
Business casual clothing visible from above. Left arm back, right arm forward (opposite to legs).
90s CGI stylized rendering. NOT isometric, NOT angled - pure top-down overhead view.
This sprite will be rotated in-game for different walking directions.`,

    // === CAR SPRITE ===
    // Single top-down sprite that can be rotated in-game for any direction
    // VIEW: TOP-DOWN OVERHEAD (bird's eye view looking straight down)
    sprite: `SINGLE SPRITE: 32x32 pixels.
TOP-DOWN OVERHEAD VIEW (bird's eye, looking straight down from above).
Car pointing UP (toward top of screen). Roof and hood visible from above, front of car at top.
Chunky, toy-like 90s proportions. No brand markings.
90s CGI stylized rendering. NOT isometric, NOT angled - pure top-down overhead view.
This sprite will be rotated in-game for different driving directions.`,

    // === LEGACY AND ADDITIONAL PEDESTRIAN TYPES ===
    // All pedestrians use REALISTIC human proportions (7-8 heads tall), NOT blocky/Roblox style
    pedestrian_walk: `4-frame walk cycle sprite strip. REALISTIC human proportions (7-8 heads tall). Business casual clothing. Walking pose from side view. Each frame shows different leg position. Generic adult pedestrian. NOT blocky, NOT Roblox-style.`,

    pedestrian_stand: `Standing idle pose. REALISTIC human proportions (7-8 heads tall). Business casual clothing. Neutral standing position. Could have subtle idle animation frames. NOT blocky, NOT Roblox-style.`,

    pedestrian_suit: `4-frame walk cycle. REALISTIC human proportions (7-8 heads tall). Character in business suit. Professional appearance. Briefcase optional. Corporate worker type. NOT blocky, NOT Roblox-style.`,

    pedestrian_casual: `4-frame walk cycle. REALISTIC human proportions (7-8 heads tall). Character in casual clothes. Relaxed appearance. Everyday citizen type. NOT blocky, NOT Roblox-style.`,

    pedestrian_business: `4-frame walk cycle sprite strip (128x32 = 4 frames of 32x32 side by side).
REALISTIC human proportions (7-8 heads tall like a real adult). Professional business attire - suit, tie, polished shoes.
Walking pose from isometric 45-degree view. Each frame shows different leg position in the walk cycle.
Frame 1: Right foot forward, left foot back
Frame 2: Feet together, upright
Frame 3: Left foot forward, right foot back
Frame 4: Feet together, upright
Corporate businessman/businesswoman type. Briefcase optional.
NOT blocky, NOT stubby, NOT Roblox-style. Normal adult human body with 90s CGI stylized rendering.`,

    car_sedan: `Generic sedan car from TOP-DOWN OVERHEAD VIEW (bird's eye, looking straight down).
Chunky, slightly toy-like 90s proportions. Solid neutral color (gray, blue, or silver). No brand markings.
NOT isometric, NOT angled - pure top-down overhead view.`,

    car_police: `Police car from TOP-DOWN OVERHEAD VIEW (bird's eye, looking straight down).
Black and white police livery. Light bar on roof visible from above. "POLICE" text on roof if visible.
Chunky, toy-like 90s proportions. Classic police cruiser shape.
NOT isometric, NOT angled - pure top-down overhead view.`,

    car_sports: `Sports car from TOP-DOWN OVERHEAD VIEW (bird's eye, looking straight down).
Sleek but chunky 90s CGI style. Bold color (red or yellow). No brand markings.
NOT isometric, NOT angled - pure top-down overhead view.`,

    car_van: `Delivery/utility van from TOP-DOWN OVERHEAD VIEW (bird's eye, looking straight down).
Boxy, chunky proportions. White or neutral color. No brand text.
NOT isometric, NOT angled - pure top-down overhead view.`,

    car_taxi: `Taxi cab from TOP-DOWN OVERHEAD VIEW (bird's eye, looking straight down).
Yellow with "TAXI" sign on roof visible from above. Chunky proportions. Generic taxi appearance.
NOT isometric, NOT angled - pure top-down overhead view.`
};

/**
 * Build prompt for NPC sprite generation
 */
function buildNPCPrompt(npcType, customDetails = '') {
    const npcName = npcType.replace(/_/g, ' ').toUpperCase();
    const features = NPC_FEATURES[npcType];

    // Detect sprite type for proper sizing
    // ped_walk_n_1, ped_walk_n_2, etc. - individual frames
    const isPedWalk = npcType.startsWith('ped_walk_');
    const isCarDirection = ['car_n', 'car_s', 'car_e', 'car_w'].includes(npcType);
    const isPedestrian = npcType.startsWith('pedestrian_') || isPedWalk;

    if (!features) {
        throw new Error(`No features defined for NPC type: ${npcType}. Provide customDetails.`);
    }

    // Size specifications based on type
    let sizeSpec;
    if (isPedWalk) {
        sizeSpec = 'Single sprite: 32x32 pixels (one animation frame)';
    } else if (isCarDirection) {
        sizeSpec = 'Single sprite: 32x32 pixels (one car facing specific direction)';
    } else if (isPedestrian) {
        sizeSpec = 'Sprite strip: 128x32 pixels (4 frames of 32x32 each) OR single 32x32 for idle';
    } else {
        sizeSpec = 'Single sprite: 64x32 pixels (fits road tile)';
    }

    // Direction info for directional sprites
    let directionNote = '';
    if (isPedWalk || isCarDirection) {
        // Extract direction from npcType (e.g., ped_walk_n_1 -> n, car_n -> n)
        const parts = npcType.split('_');
        let direction;
        if (isPedWalk) {
            // ped_walk_n_1 -> parts[2] = 'n'
            direction = parts[2].toUpperCase();
        } else {
            // car_n -> parts[1] = 'n'
            direction = parts[1].toUpperCase();
        }
        const directionMap = {
            'N': 'NORTH (toward top of screen)',
            'S': 'SOUTH (toward bottom of screen)',
            'E': 'EAST (toward right of screen)',
            'W': 'WEST (toward left of screen)'
        };
        directionNote = `\nDIRECTION: ${directionMap[direction] || direction}
- The ${isPedWalk ? 'character' : 'vehicle'} must be clearly facing/moving in the ${direction} direction
- TOP-DOWN OVERHEAD VIEW - looking straight down from above`;
    }

    return `Create an ambient NPC sprite: ${npcName}.

FORMAT REQUIREMENTS:
- TOP-DOWN OVERHEAD VIEW (bird's eye, looking straight down from above)
- ${sizeSpec}
- Background: TRANSPARENT (PNG-ready)
- Purpose: ${isPedestrian ? 'Pedestrians walking on sidewalks' : 'Vehicles driving on roads'}
${directionNote}

THE NPC:
${features}

${STYLE_GUIDE}

${STYLE_REFERENCE_ANCHOR}

CRITICAL:
- Match the chunky 90s CGI aesthetic from building reference sheets
- ${isPedestrian ? 'Character proportions should match the stocky, geometric style' : 'Vehicle should look toy-like and chunky, not realistic'}
- Country-neutral (no flags, specific national markings)
- NO external shadows
- Sprite must be CENTERED on the canvas

${customDetails ? `ADDITIONAL NOTES:\n${customDetails}` : ''}`;
}

// ============================================================================
// AVATAR ASSETS
// ============================================================================

const AVATAR_FEATURES = {
    // Base bodies
    base_standard: `Standard adult human body silhouette. Neutral standing pose, arms slightly away from body. Average/normal build. Stocky, geometric 90s CGI proportions.`,

    base_athletic: `Athletic adult human body silhouette. Broader shoulders, more muscular proportions. Neutral standing pose. Stocky, geometric 90s CGI proportions.`,

    // Hair styles
    hair_short: `Short, professional haircut. Neat and tidy. Dark brown/black. Chunky hair masses with subtle strand detail. Business-appropriate.`,

    hair_long: `Longer hair past ears, could reach shoulders. Styled but not overly formal. Dark brown/black. Chunky stylized masses.`,

    hair_mohawk: `Bold mohawk hairstyle. Spiked up center, shaved sides. Could be bold color. Punk/rebellious. Exaggerated chunky spikes.`,

    hair_bald: `Bald/shaved head. Smooth scalp with subtle skin texture. Clean, professional appearance.`,

    hair_slicked: `Slicked back hair. Shiny, product-styled. Professional businessman look. Dark color with highlights.`,

    hair_curly: `Curly/wavy hair. Chunky stylized curls. Medium length. Natural, slightly wild appearance.`,

    // Outfits
    outfit_suit: `Professional business suit. Dark gray or navy jacket and trousers. White dress shirt, tie. Classic corporate attire.`,

    outfit_casual: `Casual everyday clothes. Polo shirt and chinos, or button-down with jeans. Relaxed but presentable. Earth tones.`,

    outfit_flashy: `Flashy, expensive-looking outfit. Bright colors or patterns. Gold accessories. Showing off wealth.`,

    outfit_street: `Street style clothing. Hoodie, sneakers, urban fashion. Relaxed, youthful appearance.`,

    outfit_gold_legendary: `LEGENDARY: Extraordinary golden suit. Shimmering metallic gold fabric. Luxurious, ostentatious. Sparkle effects. "I made it" appearance.`,

    outfit_prison: `Prison jumpsuit. Orange or striped. Simple, institutional. Disheveled appearance.`,

    outfit_tropical: `Hawaiian shirt, shorts, sandals. Vacation/retirement attire. Relaxed, wealthy retiree look.`,

    outfit_formal: `Black tie formal wear. Tuxedo or evening gown equivalent. Elegant, high-class event attire.`,

    // Headwear
    headwear_tophat: `Classic tall top hat. Black with band. Formal, old-money wealthy appearance.`,

    headwear_cap: `Casual baseball cap. Curved brim forward. Solid color. Relaxed, sporty.`,

    headwear_fedora: `Fedora hat. Classic gangster/noir style. Dark color with band.`,

    headwear_crown_legendary: `LEGENDARY: Magnificent royal crown. Gold with jewels (rubies, sapphires, emeralds). Ornate metalwork. Regal, ultimate status symbol.`,

    headwear_hardhat: `Construction hard hat. Yellow or white. Working class, builder appearance.`,

    headwear_beanie: `Knit beanie hat. Casual, urban style. Solid color.`,

    // Accessories
    accessory_sunglasses: `Cool sunglasses. Dark lenses with reflection. Aviator or wayfarer style. Confident appearance.`,

    accessory_watch: `Luxury wristwatch. Metal band (silver or gold). Expensive, successful businessman accessory.`,

    accessory_cigar: `Lit cigar. Smoke wisping upward. Power/wealth symbol. Boss imagery.`,

    accessory_briefcase: `Professional briefcase. Leather, classic style. Business equipment.`,

    accessory_chain: `Gold chain necklace. Chunky, visible. Wealth display.`,

    accessory_earring: `Earring (stud or small hoop). Subtle jewelry accent.`,

    // Backgrounds
    background_city: `City skyline at dusk/golden hour. Multiple skyscraper silhouettes. Warm sky gradient. Urban, successful, metropolitan.`,

    background_office: `Executive office interior. Large window with city view. Bookshelf, desk edge, wood paneling. Professional corporate.`,

    background_mansion: `Mansion exterior or interior. Grand architecture. Wealth and success backdrop.`,

    background_prison: `Prison cell or yard. Institutional, consequence backdrop. Gray, confined atmosphere.`
};

/**
 * Build prompt for avatar asset generation
 */
function buildAvatarPrompt(avatarType, customDetails = '') {
    const avatarName = avatarType.replace(/_/g, ' ').toUpperCase();
    const features = AVATAR_FEATURES[avatarType];

    const category = avatarType.split('_')[0]; // base, hair, outfit, headwear, accessory, background
    const isBackground = category === 'background';
    const isLegendary = avatarType.includes('_legendary');

    if (!features) {
        throw new Error(`No features defined for avatar type: ${avatarType}. Provide customDetails.`);
    }

    let layerInstructions;
    switch (category) {
        case 'base':
            layerInstructions = 'BASE LAYER - underlying body shape. Show as neutral gray (skin applied separately). Must align with all other layers.';
            break;
        case 'hair':
            layerInstructions = 'HAIR LAYER - overlays on head position. Must align with base body head position.';
            break;
        case 'outfit':
            layerInstructions = 'OUTFIT LAYER - covers torso, arms, legs. Leave face and hands exposed for skin layer.';
            break;
        case 'headwear':
            layerInstructions = 'HEADWEAR LAYER - sits on/replaces visible hair. Must align with head position.';
            break;
        case 'accessory':
            layerInstructions = 'ACCESSORY LAYER - small addition to face/body. Must align with appropriate body part.';
            break;
        case 'background':
            layerInstructions = 'BACKGROUND LAYER - full coverage, no transparency. Character layers composite on top.';
            break;
        default:
            layerInstructions = 'Layer must align with base body for proper compositing.';
    }

    return `Create an avatar ${category.toUpperCase()} layer: ${avatarName}.

FORMAT REQUIREMENTS:
- Front-facing character view
- Canvas: 512x512 pixels SQUARE
- Background: ${isBackground ? 'Full coverage (this IS the background)' : 'TRANSPARENT (PNG-ready)'}
- Purpose: ${layerInstructions}

THE ASSET:
${features}

${isLegendary ? `
LEGENDARY RARITY:
This is a LEGENDARY tier item - make it look SPECIAL, RARE, and DESIRABLE.
- Premium quality rendering
- Extra visual flair (sparkles, glow, metallic effects)
- Should stand out as obviously high-value
` : ''}

${STYLE_GUIDE}

${STYLE_REFERENCE_ANCHOR}

CRITICAL:
- Match the chunky, stocky 90s CGI character proportions from reference sheets
- All avatar layers must align perfectly for compositing
- ${isBackground ? 'Fill entire canvas as background scene' : 'Transparent background, only the specific element visible'}
- Country-neutral, gender-appropriate

${customDetails ? `ADDITIONAL NOTES:\n${customDetails}` : ''}`;
}

// ============================================================================
// UI ELEMENTS
// ============================================================================

const UI_FEATURES = {
    minimap_player: `Small bright GREEN dot or diamond shape. Solid, highly visible. Simple geometric. Subtle glow optional. 8x8 pixels.`,

    minimap_enemy: `Small bright RED dot or diamond shape. Solid, highly visible. Simple geometric. Clearly different from green player marker. 8x8 pixels.`,

    cursor_select: `Glowing diamond outline that surrounds an isometric tile. Bright yellow, white, or cyan edge glow. Just the outline - no fill (or very subtle semi-transparent fill). 68x36 pixels.`
};

/**
 * Build prompt for UI element generation
 */
function buildUIPrompt(uiType, customDetails = '') {
    const uiName = uiType.replace(/_/g, ' ').toUpperCase();
    const features = UI_FEATURES[uiType];

    if (!features) {
        throw new Error(`No features defined for UI type: ${uiType}. Provide customDetails.`);
    }

    return `Create a UI element: ${uiName}.

FORMAT REQUIREMENTS:
- Background: TRANSPARENT (PNG-ready)
- ${features}

PURPOSE:
${uiType.startsWith('minimap_') ? 'Shows player/enemy positions on the minimap. Must be highly visible at tiny size.' : 'Highlights currently selected/hovered tile on the game map.'}

STYLE:
- Clean, simple, easily distinguishable
- Bright enough to be visible over any terrain or building
- Smooth anti-aliased edges

${STYLE_REFERENCE_ANCHOR}

${customDetails ? `ADDITIONAL NOTES:\n${customDetails}` : ''}`;
}

// ============================================================================
// OWNERSHIP OVERLAYS
// ============================================================================

/**
 * Build prompt for overlay generation (ownership, claim stakes, etc.)
 */
function buildOverlayPrompt(overlayType, customDetails = '') {
    // Claim stake / land marker
    if (overlayType === 'claim_stake') {
        return `Create a CLAIM STAKE marker for purchased but unbuilt land.

FORMAT REQUIREMENTS:
- Size: 64x64 pixels
- Background: TRANSPARENT (PNG-ready)
- Isometric 45-degree view

THE STAKE:
- Wooden stake/post driven into the ground at center
- Small "SOLD" or "CLAIMED" sign hanging from it (or just a flag)
- Simple rope or ribbon tied to the stake
- Visible from isometric view, stake is vertical, sign faces camera

STYLE: 90s CGI aesthetic (chunky geometric shapes, photorealistic textures)
- Simple wooden post with grain texture
- Weathered but sturdy appearance
- Clear visual indicator that this land is owned

${customDetails ? `ADDITIONAL NOTES:\n${customDetails}` : ''}`;
    }

    // Ownership color overlays
    const isPlayerOwned = overlayType === 'owned_self';
    const color = isPlayerOwned ? 'GREEN (#22c55e)' : 'RED (#ef4444)';
    const meaning = isPlayerOwned ? 'player-owned' : 'enemy-owned';

    return `Create an ownership overlay: ${overlayType.toUpperCase().replace(/_/g, ' ')}.

FORMAT REQUIREMENTS:
- Diamond/rhombus shape matching tile footprint
- Size: 64x32 pixels (same as terrain tile)
- Background: TRANSPARENT (PNG-ready)
- Opacity: 30-40% semi-transparent

THE OVERLAY:
- Solid ${color} color fill of the diamond shape
- Semi-transparent to show terrain/building underneath
- Indicates this tile is ${meaning}

STYLE:
- Clean geometric diamond shape
- Consistent with isometric tile grid
- Simple color overlay, no gradients or effects needed

${customDetails ? `ADDITIONAL NOTES:\n${customDetails}` : ''}`;
}

// ============================================================================
// MASTER PROMPT BUILDER - Routes to correct category builder
// ============================================================================

/**
 * Build the appropriate prompt based on asset category
 * @param {string} category - Asset category (building_ref, terrain, effect, etc.)
 * @param {string} assetKey - Specific asset identifier
 * @param {string} customDetails - Additional prompt details
 * @returns {string} Complete prompt for Gemini
 */
function buildAssetPrompt(category, assetKey, customDetails = '') {
    switch (category) {
        // === REFERENCE SHEETS (generate first, approve, then make sprites) ===
        case 'building_ref':
            return buildBuildingRefPrompt(assetKey, customDetails);

        case 'character_ref':
            return buildCharacterRefPrompt(assetKey, customDetails);

        case 'vehicle_ref':
            return buildVehicleRefPrompt(assetKey, customDetails);

        case 'effect_ref':
            return buildEffectRefPrompt(assetKey, customDetails);

        case 'terrain_ref':
            return buildTerrainRefPrompt(assetKey, customDetails);

        // === SPRITES (generated from approved reference sheets) ===
        case 'building_sprite':
            return buildBuildingSpritePrompt(assetKey, customDetails);

        case 'terrain':
            return buildTerrainPrompt(assetKey, customDetails);

        case 'effect':
            return buildEffectPrompt(assetKey, customDetails);

        case 'scene':
            return buildScenePrompt(assetKey, customDetails);

        case 'npc':
            return buildNPCPrompt(assetKey, customDetails);

        case 'avatar':
            return buildAvatarPrompt(assetKey, customDetails);

        case 'ui':
            return buildUIPrompt(assetKey, customDetails);

        case 'overlay':
            return buildOverlayPrompt(assetKey, customDetails);

        default:
            // For unknown categories, require a custom prompt
            if (!customDetails) {
                throw new Error(`Unknown category "${category}". Provide a custom prompt.`);
            }
            // Wrap custom prompt with style guide
            return `${customDetails}

${STYLE_GUIDE}

${STYLE_REFERENCE_ANCHOR}`;
    }
}

// ============================================================================
// PROMPT TEMPLATE HELPERS
// Functions to fetch prompts from DB - NO FALLBACKS (fail explicitly to avoid wasting tokens)
// ============================================================================

/**
 * Get prompt for generation - checks DB ONLY, no hardcoded fallback
 * FAILS EXPLICITLY if no template exists - prevents wasting Gemini tokens on incorrect prompts
 * @param {Object} env - Worker environment
 * @param {string} category - Asset category
 * @param {string} assetKey - Asset key
 * @param {string} customDetails - Optional custom details to inject
 * @returns {Promise<string>} The complete prompt ready for generation
 * @throws {Error} If no template found in database
 */
async function getPromptForGeneration(env, category, assetKey, customDetails = '') {
    // 1. Try to get from database (specific asset key)
    let template = await env.DB.prepare(`
        SELECT base_prompt, style_guide, system_instructions
        FROM prompt_templates
        WHERE category = ? AND asset_key = ? AND is_active = TRUE
    `).bind(category, assetKey).first();

    // 2. Fall back to category default ONLY
    if (!template) {
        template = await env.DB.prepare(`
            SELECT base_prompt, style_guide, system_instructions
            FROM prompt_templates
            WHERE category = ? AND asset_key = '_default' AND is_active = TRUE
        `).bind(category).first();
    }

    // 3. NO HARDCODED FALLBACK - fail explicitly to avoid wasting Gemini tokens
    if (!template) {
        throw new Error(`No prompt template found for ${category}/${assetKey}. Run the seed migration (0027_seed_prompt_templates.sql) first.`);
    }

    // 4. Replace placeholders in template
    let prompt = template.base_prompt;

    // Replace common placeholders
    const buildingFeatures = BUILDING_FEATURES[assetKey] || '';
    prompt = prompt
        .replace(/{BUILDING_TYPE}/g, assetKey.replace(/_/g, ' ').toUpperCase())
        .replace(/{BUILDING_FEATURES}/g, buildingFeatures)
        .replace(/{CHARACTER_TYPE}/g, assetKey.replace(/_/g, ' ').toUpperCase())
        .replace(/{CHARACTER_FEATURES}/g, CHARACTER_REF_FEATURES[assetKey] || '')
        .replace(/{VEHICLE_TYPE}/g, assetKey.replace(/_/g, ' ').toUpperCase())
        .replace(/{VEHICLE_FEATURES}/g, VEHICLE_REF_FEATURES[assetKey] || '')
        .replace(/{EFFECT_TYPE}/g, assetKey.replace(/_/g, ' ').toUpperCase())
        .replace(/{EFFECT_FEATURES}/g, EFFECT_REF_FEATURES[assetKey] || EFFECT_FEATURES[assetKey] || '')
        .replace(/{TERRAIN_TYPE}/g, assetKey.replace(/_/g, ' ').toUpperCase())
        .replace(/{NPC_TYPE}/g, assetKey.replace(/_/g, ' ').toUpperCase())
        .replace(/{NPC_FEATURES}/g, NPC_FEATURES[assetKey] || '')
        .replace(/{AVATAR_TYPE}/g, assetKey.replace(/_/g, ' ').toUpperCase())
        .replace(/{AVATAR_FEATURES}/g, AVATAR_FEATURES[assetKey] || '')
        .replace(/{SCENE_TYPE}/g, assetKey.replace(/_/g, ' ').toUpperCase())
        .replace(/{SCENE_FEATURES}/g, SCENE_FEATURES[assetKey] || '')
        .replace(/{UI_TYPE}/g, assetKey.replace(/_/g, ' ').toUpperCase())
        .replace(/{UI_FEATURES}/g, UI_FEATURES[assetKey] || '')
        .replace(/{OVERLAY_TYPE}/g, assetKey.replace(/_/g, ' ').toUpperCase())
        .replace(/{SIZE_CLASS}/g, BUILDING_SIZE_CLASSES[assetKey]?.canvas || '256x256')
        .replace(/{CUSTOM_DETAILS}/g, customDetails || '');

    // Append style guide if present
    if (template.style_guide) {
        prompt += `\n\nSTYLE GUIDE:\n${template.style_guide}`;
    }

    // Prepend system instructions if present (critical for layout/camera/style)
    if (template.system_instructions) {
        prompt = template.system_instructions + '\n\n---\n\n' + prompt;
    }

    return prompt;
}

// ============================================================================
// ASSET DEPENDENCY CHECKING
// Some assets require other assets to be approved first
// ============================================================================

/**
 * Check if scene generation dependencies are met.
 * Scenes require avatar base assets to be approved for proper compositing testing.
 * Returns { canGenerate: boolean, missing: string[], message: string }
 */
async function checkSceneDependencies(env) {
    // Check for approved avatar base assets
    const avatarBase = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM generated_assets
        WHERE category = 'avatar' AND asset_key LIKE 'base_%' AND status = 'approved'
    `).first();

    const missing = [];

    if (!avatarBase || avatarBase.count === 0) {
        missing.push('Avatar base body (avatar/base_*)');
    }

    // Optionally check for other dependencies
    // We could also require buildings, effects, etc. to be done first
    // For now, just require avatar base for compositing testing

    if (missing.length > 0) {
        return {
            canGenerate: false,
            missing,
            message: `Scene generation blocked. Required assets not yet approved: ${missing.join(', ')}. Scenes need avatar assets for compositing.`
        };
    }

    return { canGenerate: true, missing: [], message: 'All dependencies met.' };
}

/**
 * Check if sprite generation has required reference sheet approved.
 * Building sprites need building_ref, NPC sprites need character_ref, etc.
 */
async function checkSpriteReferenceDependency(env, category, assetKey) {
    // Special handling for NPC category - cars use vehicle_ref, pedestrians use character_ref
    if (category === 'npc') {
        const isCarDirection = ['car_n', 'car_s', 'car_e', 'car_w'].includes(assetKey);
        const isPedDirection = assetKey.startsWith('ped_walk_');

        if (isCarDirection) {
            // Car directional sprites need any approved vehicle_ref starting with 'car'
            const ref = await env.DB.prepare(`
                SELECT id, status FROM generated_assets
                WHERE category = 'vehicle_ref' AND asset_key LIKE 'car%' AND status = 'approved'
                ORDER BY created_at DESC LIMIT 1
            `).first();

            if (!ref) {
                return {
                    canGenerate: false,
                    message: `No approved vehicle reference found for cars. Generate and approve a car vehicle_ref first (e.g., car_sedan).`
                };
            }
            return { canGenerate: true, referenceId: ref.id };
        }

        if (isPedDirection) {
            // Pedestrian directional sprites need any approved character_ref starting with 'pedestrian'
            const ref = await env.DB.prepare(`
                SELECT id, status FROM generated_assets
                WHERE category = 'character_ref' AND asset_key LIKE 'pedestrian%' AND status = 'approved'
                ORDER BY created_at DESC LIMIT 1
            `).first();

            if (!ref) {
                return {
                    canGenerate: false,
                    message: `No approved character reference found for pedestrians. Generate and approve a character_ref (pedestrian, pedestrian_business, or pedestrian_casual) first.`
                };
            }
            return { canGenerate: true, referenceId: ref.id };
        }

        // Legacy NPC types - no reference required
        return { canGenerate: true };
    }

    const refCategoryMap = {
        'building_sprite': 'building_ref',
        'effect': 'effect_ref'
    };

    const refCategory = refCategoryMap[category];
    if (!refCategory) {
        return { canGenerate: true }; // No reference needed
    }

    // Check if there's an approved reference for this asset_key
    const ref = await env.DB.prepare(`
        SELECT id, status FROM generated_assets
        WHERE category = ? AND asset_key = ? AND status = 'approved'
        ORDER BY created_at DESC LIMIT 1
    `).bind(refCategory, assetKey).first();

    if (!ref) {
        return {
            canGenerate: false,
            message: `No approved ${refCategory.replace('_', ' ')} found for "${assetKey}". Generate and approve a reference sheet first.`
        };
    }

    return { canGenerate: true, referenceId: ref.id };
}

// Gemini API helper - Uses Nano Banana Pro (gemini-3-pro-image-preview)
// referenceImages: array of { buffer: Uint8Array, mimeType: string, name: string }
// settings: { temperature, topK, topP, maxOutputTokens } - optional, uses defaults if not provided
async function generateWithGemini(env, prompt, referenceImages = [], settings = {}) {
    try {
        // Build the parts array - text prompt first, then optional reference images
        const parts = [{ text: prompt }];

        // Normalize to array (for backwards compatibility)
        const images = referenceImages
            ? (Array.isArray(referenceImages) ? referenceImages : [referenceImages])
            : [];

        // Add each reference image for Gemini to use as context
        for (const refImage of images) {
            if (!refImage || !refImage.buffer) continue;

            // Convert buffer to base64 (chunked to avoid stack overflow on large images)
            let base64Data = '';
            const bytes = refImage.buffer;
            const chunkSize = 8192;
            for (let i = 0; i < bytes.length; i += chunkSize) {
                const chunk = bytes.slice(i, i + chunkSize);
                base64Data += String.fromCharCode.apply(null, chunk);
            }
            base64Data = btoa(base64Data);

            parts.push({
                inlineData: {
                    mimeType: refImage.mimeType || 'image/png',
                    data: base64Data
                }
            });

            if (refImage.name) {
                console.log(`Added reference image: ${refImage.name} (${refImage.buffer.length} bytes)`);
            }
        }

        // Build generation config with configurable settings
        const generationConfig = {
            responseModalities: ['IMAGE', 'TEXT'],
            temperature: settings.temperature ?? 0.7,
            topK: settings.topK ?? 40,
            topP: settings.topP ?? 0.95
        };

        // Add maxOutputTokens if specified
        if (settings.maxOutputTokens) {
            generationConfig.maxOutputTokens = settings.maxOutputTokens;
        }

        // Add imageConfig for aspect ratio and image size (Gemini 3 Pro Image)
        // Must use uppercase K (1K, 2K, 4K)
        // Note: Gemini doesn't support numberOfImages - use sprite sheet approach for multiple frames
        if (settings.aspectRatio || settings.imageSize) {
            generationConfig.imageConfig = {};
            if (settings.aspectRatio) {
                generationConfig.imageConfig.aspectRatio = settings.aspectRatio;
            }
            if (settings.imageSize) {
                generationConfig.imageConfig.imageSize = settings.imageSize;
            }
        }

        console.log(`Calling Gemini with generationConfig:`, JSON.stringify(generationConfig));
        console.log(`Prompt length: ${prompt.length}, Reference images: ${images.length}`);

        // Build request body
        const requestBody = {
            contents: [{
                parts: parts
            }],
            generationConfig: generationConfig
        };

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${env.GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            }
        );

        if (!response.ok) {
            const error = await response.text();
            console.error('Gemini API error:', error);
            return { success: false, error: `Gemini API error: ${response.status} - ${error}` };
        }

        const data = await response.json();

        // Extract ALL images from response (supports numberOfImages > 1)
        const imageParts = data.candidates?.[0]?.content?.parts?.filter(p => p.inlineData) || [];
        if (imageParts.length === 0) {
            // Check for text response (might contain error or explanation)
            const textPart = data.candidates?.[0]?.content?.parts?.find(p => p.text);
            return {
                success: false,
                error: 'No image in response',
                modelResponse: textPart?.text || null
            };
        }

        // Convert all images to buffers
        const imageBuffers = imageParts.map(part => ({
            buffer: Uint8Array.from(atob(part.inlineData.data), c => c.charCodeAt(0)),
            mimeType: part.inlineData.mimeType
        }));

        const modelResponse = data.candidates?.[0]?.content?.parts?.find(p => p.text)?.text || null;

        // Return single image for backward compatibility, plus array for multi-image
        return {
            success: true,
            imageBuffer: imageBuffers[0].buffer,  // First image for backward compatibility
            mimeType: imageBuffers[0].mimeType,
            imageBuffers,  // All images when numberOfImages > 1
            imageCount: imageBuffers.length,
            modelResponse
        };

    } catch (error) {
        console.error('Gemini generation error:', error);
        return { success: false, error: error.message };
    }
}

// ============================================================================
// STAGE 4: ENHANCED GENERATION HELPERS
// ============================================================================

/**
 * Get default aspect ratio based on asset category
 * @param {string} category - Asset category
 * @returns {string} Default aspect ratio for the category
 */
function getDefaultAspectRatioForCategory(category) {
    // Reference sheets use 3:2 for 6-panel layout
    if (category?.endsWith('_ref')) {
        return '3:2';
    }
    // Scenes use 16:9 for widescreen
    if (category === 'scene') {
        return '16:9';
    }
    // All sprites and other assets use 1:1
    return '1:1';
}

/**
 * Validate and sanitize generation settings
 * Clamps values to valid ranges and records the model for reproducibility
 * @param {Object} settings - Raw settings from request
 * @param {string} category - Asset category (used for smart defaults)
 * @returns {Object} Validated settings with model name
 */
function validateGenerationSettings(settings = {}, category = null) {
    // Valid aspect ratios for Gemini image generation (per docs: 1:1, 3:4, 4:3, 9:16, 16:9)
    const validAspectRatios = ['1:1', '3:4', '4:3', '9:16', '16:9'];
    // Valid image sizes for Gemini 3 Pro
    const validImageSizes = ['1K', '2K', '4K'];

    // Get category-based defaults
    const defaultAspectRatio = getDefaultAspectRatioForCategory(category);
    const defaultImageSize = '4K';

    return {
        model: 'gemini-3-pro-image-preview',  // Always record model used for reproducibility
        temperature: Math.min(2.0, Math.max(0.0, settings.temperature ?? 0.7)),
        topK: Math.min(100, Math.max(1, Math.round(settings.topK ?? 40))),
        topP: Math.min(1.0, Math.max(0.0, settings.topP ?? 0.95)),
        maxOutputTokens: settings.maxOutputTokens || null,
        // Imagen-specific settings with smart defaults
        aspectRatio: validAspectRatios.includes(settings.aspectRatio) ? settings.aspectRatio : defaultAspectRatio,
        imageSize: validImageSizes.includes(settings.imageSize) ? settings.imageSize : defaultImageSize
    };
}

/**
 * Fetch reference images from library and approved assets
 * @param {Object} env - Worker environment
 * @param {Array} referenceSpecs - Array of { type: 'library' | 'approved_asset', id: number }
 * @returns {Promise<Array>} Array of { buffer: Uint8Array, mimeType: string, name: string }
 */
async function fetchReferenceImages(env, referenceSpecs = []) {
    const images = [];

    for (const spec of referenceSpecs) {
        try {
            let r2Key, name;

            if (spec.type === 'library') {
                // Fetch from reference_images table
                const refImage = await env.DB.prepare(`
                    SELECT r2_key, name FROM reference_images WHERE id = ? AND is_archived = FALSE
                `).bind(spec.id).first();

                if (!refImage) {
                    console.warn(`Reference image ${spec.id} not found or archived`);
                    continue;
                }
                r2Key = refImage.r2_key;
                name = refImage.name;

            } else if (spec.type === 'approved_asset') {
                // Fetch from generated_assets table
                // Prefer r2_url (public WebP - much smaller) over r2_key_private (raw PNG)
                const asset = await env.DB.prepare(`
                    SELECT r2_key_private, r2_url, asset_key, category FROM generated_assets
                    WHERE id = ? AND status = 'approved'
                `).bind(spec.id).first();

                if (!asset) {
                    console.warn(`Approved asset ${spec.id} not found`);
                    continue;
                }

                name = `${asset.category}/${asset.asset_key}`;

                // Try to use public WebP first (much smaller, ~100KB vs ~6MB)
                if (asset.r2_url) {
                    // Extract R2 key from URL: https://assets.notropolis.net/{key} -> {key}
                    const publicKey = asset.r2_url.replace(R2_PUBLIC_URL + '/', '');
                    const publicObject = await env.R2_PUBLIC.get(publicKey);
                    if (publicObject) {
                        const buffer = new Uint8Array(await publicObject.arrayBuffer());
                        images.push({
                            buffer,
                            mimeType: publicObject.httpMetadata?.contentType || 'image/webp',
                            name
                        });
                        console.log(`Fetched reference (public WebP): ${name} (${buffer.length} bytes)`);
                        continue;
                    }
                    console.warn(`Public asset not found: ${publicKey}, falling back to private`);
                }

                // Fall back to private raw PNG - resize if large
                if (asset.r2_key_private) {
                    try {
                        const resized = await fetchResizedReferenceImage(env, asset.r2_key_private, 1024);
                        images.push({
                            buffer: resized.buffer,
                            mimeType: resized.mimeType,
                            name
                        });
                        console.log(`Fetched reference (private, resized): ${name} (${resized.buffer.length} bytes)`);
                        continue;
                    } catch (err) {
                        console.error(`Failed to fetch/resize private asset: ${err.message}`);
                    }
                }

                console.warn(`No image found for approved asset ${spec.id}`);
                continue;
            } else {
                console.warn(`Unknown reference type: ${spec.type}`);
                continue;
            }

            // Fetch image from R2 (for library type only) - resize if large
            try {
                const resized = await fetchResizedReferenceImage(env, r2Key, 1024);
                images.push({
                    buffer: resized.buffer,
                    mimeType: resized.mimeType,
                    name
                });
                console.log(`Fetched reference (library): ${name} (${resized.buffer.length} bytes)`);
            } catch (err) {
                console.warn(`Failed to fetch library image: ${err.message}`);
            }

        } catch (err) {
            console.error(`Error fetching reference ${spec.type}/${spec.id}:`, err);
        }
    }

    return images;
}

/**
 * Fetch parent reference sheet for sprite categories
 * Returns the approved reference sheet that should be used as context
 * @param {Object} env - Worker environment
 * @param {string} category - Asset category
 * @param {string} assetKey - Asset key
 * @returns {Promise<Object|null>} { buffer, mimeType, name } or null
 */
async function fetchParentReferenceForSprite(env, category, assetKey) {
    // Map sprite categories to their reference categories
    const SPRITE_TO_REF = {
        'building_sprite': 'building_ref',
        'npc': 'character_ref',
        'effect': 'effect_ref',
        'avatar': 'character_ref',
        'terrain': 'terrain_ref'
    };

    const refCategory = SPRITE_TO_REF[category];
    if (!refCategory) return null;

    // Get the matching asset key for the reference
    const refAssetKey = getRefAssetKeyForParent(category, assetKey);

    // Find approved reference
    const refAsset = await env.DB.prepare(`
        SELECT r2_key_private, asset_key, variant FROM generated_assets
        WHERE category = ? AND asset_key = ? AND status = 'approved'
        ORDER BY is_active DESC, approved_at DESC
        LIMIT 1
    `).bind(refCategory, refAssetKey).first();

    if (!refAsset || !refAsset.r2_key_private) {
        console.log(`No approved parent reference found for ${refCategory}/${refAssetKey}`);
        return null;
    }

    // Fetch from R2
    const object = await env.R2_PRIVATE.get(refAsset.r2_key_private);
    if (!object) {
        console.warn(`Parent reference R2 object not found: ${refAsset.r2_key_private}`);
        return null;
    }

    const buffer = new Uint8Array(await object.arrayBuffer());
    console.log(`Fetched parent reference: ${refCategory}/${refAsset.asset_key} v${refAsset.variant} (${buffer.length} bytes)`);

    return {
        buffer,
        mimeType: 'image/png',
        name: `Parent: ${refCategory}/${refAsset.asset_key}`
    };
}

/**
 * Get the reference sheet asset_key for parent lookup
 * Similar to getRefAssetKey but separated for clarity
 */
function getRefAssetKeyForParent(category, assetKey) {
    if (category === 'npc') {
        // Pedestrian directional sprites need any pedestrian character ref
        if (assetKey.startsWith('ped_walk_')) {
            return 'pedestrian'; // Use base pedestrian ref
        }
        // Car directional sprites need car vehicle ref
        if (assetKey.startsWith('car_')) {
            return assetKey.split('_').slice(0, 2).join('_'); // car_n -> car (but we want car_sedan etc)
        }
        if (assetKey.startsWith('pedestrian_')) {
            return assetKey.includes('business') || assetKey.includes('suit')
                ? 'pedestrian_business'
                : 'pedestrian_casual';
        }
    }
    if (category === 'avatar') {
        return 'avatar_base';
    }
    if (category === 'terrain') {
        return assetKey.split('_')[0]; // road_straight → road
    }
    // For building_sprite and effect, asset_key is the same
    return assetKey;
}

/**
 * Store reference image links in the database
 * @param {Object} env - Worker environment
 * @param {number} assetId - The generated asset ID
 * @param {Array} referenceSpecs - Array of { type, id }
 */
async function storeReferenceLinks(env, assetId, referenceSpecs = []) {
    for (let i = 0; i < referenceSpecs.length; i++) {
        const ref = referenceSpecs[i];
        await env.DB.prepare(`
            INSERT INTO asset_reference_links (
                asset_id, reference_image_id, approved_asset_id,
                link_type, sort_order
            )
            VALUES (?, ?, ?, ?, ?)
        `).bind(
            assetId,
            ref.type === 'library' ? ref.id : null,
            ref.type === 'approved_asset' ? ref.id : null,
            ref.type,
            i
        ).run();

        // Increment usage count for library references
        if (ref.type === 'library') {
            await env.DB.prepare(`
                UPDATE reference_images
                SET usage_count = usage_count + 1
                WHERE id = ?
            `).bind(ref.id).run();
        }
    }
}

// ============================================================================

// Map sprite categories to their corresponding reference sheet categories
const SPRITE_TO_REF_CATEGORY = {
    'building_sprite': 'building_ref',
    'npc': 'character_ref',      // pedestrians use character_ref
    'effect': 'effect_ref',
    'avatar': 'character_ref',   // avatars use character_ref (avatar_base)
    'terrain': 'terrain_ref'     // terrain sprites use terrain_ref (road, water, etc.)
};

// Get the reference sheet asset_key for a sprite
// For most, it's the same key. For NPCs/avatars, we need to map to the correct ref
function getRefAssetKey(category, assetKey) {
    if (category === 'npc') {
        // Pedestrians map to their character ref
        if (assetKey.startsWith('pedestrian_')) {
            return assetKey.includes('business') || assetKey.includes('suit')
                ? 'pedestrian_business'
                : 'pedestrian_casual';
        }
        // Vehicles map to their vehicle ref
        if (assetKey.startsWith('car_')) {
            return assetKey; // car_sedan, car_sports, etc.
        }
    }
    if (category === 'avatar') {
        return 'avatar_base'; // All avatar items use the avatar_base character ref
    }
    if (category === 'terrain') {
        // Terrain sprites map to their base type: road_straight → road, water_n → water
        return assetKey.split('_')[0]; // road, water, dirt, grass
    }
    // For building_sprite and effect, the asset_key is the same
    return assetKey;
}

// Route handler for asset management
export async function handleAssetRoutes(request, env, path, method, user, ctx = null) {
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
        // Query params: ?show_hidden=true to include archived, rejected, and failed assets
        if (action === 'list' && method === 'GET' && param1) {
            const category = param1;
            // Support both old param name (show_archived) and new (show_hidden)
            const showHidden = url.searchParams.get('show_hidden') === 'true' ||
                              url.searchParams.get('show_archived') === 'true';

            // Build query based on whether to show hidden (archived + rejected + failed)
            const statusFilter = showHidden ? '' : "AND status NOT IN ('archived', 'rejected', 'failed')";
            const assets = await env.DB.prepare(`
                SELECT *,
                       r2_key_private as r2_key,
                       CASE WHEN r2_url IS NOT NULL THEN r2_url
                            ELSE NULL END as public_url
                FROM generated_assets
                WHERE category = ? ${statusFilter}
                ORDER BY asset_key, variant
            `).bind(category).all();

            return Response.json({ success: true, data: assets.results || [] });
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

            const items = queue.results || [];
            const pending = items.filter(i => i.status === 'queued').length;
            const generating = items.filter(i => i.status === 'processing').length;

            return Response.json({
                success: true,
                data: {
                    pending,
                    generating,
                    items: items.map(i => ({
                        id: i.id,
                        category: i.category,
                        asset_key: i.asset_key,
                        status: i.status === 'queued' ? 'pending' : 'generating',
                        created_at: i.created_at
                    }))
                }
            });
        }

        // POST /api/admin/assets/process-queue - Process pending items in the generation queue
        if (action === 'process-queue' && method === 'POST') {
            const { limit = 5 } = await request.json().catch(() => ({}));

            // Get pending items from queue
            const pendingItems = await env.DB.prepare(`
                SELECT q.id as queue_id, q.asset_id, a.category, a.asset_key, a.base_prompt, a.parent_asset_id
                FROM asset_generation_queue q
                JOIN generated_assets a ON q.asset_id = a.id
                WHERE q.status = 'queued' AND a.status = 'pending'
                ORDER BY q.priority, q.created_at
                LIMIT ?
            `).bind(limit).all();

            const items = pendingItems.results || [];
            if (items.length === 0) {
                return Response.json({ success: true, processed: 0, message: 'No pending items in queue' });
            }

            const processed = [];
            const errors = [];

            for (const item of items) {
                try {
                    // Mark as processing
                    await env.DB.prepare(`
                        UPDATE asset_generation_queue SET status = 'processing' WHERE id = ?
                    `).bind(item.queue_id).run();
                    await env.DB.prepare(`
                        UPDATE generated_assets SET status = 'generating' WHERE id = ?
                    `).bind(item.asset_id).run();

                    // Get parent reference image if this is a child asset
                    // Prefer public WebP (much smaller) over private PNG
                    let referenceImage = null;
                    if (item.parent_asset_id) {
                        const parentAsset = await env.DB.prepare(`
                            SELECT r2_key_private, r2_url FROM generated_assets WHERE id = ?
                        `).bind(item.parent_asset_id).first();

                        if (parentAsset) {
                            // Try public WebP first (much smaller)
                            if (parentAsset.r2_url) {
                                const publicKey = parentAsset.r2_url.replace(R2_PUBLIC_URL + '/', '');
                                const publicObject = await env.R2_PUBLIC.get(publicKey);
                                if (publicObject) {
                                    const refBuffer = await publicObject.arrayBuffer();
                                    referenceImage = {
                                        buffer: new Uint8Array(refBuffer),
                                        mimeType: publicObject.httpMetadata?.contentType || 'image/webp',
                                        name: 'reference'
                                    };
                                    console.log(`Queue: Fetched parent ref (public WebP): ${refBuffer.byteLength} bytes`);
                                }
                            }

                            // Fall back to private PNG - resize if large
                            if (!referenceImage && parentAsset.r2_key_private) {
                                try {
                                    const resized = await fetchResizedReferenceImage(env, parentAsset.r2_key_private, 1024);
                                    referenceImage = {
                                        buffer: resized.buffer,
                                        mimeType: resized.mimeType,
                                        name: 'reference'
                                    };
                                    console.log(`Queue: Fetched parent ref (resized): ${resized.buffer.length} bytes`);
                                } catch (err) {
                                    console.error(`Queue: Failed to fetch/resize parent ref: ${err.message}`);
                                }
                            }
                        }
                    }

                    // Generate the image with category-appropriate settings
                    const queueSettings = validateGenerationSettings({}, item.category);
                    const generated = await generateWithGemini(env, item.base_prompt, referenceImage ? [referenceImage] : null, queueSettings);

                    if (generated.success) {
                        // Store in R2
                        const r2Key = `raw/${item.category}_${item.asset_key}_raw_v1.png`;
                        await env.R2_PRIVATE.put(r2Key, generated.imageBuffer, {
                            httpMetadata: { contentType: 'image/png' }
                        });

                        // Update asset record
                        await env.DB.prepare(`
                            UPDATE generated_assets
                            SET status = 'completed', r2_key_private = ?
                            WHERE id = ?
                        `).bind(r2Key, item.asset_id).run();

                        // Mark queue item as completed
                        await env.DB.prepare(`
                            UPDATE asset_generation_queue SET status = 'completed' WHERE id = ?
                        `).bind(item.queue_id).run();

                        processed.push({ asset_id: item.asset_id, asset_key: item.asset_key });
                    } else {
                        throw new Error(generated.error || 'Generation failed');
                    }
                } catch (err) {
                    // Mark as failed
                    await env.DB.prepare(`
                        UPDATE asset_generation_queue SET status = 'failed', error_message = ? WHERE id = ?
                    `).bind(err.message, item.queue_id).run();
                    await env.DB.prepare(`
                        UPDATE generated_assets SET status = 'failed', error_message = ? WHERE id = ?
                    `).bind(err.message, item.asset_id).run();

                    errors.push({ asset_id: item.asset_id, asset_key: item.asset_key, error: err.message });
                }
            }

            return Response.json({
                success: true,
                processed: processed.length,
                errors: errors.length,
                details: { processed, errors }
            });
        }

        // GET /api/admin/assets/preview/:assetId - Get signed preview URL for private asset
        if (action === 'preview' && method === 'GET' && param1) {
            const assetId = param1;
            const asset = await env.DB.prepare(`
                SELECT id, r2_key_private, r2_url FROM generated_assets WHERE id = ?
            `).bind(assetId).first();

            if (!asset) {
                return Response.json({ success: false, error: 'Asset not found' }, { status: 404 });
            }

            // OPTIMIZATION: If public URL exists, return it directly (no base64 encoding needed!)
            // This is much faster and avoids CPU limits for large images
            if (asset.r2_url) {
                return Response.json({
                    success: true,
                    data: {
                        url: asset.r2_url,
                        source: 'public',
                        expires_at: null // Public URLs don't expire
                    }
                });
            }

            // Fall back to base64 for private-only assets (reference sheets, raw sprites)
            const r2Key = asset.r2_key_private;
            if (!r2Key) {
                return Response.json({ success: false, error: 'No image available' }, { status: 404 });
            }

            const object = await env.R2_PRIVATE.get(r2Key);
            if (!object) {
                return Response.json({ success: false, error: 'Image not found in storage' }, { status: 404 });
            }

            // Convert to base64 data URL (chunked to avoid stack overflow on large images)
            const arrayBuffer = await object.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            let binary = '';
            const chunkSize = 8192;
            for (let i = 0; i < uint8Array.length; i += chunkSize) {
                const chunk = uint8Array.subarray(i, i + chunkSize);
                binary += String.fromCharCode.apply(null, chunk);
            }
            const base64 = btoa(binary);
            const contentType = object.httpMetadata?.contentType || 'image/png';
            const dataUrl = `data:${contentType};base64,${base64}`;

            return Response.json({
                success: true,
                data: {
                    url: dataUrl,
                    source: 'private',
                    expires_at: new Date(Date.now() + 3600000).toISOString() // 1 hour (not really used for data URLs)
                }
            });
        }

        // GET /api/admin/assets/sprite-requirements/:refCategory - Get sprite requirements for a reference type
        // Stage 5a: Returns what sprites are needed for a reference type
        if (action === 'sprite-requirements' && method === 'GET' && param1) {
            const refCategory = param1;
            const requirements = SPRITE_REQUIREMENTS[refCategory];

            return Response.json({
                success: true,
                refCategory,
                requirements: requirements || [],
                message: requirements ? undefined : 'No sprite requirements for this category'
            });
        }

        // GET /api/admin/assets/sprite-status/:refId - Get sprite status for a specific reference
        // Stage 5a: Shows which sprites exist/need generating for an approved reference
        if (action === 'sprite-status' && method === 'GET' && param1) {
            const refId = param1;

            // Get the reference asset
            const refAsset = await env.DB.prepare(`
                SELECT id, category, asset_key, status
                FROM generated_assets
                WHERE id = ?
            `).bind(refId).first();

            if (!refAsset) {
                return Response.json({ success: false, error: 'Reference not found' }, { status: 404 });
            }

            if (refAsset.status !== 'approved') {
                return Response.json({
                    success: false,
                    error: 'Reference must be approved before generating sprites'
                }, { status: 400 });
            }

            // Get requirements for this reference type
            const requirements = SPRITE_REQUIREMENTS[refAsset.category];
            if (!requirements) {
                return Response.json({
                    success: true,
                    reference: refAsset,
                    sprites: [],
                    summary: { total: 0, completed: 0, inProgress: 0, notStarted: 0, percentComplete: 100 },
                    message: 'No sprites needed for this reference type'
                });
            }

            // Check which sprites exist
            const sprites = [];
            for (const req of requirements) {
                // Build the expected asset_key for the sprite
                // For terrain: road_straight, road_corner, etc.
                // For buildings: restaurant (same as ref)
                const spriteAssetKey = req.variant === 'main'
                    ? refAsset.asset_key
                    : `${refAsset.asset_key}_${req.variant}`;

                // Find existing sprite linked to this parent
                const existingSprite = await env.DB.prepare(`
                    SELECT id, status, r2_url, pipeline_status, generation_settings
                    FROM generated_assets
                    WHERE category = ?
                    AND asset_key = ?
                    AND parent_asset_id = ?
                    ORDER BY created_at DESC
                    LIMIT 1
                `).bind(req.spriteCategory, spriteAssetKey, refId).first();

                sprites.push({
                    variant: req.variant,
                    displayName: req.displayName,
                    required: req.required,
                    spriteCategory: req.spriteCategory,
                    spriteAssetKey: spriteAssetKey,
                    // Existing sprite info (null if not created)
                    spriteId: existingSprite?.id || null,
                    status: existingSprite?.status || null,
                    pipelineStatus: existingSprite?.pipeline_status || null,
                    publicUrl: existingSprite?.r2_url || null,
                    generationSettings: existingSprite?.generation_settings
                        ? JSON.parse(existingSprite.generation_settings)
                        : null
                });
            }

            // Calculate completion status
            const total = sprites.length;
            const completed = sprites.filter(s => s.status === 'approved' && s.pipelineStatus === 'completed').length;
            const inProgress = sprites.filter(s => s.status === 'generating' || s.status === 'review').length;
            const notStarted = sprites.filter(s => s.status === null).length;

            return Response.json({
                success: true,
                reference: {
                    id: refAsset.id,
                    category: refAsset.category,
                    asset_key: refAsset.asset_key,
                    status: refAsset.status
                },
                sprites,
                summary: {
                    total,
                    completed,
                    inProgress,
                    notStarted,
                    percentComplete: Math.round((completed / total) * 100)
                }
            });
        }

        // POST /api/admin/assets/generate - Generate a new asset
        // Stage 4: Enhanced with custom prompts, reference images, and Gemini settings
        // Stage 5a: Added parent_asset_id and sprite_variant for explicit sprite-reference linking
        if (action === 'generate' && method === 'POST') {
            const {
                category,
                asset_key,
                prompt: customPrompt,           // Stage 4: Custom prompt (optional, overrides template)
                custom_details,                  // Additional details to append
                reference_images = [],           // Stage 4: Array of { type: 'library' | 'approved_asset', id }
                generation_settings = {},        // Stage 4: { temperature, topK, topP, maxOutputTokens }
                parent_asset_id: explicitParentId,  // Stage 5a: Explicit parent reference ID
                sprite_variant                   // Stage 5a: Which variant this sprite is (e.g., 'main', 'n', 'corner')
            } = await request.json();

            // Validate required fields
            if (!category || !asset_key) {
                return Response.json({
                    success: false,
                    error: 'category and asset_key are required'
                }, { status: 400 });
            }

            // Stage 4: Validate and clamp generation settings
            const validatedSettings = validateGenerationSettings(generation_settings, category);
            console.log(`Generation settings validated:`, JSON.stringify(validatedSettings));

            // Stage 5a: Validate explicit parent_asset_id if provided
            let validatedParentId = null;
            if (explicitParentId) {
                const parentRef = await env.DB.prepare(`
                    SELECT id, category, asset_key, status, r2_key_private
                    FROM generated_assets
                    WHERE id = ? AND status = 'approved'
                `).bind(explicitParentId).first();

                if (!parentRef) {
                    return Response.json({
                        success: false,
                        error: 'Parent reference not found or not approved'
                    }, { status: 400 });
                }

                // Validate sprite/reference relationship
                const validRelationship = validateSpriteRefRelationship(category, parentRef.category);
                if (!validRelationship) {
                    return Response.json({
                        success: false,
                        error: `Cannot create ${category} from ${parentRef.category}`
                    }, { status: 400 });
                }

                validatedParentId = explicitParentId;
                console.log(`Using explicit parent_asset_id: ${validatedParentId} (${parentRef.category}/${parentRef.asset_key})`);
            }

            // === DEPENDENCY CHECKS ===
            // Scene generation requires avatar assets to be approved first
            if (category === 'scene') {
                const sceneCheck = await checkSceneDependencies(env);
                if (!sceneCheck.canGenerate) {
                    return Response.json({
                        error: 'Scene generation blocked',
                        reason: sceneCheck.message,
                        missing_dependencies: sceneCheck.missing,
                        hint: 'Generate and approve avatar base assets first (avatar/base_male, avatar/base_female)'
                    }, { status: 400 });
                }
            }

            // Sprite generation requires approved reference sheet
            if (['building_sprite', 'npc', 'effect'].includes(category)) {
                const spriteCheck = await checkSpriteReferenceDependency(env, category, asset_key);
                if (!spriteCheck.canGenerate) {
                    return Response.json({
                        error: 'Sprite generation blocked',
                        reason: spriteCheck.message,
                        hint: 'Generate and approve a reference sheet for this asset first'
                    }, { status: 400 });
                }
            }

            // Stage 4: Build the prompt - either from custom prompt or database template
            let fullPrompt;

            if (customPrompt) {
                // Always try to use the database template (with system_instructions)
                // and treat the custom prompt as additional details. This ensures
                // style instructions are always included for all asset types.
                const combinedDetails = customPrompt + (custom_details ? `\n\n${custom_details}` : '');
                try {
                    // Use database template which includes system_instructions
                    fullPrompt = await getPromptForGeneration(env, category, asset_key, combinedDetails);
                    console.log(`Using template with custom details for ${category} (${fullPrompt.length} chars)`);
                    console.log(`Prompt preview: ${fullPrompt.substring(0, 300)}...`);
                } catch (err) {
                    // Fall back to buildAssetPrompt if no database template
                    try {
                        fullPrompt = buildAssetPrompt(category, asset_key, combinedDetails);
                        console.log(`Using fallback buildAssetPrompt for ${category} (${fullPrompt.length} chars)`);
                    } catch (buildErr) {
                        // Last resort: use custom prompt directly
                        fullPrompt = combinedDetails;
                        console.log(`Using custom prompt directly for ${category} (${fullPrompt.length} chars)`);
                    }
                }
            } else {
                // Stage 3: Get prompt from database template (no custom prompt provided)
                try {
                    fullPrompt = await getPromptForGeneration(env, category, asset_key, custom_details || '');
                    console.log(`Using database template prompt (${fullPrompt.length} chars)`);
                    // Log first 300 chars to verify system instructions are included
                    console.log(`Prompt preview: ${fullPrompt.substring(0, 300)}...`);
                } catch (err) {
                    // Fall back to legacy buildAssetPrompt for backwards compatibility
                    console.log(`No database template found, falling back to buildAssetPrompt: ${err.message}`);
                    try {
                        fullPrompt = buildAssetPrompt(category, asset_key, custom_details || '');
                    } catch (buildErr) {
                        return Response.json({
                            error: buildErr.message,
                            hint: `Provide a known asset_key for category "${category}" or include a custom prompt`,
                            supported_categories: {
                                reference_sheets: ['building_ref', 'character_ref', 'vehicle_ref', 'effect_ref'],
                                sprites: ['building_sprite', 'terrain', 'effect', 'scene', 'npc', 'avatar', 'ui', 'overlay']
                            }
                        }, { status: 400 });
                    }
                }
            }

            if (!fullPrompt) {
                return Response.json({ error: 'Could not build prompt. Provide asset_key or custom prompt.' }, { status: 400 });
            }

            // Stage 4: Fetch user-specified reference images from library/approved assets
            let userReferenceImages = [];
            if (reference_images && reference_images.length > 0) {
                userReferenceImages = await fetchReferenceImages(env, reference_images);
                console.log(`Fetched ${userReferenceImages.length} user-specified reference images`);
            }

            // For sprite categories, fetch the approved reference sheet image
            let referenceImage = null;
            // Stage 5a: Use explicit parent_asset_id if provided, otherwise auto-detect
            let parentAssetId = validatedParentId || null;
            const refCategory = SPRITE_TO_REF_CATEGORY[category];

            if (refCategory) {
                // This is a sprite category that needs a reference sheet
                const refAssetKey = getRefAssetKey(category, asset_key);

                // Look for an approved reference sheet - prefer public WebP (smaller)
                const refAsset = await env.DB.prepare(`
                    SELECT id, r2_key_private, r2_url FROM generated_assets
                    WHERE category = ? AND asset_key = ? AND status = 'approved'
                    ORDER BY variant DESC
                    LIMIT 1
                `).bind(refCategory, refAssetKey).first();

                if (refAsset) {
                    // Try public WebP first (much smaller, ~100KB vs ~6MB)
                    if (refAsset.r2_url) {
                        const publicKey = refAsset.r2_url.replace(R2_PUBLIC_URL + '/', '');
                        const publicObject = await env.R2_PUBLIC.get(publicKey);
                        if (publicObject) {
                            const buffer = await publicObject.arrayBuffer();
                            referenceImage = {
                                buffer: new Uint8Array(buffer),
                                mimeType: publicObject.httpMetadata?.contentType || 'image/webp'
                            };
                            parentAssetId = refAsset.id;
                            console.log(`Fetched parent ref (public WebP): ${refCategory}/${refAssetKey} (${buffer.byteLength} bytes)`);
                        }
                    }

                    // Fall back to private PNG if no public version - resize if large
                    if (!referenceImage && refAsset.r2_key_private) {
                        try {
                            // Use resize function to handle large reference sheets
                            const resized = await fetchResizedReferenceImage(env, refAsset.r2_key_private, 1024);
                            referenceImage = {
                                buffer: resized.buffer,
                                mimeType: resized.mimeType
                            };
                            parentAssetId = refAsset.id;
                            console.log(`Fetched parent ref (resized): ${refCategory}/${refAssetKey} (${resized.buffer.length} bytes)`);
                        } catch (err) {
                            console.error(`Failed to fetch parent ref: ${err.message}`);
                        }
                    }

                    if (referenceImage) {
                        // Prepend instruction to use the reference image
                        if (category === 'terrain') {
                            // Terrain tiles are top-down squares, NOT isometric
                            fullPrompt = `REFERENCE IMAGE ATTACHED: This shows 5 road tiles. Extract ONLY the specific tile you are generating. Output a single SQUARE tile with TRANSPARENT background. Copy the EXACT style, road width, and colors from the reference.\n\n${fullPrompt}`;
                        } else {
                            fullPrompt = `REFERENCE IMAGE ATTACHED: Use the attached reference sheet image as your style guide. The sprite you generate MUST match the exact design, colors, and details shown in this reference sheet. Extract and render only the 45-degree isometric view as a standalone sprite.\n\n${fullPrompt}`;
                        }
                    }
                }

                // Warn if no approved ref exists (but don't block - allow generation anyway)
                if (!referenceImage) {
                    console.log(`Warning: No approved reference sheet found for ${refCategory}/${refAssetKey}. Generating sprite from text prompt only.`);
                }
            }

            // For effect sprites, include building references so the AI knows the size/style
            // Pick buildings of DIFFERENT sizes to ensure effect works on all building types
            let buildingReferenceImages = [];
            if (category === 'effect') {
                // Small buildings (TINY/SHORT): claim_stake, market_stall, hot_dog_stand, campsite
                const smallBuildings = ['claim_stake', 'market_stall', 'hot_dog_stand', 'campsite'];
                // Medium buildings: shop, burger_bar, motel
                const mediumBuildings = ['shop', 'burger_bar', 'motel'];
                // Large buildings (TALL/VERY_TALL): restaurant, manor, police_station, casino, temple, bank
                const largeBuildings = ['restaurant', 'manor', 'police_station', 'casino', 'temple', 'bank'];

                // Fetch one of each size class if available - include r2_url for smaller WebP
                const buildingSprites = await env.DB.prepare(`
                    SELECT id, r2_key_private, r2_url, asset_key FROM generated_assets
                    WHERE category = 'building_sprite' AND status = 'approved' AND (r2_url IS NOT NULL OR r2_key_private IS NOT NULL)
                    AND (
                        asset_key IN (${smallBuildings.map(() => '?').join(',')})
                        OR asset_key IN (${mediumBuildings.map(() => '?').join(',')})
                        OR asset_key IN (${largeBuildings.map(() => '?').join(',')})
                    )
                    ORDER BY
                        CASE
                            WHEN asset_key IN (${smallBuildings.map(() => '?').join(',')}) THEN 1
                            WHEN asset_key IN (${mediumBuildings.map(() => '?').join(',')}) THEN 2
                            WHEN asset_key IN (${largeBuildings.map(() => '?').join(',')}) THEN 3
                        END,
                        RANDOM()
                `).bind(
                    ...smallBuildings, ...mediumBuildings, ...largeBuildings,
                    ...smallBuildings, ...mediumBuildings, ...largeBuildings
                ).all();

                // Take up to 3 - ideally one from each size category
                const selectedSprites = [];
                let hasSmall = false, hasMedium = false, hasLarge = false;
                for (const sprite of buildingSprites.results || []) {
                    if (selectedSprites.length >= 3) break;
                    const isSmall = smallBuildings.includes(sprite.asset_key);
                    const isMedium = mediumBuildings.includes(sprite.asset_key);
                    const isLarge = largeBuildings.includes(sprite.asset_key);

                    if ((isSmall && !hasSmall) || (isMedium && !hasMedium) || (isLarge && !hasLarge) || selectedSprites.length < 3) {
                        selectedSprites.push(sprite);
                        if (isSmall) hasSmall = true;
                        if (isMedium) hasMedium = true;
                        if (isLarge) hasLarge = true;
                    }
                }

                for (const sprite of selectedSprites) {
                    // Try public WebP first (much smaller)
                    if (sprite.r2_url) {
                        const publicKey = sprite.r2_url.replace(R2_PUBLIC_URL + '/', '');
                        const publicObject = await env.R2_PUBLIC.get(publicKey);
                        if (publicObject) {
                            const buffer = await publicObject.arrayBuffer();
                            buildingReferenceImages.push({
                                buffer: new Uint8Array(buffer),
                                mimeType: publicObject.httpMetadata?.contentType || 'image/webp',
                                name: sprite.asset_key
                            });
                            console.log(`Fetched building ref (public WebP): ${sprite.asset_key} (${buffer.byteLength} bytes)`);
                            continue;
                        }
                    }
                    // Fall back to private PNG
                    if (sprite.r2_key_private) {
                        const spriteObject = await env.R2_PRIVATE.get(sprite.r2_key_private);
                        if (spriteObject) {
                            const buffer = await spriteObject.arrayBuffer();
                            buildingReferenceImages.push({
                                buffer: new Uint8Array(buffer),
                                mimeType: 'image/png',
                                name: sprite.asset_key
                            });
                            console.log(`Fetched building ref (private PNG): ${sprite.asset_key} (${buffer.byteLength} bytes)`);
                        }
                    }
                }

                if (buildingReferenceImages.length > 0) {
                    const sizeNote = buildingReferenceImages.length >= 3
                        ? 'These buildings show SMALL, MEDIUM, and LARGE sizes - your effect must work on ALL of them.'
                        : 'Study these building sizes - your effect must work on buildings of varying sizes.';

                    fullPrompt = `BUILDING REFERENCE IMAGES ATTACHED: These are example building sprites that your effect overlay will be placed ON TOP OF.

${sizeNote}

Your effect overlay must:
1. Match the same 45-degree isometric angle
2. Be sized proportionally - smaller effect for smaller buildings, larger for larger buildings
3. Work as a SCALABLE overlay that can be resized to fit any building
4. Have the center point so when overlaid, the effect appears centered on the building

The effect should fill approximately 70-90% of the building footprint when overlaid.

${fullPrompt}`;
                }
            }

            // For terrain sprites, include previously approved sibling tiles for consistency
            // This ensures road tiles interlock perfectly - each new tile copies the exact dimensions from siblings
            let terrainSiblingImages = [];
            if (category === 'terrain') {
                // Extract terrain type from asset_key (e.g., 'road' from 'road_straight')
                const terrainType = asset_key.split('_')[0]; // 'road', 'water', 'dirt', 'grass'

                // Road tiles have a specific chain order for generation
                // road_straight is the MASTER - all others must match its exact dimensions
                const ROAD_CHAIN_ORDER = ['road_straight', 'road_corner', 'road_tjunction', 'road_crossroad', 'road_deadend'];

                let siblingQuery;
                if (terrainType === 'road') {
                    // For road tiles, prioritize road_straight as the master, then follow chain order
                    siblingQuery = await env.DB.prepare(`
                        SELECT id, r2_key_private, r2_url, asset_key FROM generated_assets
                        WHERE category = 'terrain'
                        AND status = 'approved'
                        AND (r2_url IS NOT NULL OR r2_key_private IS NOT NULL)
                        AND asset_key LIKE 'road_%'
                        AND asset_key != ?
                        ORDER BY
                            CASE asset_key
                                WHEN 'road_straight' THEN 1
                                WHEN 'road_corner' THEN 2
                                WHEN 'road_tjunction' THEN 3
                                WHEN 'road_crossroad' THEN 4
                                WHEN 'road_deadend' THEN 5
                                ELSE 6
                            END,
                            id ASC
                    `).bind(asset_key).all();
                } else {
                    // For other terrain types, use the original ordering
                    siblingQuery = await env.DB.prepare(`
                        SELECT id, r2_key_private, r2_url, asset_key FROM generated_assets
                        WHERE category = 'terrain'
                        AND status = 'approved'
                        AND (r2_url IS NOT NULL OR r2_key_private IS NOT NULL)
                        AND asset_key LIKE ?
                        AND asset_key != ?
                        ORDER BY
                            CASE
                                WHEN asset_key LIKE '%_ns' OR asset_key LIKE '%_ew' THEN 1
                                WHEN asset_key LIKE '%_ne' OR asset_key LIKE '%_nw' OR asset_key LIKE '%_se' OR asset_key LIKE '%_sw' THEN 2
                                ELSE 3
                            END,
                            id ASC
                    `).bind(`${terrainType}_%`, asset_key).all();
                }

                // Fetch up to 5 sibling tiles
                const selectedSiblings = (siblingQuery.results || []).slice(0, 5);

                for (const sibling of selectedSiblings) {
                    // Try public WebP first (much smaller)
                    if (sibling.r2_url) {
                        const publicKey = sibling.r2_url.replace(R2_PUBLIC_URL + '/', '');
                        const publicObject = await env.R2_PUBLIC.get(publicKey);
                        if (publicObject) {
                            const buffer = await publicObject.arrayBuffer();
                            terrainSiblingImages.push({
                                buffer: new Uint8Array(buffer),
                                mimeType: publicObject.httpMetadata?.contentType || 'image/webp',
                                name: sibling.asset_key
                            });
                            console.log(`Fetched terrain sibling (public WebP): ${sibling.asset_key} (${buffer.byteLength} bytes)`);
                            continue;
                        }
                    }
                    // Fall back to private PNG
                    if (sibling.r2_key_private) {
                        const siblingObject = await env.R2_PRIVATE.get(sibling.r2_key_private);
                        if (siblingObject) {
                            const buffer = await siblingObject.arrayBuffer();
                            terrainSiblingImages.push({
                                buffer: new Uint8Array(buffer),
                                mimeType: 'image/png',
                                name: sibling.asset_key
                            });
                            console.log(`Fetched terrain sibling (private PNG): ${sibling.asset_key} (${buffer.byteLength} bytes)`);
                        }
                    }
                }

                if (terrainSiblingImages.length > 0) {
                    const siblingNames = terrainSiblingImages.map(s => s.name).join(', ');

                    // Road-specific instructions
                    if (terrainType === 'road') {
                        fullPrompt = `REFERENCE IMAGES ATTACHED: ${siblingNames}

Copy the EXACT road width, sidewalk width, and colors from the attached images. Your tile must connect seamlessly with these when placed edge-to-edge.

${fullPrompt}`;
                    } else {
                        // Non-road terrain
                        fullPrompt = `SIBLING TILE IMAGES ATTACHED: These are previously approved ${terrainType} tiles that your new tile MUST match exactly.
Sibling tiles: ${siblingNames}

CRITICAL - Your tile must have:
- IDENTICAL path/feature width (measure from the siblings)
- IDENTICAL colors and style
- IDENTICAL edge alignment (where features meet tile edges)
- SEAMLESS connection when placed adjacent to these tiles

Study the attached sibling tiles carefully. Copy their exact proportions and style.

${fullPrompt}`;
                    }
                }
            }

            // Find the next available variant number for this asset (never overwrite existing)
            const maxVariant = await env.DB.prepare(`
                SELECT COALESCE(MAX(variant), 0) as max_variant FROM generated_assets
                WHERE category = ? AND asset_key = ?
            `).bind(category, asset_key).first();

            const nextVariant = (maxVariant?.max_variant || 0) + 1;

            // Stage 4: Create new asset record with generation_settings
            // Stage 5a: Added sprite_variant column
            const result = await env.DB.prepare(`
                INSERT INTO generated_assets (category, asset_key, variant, base_prompt, current_prompt, status, generation_model, parent_asset_id, generation_settings, sprite_variant)
                VALUES (?, ?, ?, ?, ?, 'pending', 'gemini-3-pro-image-preview', ?, ?, ?)
                RETURNING id
            `).bind(
                category,
                asset_key,
                nextVariant,
                fullPrompt,
                fullPrompt,
                parentAssetId,
                JSON.stringify(validatedSettings),  // Stage 4: Store settings for reproducibility
                sprite_variant || null               // Stage 5a: Store sprite variant
            ).first();

            // Stage 4: Store reference image links
            if (reference_images && reference_images.length > 0) {
                await storeReferenceLinks(env, result.id, reference_images);
                console.log(`Stored ${reference_images.length} reference links for asset ${result.id}`);
            }

            // Add to queue
            await env.DB.prepare(`
                INSERT INTO asset_generation_queue (asset_id, priority)
                VALUES (?, 5)
            `).bind(result.id).run();

            // Stage 4: Combine all reference images for generation
            // Order: user-specified refs first, then parent ref, then auto-fetched context refs
            const allReferenceImages = [
                ...userReferenceImages,              // Stage 4: User-specified from library/approved assets
                ...(referenceImage ? [referenceImage] : []),  // Parent reference sheet for sprites
                ...buildingReferenceImages,          // Building context for effects
                ...terrainSiblingImages              // Sibling tiles for terrain consistency
            ];

            console.log(`Total reference images for generation: ${allReferenceImages.length}`);

            // Stage 4: Pass validated settings to Gemini
            const generated = await generateWithGemini(env, fullPrompt, allReferenceImages, validatedSettings);

            if (generated.success) {
                // Determine storage path based on category
                // All originals go to PRIVATE bucket (not publicly accessible)
                let r2Key;
                if (category.endsWith('_ref')) {
                    // Reference sheets go to refs/
                    r2Key = `refs/${asset_key}_ref_v${nextVariant}.png`;
                } else if (category === 'scene') {
                    // Scene originals go to scenes/
                    r2Key = `scenes/${asset_key}_v${nextVariant}.png`;
                } else {
                    // Sprites go to raw/ (will be processed later)
                    r2Key = `raw/${category}_${asset_key}_raw_v${nextVariant}.png`;
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

                // Stage 4: Enhanced audit logging with settings
                // Stage 5a: Added sprite_variant to audit
                await logAudit(env, 'generate', result.id, user?.username, {
                    category,
                    asset_key,
                    variant: nextVariant,
                    sprite_variant: sprite_variant || null,
                    hasCustomPrompt: !!customPrompt,
                    referenceCount: reference_images.length,
                    used_parent_reference: !!referenceImage,
                    sibling_count: terrainSiblingImages.length,
                    sibling_tiles: terrainSiblingImages.map(s => s.name),
                    settings: validatedSettings
                });

                const siblingNote = terrainSiblingImages.length > 0
                    ? ` Using ${terrainSiblingImages.length} sibling tile(s) for consistency: ${terrainSiblingImages.map(s => s.name).join(', ')}.`
                    : '';

                // Stage 4: Enhanced response with variant and settings
                // Stage 5a: Added sprite_variant to response
                return Response.json({
                    success: true,
                    asset_id: result.id,
                    assetId: result.id,  // Stage 4: Also include camelCase for frontend
                    variant: nextVariant,
                    r2_key: r2Key,
                    bucket: 'private',
                    parent_asset_id: parentAssetId,
                    sprite_variant: sprite_variant || null,
                    used_reference_image: !!referenceImage,
                    user_references_count: userReferenceImages.length,
                    sibling_tiles_used: terrainSiblingImages.length,
                    sibling_tiles: terrainSiblingImages.map(s => s.name),
                    generation_settings: validatedSettings,
                    message: 'Generation started',
                    note: referenceImage
                        ? `Generated using approved reference sheet.${siblingNote} Original stored in private bucket.`
                        : `Original stored in private bucket.${siblingNote} Use POST /process/:id to create game-ready WebP in public bucket.`
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

        // POST /api/admin/assets/remove-background/:id - Remove background and trim transparent pixels
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

            // Call Slazzer API with image file - includes crop=true to trim transparent pixels
            const arrayBuffer = await originalObj.arrayBuffer();
            const formData = new FormData();
            formData.append('source_image_file', new Blob([arrayBuffer], { type: 'image/png' }), 'image.png');
            formData.append('crop', 'true'); // Trim transparent pixels from all edges

            const slazzerResponse = await fetch('https://api.slazzer.com/v2.0/remove_image_background', {
                method: 'POST',
                headers: {
                    'API-KEY': env.SLAZZER_API_KEY
                },
                body: formData
            });

            if (!slazzerResponse.ok) {
                const error = await slazzerResponse.text();
                return Response.json({ error: `Background removal failed: ${error}` }, { status: 500 });
            }

            // Slazzer returns the image directly as binary
            const transparentBuffer = await slazzerResponse.arrayBuffer();

            // Store transparent + trimmed version in private bucket
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
                note: 'Background removed and transparent pixels trimmed. Use POST /process/:id to publish.'
            });
        }

        // PUT /api/admin/assets/approve/:id - Approve an asset and set as active
        if (action === 'approve' && method === 'PUT' && param1) {
            const id = param1;

            // Get full asset details (need all fields for pipeline)
            const asset = await env.DB.prepare(`
                SELECT * FROM generated_assets WHERE id = ?
            `).bind(id).first();

            if (!asset) {
                return Response.json({ error: 'Asset not found' }, { status: 404 });
            }

            // Validate status - can only approve from review or completed
            if (asset.status !== 'review' && asset.status !== 'completed') {
                return Response.json({
                    success: false,
                    error: `Cannot approve asset with status: ${asset.status}`
                }, { status: 400 });
            }

            // Deactivate other assets of the same category and asset_key
            await env.DB.prepare(`
                UPDATE generated_assets
                SET is_active = FALSE
                WHERE category = ? AND asset_key = ? AND id != ?
            `).bind(asset.category, asset.asset_key, id).run();

            // Approve and set as active
            await env.DB.prepare(`
                UPDATE generated_assets
                SET status = 'approved', approved_at = CURRENT_TIMESTAMP, approved_by = ?, is_active = TRUE
                WHERE id = ?
            `).bind(user?.username || 'admin', id).run();

            await logAudit(env, 'approve', parseInt(id), user?.username, {
                set_active: true,
                category: asset.category,
                asset_key: asset.asset_key
            });

            // ===========================================
            // POST-APPROVAL PIPELINE (SPRITES ONLY)
            // Runs asynchronously for sprite categories
            // ===========================================

            if (SPRITE_CATEGORIES.includes(asset.category)) {
                // Only run pipeline if not already processed
                if (!asset.background_removed && asset.r2_key_private) {
                    // Run pipeline asynchronously - don't block the response
                    const pipelinePromise = postApprovalPipeline(env, parseInt(id), asset, user?.username);
                    if (ctx && ctx.waitUntil) {
                        ctx.waitUntil(pipelinePromise);
                    } else {
                        // Fallback: just run it (will complete before worker terminates)
                        pipelinePromise.catch(err => console.error('Pipeline error:', err));
                    }

                    return Response.json({
                        success: true,
                        approved: true,
                        is_active: true,
                        pipeline: 'started',
                        message: 'Approved. Processing pipeline started (bg removal → trim → resize → publish).'
                    });
                } else {
                    // Already processed or no image - just approve
                    return Response.json({
                        success: true,
                        approved: true,
                        is_active: true,
                        message: asset.background_removed
                            ? 'Approved. Already processed.'
                            : 'Approved (no image to process).'
                    });
                }
            }

            // ===========================================
            // AUTO-GENERATION FOR REFERENCE SHEETS
            // Queues sprite generation when refs are approved
            // ===========================================

            let autoGeneratedVariations = [];

            // Check if this is a terrain_ref that should auto-generate terrain sprite variations
            if (asset.category === 'terrain_ref' && TERRAIN_VARIATIONS[asset.asset_key]) {
                const variations = TERRAIN_VARIATIONS[asset.asset_key];
                for (const variantKey of variations) {
                    // Build prompt for this terrain variation - will use the terrain_ref as visual reference
                    const prompt = buildTerrainPrompt(variantKey, `Extract from the approved ${asset.asset_key} reference sheet.`);

                    // Create asset record with prompt (required - base_prompt NOT NULL)
                    const insertResult = await env.DB.prepare(`
                        INSERT INTO generated_assets (category, asset_key, variant, base_prompt, current_prompt, status, parent_asset_id)
                        VALUES (?, ?, 1, ?, ?, 'pending', ?)
                        ON CONFLICT (category, asset_key, variant) DO NOTHING
                    `).bind('terrain', variantKey, prompt, prompt, id).run();

                    if (insertResult.meta?.changes > 0) {
                        const newId = insertResult.meta?.last_row_id;
                        // Queue for generation
                        await env.DB.prepare(`
                            INSERT INTO asset_generation_queue (asset_id, priority)
                            VALUES (?, 1)
                        `).bind(newId).run();
                        autoGeneratedVariations.push({ variant: variantKey, id: newId });
                    }
                }
                await logAudit(env, 'auto_queue_terrain_sprites', parseInt(id), user?.username, {
                    base_type: asset.asset_key,
                    queued_tiles: autoGeneratedVariations.map(v => v.variant)
                });
            }

            // Check if this is an NPC/vehicle reference that should auto-generate directional sprites
            // Any pedestrian type (pedestrian, pedestrian_business, pedestrian_casual) triggers directional sprite generation
            if (asset.category === 'character_ref' && asset.asset_key.startsWith('pedestrian')) {
                const variants = DIRECTIONAL_SPRITE_VARIANTS.pedestrian;
                for (const variant of variants) {
                    // Build asset_key same as UI: {refAssetKey}_{variant} e.g., pedestrian_walk_1
                    const spriteAssetKey = `${asset.asset_key}_${variant}`;

                    // Get full prompt from database template (includes system_instructions)
                    let prompt;
                    try {
                        prompt = await getPromptForGeneration(env, 'npc', spriteAssetKey, '');
                    } catch (err) {
                        // Fall back to default npc template
                        try {
                            prompt = await getPromptForGeneration(env, 'npc', '_default', '');
                        } catch (err2) {
                            // Last resort: use basic NPC prompt
                            prompt = buildNPCPrompt(variant, '');
                        }
                    }

                    const insertResult = await env.DB.prepare(`
                        INSERT INTO generated_assets (category, asset_key, variant, base_prompt, current_prompt, status, parent_asset_id)
                        VALUES (?, ?, 1, ?, ?, 'pending', ?)
                        ON CONFLICT (category, asset_key, variant) DO NOTHING
                    `).bind('npc', spriteAssetKey, prompt, prompt, id).run();

                    if (insertResult.meta?.changes > 0) {
                        const newId = insertResult.meta?.last_row_id;
                        await env.DB.prepare(`
                            INSERT INTO asset_generation_queue (asset_id, priority)
                            VALUES (?, 1)
                        `).bind(newId).run();
                        autoGeneratedVariations.push({ variant: spriteAssetKey, id: newId });
                    }
                }
                await logAudit(env, 'auto_queue_directions', parseInt(id), user?.username, {
                    base_type: asset.asset_key,
                    queued_variants: autoGeneratedVariations.map(v => v.variant)
                });
            }

            // Check if this is a vehicle reference that should auto-generate sprite
            if (asset.category === 'vehicle_ref' && asset.asset_key.startsWith('car')) {
                const variants = DIRECTIONAL_SPRITE_VARIANTS.car;
                for (const variant of variants) {
                    // Build asset_key same as UI: {refAssetKey}_{variant} e.g., car_sedan_sprite
                    const spriteAssetKey = `${asset.asset_key}_${variant}`;

                    // Get full prompt from database template (includes system_instructions)
                    let prompt;
                    try {
                        prompt = await getPromptForGeneration(env, 'vehicle', spriteAssetKey, '');
                    } catch (err) {
                        // Fall back to default vehicle template
                        try {
                            prompt = await getPromptForGeneration(env, 'vehicle', '_default', '');
                        } catch (err2) {
                            // Last resort: use basic NPC prompt
                            prompt = buildNPCPrompt(variant, '');
                        }
                    }

                    const insertResult = await env.DB.prepare(`
                        INSERT INTO generated_assets (category, asset_key, variant, base_prompt, current_prompt, status, parent_asset_id)
                        VALUES (?, ?, 1, ?, ?, 'pending', ?)
                        ON CONFLICT (category, asset_key, variant) DO NOTHING
                    `).bind('vehicle', spriteAssetKey, prompt, prompt, id).run();

                    if (insertResult.meta?.changes > 0) {
                        const newId = insertResult.meta?.last_row_id;
                        await env.DB.prepare(`
                            INSERT INTO asset_generation_queue (asset_id, priority)
                            VALUES (?, 1)
                        `).bind(newId).run();
                        autoGeneratedVariations.push({ variant: spriteAssetKey, id: newId });
                    }
                }
                await logAudit(env, 'auto_queue_directions', parseInt(id), user?.username, {
                    base_type: asset.asset_key,
                    queued_variants: autoGeneratedVariations.map(v => v.variant)
                });
            }

            // Non-sprite category approved (references, backgrounds, etc.)
            return Response.json({
                success: true,
                approved: true,
                is_active: true,
                message: 'Approved successfully.',
                auto_queued: autoGeneratedVariations.length > 0 ? autoGeneratedVariations : undefined
            });
        }

        // PUT /api/admin/assets/set-active/:id - Set an existing approved asset as the active one
        if (action === 'set-active' && method === 'PUT' && param1) {
            const id = param1;

            // Get asset details
            const asset = await env.DB.prepare(`
                SELECT category, asset_key, status FROM generated_assets WHERE id = ?
            `).bind(id).first();

            if (!asset) {
                return Response.json({ error: 'Asset not found' }, { status: 404 });
            }

            if (asset.status !== 'approved') {
                return Response.json({ error: 'Only approved assets can be set as active' }, { status: 400 });
            }

            // Deactivate other assets of the same category and asset_key
            await env.DB.prepare(`
                UPDATE generated_assets
                SET is_active = FALSE
                WHERE category = ? AND asset_key = ?
            `).bind(asset.category, asset.asset_key).run();

            // Set this one as active
            await env.DB.prepare(`
                UPDATE generated_assets
                SET is_active = TRUE
                WHERE id = ?
            `).bind(id).run();

            await logAudit(env, 'set_active', parseInt(id), user?.username);

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

        // POST /api/admin/assets/regenerate/:id - Regenerate an asset (creates new version, preserves old)
        // Stage 6: Enhanced to create new asset record with incremented variant, accept overrides
        if (action === 'regenerate' && method === 'POST' && param1) {
            const id = param1;

            try {
                const body = await request.json().catch(() => ({}));
                const {
                    prompt: customPrompt,
                    custom_details,
                    reference_images,
                    generation_settings,
                    preserve_old = true  // Default: preserve old version
                } = body;

                // Get original asset
                const original = await env.DB.prepare(`
                    SELECT * FROM generated_assets WHERE id = ?
                `).bind(id).first();

                if (!original) {
                    return Response.json({ success: false, error: 'Asset not found' }, { status: 404 });
                }

                // Validate status - can regenerate from review, completed, rejected, failed, approved
                const allowedStatuses = ['review', 'completed', 'rejected', 'failed', 'approved'];
                if (!allowedStatuses.includes(original.status)) {
                    return Response.json({
                        success: false,
                        error: `Cannot regenerate asset with status: ${original.status}`
                    }, { status: 400 });
                }

                // Calculate new variant number
                const maxVariant = await env.DB.prepare(`
                    SELECT MAX(variant) as max FROM generated_assets
                    WHERE category = ? AND asset_key = ?
                `).bind(original.category, original.asset_key).first();

                const newVariant = (maxVariant?.max || 0) + 1;

                // Determine the prompt - always include system_instructions from template
                let finalPrompt;
                if (customPrompt) {
                    // For all categories, try to include system_instructions from template
                    const combinedDetails = customPrompt + (custom_details ? `\n\n${custom_details}` : '');
                    try {
                        // Use database template which includes system_instructions
                        finalPrompt = await getPromptForGeneration(env, original.category, original.asset_key, combinedDetails);
                        console.log(`Regenerate: Using template with custom details (${finalPrompt.length} chars)`);
                    } catch (err) {
                        // Fall back to custom prompt if no template
                        finalPrompt = combinedDetails;
                        console.log(`Regenerate: Using custom prompt directly (${finalPrompt.length} chars)`);
                    }
                } else {
                    // No custom prompt - try to get fresh from template with original's custom details
                    try {
                        finalPrompt = await getPromptForGeneration(env, original.category, original.asset_key, custom_details || '');
                        console.log(`Regenerate: Using fresh template (${finalPrompt.length} chars)`);
                    } catch (err) {
                        // Fall back to original prompt
                        finalPrompt = original.current_prompt;
                        if (custom_details) {
                            finalPrompt += `\n\n${custom_details}`;
                        }
                        console.log(`Regenerate: Using original prompt (${finalPrompt.length} chars)`);
                    }
                }

                // Determine settings (use overrides or inherit from original)
                const originalSettings = original.generation_settings
                    ? JSON.parse(original.generation_settings)
                    : {};

                const mergedSettings = validateGenerationSettings({
                    temperature: generation_settings?.temperature ?? originalSettings.temperature,
                    topK: generation_settings?.topK ?? originalSettings.topK,
                    topP: generation_settings?.topP ?? originalSettings.topP,
                    maxOutputTokens: generation_settings?.maxOutputTokens ?? originalSettings.maxOutputTokens,
                    aspectRatio: generation_settings?.aspectRatio ?? originalSettings.aspectRatio,
                    imageSize: generation_settings?.imageSize ?? originalSettings.imageSize
                }, original.category);

                // Update old version status if preserving
                if (preserve_old) {
                    // Mark old as "completed" (ready for review/comparison)
                    // Don't change if already approved
                    if (original.status !== 'approved') {
                        await env.DB.prepare(`
                            UPDATE generated_assets
                            SET status = 'completed',
                                updated_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                        `).bind(id).run();
                    }
                }

                // Create new version
                // Note: Convert undefined to null explicitly for D1 compatibility
                const insertResult = await env.DB.prepare(`
                    INSERT INTO generated_assets (
                        category, asset_key, variant,
                        base_prompt, current_prompt,
                        status, parent_asset_id,
                        generation_settings, generation_model,
                        auto_created, auto_created_from
                    )
                    VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, 'gemini-3-pro-image-preview', ?, ?)
                    RETURNING id
                `).bind(
                    original.category,
                    original.asset_key,
                    newVariant,
                    original.base_prompt,  // Keep original base prompt
                    finalPrompt,           // Use new/modified prompt as current
                    original.parent_asset_id ?? null,
                    JSON.stringify(mergedSettings),
                    original.auto_created ? 1 : 0,  // Boolean as integer for SQLite
                    original.auto_created_from ?? null
                ).first();

                const newAssetId = insertResult.id;

                // Copy or create reference links
                if (reference_images && reference_images.length > 0) {
                    // Use new reference images
                    await storeReferenceLinks(env, newAssetId, reference_images);
                    console.log(`Stored ${reference_images.length} new reference links for regenerated asset ${newAssetId}`);
                } else {
                    // Copy reference links from original
                    const originalLinks = await env.DB.prepare(`
                        SELECT reference_image_id, approved_asset_id, link_type, sort_order
                        FROM asset_reference_links
                        WHERE asset_id = ?
                    `).bind(id).all();

                    for (const link of originalLinks.results || []) {
                        await env.DB.prepare(`
                            INSERT INTO asset_reference_links (
                                asset_id, reference_image_id, approved_asset_id,
                                link_type, sort_order
                            )
                            VALUES (?, ?, ?, ?, ?)
                        `).bind(
                            newAssetId,
                            link.reference_image_id,
                            link.approved_asset_id,
                            link.link_type,
                            link.sort_order
                        ).run();
                    }
                    if (originalLinks.results?.length > 0) {
                        console.log(`Copied ${originalLinks.results.length} reference links from original asset ${id} to ${newAssetId}`);
                    }
                }

                // Queue for generation
                await env.DB.prepare(`
                    INSERT INTO asset_generation_queue (asset_id, priority)
                    VALUES (?, 3)
                `).bind(newAssetId).run();

                // Update status to generating
                await env.DB.prepare(`
                    UPDATE generated_assets SET status = 'generating' WHERE id = ?
                `).bind(newAssetId).run();

                // Log audit
                await logAudit(env, 'regenerate', newAssetId, user?.username, {
                    original_id: parseInt(id),
                    original_variant: original.variant,
                    new_variant: newVariant,
                    had_custom_prompt: !!customPrompt,
                    had_new_references: !!(reference_images && reference_images.length > 0),
                    had_new_settings: !!generation_settings,
                    preserved_old: preserve_old,
                    settings: mergedSettings
                });

                // Fetch reference images for generation
                // First, get user-specified references from asset_reference_links
                const referenceLinksForGeneration = await env.DB.prepare(`
                    SELECT reference_image_id, approved_asset_id, link_type
                    FROM asset_reference_links
                    WHERE asset_id = ?
                    ORDER BY sort_order
                `).bind(newAssetId).all();

                const referenceSpecs = (referenceLinksForGeneration.results || []).map(link => ({
                    type: link.link_type,
                    id: link.link_type === 'library' ? link.reference_image_id : link.approved_asset_id
                }));

                let userReferenceImages = [];
                if (referenceSpecs.length > 0) {
                    userReferenceImages = await fetchReferenceImages(env, referenceSpecs);
                }

                // Fetch parent reference image if this is a sprite
                let parentReferenceImage = null;
                if (original.parent_asset_id) {
                    const parentAsset = await env.DB.prepare(`
                        SELECT r2_key_private, r2_url, asset_key, category FROM generated_assets WHERE id = ?
                    `).bind(original.parent_asset_id).first();

                    if (parentAsset) {
                        const name = `Parent: ${parentAsset.category}/${parentAsset.asset_key}`;

                        // Try public WebP first (much smaller)
                        if (parentAsset.r2_url) {
                            const publicKey = parentAsset.r2_url.replace(R2_PUBLIC_URL + '/', '');
                            const publicObject = await env.R2_PUBLIC.get(publicKey);
                            if (publicObject) {
                                const refBuffer = await publicObject.arrayBuffer();
                                parentReferenceImage = {
                                    buffer: new Uint8Array(refBuffer),
                                    mimeType: publicObject.httpMetadata?.contentType || 'image/webp',
                                    name
                                };
                                console.log(`Fetched parent ref (public WebP): ${name} (${refBuffer.byteLength} bytes)`);
                            }
                        }

                        // Fall back to private PNG - resize if large
                        if (!parentReferenceImage && parentAsset.r2_key_private) {
                            try {
                                const resized = await fetchResizedReferenceImage(env, parentAsset.r2_key_private, 1024);
                                parentReferenceImage = {
                                    buffer: resized.buffer,
                                    mimeType: resized.mimeType,
                                    name
                                };
                                console.log(`Fetched parent ref (resized): ${name} (${resized.buffer.length} bytes)`);
                            } catch (err) {
                                console.error(`Failed to fetch/resize parent ref: ${err.message}`);
                            }
                        }
                    }
                }

                // Combine reference images
                const allReferenceImages = [
                    ...userReferenceImages,
                    ...(parentReferenceImage ? [parentReferenceImage] : [])
                ];

                console.log(`Regenerating asset ${newAssetId} (v${newVariant}) with ${allReferenceImages.length} reference images`);

                // Start generation
                const generated = await generateWithGemini(env, finalPrompt, allReferenceImages, mergedSettings);

                if (generated.success) {
                    // Determine storage path
                    let r2Key;
                    if (original.category.endsWith('_ref')) {
                        r2Key = `refs/${original.asset_key}_ref_v${newVariant}.png`;
                    } else if (original.category === 'scene') {
                        r2Key = `scenes/${original.asset_key}_v${newVariant}.png`;
                    } else {
                        r2Key = `raw/${original.category}_${original.asset_key}_raw_v${newVariant}.png`;
                    }

                    // Store in PRIVATE bucket
                    await env.R2_PRIVATE.put(r2Key, generated.imageBuffer, {
                        httpMetadata: { contentType: 'image/png' }
                    });

                    // Update asset record
                    await env.DB.prepare(`
                        UPDATE generated_assets
                        SET status = 'completed', r2_key_private = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `).bind(r2Key, newAssetId).run();

                    // Update queue
                    await env.DB.prepare(`
                        UPDATE asset_generation_queue
                        SET status = 'completed', completed_at = CURRENT_TIMESTAMP
                        WHERE asset_id = ?
                    `).bind(newAssetId).run();

                    return Response.json({
                        success: true,
                        originalId: parseInt(id),
                        originalVariant: original.variant,
                        newAssetId,
                        newVariant,
                        r2_key: r2Key,
                        generation_settings: mergedSettings,
                        message: `Created new version (variant ${newVariant}). ${preserve_old ? 'Old version preserved.' : ''}`
                    });
                } else {
                    // Generation failed
                    await env.DB.prepare(`
                        UPDATE generated_assets
                        SET status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `).bind(generated.error, newAssetId).run();

                    await env.DB.prepare(`
                        UPDATE asset_generation_queue
                        SET status = 'failed', completed_at = CURRENT_TIMESTAMP
                        WHERE asset_id = ?
                    `).bind(newAssetId).run();

                    return Response.json({
                        success: false,
                        error: generated.error,
                        newAssetId,
                        newVariant,
                        message: 'Regeneration failed'
                    }, { status: 500 });
                }

            } catch (error) {
                console.error('Regenerate error:', error);
                return Response.json({ success: false, error: error.message }, { status: 500 });
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

        // GET /api/admin/assets/reference-links/:assetId - Get reference images used for an asset
        if (action === 'reference-links' && method === 'GET' && param1) {
            const assetId = param1;

            // Get reference links with associated metadata
            const links = await env.DB.prepare(`
                SELECT
                    arl.id,
                    arl.asset_id,
                    arl.reference_image_id,
                    arl.approved_asset_id,
                    arl.link_type,
                    arl.sort_order,
                    ri.name as ref_name,
                    ri.thumbnail_r2_key as ref_thumbnail_key,
                    ri.category as ref_category,
                    ga.asset_key as approved_asset_key,
                    ga.category as approved_asset_category,
                    ga.r2_url as approved_asset_url
                FROM asset_reference_links arl
                LEFT JOIN reference_images ri ON arl.reference_image_id = ri.id
                LEFT JOIN generated_assets ga ON arl.approved_asset_id = ga.id
                WHERE arl.asset_id = ?
                ORDER BY arl.sort_order
            `).bind(assetId).all();

            // Transform to frontend-friendly format with thumbnail URLs
            const referenceLinks = await Promise.all((links.results || []).map(async (link) => {
                let thumbnailUrl = null;
                let name = '';

                if (link.link_type === 'library' && link.ref_thumbnail_key) {
                    // Get signed URL for library reference thumbnail
                    const thumbnailObject = await env.R2_PRIVATE.get(link.ref_thumbnail_key);
                    if (thumbnailObject) {
                        const buffer = await thumbnailObject.arrayBuffer();
                        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
                        thumbnailUrl = `data:image/png;base64,${base64}`;
                    }
                    name = link.ref_name || `Reference #${link.reference_image_id}`;
                } else if (link.link_type === 'approved_asset') {
                    // Use public URL for approved asset
                    thumbnailUrl = link.approved_asset_url;
                    name = link.approved_asset_key
                        ? `${link.approved_asset_category}/${link.approved_asset_key}`
                        : `Asset #${link.approved_asset_id}`;
                }

                return {
                    id: link.id,
                    link_type: link.link_type,
                    reference_image_id: link.reference_image_id,
                    approved_asset_id: link.approved_asset_id,
                    thumbnailUrl,
                    name,
                    sort_order: link.sort_order
                };
            }));

            return Response.json({
                success: true,
                referenceLinks
            });
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

            // Build the full prompt with system_instructions from template
            let fullPrompt;
            try {
                fullPrompt = await getPromptForGeneration(env, spriteCategory.id, ref.asset_key, sprite_prompt || '');
                console.log(`generate-from-ref: Using template with details (${fullPrompt.length} chars)`);
            } catch (err) {
                // Fall back to provided sprite_prompt if no template
                fullPrompt = sprite_prompt || buildAssetPrompt(spriteCategory.id, ref.asset_key, '');
                console.log(`generate-from-ref: Using fallback prompt (${fullPrompt.length} chars)`);
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
                fullPrompt,
                fullPrompt,
                refId
            ).first();

            // Generate the sprite with sprite-appropriate settings (1:1 aspect, 4K)
            const spriteSettings = validateGenerationSettings({}, spriteCategory.id);
            const generated = await generateWithGemini(env, fullPrompt, [], spriteSettings);

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

        // POST /api/admin/assets/reprocess-sprites - Reprocess existing approved sprites with WebP conversion + resize
        // Takes existing _transparent.png from private bucket and creates properly sized WebP in public bucket
        if (action === 'reprocess-sprites' && method === 'POST') {
            const { category, dry_run } = await request.json().catch(() => ({}));
            const targetCategory = category || 'building_sprite';

            // Find all approved sprites that have a transparent PNG in private bucket
            const sprites = await env.DB.prepare(`
                SELECT id, category, asset_key, variant, r2_key_private, r2_key_public, r2_url
                FROM generated_assets
                WHERE category = ?
                  AND status = 'approved'
                  AND background_removed = TRUE
                  AND r2_key_private LIKE '%_transparent.png'
                ORDER BY asset_key
            `).bind(targetCategory).all();

            if (!sprites.results || sprites.results.length === 0) {
                return Response.json({
                    success: false,
                    message: `No approved ${targetCategory} assets found with transparent PNG`,
                    hint: 'Make sure sprites are approved and have background removed'
                });
            }

            if (dry_run) {
                return Response.json({
                    success: true,
                    dry_run: true,
                    message: `Would reprocess ${sprites.results.length} sprites`,
                    sprites: sprites.results.map(s => ({
                        id: s.id,
                        asset_key: s.asset_key,
                        source: s.r2_key_private,
                        target_dimensions: getTargetDimensions(s.category, s.asset_key)
                    }))
                });
            }

            const results = [];
            for (const sprite of sprites.results) {
                try {
                    // Fetch the transparent PNG from private bucket
                    const pngObject = await env.R2_PRIVATE.get(sprite.r2_key_private);
                    if (!pngObject) {
                        results.push({ id: sprite.id, asset_key: sprite.asset_key, success: false, error: 'PNG not found in private bucket' });
                        continue;
                    }

                    const pngBuffer = await pngObject.arrayBuffer();
                    const targetDims = getTargetDimensions(sprite.category, sprite.asset_key);

                    if (!targetDims) {
                        results.push({ id: sprite.id, asset_key: sprite.asset_key, success: false, error: 'No target dimensions defined' });
                        continue;
                    }

                    // Resize and convert to WebP using Cloudflare Image Transformations
                    const tempKey = `_temp/${sprite.category}_${sprite.asset_key}_${Date.now()}.png`;
                    const webpBuffer = await resizeViaCloudflare(
                        env,
                        pngBuffer,
                        tempKey,
                        targetDims.width,
                        targetDims.height
                    );

                    // Save to public bucket
                    const gameReadyKey = `sprites/${sprite.category}/${sprite.asset_key}_v${sprite.variant}.webp`;
                    await env.R2_PUBLIC.put(gameReadyKey, webpBuffer, {
                        httpMetadata: { contentType: 'image/webp' }
                    });
                    const gameReadyUrl = `https://assets.notropolis.net/${gameReadyKey}`;

                    // Update database
                    await env.DB.prepare(`
                        UPDATE generated_assets
                        SET r2_key_public = ?, r2_url = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `).bind(gameReadyKey, gameReadyUrl, sprite.id).run();

                    results.push({
                        id: sprite.id,
                        asset_key: sprite.asset_key,
                        success: true,
                        dimensions: targetDims,
                        public_url: gameReadyUrl
                    });
                } catch (err) {
                    results.push({ id: sprite.id, asset_key: sprite.asset_key, success: false, error: err.message });
                }
            }

            await logAudit(env, 'reprocess_sprites', null, user?.username, {
                category: targetCategory,
                total: sprites.results.length,
                successful: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length
            });

            return Response.json({
                success: true,
                message: `Reprocessed ${results.filter(r => r.success).length}/${sprites.results.length} sprites`,
                results
            });
        }

        // POST /api/admin/assets/upload-outline/:id - Upload pre-generated outline for a sprite
        // Receives base64 WebP data and stores it alongside the sprite
        if (action === 'upload-outline' && method === 'POST' && param1) {
            const assetId = parseInt(param1);
            const { outline_data } = await request.json();

            if (!outline_data) {
                return Response.json({ success: false, error: 'Missing outline_data' }, { status: 400 });
            }

            // Get the asset to find its public key pattern
            const asset = await env.DB.prepare(`
                SELECT id, category, asset_key, variant, r2_key_public
                FROM generated_assets
                WHERE id = ?
            `).bind(assetId).first();

            if (!asset) {
                return Response.json({ success: false, error: 'Asset not found' }, { status: 404 });
            }

            if (!asset.r2_key_public) {
                return Response.json({ success: false, error: 'Asset has no public sprite' }, { status: 400 });
            }

            // Convert base64 to buffer
            const base64Data = outline_data.replace(/^data:image\/webp;base64,/, '');
            const outlineBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

            // Generate outline key based on sprite key
            const outlineKey = asset.r2_key_public.replace('.webp', '_outline.webp');

            // Upload to R2
            await env.R2_PUBLIC.put(outlineKey, outlineBuffer, {
                httpMetadata: { contentType: 'image/webp' }
            });

            const outlineUrl = `${R2_PUBLIC_URL}/${outlineKey}`;

            // Update database
            await env.DB.prepare(`
                UPDATE generated_assets
                SET outline_url = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).bind(outlineUrl, assetId).run();

            await logAudit(env, 'upload_outline', assetId, user?.username, {
                outline_key: outlineKey,
                outline_url: outlineUrl,
                size_bytes: outlineBuffer.length
            });

            return Response.json({
                success: true,
                outline_url: outlineUrl,
                outline_key: outlineKey
            });
        }

        // GET /api/admin/assets/sprites-for-outline - Get all published building sprites that need outlines
        if (action === 'sprites-for-outline' && method === 'GET') {
            const sprites = await env.DB.prepare(`
                SELECT ga.id, ga.category, ga.asset_key, ga.variant, ga.r2_url, ga.outline_url
                FROM generated_assets ga
                JOIN asset_configurations ac ON ga.category = ac.category AND ga.asset_key = ac.asset_key
                WHERE ga.category = 'building_sprite'
                  AND ga.status = 'approved'
                  AND ac.is_published = TRUE
                  AND ga.r2_url IS NOT NULL
                ORDER BY ga.asset_key, ga.variant
            `).all();

            return Response.json({
                success: true,
                sprites: sprites.results,
                total: sprites.results.length,
                with_outline: sprites.results.filter(s => s.outline_url).length,
                without_outline: sprites.results.filter(s => !s.outline_url).length
            });
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
                SELECT
                    bt.id as building_type_id,
                    bt.name as building_name,
                    bt.cost as base_cost,
                    bt.base_profit,
                    bt.level_required,
                    bt.requires_license,
                    bc.active_sprite_id,
                    bc.cost_override,
                    bc.base_profit_override,
                    COALESCE(bc.cost_override, bt.cost) as effective_cost,
                    COALESCE(bc.base_profit_override, bt.base_profit) as effective_profit,
                    COALESCE(bc.is_published, 0) as is_published,
                    bc.published_at,
                    bc.published_by,
                    ga.r2_url as sprite_url,
                    (SELECT COUNT(*) FROM generated_assets
                     WHERE category = 'building_sprite'
                     AND asset_key = bt.id
                     AND status = 'approved') as available_sprites
                FROM building_types bt
                LEFT JOIN building_configurations bc ON bt.id = bc.building_type_id
                LEFT JOIN generated_assets ga ON bc.active_sprite_id = ga.id
                ORDER BY bt.name
            `).all();

            return Response.json({ success: true, buildings: buildings.results });
        }

        // GET /api/admin/assets/buildings/:buildingType/sprites - Get available sprites
        if (action === 'buildings' && method === 'GET' && param1 && param2 === 'sprites') {
            const buildingType = param1;

            const sprites = await env.DB.prepare(`
                SELECT ga.*,
                       ga.r2_key_private as r2_key,
                       CASE WHEN ga.r2_url IS NOT NULL THEN ga.r2_url ELSE NULL END as public_url,
                       (SELECT bc.active_sprite_id FROM building_configurations bc
                        WHERE bc.building_type_id = ?) = ga.id as is_active
                FROM generated_assets ga
                WHERE ga.category = 'building_sprite'
                  AND ga.asset_key = ?
                  AND ga.status = 'approved'
                ORDER BY ga.created_at DESC
            `).bind(buildingType, buildingType).all();

            return Response.json({ success: true, sprites: sprites.results });
        }

        // PUT /api/admin/assets/buildings/:buildingType - Update building configuration
        if (action === 'buildings' && method === 'PUT' && param1 && !param2) {
            const buildingType = param1;
            const body = await request.json();
            // Convert undefined to null for D1 compatibility
            const active_sprite_id = body.active_sprite_id ?? null;
            const cost_override = body.cost_override ?? null;
            const base_profit_override = body.base_profit_override ?? null;

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
            const body = await request.json();
            const { name, description, background_r2_key, foreground_r2_key, avatar_slot, width, height } = body;

            // Check if template already exists
            const existing = await env.DB.prepare(`
                SELECT * FROM scene_templates WHERE id = ?
            `).bind(sceneId).first();

            // If no existing template, require all fields for creation
            if (!existing && (!name || !background_r2_key || !avatar_slot)) {
                return Response.json({
                    error: 'name, background_r2_key, and avatar_slot are required for new templates'
                }, { status: 400 });
            }

            // If avatar_slot is provided, validate it
            let avatarSlotJson = null;
            if (avatar_slot) {
                const slot = typeof avatar_slot === 'string' ? JSON.parse(avatar_slot) : avatar_slot;
                if (typeof slot.x !== 'number' || typeof slot.y !== 'number' ||
                    typeof slot.width !== 'number' || typeof slot.height !== 'number') {
                    return Response.json({
                        error: 'avatar_slot must have x, y, width, height as numbers'
                    }, { status: 400 });
                }
                avatarSlotJson = JSON.stringify(slot);
            }

            if (existing) {
                // Partial update for existing template
                const updates = [];
                const params = [];
                if (name !== undefined) { updates.push('name = ?'); params.push(name); }
                if (description !== undefined) { updates.push('description = ?'); params.push(description); }
                if (background_r2_key !== undefined) { updates.push('background_r2_key = ?'); params.push(background_r2_key); }
                if (foreground_r2_key !== undefined) { updates.push('foreground_r2_key = ?'); params.push(foreground_r2_key); }
                if (avatarSlotJson !== null) { updates.push('avatar_slot = ?'); params.push(avatarSlotJson); }
                if (width !== undefined) { updates.push('width = ?'); params.push(width); }
                if (height !== undefined) { updates.push('height = ?'); params.push(height); }
                updates.push('updated_at = CURRENT_TIMESTAMP');
                params.push(sceneId);

                await env.DB.prepare(`
                    UPDATE scene_templates SET ${updates.join(', ')} WHERE id = ?
                `).bind(...params).run();
            } else {
                // Insert new template
                await env.DB.prepare(`
                    INSERT INTO scene_templates (id, name, description, background_r2_key, foreground_r2_key, avatar_slot, width, height)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(sceneId, name, description, background_r2_key, foreground_r2_key, avatarSlotJson, width || 1920, height || 1080).run();
            }

            // Invalidate all cached scenes for this template
            await env.DB.prepare(`
                DELETE FROM composed_scene_cache WHERE scene_template_id = ?
            `).bind(sceneId).run();

            await logAudit(env, 'scene_template_updated', null, user?.username, {
                scene_id: sceneId,
                name: name || existing?.name
            });

            return Response.json({ success: true, message: 'Scene template saved.' });
        }

        // POST /api/admin/assets/scenes/templates/:sceneId/publish - Publish scene template
        if (action === 'scenes' && param1 === 'templates' && method === 'POST' && param2 && param3 === 'publish') {
            const sceneId = param2;

            const template = await env.DB.prepare(`
                SELECT * FROM scene_templates WHERE id = ?
            `).bind(sceneId).first();

            if (!template) {
                return Response.json({ error: 'Scene template not found' }, { status: 404 });
            }

            await env.DB.prepare(`
                UPDATE scene_templates SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?
            `).bind(sceneId).run();

            await logAudit(env, 'scene_template_published', null, user?.username, {
                scene_id: sceneId,
                name: template.name
            });

            return Response.json({ success: true, message: 'Scene template published.' });
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
            } else if (asset.category === 'avatar') {
                // Avatar assets go to avatars/ folder (for compositing system)
                // Keep as PNG for compositing transparency
                gameReadyKey = `avatars/${asset.asset_key}_v${asset.variant}.png`;
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

        // ============================================
        // REFERENCE LIBRARY ENDPOINTS
        // ============================================

        // GET /api/admin/assets/reference-library - List reference images
        if (action === 'reference-library' && method === 'GET' && !param1) {
            const category = url.searchParams.get('category');
            const search = url.searchParams.get('search');
            const archived = url.searchParams.get('archived') === 'true';
            const sourceType = url.searchParams.get('source_type');

            let query = `
                SELECT
                    id, name, description, category, tags,
                    thumbnail_r2_key, width, height, file_size, mime_type,
                    usage_count, uploaded_by, source_type, created_at
                FROM reference_images
                WHERE is_archived = ?
            `;
            const params = [archived];

            if (category) {
                query += ` AND category = ?`;
                params.push(category);
            }

            if (sourceType) {
                query += ` AND source_type = ?`;
                params.push(sourceType);
            }

            if (search) {
                query += ` AND (name LIKE ? OR description LIKE ? OR tags LIKE ?)`;
                const searchPattern = `%${search}%`;
                params.push(searchPattern, searchPattern, searchPattern);
            }

            query += ` ORDER BY created_at DESC`;

            const results = await env.DB.prepare(query).bind(...params).all();

            // Get distinct categories and source types for filter UI
            const categoriesResult = await env.DB.prepare(`
                SELECT DISTINCT category FROM reference_images WHERE is_archived = FALSE AND category IS NOT NULL ORDER BY category
            `).all();
            const sourceTypesResult = await env.DB.prepare(`
                SELECT DISTINCT source_type FROM reference_images WHERE is_archived = FALSE AND source_type IS NOT NULL ORDER BY source_type
            `).all();

            // Generate thumbnail URLs for each image (using R2 key path through worker)
            const serverUrl = env.SERVER_URL || 'https://api.notropolis.net';
            const images = (results.results || []).map(img => ({
                ...img,
                tags: img.tags ? JSON.parse(img.tags) : [],
                thumbnailUrl: img.thumbnail_r2_key
                    ? `${serverUrl}/api/admin/assets/reference-library/serve/${encodeURIComponent(img.thumbnail_r2_key)}`
                    : null
            }));

            return Response.json({
                success: true,
                images,
                count: images.length,
                filters: {
                    categories: (categoriesResult.results || []).map(r => r.category),
                    sourceTypes: (sourceTypesResult.results || []).map(r => r.source_type)
                }
            });
        }

        // GET /api/admin/assets/reference-library/:id - Get single reference image
        if (action === 'reference-library' && method === 'GET' && param1 && !param2) {
            const id = param1;

            const image = await env.DB.prepare(`
                SELECT * FROM reference_images WHERE id = ?
            `).bind(id).first();

            if (!image) {
                return Response.json({ success: false, error: 'Image not found' }, { status: 404 });
            }

            const serverUrl = env.SERVER_URL || 'https://api.notropolis.net';
            return Response.json({
                success: true,
                image: {
                    ...image,
                    tags: image.tags ? JSON.parse(image.tags) : [],
                    thumbnailUrl: image.thumbnail_r2_key
                        ? `${serverUrl}/api/admin/assets/reference-library/serve/${encodeURIComponent(image.thumbnail_r2_key)}`
                        : null
                }
            });
        }

        // GET /api/admin/assets/reference-library/:id/preview - Get full-size preview URL
        if (action === 'reference-library' && method === 'GET' && param1 && param2 === 'preview') {
            const id = param1;

            const image = await env.DB.prepare(`
                SELECT r2_key, mime_type FROM reference_images WHERE id = ?
            `).bind(id).first();

            if (!image) {
                return Response.json({ success: false, error: 'Image not found' }, { status: 404 });
            }

            // Return a worker URL that serves the image
            const serverUrl = env.SERVER_URL || 'https://api.notropolis.net';
            return Response.json({
                success: true,
                previewUrl: `${serverUrl}/api/admin/assets/reference-library/serve/${encodeURIComponent(image.r2_key)}`,
                mimeType: image.mime_type
            });
        }

        // GET /api/admin/assets/reference-library/serve/:key - Serve image from R2 (internal)
        if (action === 'reference-library' && param1 === 'serve' && method === 'GET' && param2) {
            // Reconstruct the full key from remaining path parts
            const keyParts = pathParts.slice(2); // Skip 'reference-library' and 'serve'
            const r2Key = decodeURIComponent(keyParts.join('/'));

            const object = await env.R2_PRIVATE.get(r2Key);

            if (!object) {
                return Response.json({ success: false, error: 'Image not found in storage' }, { status: 404 });
            }

            // Return the image directly
            const headers = new Headers();
            headers.set('Content-Type', object.httpMetadata?.contentType || 'image/png');
            headers.set('Cache-Control', 'private, max-age=3600');

            return new Response(object.body, { headers });
        }

        // POST /api/admin/assets/reference-library/upload - Upload new reference image
        if (action === 'reference-library' && param1 === 'upload' && method === 'POST') {
            try {
                const formData = await request.formData();
                const file = formData.get('file');
                const name = formData.get('name');
                const description = formData.get('description') || null;
                const category = formData.get('category') || 'general';
                const tags = formData.get('tags') || '[]';

                if (!file || !name) {
                    return Response.json({ success: false, error: 'File and name are required' }, { status: 400 });
                }

                // Validate file type
                const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
                if (!validTypes.includes(file.type)) {
                    return Response.json({
                        success: false,
                        error: `Invalid file type. Allowed: ${validTypes.join(', ')}`
                    }, { status: 400 });
                }

                // Read file buffer
                const arrayBuffer = await file.arrayBuffer();
                const buffer = new Uint8Array(arrayBuffer);

                // Generate unique filename
                const timestamp = Date.now();
                const sanitizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
                const extension = file.type.split('/')[1];
                const r2Key = `reference-library/${category}/${sanitizedName}_${timestamp}.${extension}`;

                // Upload to R2 private bucket
                await env.R2_PRIVATE.put(r2Key, buffer, {
                    httpMetadata: { contentType: file.type }
                });

                // MVP: Use same key for thumbnail (use Cloudflare transforms at read time)
                const thumbnailKey = r2Key;

                // Get image dimensions
                const dimensions = getImageDimensions(buffer);

                // Get source_type from form data (default to 'upload')
                const sourceType = formData.get('source_type') || 'upload';
                const uploadedBy = user?.username || 'system';

                // Insert database record
                const result = await env.DB.prepare(`
                    INSERT INTO reference_images (
                        name, description, category, tags,
                        r2_key, thumbnail_r2_key,
                        width, height, file_size, mime_type,
                        uploaded_by, source_type
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    RETURNING id
                `).bind(
                    name, description, category, tags,
                    r2Key, thumbnailKey,
                    dimensions.width, dimensions.height, buffer.length, file.type,
                    uploadedBy, sourceType
                ).first();

                // Log audit (null for asset_id since this is a reference image, not a generated asset)
                await logAudit(env, 'upload_reference_image', null, uploadedBy, {
                    reference_image_id: result.id,
                    name, category, file_size: buffer.length, source_type: sourceType
                });

                return Response.json({
                    success: true,
                    image: {
                        id: result.id,
                        name,
                        category,
                        r2Key,
                        thumbnailKey,
                        width: dimensions.width,
                        height: dimensions.height,
                        fileSize: buffer.length,
                        sourceType,
                        uploadedBy
                    }
                });

            } catch (error) {
                console.error('Upload error:', error);
                return Response.json({ success: false, error: error.message }, { status: 500 });
            }
        }

        // PUT /api/admin/assets/reference-library/:id - Update metadata
        if (action === 'reference-library' && method === 'PUT' && param1 && !param2) {
            const id = param1;
            const body = await request.json();

            // Validate image exists and is not archived
            const existing = await env.DB.prepare(`
                SELECT id FROM reference_images WHERE id = ? AND is_archived = FALSE
            `).bind(id).first();

            if (!existing) {
                return Response.json({ success: false, error: 'Image not found' }, { status: 404 });
            }

            // Build update query dynamically
            const updates = [];
            const values = [];

            if (body.name !== undefined) {
                updates.push('name = ?');
                values.push(body.name);
            }
            if (body.description !== undefined) {
                updates.push('description = ?');
                values.push(body.description);
            }
            if (body.category !== undefined) {
                updates.push('category = ?');
                values.push(body.category);
            }
            if (body.tags !== undefined) {
                updates.push('tags = ?');
                values.push(JSON.stringify(body.tags));
            }

            if (updates.length === 0) {
                return Response.json({ success: false, error: 'No fields to update' }, { status: 400 });
            }

            updates.push('updated_at = CURRENT_TIMESTAMP');
            values.push(id);

            await env.DB.prepare(`
                UPDATE reference_images
                SET ${updates.join(', ')}
                WHERE id = ?
            `).bind(...values).run();

            // Log audit (null for asset_id since this is a reference image, not a generated asset)
            await logAudit(env, 'update_reference_image', null, user?.username, {
                reference_image_id: parseInt(id),
                ...body
            });

            return Response.json({ success: true });
        }

        // DELETE /api/admin/assets/reference-library/:id - Archive (soft delete)
        if (action === 'reference-library' && method === 'DELETE' && param1 && !param2) {
            const id = param1;

            // Check if image is in use
            const usageCount = await env.DB.prepare(`
                SELECT COUNT(*) as count FROM asset_reference_links
                WHERE reference_image_id = ?
            `).bind(id).first();

            // Soft delete (archive)
            const result = await env.DB.prepare(`
                UPDATE reference_images
                SET is_archived = TRUE, archived_at = CURRENT_TIMESTAMP
                WHERE id = ? AND is_archived = FALSE
            `).bind(id).run();

            if (result.meta.changes === 0) {
                return Response.json({ success: false, error: 'Image not found or already archived' }, { status: 404 });
            }

            // Log audit (null for asset_id since this is a reference image, not a generated asset)
            await logAudit(env, 'archive_reference_image', null, user?.username, {
                reference_image_id: parseInt(id),
                was_in_use: usageCount.count > 0,
                usage_count: usageCount.count
            });

            return Response.json({
                success: true,
                archived: true,
                wasInUse: usageCount.count > 0
            });
        }

        // ============================================
        // PROMPT TEMPLATE ENDPOINTS
        // ============================================

        // GET /api/admin/assets/prompts - List all categories with their templates
        if (action === 'prompts' && method === 'GET' && !param1) {
            const templates = await env.DB.prepare(`
                SELECT DISTINCT category, asset_key, template_name
                FROM prompt_templates
                WHERE is_active = TRUE
                ORDER BY category, asset_key
            `).all();

            // Group by category
            const grouped = (templates.results || []).reduce((acc, t) => {
                if (!acc[t.category]) {
                    acc[t.category] = [];
                }
                acc[t.category].push({
                    assetKey: t.asset_key,
                    templateName: t.template_name
                });
                return acc;
            }, {});

            return Response.json({
                success: true,
                categories: grouped
            });
        }

        // GET /api/admin/assets/prompts/:category/:assetKey - Get active template
        if (action === 'prompts' && method === 'GET' && param1 && param2 && !param3) {
            const category = param1;
            const assetKey = param2;

            // Try specific template first
            let template = await env.DB.prepare(`
                SELECT * FROM prompt_templates
                WHERE category = ? AND asset_key = ? AND is_active = TRUE
            `).bind(category, assetKey).first();

            // Fall back to category default if no specific template
            if (!template) {
                template = await env.DB.prepare(`
                    SELECT * FROM prompt_templates
                    WHERE category = ? AND asset_key = '_default' AND is_active = TRUE
                `).bind(category).first();
            }

            // NO hardcoded fallback - fail explicitly to avoid wasting Gemini tokens
            if (!template) {
                return Response.json({
                    success: false,
                    error: `No prompt template found for ${category}/${assetKey}. Run the seed migration (0027_seed_prompt_templates.sql) first.`
                }, { status: 404 });
            }

            return Response.json({
                success: true,
                template: {
                    id: template.id,
                    category: template.category,
                    assetKey: template.asset_key,
                    templateName: template.template_name,
                    basePrompt: template.base_prompt,
                    styleGuide: template.style_guide,
                    systemInstructions: template.system_instructions,
                    version: template.version,
                    createdBy: template.created_by,
                    updatedAt: template.updated_at,
                    isHardcoded: false
                }
            });
        }

        // GET /api/admin/assets/prompts/:category/:assetKey/history - Version history
        if (action === 'prompts' && method === 'GET' && param1 && param2 && param3 === 'history') {
            const category = param1;
            const assetKey = param2;

            const versions = await env.DB.prepare(`
                SELECT
                    id, version, is_active,
                    base_prompt, style_guide,
                    created_by, created_at, change_notes
                FROM prompt_templates
                WHERE category = ? AND asset_key = ?
                ORDER BY version DESC
            `).bind(category, assetKey).all();

            return Response.json({
                success: true,
                versions: (versions.results || []).map(v => ({
                    id: v.id,
                    version: v.version,
                    isActive: v.is_active,
                    basePrompt: v.base_prompt,
                    styleGuide: v.style_guide,
                    createdBy: v.created_by,
                    createdAt: v.created_at,
                    changeNotes: v.change_notes
                }))
            });
        }

        // PUT /api/admin/assets/prompts/:category/:assetKey - Update template (creates new version)
        if (action === 'prompts' && method === 'PUT' && param1 && param2 && !param3) {
            const category = param1;
            const assetKey = param2;
            const body = await request.json();

            const { basePrompt, styleGuide, systemInstructions, templateName, changeNotes } = body;

            if (!basePrompt) {
                return Response.json({ success: false, error: 'basePrompt is required' }, { status: 400 });
            }

            // Get current version number
            const current = await env.DB.prepare(`
                SELECT MAX(version) as maxVersion FROM prompt_templates
                WHERE category = ? AND asset_key = ?
            `).bind(category, assetKey).first();

            const newVersion = (current?.maxVersion || 0) + 1;

            // CRITICAL: D1 does not enforce unique active constraint
            // Deactivate current active version FIRST, then insert new one
            await env.DB.prepare(`
                UPDATE prompt_templates
                SET is_active = FALSE
                WHERE category = ? AND asset_key = ? AND is_active = TRUE
            `).bind(category, assetKey).run();

            // Insert new version
            const result = await env.DB.prepare(`
                INSERT INTO prompt_templates (
                    category, asset_key, template_name,
                    base_prompt, style_guide, system_instructions,
                    version, is_active, created_by, change_notes
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?)
            `).bind(
                category, assetKey, templateName || `${category}/${assetKey}`,
                basePrompt, styleGuide || null, systemInstructions || null,
                newVersion, user?.username || 'system', changeNotes || null
            ).run();

            const templateId = result.meta.last_row_id;

            // Log audit
            await logAudit(env, 'update_prompt_template', null, user?.username, {
                category, assetKey, version: newVersion, changeNotes, templateId
            });

            return Response.json({
                success: true,
                templateId,
                version: newVersion
            });
        }

        // POST /api/admin/assets/prompts/:category/:assetKey/reset - Reset to system default
        if (action === 'prompts' && method === 'POST' && param1 && param2 && param3 === 'reset') {
            const category = param1;
            const assetKey = param2;

            // Find the original system template (version 1, created_by = 'system')
            const systemTemplate = await env.DB.prepare(`
                SELECT * FROM prompt_templates
                WHERE category = ? AND asset_key = ? AND version = 1 AND created_by = 'system'
            `).bind(category, assetKey).first();

            if (!systemTemplate) {
                return Response.json({
                    success: false,
                    error: 'No system default found for this template'
                }, { status: 404 });
            }

            // Get current max version
            const current = await env.DB.prepare(`
                SELECT MAX(version) as maxVersion FROM prompt_templates
                WHERE category = ? AND asset_key = ?
            `).bind(category, assetKey).first();

            const newVersion = (current?.maxVersion || 0) + 1;

            // Deactivate all current active versions
            await env.DB.prepare(`
                UPDATE prompt_templates
                SET is_active = FALSE
                WHERE category = ? AND asset_key = ? AND is_active = TRUE
            `).bind(category, assetKey).run();

            // Create a new version that's a copy of the system template
            const result = await env.DB.prepare(`
                INSERT INTO prompt_templates (
                    category, asset_key, template_name,
                    base_prompt, style_guide, system_instructions,
                    version, is_active, created_by, change_notes
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?)
            `).bind(
                category, assetKey, systemTemplate.template_name,
                systemTemplate.base_prompt, systemTemplate.style_guide, systemTemplate.system_instructions,
                newVersion, user?.username || 'system', 'Reset to system default'
            ).run();

            // Log audit
            await logAudit(env, 'reset_prompt_template', null, user?.username, {
                category, assetKey, version: newVersion, resetToVersion: 1
            });

            return Response.json({
                success: true,
                templateId: result.meta.last_row_id,
                version: newVersion,
                message: 'Template reset to system default'
            });
        }

        // ============================================
        // STAGE 10: ASSET CONFIGURATION ENDPOINTS
        // ============================================

        // GET /api/admin/assets/configurations/:category - List all configurations for a category
        if (action === 'configurations' && method === 'GET' && param1 && !param2) {
            const category = param1;

            // For buildings, use existing building_configurations table
            if (category === 'buildings') {
                const configs = await env.DB.prepare(`
                    SELECT
                        bt.id as asset_key,
                        bt.name,
                        bc.active_sprite_id,
                        bc.cost_override,
                        bc.base_profit_override,
                        bc.map_scale,
                        bt.cost as default_cost,
                        bt.base_profit as default_profit,
                        COALESCE(bc.cost_override, bt.cost) as effective_cost,
                        COALESCE(bc.base_profit_override, bt.base_profit) as effective_profit,
                        COALESCE(bc.is_published, 0) as is_published,
                        bc.published_at,
                        bc.published_by,
                        ga.r2_url as sprite_url,
                        (SELECT COUNT(*) FROM generated_assets
                         WHERE category = 'building_sprite'
                         AND asset_key = bt.id
                         AND status = 'approved') as available_sprites
                    FROM building_types bt
                    LEFT JOIN building_configurations bc ON bt.id = bc.building_type_id
                    LEFT JOIN generated_assets ga ON bc.active_sprite_id = ga.id
                    ORDER BY bt.name
                `).all();

                // Add default_map_scale and effective_map_scale from code constants
                const configurationsWithDefaults = configs.results.map(config => ({
                    ...config,
                    default_map_scale: getDefaultMapScale('building_sprite', config.asset_key),
                    effective_map_scale: config.map_scale ?? getDefaultMapScale('building_sprite', config.asset_key)
                }));

                return Response.json({ success: true, configurations: configurationsWithDefaults });
            }

            // For base_ground, dynamically build list from approved grass_bg sprites
            if (category === 'base_ground') {
                // Get all approved grass_bg sprites from generated_assets
                const approvedSprites = await env.DB.prepare(`
                    SELECT
                        ga.id,
                        ga.asset_key,
                        ga.r2_url as sprite_url,
                        ga.created_at
                    FROM generated_assets ga
                    WHERE ga.category = 'terrain'
                      AND ga.asset_key = 'grass_bg'
                      AND ga.status = 'approved'
                    ORDER BY ga.created_at DESC
                `).all();

                // Get current active base_ground configuration
                const activeConfig = await env.DB.prepare(`
                    SELECT asset_key, active_sprite_id, is_active
                    FROM asset_configurations
                    WHERE category = 'base_ground' AND is_active = TRUE
                    LIMIT 1
                `).first();

                // Build configurations from approved sprites
                const configurations = approvedSprites.results.map((sprite) => ({
                    id: sprite.id,
                    category: 'base_ground',
                    asset_key: `grass_bg_${sprite.id}`,
                    active_sprite_id: sprite.id,
                    sprite_url: sprite.sprite_url,
                    is_active: activeConfig?.active_sprite_id === sprite.id,
                    available_sprites: 1,
                    created_at: sprite.created_at
                }));

                return Response.json({ success: true, configurations });
            }

            // For other categories, use asset_configurations table
            // Map configuration category to sprite category for the count
            const spriteCategoryMap = {
                'npcs': 'npc',
                'effects': 'effect',
                'terrain': 'terrain',
                'tricks': 'overlay',
            };
            const spriteCategory = spriteCategoryMap[category] || category;

            const configs = await env.DB.prepare(`
                SELECT
                    ac.*,
                    ga.r2_url as sprite_url,
                    ga.asset_key as sprite_key,
                    (SELECT COUNT(*) FROM generated_assets
                     WHERE category = ? AND asset_key = ac.asset_key
                     AND status = 'approved') as available_sprites
                FROM asset_configurations ac
                LEFT JOIN generated_assets ga ON ac.active_sprite_id = ga.id
                WHERE ac.category = ?
                ORDER BY ac.asset_key
            `).bind(spriteCategory, category).all();

            // Add default_map_scale and effective_map_scale from code constants
            const configurationsWithDefaults = configs.results.map(config => ({
                ...config,
                default_map_scale: getDefaultMapScale(config.category, config.asset_key),
                effective_map_scale: config.map_scale ?? getDefaultMapScale(config.category, config.asset_key)
            }));

            return Response.json({ success: true, configurations: configurationsWithDefaults });
        }

        // GET /api/admin/assets/configurations/:category/:assetKey/sprites - Get available sprites for an asset
        if (action === 'configurations' && method === 'GET' && param1 && param2 && param3 === 'sprites') {
            const category = param1;
            const assetKey = param2;

            // Map configuration category to sprite category
            const spriteCategoryMap = {
                'buildings': 'building_sprite',
                'npcs': 'npc',
                'effects': 'effect',
                'terrain': 'terrain',
                'base_ground': 'terrain',
                'tricks': 'overlay',
            };

            const spriteCategory = spriteCategoryMap[category] || category;

            const sprites = await env.DB.prepare(`
                SELECT ga.*,
                       ga.r2_key_private as r2_key,
                       CASE WHEN ga.r2_url IS NOT NULL THEN ga.r2_url ELSE NULL END as public_url
                FROM generated_assets ga
                WHERE ga.category = ?
                  AND ga.asset_key = ?
                  AND ga.status = 'approved'
                ORDER BY ga.created_at DESC
            `).bind(spriteCategory, assetKey).all();

            return Response.json({ success: true, sprites: sprites.results });
        }

        // PUT /api/admin/assets/configurations/:category/:assetKey - Update configuration for an asset
        if (action === 'configurations' && method === 'PUT' && param1 && param2 && !param3) {
            const category = param1;
            const assetKey = param2;
            const body = await request.json();

            // For buildings, use existing building_configurations table
            if (category === 'buildings') {
                const { active_sprite_id, cost_override, base_profit_override, map_scale } = body;

                await env.DB.prepare(`
                    INSERT INTO building_configurations (building_type_id, active_sprite_id, cost_override, base_profit_override, map_scale)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT (building_type_id) DO UPDATE SET
                        active_sprite_id = COALESCE(excluded.active_sprite_id, building_configurations.active_sprite_id),
                        cost_override = excluded.cost_override,
                        base_profit_override = excluded.base_profit_override,
                        map_scale = excluded.map_scale,
                        updated_at = CURRENT_TIMESTAMP
                `).bind(assetKey, active_sprite_id || null, cost_override ?? null, base_profit_override ?? null, map_scale ?? null).run();

                await logAudit(env, 'update_building_config', active_sprite_id, user?.username, {
                    building_type: assetKey, cost_override, base_profit_override, map_scale
                });

                return Response.json({ success: true, message: 'Building configuration updated' });
            }

            // For other categories, use asset_configurations table
            const { active_sprite_id, config, is_active, map_scale } = body;

            await env.DB.prepare(`
                INSERT INTO asset_configurations (category, asset_key, active_sprite_id, config, is_active, map_scale)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT (category, asset_key) DO UPDATE SET
                    active_sprite_id = COALESCE(excluded.active_sprite_id, asset_configurations.active_sprite_id),
                    config = COALESCE(excluded.config, asset_configurations.config),
                    is_active = COALESCE(excluded.is_active, asset_configurations.is_active),
                    map_scale = COALESCE(excluded.map_scale, asset_configurations.map_scale),
                    updated_at = CURRENT_TIMESTAMP
            `).bind(category, assetKey, active_sprite_id || null, config ? JSON.stringify(config) : null, is_active ?? false, map_scale ?? null).run();

            await logAudit(env, 'update_asset_config', null, user?.username, {
                category, assetKey, ...body
            });

            return Response.json({ success: true, message: 'Asset configuration updated' });
        }

        // POST /api/admin/assets/configurations/:category/:assetKey/publish - Publish an asset configuration
        if (action === 'configurations' && method === 'POST' && param1 && param2 && param3 === 'publish') {
            const category = param1;
            const assetKey = param2;

            if (category === 'buildings') {
                // Check configuration exists and has a sprite
                const config = await env.DB.prepare(`
                    SELECT * FROM building_configurations WHERE building_type_id = ?
                `).bind(assetKey).first();

                if (!config || !config.active_sprite_id) {
                    return Response.json({
                        error: 'Cannot publish: no sprite selected for this building type.'
                    }, { status: 400 });
                }

                await env.DB.prepare(`
                    UPDATE building_configurations
                    SET is_published = TRUE,
                        published_at = CURRENT_TIMESTAMP,
                        published_by = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE building_type_id = ?
                `).bind(user?.username || 'admin', assetKey).run();

                await logAudit(env, 'publish_building', config.active_sprite_id, user?.username, {
                    building_type: assetKey
                });

                return Response.json({ success: true, message: 'Building configuration published.' });
            }

            // For other categories
            const config = await env.DB.prepare(`
                SELECT * FROM asset_configurations WHERE category = ? AND asset_key = ?
            `).bind(category, assetKey).first();

            if (!config || !config.active_sprite_id) {
                return Response.json({
                    error: 'Cannot publish: no sprite selected for this asset.'
                }, { status: 400 });
            }

            await env.DB.prepare(`
                UPDATE asset_configurations
                SET is_published = TRUE,
                    published_at = CURRENT_TIMESTAMP,
                    published_by = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE category = ? AND asset_key = ?
            `).bind(user?.username || 'admin', category, assetKey).run();

            await logAudit(env, 'publish_asset', config.active_sprite_id, user?.username, {
                category, assetKey
            });

            return Response.json({ success: true, message: 'Asset configuration published.' });
        }

        // POST /api/admin/assets/configurations/:category/:assetKey/unpublish - Unpublish an asset configuration
        if (action === 'configurations' && method === 'POST' && param1 && param2 && param3 === 'unpublish') {
            const category = param1;
            const assetKey = param2;

            if (category === 'buildings') {
                await env.DB.prepare(`
                    UPDATE building_configurations
                    SET is_published = FALSE,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE building_type_id = ?
                `).bind(assetKey).run();

                await logAudit(env, 'unpublish_building', null, user?.username, {
                    building_type: assetKey
                });

                return Response.json({ success: true, message: 'Building unpublished.' });
            }

            // For other categories
            await env.DB.prepare(`
                UPDATE asset_configurations
                SET is_published = FALSE,
                    updated_at = CURRENT_TIMESTAMP
                WHERE category = ? AND asset_key = ?
            `).bind(category, assetKey).run();

            await logAudit(env, 'unpublish_asset', null, user?.username, {
                category, assetKey
            });

            return Response.json({ success: true, message: 'Asset unpublished.' });
        }

        // PUT /api/admin/assets/base-ground/active - Set the active base ground for the game
        if (action === 'base-ground' && param1 === 'active' && method === 'PUT') {
            const { asset_key } = await request.json();

            if (!asset_key) {
                return Response.json({ error: 'asset_key is required' }, { status: 400 });
            }

            // Extract sprite_id from asset_key (format: grass_bg_{id})
            const spriteIdMatch = asset_key.match(/grass_bg_(\d+)/);
            const spriteId = spriteIdMatch ? parseInt(spriteIdMatch[1], 10) : null;

            if (!spriteId) {
                return Response.json({ error: 'Invalid asset_key format. Expected grass_bg_{id}' }, { status: 400 });
            }

            // Verify the sprite exists and is approved
            const sprite = await env.DB.prepare(`
                SELECT id, r2_url FROM generated_assets
                WHERE id = ? AND category = 'terrain' AND asset_key = 'grass_bg' AND status = 'approved'
            `).bind(spriteId).first();

            if (!sprite) {
                return Response.json({ error: 'Sprite not found or not approved' }, { status: 404 });
            }

            // Clear all active flags for base_ground
            await env.DB.prepare(`
                UPDATE asset_configurations
                SET is_active = FALSE
                WHERE category = 'base_ground'
            `).run();

            // Set the new active one with sprite_id (create if doesn't exist)
            await env.DB.prepare(`
                INSERT INTO asset_configurations (category, asset_key, active_sprite_id, is_active)
                VALUES ('base_ground', ?, ?, TRUE)
                ON CONFLICT (category, asset_key) DO UPDATE SET
                    active_sprite_id = ?,
                    is_active = TRUE,
                    updated_at = CURRENT_TIMESTAMP
            `).bind(asset_key, spriteId, spriteId).run();

            await logAudit(env, 'set_active_base_ground', null, user?.username, { asset_key, sprite_id: spriteId });

            return Response.json({ success: true, message: 'Active base ground updated.', sprite_url: sprite.r2_url });
        }

        // GET /api/admin/assets/base-ground/active - Get the current active base ground URL
        if (action === 'base-ground' && param1 === 'active' && method === 'GET') {
            const result = await env.DB.prepare(`
                SELECT
                    ac.asset_key,
                    ac.active_sprite_id,
                    ga.r2_url as sprite_url
                FROM asset_configurations ac
                LEFT JOIN generated_assets ga ON ac.active_sprite_id = ga.id
                WHERE ac.category = 'base_ground' AND ac.is_active = TRUE
                LIMIT 1
            `).first();

            if (!result) {
                return Response.json({ success: true, base_ground: null });
            }

            return Response.json({
                success: true,
                base_ground: {
                    asset_key: result.asset_key,
                    sprite_url: result.sprite_url
                }
            });
        }

        // GET /api/admin/assets/available-assets/:category - List available approved sprites for a category
        if (action === 'available-assets' && method === 'GET' && param1) {
            const category = param1;

            // Map UI category to sprite category
            const spriteCategoryMap = {
                'buildings': 'building_sprite',
                'npcs': 'npc',
                'effects': 'effect',
                'terrain': 'terrain',
                'base_ground': 'terrain',
            };

            const spriteCategory = spriteCategoryMap[category] || category;

            const assets = await env.DB.prepare(`
                SELECT
                    asset_key,
                    COUNT(*) as sprite_count,
                    MAX(r2_url) as sample_url
                FROM generated_assets
                WHERE category = ? AND status = 'approved'
                GROUP BY asset_key
                ORDER BY asset_key
            `).bind(spriteCategory).all();

            return Response.json({ success: true, assets: assets.results });
        }

        // ============================================
        // LLM SETTINGS ENDPOINTS
        // View and edit all prompt templates with shared system_instructions tracking
        // ============================================

        // GET /api/admin/assets/llm-settings - List all templates with shared system_instructions grouping
        if (action === 'llm-settings' && method === 'GET' && !param1) {
            // Get all active templates
            const templates = await env.DB.prepare(`
                SELECT
                    id, category, asset_key, template_name,
                    base_prompt, style_guide, system_instructions,
                    version, created_by, updated_at
                FROM prompt_templates
                WHERE is_active = TRUE
                ORDER BY category, asset_key
            `).all();

            // Group templates by system_instructions hash for shared detection
            const templateList = templates.results || [];
            const sharedGroups = {};

            for (const template of templateList) {
                const sysInstructions = template.system_instructions || '';
                // Create hash for grouping (use first 100 chars as key for comparison)
                const groupKey = sysInstructions.substring(0, 100) || '_no_system_instructions';

                if (!sharedGroups[groupKey]) {
                    sharedGroups[groupKey] = {
                        system_instructions: sysInstructions,
                        templates: []
                    };
                }
                sharedGroups[groupKey].templates.push({
                    id: template.id,
                    category: template.category,
                    asset_key: template.asset_key,
                    template_name: template.template_name,
                    base_prompt: template.base_prompt,
                    style_guide: template.style_guide,
                    version: template.version,
                    created_by: template.created_by,
                    updated_at: template.updated_at
                });
            }

            // Convert to array and mark shared
            const groups = Object.values(sharedGroups).map((group, idx) => ({
                group_id: `group_${idx}`,
                system_instructions: group.system_instructions,
                is_shared: group.templates.length > 1,
                template_count: group.templates.length,
                categories: [...new Set(group.templates.map(t => t.category))],
                templates: group.templates
            }));

            // Sort: shared groups first, then by template count
            groups.sort((a, b) => {
                if (a.is_shared !== b.is_shared) return b.is_shared ? 1 : -1;
                return b.template_count - a.template_count;
            });

            return Response.json({
                success: true,
                total_templates: templateList.length,
                groups
            });
        }

        // GET /api/admin/assets/llm-settings/template/:id - Get a single template
        if (action === 'llm-settings' && method === 'GET' && param1 === 'template' && param2) {
            const templateId = parseInt(param2);

            const template = await env.DB.prepare(`
                SELECT * FROM prompt_templates WHERE id = ?
            `).bind(templateId).first();

            if (!template) {
                return Response.json({ error: 'Template not found' }, { status: 404 });
            }

            return Response.json({ success: true, template });
        }

        // PUT /api/admin/assets/llm-settings/template/:id - Update a single template (creates new version)
        if (action === 'llm-settings' && method === 'PUT' && param1 === 'template' && param2) {
            const templateId = parseInt(param2);
            const body = await request.json();
            const { base_prompt, system_instructions, style_guide, change_notes } = body;

            // Get current template
            const current = await env.DB.prepare(`
                SELECT * FROM prompt_templates WHERE id = ?
            `).bind(templateId).first();

            if (!current) {
                return Response.json({ error: 'Template not found' }, { status: 404 });
            }

            // Get max version for this category/asset_key
            const versionResult = await env.DB.prepare(`
                SELECT MAX(version) as maxVersion FROM prompt_templates
                WHERE category = ? AND asset_key = ?
            `).bind(current.category, current.asset_key).first();

            const newVersion = (versionResult?.maxVersion || 0) + 1;

            // Deactivate current active versions
            await env.DB.prepare(`
                UPDATE prompt_templates
                SET is_active = FALSE
                WHERE category = ? AND asset_key = ? AND is_active = TRUE
            `).bind(current.category, current.asset_key).run();

            // Insert new version
            const result = await env.DB.prepare(`
                INSERT INTO prompt_templates (
                    category, asset_key, template_name,
                    base_prompt, style_guide, system_instructions,
                    version, is_active, created_by, change_notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?)
            `).bind(
                current.category,
                current.asset_key,
                current.template_name,
                base_prompt ?? current.base_prompt,
                style_guide ?? current.style_guide,
                system_instructions ?? current.system_instructions,
                newVersion,
                user?.username || 'admin',
                change_notes || 'Updated via LLM Settings'
            ).run();

            await logAudit(env, 'update_llm_settings', null, user?.username, {
                template_id: templateId,
                category: current.category,
                asset_key: current.asset_key,
                version: newVersion
            });

            return Response.json({
                success: true,
                new_template_id: result.meta.last_row_id,
                version: newVersion,
                message: 'Template updated successfully'
            });
        }

        // PUT /api/admin/assets/llm-settings/shared - Update all templates with matching system_instructions
        if (action === 'llm-settings' && method === 'PUT' && param1 === 'shared') {
            const body = await request.json();
            const { new_system_instructions, change_notes, template_ids } = body;

            if (!template_ids || !Array.isArray(template_ids) || template_ids.length === 0) {
                return Response.json({ error: 'template_ids array is required' }, { status: 400 });
            }

            if (new_system_instructions === undefined) {
                return Response.json({ error: 'new_system_instructions is required' }, { status: 400 });
            }

            const updatedTemplates = [];
            const errors = [];

            // Process each template
            for (const templateId of template_ids) {
                try {
                    // Get current template
                    const current = await env.DB.prepare(`
                        SELECT * FROM prompt_templates WHERE id = ? AND is_active = TRUE
                    `).bind(templateId).first();

                    if (!current) {
                        errors.push({ id: templateId, error: 'Not found or not active' });
                        continue;
                    }

                    // Get max version
                    const versionResult = await env.DB.prepare(`
                        SELECT MAX(version) as maxVersion FROM prompt_templates
                        WHERE category = ? AND asset_key = ?
                    `).bind(current.category, current.asset_key).first();

                    const newVersion = (versionResult?.maxVersion || 0) + 1;

                    // Deactivate current
                    await env.DB.prepare(`
                        UPDATE prompt_templates
                        SET is_active = FALSE
                        WHERE category = ? AND asset_key = ? AND is_active = TRUE
                    `).bind(current.category, current.asset_key).run();

                    // Insert new version with updated system_instructions
                    const result = await env.DB.prepare(`
                        INSERT INTO prompt_templates (
                            category, asset_key, template_name,
                            base_prompt, style_guide, system_instructions,
                            version, is_active, created_by, change_notes
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?)
                    `).bind(
                        current.category,
                        current.asset_key,
                        current.template_name,
                        current.base_prompt,
                        current.style_guide,
                        new_system_instructions,
                        newVersion,
                        user?.username || 'admin',
                        change_notes || 'Bulk update via LLM Settings'
                    ).run();

                    updatedTemplates.push({
                        original_id: templateId,
                        new_id: result.meta.last_row_id,
                        category: current.category,
                        asset_key: current.asset_key,
                        version: newVersion
                    });
                } catch (err) {
                    errors.push({ id: templateId, error: err.message });
                }
            }

            await logAudit(env, 'bulk_update_llm_settings', null, user?.username, {
                updated_count: updatedTemplates.length,
                error_count: errors.length,
                template_ids
            });

            return Response.json({
                success: true,
                updated_count: updatedTemplates.length,
                updated_templates: updatedTemplates,
                errors: errors.length > 0 ? errors : undefined,
                message: `Updated ${updatedTemplates.length} template(s)${errors.length > 0 ? `, ${errors.length} error(s)` : ''}`
            });
        }

        // Default: route not found
        return Response.json({ error: 'Asset route not found', path, method }, { status: 404 });

    } catch (error) {
        console.error('Asset route error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}
