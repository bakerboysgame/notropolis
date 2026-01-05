-- 0068_hero_out_testerville_and_archive.sql
-- Hero out all companies from Testerville and archive the map

-- Step 1: Calculate total value (cash + buildings) and update offshore for each company on Testerville
-- This adds their cash plus building values to their offshore account
UPDATE game_companies
SET
    offshore = offshore + cash + COALESCE(
        (SELECT SUM(COALESCE(bi.calculated_value, bt.cost))
         FROM building_instances bi
         JOIN building_types bt ON bi.building_type_id = bt.id
         JOIN tiles t ON bi.tile_id = t.id
         WHERE bi.company_id = game_companies.id AND t.map_id = 'map_testerville_001'),
        0
    ),
    cash = 0,
    level = 1,
    total_actions = 0,
    current_map_id = NULL,
    location_type = NULL,
    land_ownership_streak = 0,
    land_percentage = 0,
    hero_eligible_streak = 0,
    is_in_prison = 0,
    prison_fine = 0,
    hero_celebration_pending = 1,
    hero_from_map_id = 'map_testerville_001',
    hero_from_location_type = 'town',
    ticks_since_action = 0
WHERE current_map_id = 'map_testerville_001';

-- Step 2: Log forced hero-out transactions for all affected companies
INSERT INTO game_transactions (id, company_id, map_id, action_type, amount, details)
SELECT
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
    gc.id,
    'map_testerville_001',
    'forced_hero_out',
    gc.offshore,
    json_object(
        'path', 'admin_archive',
        'buildings_sold', (SELECT COUNT(*) FROM building_instances bi JOIN tiles t ON bi.tile_id = t.id WHERE bi.company_id = gc.id AND t.map_id = 'map_testerville_001'),
        'building_value', COALESCE((SELECT SUM(COALESCE(bi.calculated_value, bt.cost)) FROM building_instances bi JOIN building_types bt ON bi.building_type_id = bt.id JOIN tiles t ON bi.tile_id = t.id WHERE bi.company_id = gc.id AND t.map_id = 'map_testerville_001'), 0),
        'forced', true,
        'reason', 'map_archived'
    )
FROM game_companies gc
WHERE gc.hero_from_map_id = 'map_testerville_001' AND gc.hero_celebration_pending = 1;

-- Step 3: Delete building security for all buildings on Testerville
DELETE FROM building_security
WHERE building_id IN (
    SELECT bi.id
    FROM building_instances bi
    JOIN tiles t ON bi.tile_id = t.id
    WHERE t.map_id = 'map_testerville_001'
);

-- Step 4: Delete all building instances on Testerville
DELETE FROM building_instances
WHERE tile_id IN (
    SELECT id FROM tiles WHERE map_id = 'map_testerville_001'
);

-- Step 5: Clear tile ownership for all tiles on Testerville
UPDATE tiles
SET owner_company_id = NULL, purchased_at = NULL
WHERE map_id = 'map_testerville_001';

-- Step 6: Archive the map
UPDATE maps
SET is_active = 0
WHERE id = 'map_testerville_001';
