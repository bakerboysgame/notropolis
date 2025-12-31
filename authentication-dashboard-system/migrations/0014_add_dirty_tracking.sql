-- Add dirty tracking for efficient tick processing
-- Buildings are marked needs_profit_recalc = 1 when adjacent buildings/terrain change
-- Tick system only recalculates buildings with this flag set

ALTER TABLE building_instances ADD COLUMN needs_profit_recalc INTEGER DEFAULT 0;

-- Partial index for efficient lookup of dirty buildings
CREATE INDEX idx_buildings_needs_recalc ON building_instances(needs_profit_recalc) WHERE needs_profit_recalc = 1;
