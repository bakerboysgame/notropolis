# Stage 01: Infrastructure

## Objective

Set up database schema, API routes, and environment configuration for the asset generation pipeline.

## Dependencies

`[Requires: None]` - This is the foundation stage.

## Complexity

**Medium** - Database schema, multiple API routes, external API integration.

---

## Files to Modify

| File | Changes |
|------|---------|
| `worker/index.js` | Add asset routes import |
| `worker/wrangler.toml` | Add R2 bucket bindings for private and public asset buckets |

## Files to Create

| File | Purpose |
|------|---------|
| `migrations/0022_create_asset_tables.sql` | Asset management tables |
| `worker/src/routes/admin/assets.js` | Asset generation API routes |

---

## Database Changes

### Migration: `0022_create_asset_tables.sql`

```sql
-- ============================================
-- ASSET PIPELINE DATABASE SCHEMA
-- ============================================
-- Supports:
-- 1. Staged workflow (refs → sprites)
-- 2. Rejection with feedback → prompt update → regenerate
-- 3. Version history with prompt evolution
-- ============================================

-- Asset types enum-like table
CREATE TABLE IF NOT EXISTS asset_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    parent_category TEXT,               -- Links sprite categories to their ref category
    requires_approval BOOLEAN DEFAULT TRUE,
    requires_background_removal BOOLEAN DEFAULT FALSE
);

INSERT INTO asset_categories (id, name, description, parent_category, requires_approval, requires_background_removal) VALUES
    -- Reference sheets (no parent, no bg removal)
    ('building_ref', 'Building Reference Sheet', 'Multi-view reference sheets for buildings', NULL, TRUE, FALSE),
    ('dirty_trick_ref', 'Dirty Trick Reference', 'Reference sheets for attack effects', NULL, TRUE, FALSE),

    -- Sprites derived from refs (have parent, need bg removal)
    ('building_sprite', 'Building Sprite', 'Isometric game sprites for buildings', 'building_ref', TRUE, TRUE),
    ('dirty_trick_sprite', 'Dirty Trick Sprite', 'Overlay sprites for attack effects', 'dirty_trick_ref', TRUE, TRUE),

    -- Standalone sprites (no parent ref, but need bg removal)
    ('status_effect', 'Status Effect', 'Building status overlays', NULL, TRUE, TRUE),
    ('terrain', 'Terrain Tile', 'Isometric terrain tiles', NULL, TRUE, TRUE),
    ('overlay', 'Ownership Overlay', 'Tile ownership overlays', NULL, TRUE, FALSE),
    ('ui', 'UI Element', 'UI elements like minimap markers', NULL, TRUE, TRUE),
    ('npc', 'NPC Sprite', 'Ambient pedestrian and vehicle sprites', NULL, TRUE, TRUE),

    -- Full illustrations (no parent, no bg removal)
    ('scene', 'Scene Illustration', 'Full scene illustrations', NULL, TRUE, FALSE);

-- Generated assets table (main asset registry)
CREATE TABLE IF NOT EXISTS generated_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL REFERENCES asset_categories(id),
    asset_key TEXT NOT NULL,            -- e.g., 'restaurant', 'arson', 'arrest_scene'
    variant INTEGER DEFAULT 1,          -- For A/B variants

    -- Prompt management
    base_prompt TEXT NOT NULL,          -- Original prompt without feedback
    current_prompt TEXT NOT NULL,       -- Current prompt (base + incorporated feedback)
    prompt_version INTEGER DEFAULT 1,   -- Increments each time prompt is updated

    -- Storage
    r2_key_private TEXT,                -- Private bucket key (original/raw)
    r2_key_public TEXT,                 -- Public bucket key (game-ready WebP)
    r2_url TEXT,                        -- Public URL for game loading

    -- Status workflow
    status TEXT DEFAULT 'pending',      -- pending, generating, review, approved, rejected
    generation_model TEXT DEFAULT 'gemini-3-pro-image-preview',
    background_removed BOOLEAN DEFAULT FALSE,

    -- Parent relationship (for sprites derived from refs)
    parent_asset_id INTEGER REFERENCES generated_assets(id),

    -- Approval tracking
    approved_at DATETIME,
    approved_by TEXT,
    rejection_count INTEGER DEFAULT 0,  -- How many times rejected

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Extra data
    error_message TEXT,
    metadata TEXT                       -- JSON for dimensions, file size, etc.
);

CREATE INDEX idx_assets_category ON generated_assets(category);
CREATE INDEX idx_assets_status ON generated_assets(status);
CREATE INDEX idx_assets_key ON generated_assets(asset_key);
CREATE INDEX idx_assets_parent ON generated_assets(parent_asset_id);
CREATE UNIQUE INDEX idx_assets_unique ON generated_assets(category, asset_key, variant);

-- Rejection history (feedback loop)
-- Each rejection creates a record that can inform the next generation
CREATE TABLE IF NOT EXISTS asset_rejections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL REFERENCES generated_assets(id),
    rejected_by TEXT,
    rejection_reason TEXT NOT NULL,     -- User's feedback on what's wrong
    prompt_at_rejection TEXT,           -- The prompt that produced the rejected image
    prompt_version INTEGER,             -- Which version was rejected
    r2_key_rejected TEXT,               -- Key of rejected image (kept for reference)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rejections_asset ON asset_rejections(asset_id);

-- Generation queue for async processing
CREATE TABLE IF NOT EXISTS asset_generation_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER REFERENCES generated_assets(id),
    priority INTEGER DEFAULT 5,         -- 1=highest, 10=lowest
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    status TEXT DEFAULT 'queued',       -- queued, processing, completed, failed
    started_at DATETIME,
    completed_at DATETIME,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_queue_status ON asset_generation_queue(status, priority);

-- ============================================
-- AUDIT LOG (tracks all asset actions)
-- ============================================
CREATE TABLE IF NOT EXISTS asset_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,               -- generate, approve, reject, regenerate, remove_bg, publish, reset_prompt, link_building
    asset_id INTEGER REFERENCES generated_assets(id),
    actor TEXT,                         -- username who performed action
    details TEXT,                       -- JSON with action-specific data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_asset ON asset_audit_log(asset_id);
CREATE INDEX idx_audit_action ON asset_audit_log(action);
CREATE INDEX idx_audit_created ON asset_audit_log(created_at DESC);

-- ============================================
-- BUILDING MANAGER (links approved sprites to building_types)
-- ============================================
-- This table connects approved building sprites to the game's building_types table
-- Allows admins to configure which sprite to use and set prices

CREATE TABLE IF NOT EXISTS building_configurations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    building_type_id TEXT NOT NULL,     -- Foreign key to building_types.id
    active_sprite_id INTEGER REFERENCES generated_assets(id),  -- Currently active approved sprite

    -- Pricing (can override building_types defaults)
    -- Note: building_types uses `cost` and `base_profit` columns
    cost_override INTEGER,              -- NULL = use building_types.cost
    base_profit_override INTEGER,       -- NULL = use building_types.base_profit

    -- Status
    is_published BOOLEAN DEFAULT FALSE, -- TRUE = live in game, FALSE = draft
    published_at DATETIME,
    published_by TEXT,

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(building_type_id)
);

CREATE INDEX idx_building_config_type ON building_configurations(building_type_id);
CREATE INDEX idx_building_config_sprite ON building_configurations(active_sprite_id);

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- Assets ready for sprite generation (approved refs)
CREATE VIEW IF NOT EXISTS v_approved_refs AS
SELECT ga.*, ac.name as category_name
FROM generated_assets ga
JOIN asset_categories ac ON ga.category = ac.id
WHERE ga.status = 'approved'
  AND ga.category LIKE '%_ref';

-- Assets pending review
CREATE VIEW IF NOT EXISTS v_pending_review AS
SELECT ga.*, ac.name as category_name,
       (SELECT COUNT(*) FROM asset_rejections ar WHERE ar.asset_id = ga.id) as total_rejections
FROM generated_assets ga
JOIN asset_categories ac ON ga.category = ac.id
WHERE ga.status IN ('review', 'completed')
ORDER BY ga.updated_at DESC;

-- Sprites missing approved parent ref
CREATE VIEW IF NOT EXISTS v_sprites_needing_ref AS
SELECT ac.id as sprite_category, ac.parent_category as ref_category, ac.name
FROM asset_categories ac
WHERE ac.parent_category IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM generated_assets ga
    WHERE ga.category = ac.parent_category
      AND ga.status = 'approved'
  );

-- Building Manager view: all building types with their current config and sprite
-- Note: building_types schema uses `cost` and `base_profit` columns
CREATE VIEW IF NOT EXISTS v_building_manager AS
SELECT
    bt.id as building_type_id,
    bt.name as building_name,
    bt.cost as default_cost,
    bt.base_profit as default_profit,
    bt.level_required,
    bt.requires_license,
    bc.id as config_id,
    bc.active_sprite_id,
    bc.cost_override,
    bc.base_profit_override,
    COALESCE(bc.cost_override, bt.cost) as effective_cost,
    COALESCE(bc.base_profit_override, bt.base_profit) as effective_profit,
    bc.is_published,
    bc.published_at,
    ga.r2_url as sprite_url,
    ga.status as sprite_status,
    (SELECT COUNT(*) FROM generated_assets WHERE category = 'building_sprite' AND asset_key = bt.id AND status = 'approved') as available_sprites
FROM building_types bt
LEFT JOIN building_configurations bc ON bt.id = bc.building_type_id
LEFT JOIN generated_assets ga ON bc.active_sprite_id = ga.id;

-- Recent audit log entries
CREATE VIEW IF NOT EXISTS v_recent_audit AS
SELECT
    al.*,
    ga.asset_key,
    ga.category
FROM asset_audit_log al
LEFT JOIN generated_assets ga ON al.asset_id = ga.id
ORDER BY al.created_at DESC
LIMIT 100;

-- ============================================
-- AVATAR COMPOSITE CACHE
-- ============================================
-- Stores pre-rendered avatar composites for fast scene compositing.
-- Generated when users save their avatar customization.
-- Each company has one cached composite per context (main, scene).

CREATE TABLE IF NOT EXISTS avatar_composites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id TEXT NOT NULL,

    -- Composite type
    context TEXT DEFAULT 'main',         -- 'main' (standard), 'scene' (for scene compositing)

    -- Storage
    r2_key TEXT NOT NULL,                -- e.g., 'composites/avatar_{company_id}_main.png'
    r2_url TEXT,                         -- Public URL if in public bucket

    -- Source tracking (for cache invalidation)
    avatar_hash TEXT NOT NULL,           -- Hash of selected item IDs to detect changes

    -- Dimensions
    width INTEGER,
    height INTEGER,

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(company_id, context)
);

CREATE INDEX idx_avatar_composites_company ON avatar_composites(company_id);

-- ============================================
-- SCENE TEMPLATES (Layered Scene System)
-- ============================================
-- Scenes are now composed of layers with avatar slots for dynamic compositing.
-- Instead of full static scenes, we generate:
--   1. Background layer (scene without character)
--   2. Avatar slot metadata (position, size, rotation)
--   3. Optional foreground overlay (prison bars, confetti, etc.)

CREATE TABLE IF NOT EXISTS scene_templates (
    id TEXT PRIMARY KEY,                 -- e.g., 'arrest', 'prison', 'hero_out'
    name TEXT NOT NULL,
    description TEXT,

    -- Layer references (R2 keys in public bucket)
    background_r2_key TEXT NOT NULL,     -- Background layer (no character)
    foreground_r2_key TEXT,              -- Optional foreground overlay

    -- Avatar slot definition (where to place the avatar)
    avatar_slot TEXT NOT NULL,           -- JSON: {"x": 480, "y": 200, "width": 300, "height": 400, "rotation": 0}

    -- Scene dimensions
    width INTEGER DEFAULT 1920,
    height INTEGER DEFAULT 1080,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Pre-composed scene cache (optional optimization)
-- Stores fully rendered scenes for specific avatars (LRU cache)
CREATE TABLE IF NOT EXISTS composed_scene_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scene_template_id TEXT NOT NULL REFERENCES scene_templates(id),
    company_id TEXT NOT NULL,

    -- Cached result
    r2_key TEXT NOT NULL,
    r2_url TEXT,

    -- Cache invalidation
    avatar_hash TEXT NOT NULL,           -- Must match avatar_composites.avatar_hash
    template_hash TEXT NOT NULL,         -- Hash of template layers for cache busting

    -- Timestamps (for LRU eviction)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(scene_template_id, company_id)
);

CREATE INDEX idx_scene_cache_company ON composed_scene_cache(company_id);
CREATE INDEX idx_scene_cache_accessed ON composed_scene_cache(last_accessed_at);

-- View: Scene templates with layer URLs
CREATE VIEW IF NOT EXISTS v_scene_templates AS
SELECT
    st.*,
    CASE WHEN st.foreground_r2_key IS NOT NULL THEN 1 ELSE 0 END as has_foreground,
    json_extract(st.avatar_slot, '$.x') as avatar_x,
    json_extract(st.avatar_slot, '$.y') as avatar_y,
    json_extract(st.avatar_slot, '$.width') as avatar_width,
    json_extract(st.avatar_slot, '$.height') as avatar_height
FROM scene_templates st
WHERE st.is_active = TRUE;
```

