-- 0022_create_avatar_tables.sql

-- Avatar items catalog
CREATE TABLE avatar_items (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  -- Categories: base, skin, hair, outfit, headwear, accessory, background
  name TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  rarity TEXT DEFAULT 'common',
  -- Rarities: common, uncommon, rare, epic, legendary
  unlock_condition TEXT,
  -- NULL = always available, or JSON like {"type":"hero_count","count":10000}
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_avatar_items_category ON avatar_items(category);

-- Company avatar selections
CREATE TABLE company_avatars (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL UNIQUE,
  base_id TEXT,
  skin_id TEXT,
  hair_id TEXT,
  outfit_id TEXT,
  headwear_id TEXT,
  accessory_id TEXT,
  background_id TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (company_id) REFERENCES game_companies(id)
);

-- Unlocked items per user (user-level, not company-level)
CREATE TABLE avatar_unlocks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  unlocked_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (item_id) REFERENCES avatar_items(id),
  UNIQUE(user_id, item_id)
);

CREATE INDEX idx_avatar_unlocks_user ON avatar_unlocks(user_id);

-- Seed avatar items
-- Common items (always available - unlock_condition is NULL)
INSERT INTO avatar_items (id, category, name, r2_key, rarity, unlock_condition, sort_order) VALUES
-- Base bodies
('base_1', 'base', 'Standard', 'avatars/base/standard.png', 'common', NULL, 1),
('base_2', 'base', 'Athletic', 'avatars/base/athletic.png', 'common', NULL, 2),

-- Skin tones
('skin_1', 'skin', 'Light', 'avatars/skin/light.png', 'common', NULL, 1),
('skin_2', 'skin', 'Medium', 'avatars/skin/medium.png', 'common', NULL, 2),
('skin_3', 'skin', 'Dark', 'avatars/skin/dark.png', 'common', NULL, 3),

-- Hair
('hair_1', 'hair', 'Short', 'avatars/hair/short.png', 'common', NULL, 1),
('hair_2', 'hair', 'Long', 'avatars/hair/long.png', 'common', NULL, 2),
('hair_3', 'hair', 'Mohawk', 'avatars/hair/mohawk.png', 'uncommon', NULL, 3),

-- Outfits (common)
('outfit_1', 'outfit', 'Business Suit', 'avatars/outfit/suit.png', 'common', NULL, 1),
('outfit_2', 'outfit', 'Casual', 'avatars/outfit/casual.png', 'common', NULL, 2),

-- Headwear (common)
('head_1', 'headwear', 'Top Hat', 'avatars/headwear/tophat.png', 'uncommon', NULL, 1),
('head_2', 'headwear', 'Baseball Cap', 'avatars/headwear/cap.png', 'common', NULL, 2),

-- Accessories (common)
('acc_1', 'accessory', 'Sunglasses', 'avatars/accessory/sunglasses.png', 'common', NULL, 1),
('acc_2', 'accessory', 'Watch', 'avatars/accessory/watch.png', 'common', NULL, 2),

-- Backgrounds (common)
('bg_1', 'background', 'City Skyline', 'avatars/background/city.png', 'common', NULL, 1),
('bg_2', 'background', 'Office', 'avatars/background/office.png', 'common', NULL, 2),

-- ============================================================
-- UNLOCKABLE ITEMS (with unlock_condition)
-- These have unreachable conditions for now - logic is in place
-- ============================================================

-- Legendary Crown - Requires 10,000 hero completions (unreachable placeholder)
('head_legendary_crown', 'headwear', 'Legendary Crown', 'avatars/headwear/legendary_crown.png', 'legendary', '{"type":"hero_count","count":10000}', 100),

-- Mythic Gold Suit - Requires 500,000 hero completions (unreachable placeholder)
('outfit_mythic_gold', 'outfit', 'Mythic Gold Suit', 'avatars/outfit/mythic_gold.png', 'legendary', '{"type":"hero_count","count":500000}', 100);
