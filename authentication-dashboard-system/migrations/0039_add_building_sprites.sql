-- Migration 0039: Add sprite references to building types
-- Purpose: Store sprite metadata for isometric rendering

-- Add sprite reference columns to building_types
ALTER TABLE building_types ADD COLUMN sprite_key TEXT;
ALTER TABLE building_types ADD COLUMN sprite_height INTEGER DEFAULT 64;

-- Update building types with sprite keys
-- URL format: https://assets.notropolis.net/sprites/building_sprite/{sprite_key}.webp
UPDATE building_types SET sprite_key = 'market_stall_v3', sprite_height = 48 WHERE id = 'market_stall';
UPDATE building_types SET sprite_key = 'hot_dog_stand_v3', sprite_height = 48 WHERE id = 'hot_dog_stand';
UPDATE building_types SET sprite_key = 'campsite_v3', sprite_height = 48 WHERE id = 'campsite';
UPDATE building_types SET sprite_key = 'shop_v3', sprite_height = 64 WHERE id = 'shop';
UPDATE building_types SET sprite_key = 'burger_bar_v4', sprite_height = 64 WHERE id = 'burger_bar';
UPDATE building_types SET sprite_key = 'motel_v2', sprite_height = 80 WHERE id = 'motel';
UPDATE building_types SET sprite_key = 'high_street_store_v2', sprite_height = 96 WHERE id = 'high_street_store';
UPDATE building_types SET sprite_key = 'restaurant_v9', sprite_height = 96 WHERE id = 'restaurant';
UPDATE building_types SET sprite_key = 'manor_v3', sprite_height = 112 WHERE id = 'manor';
UPDATE building_types SET sprite_key = 'casino_v3', sprite_height = 128 WHERE id = 'casino';

-- Note: Special buildings (temple, bank, police_station) use fixed sprite mappings in code
-- since they are terrain-based, not building instances
