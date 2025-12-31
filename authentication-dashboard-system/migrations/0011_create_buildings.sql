-- 0011_create_buildings.sql
CREATE TABLE building_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cost INTEGER NOT NULL,
  base_profit INTEGER NOT NULL,
  level_required INTEGER DEFAULT 1,
  requires_license INTEGER DEFAULT 0,

  -- Adjacency preferences (JSON)
  adjacency_bonuses TEXT, -- e.g., {"water": 0.2, "road": 0.1}
  adjacency_penalties TEXT, -- e.g., {"dirt_track": -0.05}

  -- Limits
  max_per_map INTEGER, -- null = unlimited

  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE building_instances (
  id TEXT PRIMARY KEY,
  tile_id TEXT NOT NULL UNIQUE,
  building_type_id TEXT NOT NULL,
  company_id TEXT NOT NULL,

  -- Status
  damage_percent INTEGER DEFAULT 0 CHECK(damage_percent BETWEEN 0 AND 100),
  is_on_fire INTEGER DEFAULT 0,
  is_collapsed INTEGER DEFAULT 0,

  -- Market
  is_for_sale INTEGER DEFAULT 0,
  sale_price INTEGER,

  -- Calculated profit (cached, recalculated on changes)
  calculated_profit INTEGER,
  profit_modifiers TEXT, -- JSON breakdown of modifiers

  built_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (tile_id) REFERENCES tiles(id),
  FOREIGN KEY (building_type_id) REFERENCES building_types(id),
  FOREIGN KEY (company_id) REFERENCES game_companies(id)
);

CREATE INDEX idx_buildings_company ON building_instances(company_id);
CREATE INDEX idx_buildings_tile ON building_instances(tile_id);
CREATE INDEX idx_buildings_for_sale ON building_instances(is_for_sale) WHERE is_for_sale = 1;
