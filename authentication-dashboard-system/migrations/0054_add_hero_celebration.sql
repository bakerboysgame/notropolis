-- Hero Celebration System
-- Tracks hero-out messages for the town/city hall book

-- Add flag to track if company has pending hero celebration
ALTER TABLE game_companies ADD COLUMN hero_celebration_pending INTEGER DEFAULT 0;

-- Store the map they hero'd from (for showing celebration page)
ALTER TABLE game_companies ADD COLUMN hero_from_map_id TEXT DEFAULT NULL;
ALTER TABLE game_companies ADD COLUMN hero_from_location_type TEXT DEFAULT NULL;

-- Create hero messages table for town hall book
CREATE TABLE IF NOT EXISTS hero_messages (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  company_name TEXT NOT NULL,
  boss_name TEXT NOT NULL,
  map_id TEXT NOT NULL,
  map_name TEXT NOT NULL,
  location_type TEXT NOT NULL CHECK(location_type IN ('town', 'city', 'capital')),
  message TEXT NOT NULL,
  offshore_amount INTEGER NOT NULL,
  hero_path TEXT NOT NULL CHECK(hero_path IN ('netWorth', 'cash', 'land')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (company_id) REFERENCES game_companies(id),
  FOREIGN KEY (map_id) REFERENCES maps(id)
);

-- Index for querying messages by map
CREATE INDEX IF NOT EXISTS idx_hero_messages_map ON hero_messages(map_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hero_messages_location ON hero_messages(location_type, created_at DESC);
