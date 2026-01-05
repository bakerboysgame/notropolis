-- Add building variants system
-- Allows certain building types to have player-selectable sub-types (variants)
-- Adds competition penalty for same-variant/type buildings nearby

-- Add variant column to building_instances (nullable - only for buildings that support variants)
ALTER TABLE building_instances ADD COLUMN variant TEXT;

-- Add variants JSON array to building_types (defines available variants per type)
ALTER TABLE building_types ADD COLUMN variants TEXT;

-- Populate variant options for buildings that support them
UPDATE building_types SET variants = '["Fashion", "Food", "Electronics", "Books"]' WHERE id = 'high_street_store';
UPDATE building_types SET variants = '["Grocery", "Hardware", "Pharmacy", "Pet", "Sports", "Gift"]' WHERE id = 'shop';
UPDATE building_types SET variants = '["Crafts", "Flowers", "Antiques", "Clothing", "Jewelry", "Art"]' WHERE id = 'market_stall';
