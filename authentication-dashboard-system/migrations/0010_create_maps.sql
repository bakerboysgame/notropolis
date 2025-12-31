-- 0010_create_maps.sql
CREATE TABLE maps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  location_type TEXT CHECK(location_type IN ('town', 'city', 'capital')) NOT NULL,

  -- Grid size
  width INTEGER NOT NULL CHECK(width <= 100),
  height INTEGER NOT NULL CHECK(height <= 100),

  -- Hero requirements
  hero_net_worth INTEGER NOT NULL,
  hero_cash INTEGER NOT NULL,
  hero_land_percentage REAL NOT NULL,

  -- Police
  police_strike_day INTEGER CHECK(police_strike_day BETWEEN 0 AND 6),

  -- Metadata
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE tiles (
  id TEXT PRIMARY KEY,
  map_id TEXT NOT NULL,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,

  -- Terrain
  terrain_type TEXT CHECK(terrain_type IN ('free_land', 'water', 'road', 'dirt_track', 'trees')) NOT NULL,

  -- Special buildings (admin-placed, NULL = no special building)
  special_building TEXT CHECK(special_building IS NULL OR special_building IN ('temple', 'bank', 'police_station')),

  -- Ownership
  owner_company_id TEXT,
  purchased_at TEXT,

  FOREIGN KEY (map_id) REFERENCES maps(id),
  FOREIGN KEY (owner_company_id) REFERENCES game_companies(id),
  UNIQUE(map_id, x, y)
);

CREATE INDEX idx_tiles_map ON tiles(map_id);
CREATE INDEX idx_tiles_owner ON tiles(owner_company_id);
CREATE INDEX idx_tiles_coords ON tiles(map_id, x, y);
