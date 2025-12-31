-- 0012_create_game_transactions.sql
CREATE TABLE game_transactions (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  map_id TEXT,

  action_type TEXT NOT NULL,
  -- Types: buy_land, build, demolish, sell_to_state, list_for_sale,
  --        buy_property, dirty_trick, caught_by_police, pay_fine,
  --        tick_income, hero_out, bank_transfer, security_purchase

  target_tile_id TEXT,
  target_company_id TEXT,
  target_building_id TEXT,

  amount INTEGER, -- Money involved
  details TEXT, -- JSON with additional info

  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (company_id) REFERENCES game_companies(id),
  FOREIGN KEY (map_id) REFERENCES maps(id)
);

CREATE INDEX idx_game_transactions_company ON game_transactions(company_id);
CREATE INDEX idx_game_transactions_type ON game_transactions(action_type);
CREATE INDEX idx_game_transactions_time ON game_transactions(created_at);
