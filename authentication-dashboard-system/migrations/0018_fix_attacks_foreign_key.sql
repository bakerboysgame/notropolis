-- Migration 0018: Fix attacks table foreign key reference
-- Changes FOREIGN KEY from companies(id) to game_companies(id)

DROP TABLE IF EXISTS attacks;

CREATE TABLE attacks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attacker_company_id TEXT NOT NULL,
    target_building_id TEXT NOT NULL,
    trick_type TEXT NOT NULL, -- graffiti, smoke_bomb, stink_bomb, cluster_bomb, fire_bomb, destruction_bomb
    damage_dealt INTEGER NOT NULL,
    was_caught INTEGER NOT NULL DEFAULT 0, -- 0 = escaped, 1 = caught
    caught_by TEXT, -- 'security' or 'police' or NULL
    fine_amount INTEGER DEFAULT 0,
    security_active INTEGER NOT NULL DEFAULT 0,
    police_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (attacker_company_id) REFERENCES game_companies(id) ON DELETE CASCADE,
    FOREIGN KEY (target_building_id) REFERENCES building_instances(id) ON DELETE CASCADE
);

-- Recreate indexes
CREATE INDEX idx_attacks_attacker
    ON attacks(attacker_company_id, created_at DESC);

CREATE INDEX idx_attacks_target
    ON attacks(target_building_id, created_at DESC);

CREATE INDEX idx_attacks_trick_type
    ON attacks(trick_type);