---

## Implementation Details

### API Routes: `worker/src/routes/admin/assets.js`

```javascript
// Asset generation routes
import { Router } from 'itty-router';

const router = Router({ base: '/api/admin/assets' });

// Environment bindings needed:
// - env.DB (D1)
// - env.R2_PRIVATE (private R2 bucket for refs/raw)
// - env.R2_PUBLIC (public R2 bucket for game-ready assets)
// - env.GEMINI_API_KEY
// - env.REMOVAL_AI_API_KEY

// R2 Public URL Configuration:
// Public bucket URL: https://pub-874867b18f8b4b4882277d8a2b7dfe80.r2.dev
// Custom domain (if configured): https://assets.notropolis.net
// This code uses the custom domain - update if using r2.dev URL instead
const R2_PUBLIC_URL = 'https://assets.notropolis.net';

// List all assets by category
router.get('/list/:category', async (request, env) => {
    const { category } = request.params;
    const assets = await env.DB.prepare(`
        SELECT * FROM generated_assets
        WHERE category = ?
        ORDER BY asset_key, variant
    `).bind(category).all();

    return Response.json({ assets: assets.results });
});

// Get generation queue status
router.get('/queue', async (request, env) => {
    const queue = await env.DB.prepare(`
        SELECT q.*, a.category, a.asset_key
        FROM asset_generation_queue q
        JOIN generated_assets a ON q.asset_id = a.id
        WHERE q.status IN ('queued', 'processing')
        ORDER BY q.priority, q.created_at
    `).all();

    return Response.json({ queue: queue.results });
});

// Generate a new asset
router.post('/generate', async (request, env) => {
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

        // Note: No public URL for private bucket - access via worker only
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
});

// Remove background from asset using Removal.ai
// API Docs: https://removal.ai/api-documentation/
// Note: This requires the asset to be temporarily accessible - we fetch from private bucket and send as base64
router.post('/remove-background/:id', async (request, env) => {
    const { id } = request.params;

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

    return Response.json({
        success: true,
        r2_key: newR2Key,
        bucket: 'private',
        note: 'Transparent version stored. Use POST /process/:id to create game-ready WebP.'
    });
});

// Approve an asset
router.put('/approve/:id', async (request, env, ctx) => {
    const { id } = request.params;
    const user = ctx.user; // From auth middleware

    await env.DB.prepare(`
        UPDATE generated_assets
        SET status = 'approved', approved_at = CURRENT_TIMESTAMP, approved_by = ?
        WHERE id = ?
    `).bind(user?.username || 'admin', id).run();

    return Response.json({ success: true });
});

// Reject an asset WITH feedback for prompt improvement
router.put('/reject/:id', async (request, env, ctx) => {
    const { id } = request.params;
    const { reason, incorporate_feedback = true } = await request.json();
    const user = ctx.user;

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

    return Response.json({
        success: true,
        message: 'Asset rejected. Prompt updated with feedback.',
        new_prompt_version: asset.prompt_version + 1,
        feedback_incorporated: incorporate_feedback
    });
});

// Regenerate a rejected asset (uses updated prompt with feedback)
router.post('/regenerate/:id', async (request, env) => {
    const { id } = request.params;

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
});

// Get rejection history for an asset
router.get('/rejections/:id', async (request, env) => {
    const { id } = request.params;

    const rejections = await env.DB.prepare(`
        SELECT * FROM asset_rejections
        WHERE asset_id = ?
        ORDER BY created_at DESC
    `).bind(id).all();

    return Response.json({ rejections: rejections.results });
});

// Generate sprite FROM an approved reference sheet
router.post('/generate-from-ref/:refId', async (request, env) => {
    const { refId } = request.params;
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
    // Note: Could include reference image in prompt via Gemini's image input
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
});

// Get approved refs that are ready for sprite generation
router.get('/approved-refs', async (request, env) => {
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
});

// Reset prompt to base (remove all feedback)
router.post('/reset-prompt/:id', async (request, env, ctx) => {
    const { id } = request.params;

    await env.DB.prepare(`
        UPDATE generated_assets
        SET current_prompt = base_prompt,
            prompt_version = prompt_version + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).bind(id).run();

    await logAudit(env, 'reset_prompt', id, ctx.user?.username);

    return Response.json({ success: true, message: 'Prompt reset to base. Feedback removed.' });
});

