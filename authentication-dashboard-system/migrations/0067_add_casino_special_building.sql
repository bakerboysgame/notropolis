-- 0067_add_casino_special_building.sql
-- Add 'casino' to the special_building CHECK constraint in tiles table

-- Disable foreign key checks during migration
PRAGMA foreign_keys = OFF;

-- Step 1: Create new table with updated constraint
CREATE TABLE tiles_new (
  id TEXT PRIMARY KEY,
  map_id TEXT NOT NULL,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,

  -- Terrain
  terrain_type TEXT CHECK(terrain_type IN ('free_land', 'water', 'road', 'dirt_track', 'trees')) NOT NULL,

  -- Special buildings (admin-placed, NULL = no special building)
  special_building TEXT CHECK(special_building IS NULL OR special_building IN ('temple', 'bank', 'police_station', 'casino')),

  -- Ownership
  owner_company_id TEXT,
  purchased_at TEXT,

  FOREIGN KEY (map_id) REFERENCES maps(id),
  FOREIGN KEY (owner_company_id) REFERENCES game_companies(id),
  UNIQUE(map_id, x, y)
);

-- Step 2: Copy all data from old table
INSERT INTO tiles_new SELECT * FROM tiles;

-- Step 3: Drop old table
DROP TABLE tiles;

-- Step 4: Rename new table
ALTER TABLE tiles_new RENAME TO tiles;

-- Step 5: Recreate indexes
CREATE INDEX idx_tiles_map ON tiles(map_id);
CREATE INDEX idx_tiles_owner ON tiles(owner_company_id);
CREATE INDEX idx_tiles_coords ON tiles(map_id, x, y);

-- Re-enable foreign key checks
PRAGMA foreign_keys = ON;
