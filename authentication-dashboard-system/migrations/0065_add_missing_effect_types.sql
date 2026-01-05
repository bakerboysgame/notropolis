-- Add missing effect types to asset_configurations
-- These match the EFFECT_FEATURES defined in the worker

-- Add missing dirty trick effects (vandalism, robbery, poisoning, blackout)
INSERT OR IGNORE INTO asset_configurations (category, asset_key, is_active, map_scale)
VALUES
    ('effects', 'vandalism', 0, 1.0),
    ('effects', 'robbery', 0, 1.0),
    ('effects', 'poisoning', 0, 1.0),
    ('effects', 'blackout', 0, 1.0);

-- Remove unneeded/misnamed effects that don't match EFFECT_FEATURES
-- These were created but don't have corresponding prompts in the worker
DELETE FROM asset_configurations
WHERE category = 'effects'
AND asset_key IN (
    'cursor_select',      -- Not in EFFECT_FEATURES
    'minimap_enemy',      -- Not in EFFECT_FEATURES
    'minimap_player',     -- Not in EFFECT_FEATURES
    'owned_other',        -- Not in EFFECT_FEATURES
    'owned_self',         -- Not in EFFECT_FEATURES
    'fire_bomb'           -- Not in EFFECT_FEATURES (destruction_bomb exists)
);
