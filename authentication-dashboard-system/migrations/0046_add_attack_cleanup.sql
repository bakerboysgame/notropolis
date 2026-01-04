-- Migration 0046: Add is_cleaned column to attacks table
-- Tracks whether trick effects have been cleaned up by building owner

ALTER TABLE attacks ADD COLUMN is_cleaned INTEGER DEFAULT 0;

-- Index for efficiently querying uncleaned attacks on a building
CREATE INDEX IF NOT EXISTS idx_attacks_uncleaned
    ON attacks(target_building_id, is_cleaned)
    WHERE is_cleaned = 0;
