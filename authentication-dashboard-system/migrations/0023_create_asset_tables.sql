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
