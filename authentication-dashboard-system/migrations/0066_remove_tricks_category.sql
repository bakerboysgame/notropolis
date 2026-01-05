-- Remove the redundant 'tricks' category
-- All effect overlays are now managed in the 'effects' category
DELETE FROM asset_configurations WHERE category = 'tricks';
