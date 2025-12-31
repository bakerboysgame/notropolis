-- Migration 0015: Seed Building Types
-- Purpose: Insert initial building types with adjacency bonuses and penalties

INSERT INTO building_types (id, name, cost, base_profit, level_required, requires_license, adjacency_bonuses, adjacency_penalties, max_per_map) VALUES
-- Level 1 buildings
('market_stall', 'Market Stall', 1000, 100, 1, 0, '{"road": 0.15, "trees": 0.05}', '{"water": -0.1}', NULL),
('hot_dog_stand', 'Hot Dog Stand', 1500, 150, 1, 0, '{"road": 0.2}', '{"water": -0.1}', NULL),
('campsite', 'Campsite', 3000, 300, 1, 0, '{"water": 0.25, "trees": 0.15}', '{"road": -0.1, "dirt_track": -0.05}', NULL),
('shop', 'Shop', 4000, 400, 1, 0, '{"road": 0.15, "commercial": 0.1}', '{}', NULL),

-- Level 2 buildings
('burger_bar', 'Burger Bar', 8000, 800, 2, 0, '{"road": 0.2, "commercial": 0.1}', '{"water": -0.05}', NULL),
('motel', 'Motel', 12000, 1200, 2, 0, '{"road": 0.15, "water": 0.1}', '{}', NULL),

-- Level 3 buildings
('high_street_store', 'High Street Store', 20000, 2000, 3, 0, '{"road": 0.25, "commercial": 0.15}', '{"dirt_track": -0.1}', NULL),
('restaurant', 'Restaurant', 40000, 4000, 3, 1, '{"road": 0.2, "water": 0.15, "commercial": 0.1}', '{}', 5),

-- Level 4 buildings
('manor', 'Manor', 60000, 6000, 4, 1, '{"water": 0.2, "trees": 0.2}', '{"road": -0.1, "commercial": -0.15}', 3),

-- Level 5 buildings
('casino', 'Casino', 80000, 8000, 5, 1, '{"road": 0.3, "commercial": 0.2}', '{"trees": -0.1}', 2);