// ============================================
// AUDIT LOG ROUTES
// ============================================

// Get audit log for an asset
router.get('/audit/:assetId', async (request, env) => {
    const { assetId } = request.params;

    const logs = await env.DB.prepare(`
        SELECT * FROM asset_audit_log
        WHERE asset_id = ?
        ORDER BY created_at DESC
    `).bind(assetId).all();

    return Response.json({ logs: logs.results });
});

// Get recent audit log (all assets)
router.get('/audit', async (request, env) => {
    const { limit = 50, action } = request.query || {};

    let query = `SELECT * FROM v_recent_audit`;
    const params = [];

    if (action) {
        query = `SELECT * FROM asset_audit_log al
                 LEFT JOIN generated_assets ga ON al.asset_id = ga.id
                 WHERE al.action = ?
                 ORDER BY al.created_at DESC
                 LIMIT ?`;
        params.push(action, parseInt(limit));
    } else {
        query += ` LIMIT ?`;
        params.push(parseInt(limit));
    }

    const logs = await env.DB.prepare(query).bind(...params).all();
    return Response.json({ logs: logs.results });
});

// ============================================
// BUILDING MANAGER ROUTES
// ============================================

// List all building types with their configurations
router.get('/buildings', async (request, env) => {
    const buildings = await env.DB.prepare(`
        SELECT * FROM v_building_manager
        ORDER BY building_name
    `).all();

    return Response.json({ buildings: buildings.results });
});

