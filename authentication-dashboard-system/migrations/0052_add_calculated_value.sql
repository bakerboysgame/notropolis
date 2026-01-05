-- Add dynamic calculated_value field to building_instances
-- Building values now fluctuate based on position and nearby building conditions
-- Similar to how calculated_profit works

-- The calculated value of the building (base cost modified by location/adjacency)
ALTER TABLE building_instances ADD COLUMN calculated_value INTEGER DEFAULT NULL;

-- Store the breakdown of value modifiers (terrain, neighbors, etc.)
ALTER TABLE building_instances ADD COLUMN value_modifiers TEXT DEFAULT NULL;
