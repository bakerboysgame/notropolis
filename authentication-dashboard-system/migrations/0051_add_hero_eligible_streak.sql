-- Add hero eligible streak tracking for forced hero-out
-- Companies meeting hero requirements for 6+ consecutive ticks are forced to hero

-- Track consecutive ticks a company has been eligible to hero
ALTER TABLE game_companies ADD COLUMN hero_eligible_streak INTEGER DEFAULT 0;

-- Allow per-map configuration of forced hero threshold (NULL = use default of 6)
ALTER TABLE maps ADD COLUMN forced_hero_after_ticks INTEGER DEFAULT NULL;