// Get available sprites for a building type
router.get('/buildings/:buildingType/sprites', async (request, env) => {
    const { buildingType } = request.params;

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
});

// Update building configuration (set sprite, costs)
router.put('/buildings/:buildingType', async (request, env, ctx) => {
    const { buildingType } = request.params;
    const { active_sprite_id, cost_override, base_profit_override } = await request.json();
    const user = ctx.user;

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
});

// Publish building configuration (make it live in game)
router.post('/buildings/:buildingType/publish', async (request, env, ctx) => {
    const { buildingType } = request.params;
    const user = ctx.user;

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
});

// Unpublish (revert to draft)
router.post('/buildings/:buildingType/unpublish', async (request, env, ctx) => {
    const { buildingType } = request.params;

    await env.DB.prepare(`
        UPDATE building_configurations
        SET is_published = FALSE,
            updated_at = CURRENT_TIMESTAMP
        WHERE building_type_id = ?
    `).bind(buildingType).run();

    await logAudit(env, 'unpublish_building', null, ctx.user?.username, {
        building_type: buildingType
    });

    return Response.json({ success: true, message: 'Building unpublished.' });
});

// ============================================
// AVATAR COMPOSITE ROUTES
// ============================================

// Generate/update avatar composite when user saves avatar
// Called automatically after avatar update, or manually to regenerate
router.post('/avatar/composite/:companyId', async (request, env, ctx) => {
    const { companyId } = request.params;
    const { context = 'main' } = await request.json();

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

    if (existing && existing.avatar_hash === avatarHash) {
        return Response.json({
            success: true,
            message: 'Composite already up to date',
            r2_url: existing.r2_url,
            cached: true
        });
    }

    // Get avatar layer images
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

    // Order layers correctly
    const categoryOrder = ['background', 'base', 'skin', 'outfit', 'hair', 'headwear', 'accessory'];
    const layers = categoryOrder
        .map(cat => items.results.find(i => i.category === cat))
        .filter(Boolean);

    // Composite layers using server-side image processing
    // Note: Cloudflare Workers have limited image processing.
    // Options:
    // 1. Use Cloudflare Images (paid) for server-side compositing
    // 2. Use a Worker with image library (limited by CPU time)
    // 3. Client-side compositing with canvas, then upload result
    //
    // For now, we'll use approach #3: client generates canvas composite and uploads

    // This route becomes an upload endpoint:
    // Client sends pre-composited image as base64 or blob
    const { imageData } = await request.json();

    if (!imageData) {
        return Response.json({
            success: false,
            error: 'Client must provide composited imageData',
            layers: layers.map(l => ({
                category: l.category,
                r2_key: l.r2_key
            })),
            message: 'Composite client-side and upload via PUT /avatar/composite/:companyId/upload'
        }, { status: 400 });
    }

    // Decode base64 image
    const imageBuffer = Uint8Array.from(atob(imageData.split(',')[1] || imageData), c => c.charCodeAt(0));

    // Store in public bucket
    const r2Key = `composites/avatar_${companyId}_${context}.png`;
    await env.R2_PUBLIC.put(r2Key, imageBuffer, {
        httpMetadata: { contentType: 'image/png' }
    });

    const r2Url = `https://assets.notropolis.net/${r2Key}`;

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

    await logAudit(env, 'avatar_composite_updated', null, ctx.user?.username, {
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
});

// Get avatar composite URL (or layer info if not cached)
router.get('/avatar/composite/:companyId', async (request, env) => {
    const { companyId } = request.params;
    const url = new URL(request.url);
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

    const placeholders = itemIds.map(() => '?').join(',');
    const items = await env.DB.prepare(`
        SELECT id, r2_key, category FROM avatar_items WHERE id IN (${placeholders})
    `).bind(...itemIds).all();

    const R2_PUBLIC_URL = 'https://pub-874867b18f8b4b4882277d8a2b7dfe80.r2.dev';
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
});

// ============================================
// SCENE TEMPLATE ROUTES
// ============================================

// List all active scene templates
router.get('/scenes/templates', async (request, env) => {
    const templates = await env.DB.prepare(`
        SELECT * FROM v_scene_templates ORDER BY id
    `).all();

    const R2_PUBLIC_URL = 'https://assets.notropolis.net';

    const result = templates.results.map(t => ({
        ...t,
        background_url: `${R2_PUBLIC_URL}/${t.background_r2_key}`,
        foreground_url: t.foreground_r2_key ? `${R2_PUBLIC_URL}/${t.foreground_r2_key}` : null,
        avatar_slot: JSON.parse(t.avatar_slot)
    }));

    return Response.json({ success: true, templates: result });
});

// Get specific scene template
router.get('/scenes/templates/:sceneId', async (request, env) => {
    const { sceneId } = request.params;

    const template = await env.DB.prepare(`
        SELECT * FROM scene_templates WHERE id = ?
    `).bind(sceneId).first();

    if (!template) {
        return Response.json({ error: 'Scene template not found' }, { status: 404 });
    }

    const R2_PUBLIC_URL = 'https://assets.notropolis.net';

    return Response.json({
        success: true,
        template: {
            ...template,
            background_url: `${R2_PUBLIC_URL}/${template.background_r2_key}`,
            foreground_url: template.foreground_r2_key ? `${R2_PUBLIC_URL}/${template.foreground_r2_key}` : null,
            avatar_slot: JSON.parse(template.avatar_slot)
        }
    });
});

// Create/update scene template (admin)
router.put('/scenes/templates/:sceneId', async (request, env, ctx) => {
    const { sceneId } = request.params;
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

    await logAudit(env, 'scene_template_updated', null, ctx.user?.username, {
        scene_id: sceneId,
        name
    });

    return Response.json({ success: true, message: 'Scene template saved.' });
});

// Get composed scene for a company (with caching)
// Returns: cached URL if available, or layer info for client-side compositing
router.get('/scenes/compose/:sceneId/:companyId', async (request, env) => {
    const { sceneId, companyId } = request.params;

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
    const R2_PUBLIC_URL = 'https://assets.notropolis.net';
    const AVATAR_R2_URL = 'https://pub-874867b18f8b4b4882277d8a2b7dfe80.r2.dev';

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

            const placeholders = itemIds.map(() => '?').join(',');
            const items = await env.DB.prepare(`
                SELECT id, r2_key, category FROM avatar_items WHERE id IN (${placeholders})
            `).bind(...itemIds).all();

            const categoryOrder = ['background', 'base', 'skin', 'outfit', 'hair', 'headwear', 'accessory'];
            const layers = categoryOrder
                .map(cat => {
                    const item = items.results.find(i => i.category === cat);
                    if (item) {
                        return { category: cat, url: `${AVATAR_R2_URL}/${item.r2_key}` };
                    }
                    return null;
                })
                .filter(Boolean);

            avatarInfo = { cached: false, layers };
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
});

// Cache a composed scene (client uploads the result)
router.post('/scenes/compose/:sceneId/:companyId/cache', async (request, env, ctx) => {
    const { sceneId, companyId } = request.params;
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

    const r2Url = `https://assets.notropolis.net/${r2Key}`;

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
});

// Process asset for game use - copy to PUBLIC bucket as WebP
// Note: For image resizing in Workers, options include:
// - Cloudflare Images (paid) - best quality
// - Client-side processing before upload
// - Generate at target size directly (current approach for small assets)
router.post('/process/:id', async (request, env) => {
    const { id } = request.params;
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
        // They don't need to be in the public bucket for game use
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
    // For now, store as-is with correct content type
    await env.R2_PUBLIC.put(gameReadyKey, originalObj.body, {
        httpMetadata: { contentType: `image/${outputFormat}` }
    });

    // Public bucket URL (requires public access enabled on bucket)
    const gameReadyUrl = `https://assets.notropolis.net/${gameReadyKey}`;

    // Update record with game-ready URL
    await env.DB.prepare(`
        UPDATE generated_assets
        SET r2_key_public = ?, r2_url = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).bind(gameReadyKey, gameReadyUrl, id).run();

    return Response.json({
        success: true,
        game_ready_url: gameReadyUrl,
        public_key: gameReadyKey,
        format: outputFormat,
        note: 'Asset published to public bucket. For resizing, use Cloudflare Images or process client-side.'
    });
});

// Batch generate multiple assets
router.post('/batch-generate', async (request, env) => {
    const { assets } = await request.json();
    // assets = [{ category, asset_key, prompt, variant }, ...]

    const results = [];
    for (const asset of assets) {
        // Create records and queue
        const result = await env.DB.prepare(`
            INSERT INTO generated_assets (category, asset_key, variant, prompt, status)
            VALUES (?, ?, ?, ?, 'queued')
            ON CONFLICT(category, asset_key, variant)
            DO UPDATE SET prompt = excluded.prompt, status = 'queued'
            RETURNING id
        `).bind(asset.category, asset.asset_key, asset.variant || 1, asset.prompt).first();

        await env.DB.prepare(`
            INSERT INTO asset_generation_queue (asset_id)
            VALUES (?)
        `).bind(result.id).run();

        results.push({ id: result.id, asset_key: asset.asset_key });
    }

    return Response.json({ success: true, queued: results.length, assets: results });
});

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

export default router;
```

### Worker Integration

Add to `worker/index.js`:

```javascript
import assetRoutes from './src/routes/admin/assets.js';

// In the router setup
router.all('/api/admin/assets/*', requireAdmin, assetRoutes.handle);
```

### wrangler.toml Changes

Add R2 bucket bindings to `worker/wrangler.toml`:

```toml
# ==================== R2 STORAGE (Asset Pipeline) ====================
[[r2_buckets]]
binding = "R2_PRIVATE"
bucket_name = "notropolis-assets-private"

[[r2_buckets]]
binding = "R2_PUBLIC"
bucket_name = "notropolis-game-assets"

# Also add to production environment:
[[env.production.r2_buckets]]
binding = "R2_PRIVATE"
bucket_name = "notropolis-assets-private"

[[env.production.r2_buckets]]
binding = "R2_PUBLIC"
bucket_name = "notropolis-game-assets"
```

**Note:** Create buckets if they don't exist:
```bash
wrangler r2 bucket create notropolis-assets-private
wrangler r2 bucket create notropolis-game-assets
```

Enable public access on the game assets bucket:
```bash
# Via Cloudflare dashboard: R2 > notropolis-game-assets > Settings > Public access
# Or set up a custom domain: assets.notropolis.net
```

### Secrets (Already Configured)

Secrets have been added to the worker via Cloudflare API:

| Secret | Status |
|--------|--------|
| `GEMINI_API_KEY` | ✅ Added |
| `REMOVAL_AI_API_KEY` | ✅ Added |

To verify secrets exist:
```bash
curl -X GET "https://api.cloudflare.com/client/v4/accounts/329dc0e016dd5cd512d6566d64d8aa0c/workers/scripts/notropolis-api/secrets" \
  -H "Authorization: Bearer RQeVAceZ3VT-McbFF9DnYem0ZDc8YXbnHPH8wbg_"
```

---

## Test Cases

**⚠️ IMPORTANT:** Get admin JWT tokens from `docs/REFERENCE-test-tokens/CLAUDE.md`

### 1. Database Migration
```bash
# Apply migration
wrangler d1 execute notropolis-db --file=migrations/0022_create_asset_tables.sql

# Verify tables exist
wrangler d1 execute notropolis-db --command="SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'asset%' OR name LIKE 'generated%'"
```

**Expected:** Tables `asset_categories`, `generated_assets`, `asset_generation_queue` created.

### 2. API Route - List Assets
```bash
# Use admin token from docs/REFERENCE-test-tokens/CLAUDE.md
curl -X GET "https://notropolis-api.rikisenia.workers.dev/api/admin/assets/list/building_ref" \
  -H "Authorization: Bearer <ADMIN_TOKEN_FROM_CLAUDE.md>"
```

**Expected:** `{ "assets": [] }` (empty initially)

### 3. API Route - Generate Asset
```bash
# Use admin token from docs/REFERENCE-test-tokens/CLAUDE.md
curl -X POST "https://notropolis-api.rikisenia.workers.dev/api/admin/assets/generate" \
  -H "Authorization: Bearer <ADMIN_TOKEN_FROM_CLAUDE.md>" \
  -H "Content-Type: application/json" \
  -d '{"category":"building_ref","asset_key":"test","prompt":"A simple test image"}'
```

**Expected:** `{ "success": true, "asset_id": 1, "r2_key": "refs/test_ref_v1.png", "bucket": "private" }`

### 4. API Route - Background Removal
```bash
# Use admin token from docs/REFERENCE-test-tokens/CLAUDE.md
curl -X POST "https://notropolis-api.rikisenia.workers.dev/api/admin/assets/remove-background/1" \
  -H "Authorization: Bearer <ADMIN_TOKEN_FROM_CLAUDE.md>"
```

**Expected:** `{ "success": true, "r2_key": "..._transparent.png", "bucket": "private" }`

---

## Acceptance Checklist

### Database
- [ ] Migration `0022_create_asset_tables.sql` created and applies without errors
- [ ] `asset_categories` table has 10 category records
- [ ] `generated_assets` table created with proper indexes
- [ ] `asset_generation_queue` table created
- [ ] `asset_audit_log` table created
- [ ] `building_configurations` table created
- [ ] `avatar_composites` table created
- [ ] `scene_templates` table created
- [ ] `composed_scene_cache` table created
- [ ] Views created: `v_approved_refs`, `v_pending_review`, `v_building_manager`, `v_recent_audit`, `v_scene_templates`

### Infrastructure
- [ ] R2 buckets created (`notropolis-assets-private`, `notropolis-game-assets`)
- [ ] wrangler.toml updated with R2_PRIVATE and R2_PUBLIC bindings
- [ ] Asset routes file created at `worker/src/routes/admin/assets.js`
- [ ] Routes integrated into main worker
- [ ] Gemini API key configured and tested
- [ ] Removal.ai API key configured and tested

### Asset API Routes
- [ ] `/api/admin/assets/list/:category` returns empty array
- [ ] `/api/admin/assets/generate` creates record, calls Gemini, stores in private bucket
- [ ] `/api/admin/assets/remove-background/:id` processes image (for building sprites)
- [ ] `/api/admin/assets/process/:id` copies to public bucket as WebP
- [ ] `/api/admin/assets/approve/:id` updates status
- [ ] `/api/admin/assets/reject/:id` stores rejection and updates prompt
- [ ] `/api/admin/assets/regenerate/:id` regenerates with updated prompt
- [ ] Private bucket uploads work correctly
- [ ] Public bucket uploads work correctly with public access

### Audit Log Routes
- [ ] `/api/admin/assets/audit` returns recent audit entries
- [ ] `/api/admin/assets/audit/:assetId` returns audit history for specific asset
- [ ] All modifying actions log to audit table

### Building Manager Routes
- [ ] `/api/admin/assets/buildings` returns all building types with configs
- [ ] `/api/admin/assets/buildings/:buildingType/sprites` returns available sprites
- [ ] `/api/admin/assets/buildings/:buildingType` (PUT) updates configuration
- [ ] `/api/admin/assets/buildings/:buildingType/publish` marks config as live
- [ ] `/api/admin/assets/buildings/:buildingType/unpublish` reverts to draft

### Avatar Composite Routes
- [ ] `POST /api/admin/assets/avatar/composite/:companyId` uploads and caches avatar composite
- [ ] `GET /api/admin/assets/avatar/composite/:companyId` returns cached URL or layer info
- [ ] Avatar hash correctly invalidates on avatar change
- [ ] Scene cache invalidates when avatar composite updates

### Scene Template Routes
- [ ] `GET /api/admin/assets/scenes/templates` lists all active templates
- [ ] `GET /api/admin/assets/scenes/templates/:sceneId` returns template with layer URLs
- [ ] `PUT /api/admin/assets/scenes/templates/:sceneId` creates/updates template
- [ ] `GET /api/admin/assets/scenes/compose/:sceneId/:companyId` returns composed scene or compositing info
- [ ] `POST /api/admin/assets/scenes/compose/:sceneId/:companyId/cache` caches composed scene

---

## Deployment

```bash
# 1. Create R2 buckets (if they don't exist)
wrangler r2 bucket create notropolis-assets-private
wrangler r2 bucket create notropolis-game-assets

# 2. Enable public access on game assets bucket (via Cloudflare dashboard)
#    R2 > notropolis-game-assets > Settings > Public access > Enable
#    Or configure custom domain: assets.notropolis.net

# 3. Run migration
wrangler d1 execute notropolis-db --file=migrations/0022_create_asset_tables.sql

# 4. Secrets already configured via Cloudflare API:
#    - GEMINI_API_KEY ✅
#    - REMOVAL_AI_API_KEY ✅

# 5. Deploy worker (wrangler.toml must have R2 bindings first)
cd authentication-dashboard-system/worker
wrangler deploy

# 6. Verify (use admin token from docs/REFERENCE-test-tokens/CLAUDE.md)
curl -X GET "https://notropolis-api.rikisenia.workers.dev/api/admin/assets/list/building_ref" \
  -H "Authorization: Bearer <ADMIN_TOKEN_FROM_CLAUDE.md>"
```

---

## Handoff Notes

**For Stage 02:**
- API routes are ready at `/api/admin/assets/*`
- Use `POST /generate` with `category: 'building_ref'` for reference sheets
- Prompts are defined in [Ref: 16a-asset-requirements.md#building-reference-sheet-prompts]
- Generate 2 variants per building for selection (`variant: 1` and `variant: 2`)
