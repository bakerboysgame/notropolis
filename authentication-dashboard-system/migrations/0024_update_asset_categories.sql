-- ============================================
-- UPDATE ASSET CATEGORIES
-- Adds new reference sheet categories and fixes naming
-- ============================================

-- Add new reference sheet categories
INSERT OR REPLACE INTO asset_categories (id, name, description, parent_category, requires_approval, requires_background_removal) VALUES
    -- Reference sheets (no parent, no bg removal)
    ('building_ref', 'Building Reference Sheet', 'Multi-view reference sheets for buildings', NULL, TRUE, FALSE),
    ('character_ref', 'Character Reference Sheet', 'Reference sheets for pedestrians and avatar base', NULL, TRUE, FALSE),
    ('vehicle_ref', 'Vehicle Reference Sheet', 'Reference sheets for cars and vehicles', NULL, TRUE, FALSE),
    ('effect_ref', 'Effect Reference Sheet', 'Reference sheets for dirty trick effects', NULL, TRUE, FALSE),

    -- Sprites derived from refs (have parent, need bg removal)
    ('building_sprite', 'Building Sprite', 'Isometric game sprites for buildings', 'building_ref', TRUE, TRUE),
    ('npc', 'NPC Sprite', 'Pedestrian and vehicle sprites', 'character_ref', TRUE, TRUE),
    ('effect', 'Effect Overlay', 'Dirty trick and damage effect overlays', 'effect_ref', TRUE, TRUE),

    -- Standalone sprites
    ('terrain', 'Terrain Tile', 'Isometric terrain tiles', NULL, TRUE, TRUE),
    ('overlay', 'Ownership Overlay', 'Tile ownership overlays (semi-transparent)', NULL, TRUE, FALSE),
    ('ui', 'UI Element', 'UI elements like minimap markers and cursors', NULL, TRUE, TRUE),
    ('avatar', 'Avatar Layer', 'Avatar customization layers', 'character_ref', TRUE, TRUE),

    -- Full illustrations (no bg removal)
    ('scene', 'Scene Illustration', 'Full scene backgrounds and foregrounds', NULL, TRUE, FALSE);

-- Remove old category if exists
DELETE FROM asset_categories WHERE id = 'dirty_trick_ref';
DELETE FROM asset_categories WHERE id = 'dirty_trick_sprite';
DELETE FROM asset_categories WHERE id = 'status_effect';
