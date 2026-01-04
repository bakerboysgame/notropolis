-- Add boss_name column to game_companies
-- This field stores the name of the company's boss (e.g., "Doctor Test")
-- which is displayed alongside the company name

ALTER TABLE game_companies ADD COLUMN boss_name TEXT;

-- Assign random boss names to existing companies
UPDATE game_companies
SET boss_name = CASE ABS(RANDOM()) % 20
    WHEN 0 THEN 'Don Vito'
    WHEN 1 THEN 'Big Tony'
    WHEN 2 THEN 'The Professor'
    WHEN 3 THEN 'Lucky Lou'
    WHEN 4 THEN 'Slick Rick'
    WHEN 5 THEN 'Mad Max'
    WHEN 6 THEN 'Boss Hog'
    WHEN 7 THEN 'The Baron'
    WHEN 8 THEN 'Mr. Black'
    WHEN 9 THEN 'Johnny Cash'
    WHEN 10 THEN 'The Shark'
    WHEN 11 THEN 'Silent Sam'
    WHEN 12 THEN 'Fast Eddie'
    WHEN 13 THEN 'The Duke'
    WHEN 14 THEN 'Scarface'
    WHEN 15 THEN 'The Wolf'
    WHEN 16 THEN 'Kingpin'
    WHEN 17 THEN 'Doc Holiday'
    WHEN 18 THEN 'The Fixer'
    ELSE 'Big Boss'
END
WHERE boss_name IS NULL;
