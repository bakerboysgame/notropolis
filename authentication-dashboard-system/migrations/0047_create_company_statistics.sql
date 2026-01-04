-- 0047_create_company_statistics.sql
-- Dedicated statistics table updated during tick processing
-- Stores comprehensive income data for each company per location

CREATE TABLE company_statistics (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  map_id TEXT NOT NULL,

  -- Building counts
  building_count INTEGER DEFAULT 0,
  collapsed_count INTEGER DEFAULT 0,

  -- Profit breakdown (per tick = 1 in-game month)
  base_profit INTEGER DEFAULT 0,          -- Sum of calculated_profit before damage
  gross_profit INTEGER DEFAULT 0,         -- After damage multiplier applied
  tax_rate REAL DEFAULT 0,                -- Tax rate at time of calculation
  tax_amount INTEGER DEFAULT 0,           -- Gross profit * tax rate
  security_cost INTEGER DEFAULT 0,        -- Total security costs this tick
  net_profit INTEGER DEFAULT 0,           -- Final: gross - tax - security

  -- Asset values
  total_building_value INTEGER DEFAULT 0, -- Sum of building costs (for net worth)
  damaged_building_value INTEGER DEFAULT 0, -- Value accounting for damage

  -- Health metrics
  total_damage_percent INTEGER DEFAULT 0, -- Sum of all building damage
  average_damage_percent REAL DEFAULT 0,  -- Average building health
  buildings_on_fire INTEGER DEFAULT 0,

  -- Activity
  ticks_since_action INTEGER DEFAULT 0,   -- Company's idle counter at tick time
  is_earning INTEGER DEFAULT 1,           -- Whether company earned this tick (ticks_since_action < 6)

  -- Timestamps
  last_tick_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (company_id) REFERENCES game_companies(id),
  FOREIGN KEY (map_id) REFERENCES maps(id),
  UNIQUE (company_id, map_id)
);

-- Indexes for common queries
CREATE INDEX idx_company_statistics_map ON company_statistics(map_id);
CREATE INDEX idx_company_statistics_company ON company_statistics(company_id);
CREATE INDEX idx_company_statistics_net_profit ON company_statistics(map_id, net_profit DESC);
CREATE INDEX idx_company_statistics_building_value ON company_statistics(map_id, total_building_value DESC);
