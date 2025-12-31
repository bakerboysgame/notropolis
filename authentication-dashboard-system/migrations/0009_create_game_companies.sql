-- 0009_create_game_companies.sql
CREATE TABLE game_companies (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  -- Location
  current_map_id TEXT,
  location_type TEXT CHECK(location_type IN ('town', 'city', 'capital')),

  -- Financials
  cash INTEGER DEFAULT 50000,
  offshore INTEGER DEFAULT 0,

  -- Progression
  level INTEGER DEFAULT 1,
  total_actions INTEGER DEFAULT 0,

  -- Status
  is_in_prison INTEGER DEFAULT 0,
  prison_fine INTEGER DEFAULT 0,

  -- Tick tracking
  last_action_at TEXT,
  ticks_since_action INTEGER DEFAULT 0,

  -- Hero tracking
  land_ownership_streak INTEGER DEFAULT 0,
  land_percentage REAL DEFAULT 0,

  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_game_companies_user ON game_companies(user_id);
CREATE INDEX idx_game_companies_map ON game_companies(current_map_id);
