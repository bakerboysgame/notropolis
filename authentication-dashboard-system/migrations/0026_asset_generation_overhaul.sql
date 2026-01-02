-- Migration: 0026_asset_generation_overhaul.sql
-- Purpose: Add tables for reference image library, prompt templates, and generation settings
-- Author: Asset Admin Overhaul Plan
-- Date: 2026-01-02

-- ============================================
-- REFERENCE IMAGE LIBRARY
-- Stores uploaded reference images for generation context
-- ============================================

CREATE TABLE IF NOT EXISTS reference_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    tags TEXT,
    r2_key TEXT NOT NULL,
    thumbnail_r2_key TEXT,
    width INTEGER,
    height INTEGER,
    file_size INTEGER,
    mime_type TEXT DEFAULT 'image/png',
    uploaded_by TEXT,
    usage_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_archived BOOLEAN DEFAULT FALSE,
    archived_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_ref_images_category ON reference_images(category);
CREATE INDEX IF NOT EXISTS idx_ref_images_archived ON reference_images(is_archived);
CREATE INDEX IF NOT EXISTS idx_ref_images_created ON reference_images(created_at DESC);

-- ============================================
-- ASSET REFERENCE LINKS
-- Links reference images to specific generations
-- ============================================

CREATE TABLE IF NOT EXISTS asset_reference_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL,
    reference_image_id INTEGER,
    approved_asset_id INTEGER,
    link_type TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (asset_id) REFERENCES generated_assets(id) ON DELETE CASCADE,
    FOREIGN KEY (reference_image_id) REFERENCES reference_images(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_asset_id) REFERENCES generated_assets(id) ON DELETE SET NULL,
    CHECK (
        (reference_image_id IS NOT NULL AND approved_asset_id IS NULL AND link_type = 'library') OR
        (reference_image_id IS NULL AND approved_asset_id IS NOT NULL AND link_type = 'approved_asset')
    )
);

CREATE INDEX IF NOT EXISTS idx_asset_refs_asset ON asset_reference_links(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_refs_image ON asset_reference_links(reference_image_id);
CREATE INDEX IF NOT EXISTS idx_asset_refs_approved ON asset_reference_links(approved_asset_id);

-- ============================================
-- PROMPT TEMPLATES
-- Editable prompts per category/asset_key (replaces hardcoded)
-- ============================================

CREATE TABLE IF NOT EXISTS prompt_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    asset_key TEXT NOT NULL,
    template_name TEXT,
    base_prompt TEXT NOT NULL,
    style_guide TEXT,
    system_instructions TEXT,
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    change_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_prompt_templates_lookup ON prompt_templates(category, asset_key, is_active);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_category ON prompt_templates(category);

-- ============================================
-- ALTER GENERATED_ASSETS
-- Add generation settings and auto-creation tracking
-- ============================================

-- Add new columns (will error if already exist - run migration only once)
-- Note: is_active column already exists from a previous migration
ALTER TABLE generated_assets ADD COLUMN generation_settings TEXT;
ALTER TABLE generated_assets ADD COLUMN auto_created BOOLEAN DEFAULT FALSE;
ALTER TABLE generated_assets ADD COLUMN auto_created_from INTEGER;

CREATE INDEX IF NOT EXISTS idx_assets_auto_created ON generated_assets(auto_created_from);
CREATE INDEX IF NOT EXISTS idx_assets_active ON generated_assets(category, asset_key, is_active);

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- View: Active prompt templates
CREATE VIEW IF NOT EXISTS v_active_prompt_templates AS
SELECT
    id,
    category,
    asset_key,
    template_name,
    base_prompt,
    style_guide,
    system_instructions,
    version,
    created_by,
    updated_at
FROM prompt_templates
WHERE is_active = TRUE;

-- View: Reference library (non-archived)
CREATE VIEW IF NOT EXISTS v_reference_library AS
SELECT
    id,
    name,
    description,
    category,
    tags,
    r2_key,
    thumbnail_r2_key,
    width,
    height,
    file_size,
    usage_count,
    uploaded_by,
    created_at
FROM reference_images
WHERE is_archived = FALSE
ORDER BY created_at DESC;

-- View: Asset with references
CREATE VIEW IF NOT EXISTS v_asset_references AS
SELECT
    ga.id AS asset_id,
    ga.category,
    ga.asset_key,
    ga.status,
    arl.id AS link_id,
    arl.link_type,
    arl.sort_order,
    CASE
        WHEN arl.link_type = 'library' THEN ri.name
        WHEN arl.link_type = 'approved_asset' THEN ref_asset.asset_key || ' v' || ref_asset.variant
    END AS reference_name,
    CASE
        WHEN arl.link_type = 'library' THEN ri.thumbnail_r2_key
        WHEN arl.link_type = 'approved_asset' THEN ref_asset.r2_key_private
    END AS reference_thumbnail
FROM generated_assets ga
LEFT JOIN asset_reference_links arl ON ga.id = arl.asset_id
LEFT JOIN reference_images ri ON arl.reference_image_id = ri.id
LEFT JOIN generated_assets ref_asset ON arl.approved_asset_id = ref_asset.id;
