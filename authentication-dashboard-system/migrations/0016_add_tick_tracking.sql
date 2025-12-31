-- Add tick history tracking for game tick system
-- Records each 10-minute tick execution with financial summaries

CREATE TABLE tick_history (
  id TEXT PRIMARY KEY,
  processed_at TEXT DEFAULT CURRENT_TIMESTAMP,

  -- Performance metrics
  execution_time_ms INTEGER,
  maps_processed INTEGER DEFAULT 0,
  companies_updated INTEGER DEFAULT 0,
  buildings_recalculated INTEGER DEFAULT 0,

  -- Financial summary
  gross_profit INTEGER DEFAULT 0,
  tax_amount INTEGER DEFAULT 0,
  net_profit INTEGER DEFAULT 0,

  -- Fire summary
  fires_started INTEGER DEFAULT 0,
  fires_extinguished INTEGER DEFAULT 0,
  buildings_damaged INTEGER DEFAULT 0,
  buildings_collapsed INTEGER DEFAULT 0,

  -- Error tracking
  errors TEXT -- JSON array of any errors encountered
);

CREATE INDEX idx_tick_history_date ON tick_history(processed_at DESC);
