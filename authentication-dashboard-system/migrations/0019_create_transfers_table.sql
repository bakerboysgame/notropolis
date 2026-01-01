-- Migration 0019: Create bank transfers table
-- Tracks all cash transfers between companies owned by the same user
-- with daily limits: 3 sends per company, 3 receives per company per day
-- Max amount per transfer by destination location: town=50k, city=500k, capital=1M

CREATE TABLE IF NOT EXISTS bank_transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_company_id TEXT NOT NULL,
    to_company_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    from_location_type TEXT, -- town, city, capital, or NULL if not in location
    to_location_type TEXT,   -- town, city, capital, or NULL if not in location
    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (from_company_id) REFERENCES game_companies(id) ON DELETE CASCADE,
    FOREIGN KEY (to_company_id) REFERENCES game_companies(id) ON DELETE CASCADE
);

-- Index for querying transfers by sender (for daily limit checking)
CREATE INDEX IF NOT EXISTS idx_transfers_from_company
    ON bank_transfers(from_company_id, created_at DESC);

-- Index for querying transfers by receiver (for daily limit checking)
CREATE INDEX IF NOT EXISTS idx_transfers_to_company
    ON bank_transfers(to_company_id, created_at DESC);

-- Index for date-based queries (for viewing history)
CREATE INDEX IF NOT EXISTS idx_transfers_created_at
    ON bank_transfers(created_at DESC);
