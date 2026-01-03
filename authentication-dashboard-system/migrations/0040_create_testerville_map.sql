-- 0040_create_testerville_map.sql
-- Create a 60x60 test map called "Testerville"

-- Insert the map
INSERT INTO maps (id, name, country, location_type, width, height, hero_net_worth, hero_cash, hero_land_percentage, police_strike_day)
VALUES (
  'map_testerville_001',
  'Testerville',
  'Testland',
  'town',
  60,
  60,
  5500000,
  4000000,
  6.0,
  3
);

-- Generate all 3600 tiles (60x60)
-- Using a CTE to generate coordinates and assign terrain types
WITH RECURSIVE
  x_coords(x) AS (
    SELECT 0
    UNION ALL
    SELECT x + 1 FROM x_coords WHERE x < 59
  ),
  y_coords(y) AS (
    SELECT 0
    UNION ALL
    SELECT y + 1 FROM y_coords WHERE y < 59
  ),
  all_coords AS (
    SELECT x, y FROM x_coords CROSS JOIN y_coords
  )
INSERT INTO tiles (id, map_id, x, y, terrain_type, special_building)
SELECT
  'tile_testerville_' || x || '_' || y,
  'map_testerville_001',
  x,
  y,
  CASE
    -- Water: river running through the map (diagonal)
    WHEN (x BETWEEN 25 AND 27 AND y < 30) OR (y BETWEEN 25 AND 27 AND x >= 25) THEN 'water'
    -- Water: small pond in corner
    WHEN (x BETWEEN 5 AND 8 AND y BETWEEN 50 AND 53) THEN 'water'
    -- Main road: horizontal through center
    WHEN y = 30 AND x NOT BETWEEN 25 AND 27 THEN 'road'
    -- Main road: vertical through center
    WHEN x = 30 AND y NOT BETWEEN 25 AND 27 THEN 'road'
    -- Secondary roads
    WHEN y = 15 AND x BETWEEN 10 AND 50 THEN 'road'
    WHEN y = 45 AND x BETWEEN 10 AND 50 THEN 'road'
    WHEN x = 15 AND y BETWEEN 10 AND 50 THEN 'road'
    WHEN x = 45 AND y BETWEEN 10 AND 50 THEN 'road'
    -- Trees: forest patches
    WHEN (x BETWEEN 0 AND 5 AND y BETWEEN 0 AND 10) THEN 'trees'
    WHEN (x BETWEEN 50 AND 59 AND y BETWEEN 0 AND 8) THEN 'trees'
    WHEN (x BETWEEN 0 AND 8 AND y BETWEEN 55 AND 59) THEN 'trees'
    WHEN (x BETWEEN 52 AND 59 AND y BETWEEN 52 AND 59) THEN 'trees'
    -- Dirt tracks
    WHEN (x = 20 AND y BETWEEN 20 AND 40) THEN 'dirt_track'
    WHEN (x = 40 AND y BETWEEN 20 AND 40) THEN 'dirt_track'
    -- Everything else is free land
    ELSE 'free_land'
  END,
  CASE
    -- Temple at center-ish
    WHEN x = 32 AND y = 32 THEN 'temple'
    -- Bank near the crossroads
    WHEN x = 28 AND y = 30 THEN 'bank'
    -- Police station
    WHEN x = 32 AND y = 28 THEN 'police_station'
    ELSE NULL
  END
FROM all_coords;
