-- Add 'vehicle' as a separate asset category
-- Vehicles need their own category (separate from 'npc' which is for pedestrians)

INSERT OR IGNORE INTO asset_categories (id, name, description, parent_category, requires_approval, requires_background_removal)
VALUES ('vehicle', 'Vehicle Sprite', 'Car and vehicle sprites', 'vehicle_ref', TRUE, TRUE);
