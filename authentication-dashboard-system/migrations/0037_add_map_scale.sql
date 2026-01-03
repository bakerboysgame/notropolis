-- ============================================
-- Migration: Add map_scale to configuration tables
-- ============================================

-- Add map_scale to building_configurations
ALTER TABLE building_configurations ADD COLUMN map_scale REAL;

-- Add map_scale to asset_configurations
ALTER TABLE asset_configurations ADD COLUMN map_scale REAL;

-- ============================================
-- Set default map_scale values for buildings
-- Based on size class (smaller buildings = smaller scale)
-- 13 building types total
-- ============================================

-- SHORT class (small stalls/stands)
UPDATE building_configurations SET map_scale = 0.4
WHERE building_type_id IN ('market_stall', 'hot_dog_stand', 'campsite');

-- MEDIUM class (shops and eateries)
UPDATE building_configurations SET map_scale = 0.6
WHERE building_type_id IN ('shop', 'burger_bar', 'motel');

-- TALL class (larger establishments)
UPDATE building_configurations SET map_scale = 0.8
WHERE building_type_id IN ('high_street_store', 'restaurant', 'manor', 'police_station');

-- VERY_TALL class (landmarks) - full size
UPDATE building_configurations SET map_scale = 1.0
WHERE building_type_id IN ('casino', 'temple', 'bank');

-- ============================================
-- Set default map_scale for other asset types
-- Actual categories: base_ground, effects, npcs, terrain, tricks
-- ============================================

-- NPCs are small (output 64x64, scale 0.1)
UPDATE asset_configurations SET map_scale = 0.1 WHERE category = 'npcs';

-- Terrain tiles (output 320x320, scale 1.0)
UPDATE asset_configurations SET map_scale = 1.0 WHERE category = 'terrain';

-- Effects match buildings (output 320x320, scale 1.0)
UPDATE asset_configurations SET map_scale = 1.0 WHERE category = 'effects';

-- Base ground (output 320x320, scale 1.0)
UPDATE asset_configurations SET map_scale = 1.0 WHERE category = 'base_ground';

-- Tricks are small effects (scale 0.3)
UPDATE asset_configurations SET map_scale = 0.3 WHERE category = 'tricks';
