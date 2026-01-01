-- 0021_create_social_tables.sql
-- Social features: Message boards, Temple donations, Casino

-- Message boards
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  map_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (map_id) REFERENCES maps(id),
  FOREIGN KEY (company_id) REFERENCES game_companies(id)
);

CREATE INDEX idx_messages_map ON messages(map_id);
CREATE INDEX idx_messages_time ON messages(created_at);

-- Track when each company last read messages for each map
CREATE TABLE message_read_status (
  company_id TEXT NOT NULL,
  map_id TEXT NOT NULL,
  last_read_at TEXT DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (company_id, map_id),
  FOREIGN KEY (company_id) REFERENCES game_companies(id),
  FOREIGN KEY (map_id) REFERENCES maps(id)
);

-- Temple donations
CREATE TABLE donations (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (company_id) REFERENCES game_companies(id)
);

CREATE INDEX idx_donations_company ON donations(company_id);
CREATE INDEX idx_donations_time ON donations(created_at);

-- Casino games
CREATE TABLE casino_games (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  game_type TEXT NOT NULL DEFAULT 'roulette',
  bet_amount INTEGER NOT NULL,
  bet_type TEXT NOT NULL,
  bet_value TEXT,
  result INTEGER,
  won INTEGER DEFAULT 0,
  payout INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (company_id) REFERENCES game_companies(id)
);

CREATE INDEX idx_casino_company ON casino_games(company_id);
