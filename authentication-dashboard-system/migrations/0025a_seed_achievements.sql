-- 0025a_seed_achievements.sql
-- Seed achievement definitions

-- ============================================================
-- HERO ACHIEVEMENTS (hero category)
-- ============================================================

INSERT INTO achievements (id, category, name, description, icon, rarity, condition_type, condition_value, points, reward_type, reward_id, sort_order) VALUES
-- First Hero
('ach_hero_1', 'hero', 'First Steps', 'Complete your first hero', '🦸', 'common', 'hero_count', 1, 10, NULL, NULL, 1),
-- 5 Heroes
('ach_hero_5', 'hero', 'Rising Star', 'Complete 5 heroes', '⭐', 'common', 'hero_count', 5, 25, NULL, NULL, 2),
-- 25 Heroes
('ach_hero_25', 'hero', 'Veteran', 'Complete 25 heroes', '🎖️', 'uncommon', 'hero_count', 25, 50, NULL, NULL, 3),
-- 100 Heroes
('ach_hero_100', 'hero', 'Legend', 'Complete 100 heroes', '🏆', 'rare', 'hero_count', 100, 100, NULL, NULL, 4),
-- 500 Heroes
('ach_hero_500', 'hero', 'Mythic Hero', 'Complete 500 heroes', '👑', 'epic', 'hero_count', 500, 250, NULL, NULL, 5);

-- ============================================================
-- WEALTH ACHIEVEMENTS (wealth category)
-- ============================================================

INSERT INTO achievements (id, category, name, description, icon, rarity, condition_type, condition_value, points, reward_type, reward_id, sort_order) VALUES
-- $1M Offshore
('ach_wealth_1m', 'wealth', 'Millionaire', 'Accumulate $1,000,000 in offshore', '💵', 'common', 'offshore_total', 1000000, 15, NULL, NULL, 1),
-- $10M Offshore
('ach_wealth_10m', 'wealth', 'Multi-Millionaire', 'Accumulate $10,000,000 in offshore', '💰', 'uncommon', 'offshore_total', 10000000, 35, NULL, NULL, 2),
-- $100M Offshore
('ach_wealth_100m', 'wealth', 'Tycoon', 'Accumulate $100,000,000 in offshore', '🏦', 'rare', 'offshore_total', 100000000, 75, NULL, NULL, 3),
-- $1B Offshore
('ach_wealth_1b', 'wealth', 'Billionaire', 'Accumulate $1,000,000,000 in offshore', '💎', 'epic', 'offshore_total', 1000000000, 200, NULL, NULL, 4);

-- ============================================================
-- COMBAT ACHIEVEMENTS (combat category)
-- ============================================================

INSERT INTO achievements (id, category, name, description, icon, rarity, condition_type, condition_value, points, reward_type, reward_id, sort_order) VALUES
-- First Attack
('ach_attack_1', 'combat', 'First Blood', 'Perform your first attack', '⚔️', 'common', 'attack_count', 1, 10, NULL, NULL, 1),
-- 10 Attacks
('ach_attack_10', 'combat', 'Aggressor', 'Perform 10 attacks', '🗡️', 'common', 'attack_count', 10, 20, NULL, NULL, 2),
-- 50 Attacks
('ach_attack_50', 'combat', 'Raider', 'Perform 50 attacks', '🔥', 'uncommon', 'attack_count', 50, 40, NULL, NULL, 3),
-- 250 Attacks
('ach_attack_250', 'combat', 'Warlord', 'Perform 250 attacks', '💀', 'rare', 'attack_count', 250, 100, NULL, NULL, 4),
-- 1000 Attacks
('ach_attack_1000', 'combat', 'Destroyer', 'Perform 1,000 attacks', '☠️', 'epic', 'attack_count', 1000, 250, NULL, NULL, 5);

-- ============================================================
-- BADGES
-- ============================================================

INSERT INTO badges (id, name, description, icon, rarity, sort_order) VALUES
('badge_founder', 'Founder', 'Original Notropolis player', '🏛️', 'legendary', 1),
('badge_beta', 'Beta Tester', 'Participated in beta testing', '🧪', 'epic', 2),
('badge_hero_master', 'Hero Master', 'Achieved 1000 heroes', '🦸‍♂️', 'legendary', 3);
