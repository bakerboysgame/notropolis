-- Migration 0048: Add optional message field to attacks for dirty tricks
-- Messages require moderation before being visible on buildings

-- Add message columns to attacks table
ALTER TABLE attacks ADD COLUMN message TEXT;
ALTER TABLE attacks ADD COLUMN message_status TEXT DEFAULT NULL; -- NULL (no message), 'pending', 'approved', 'rejected'
ALTER TABLE attacks ADD COLUMN message_moderated_at TEXT;
ALTER TABLE attacks ADD COLUMN message_moderated_by TEXT REFERENCES users(id);
ALTER TABLE attacks ADD COLUMN message_rejection_reason TEXT;

-- Index for finding pending messages (for moderation queue)
CREATE INDEX IF NOT EXISTS idx_attacks_message_status
    ON attacks(message_status) WHERE message_status IS NOT NULL;

-- Index for finding approved messages on a building (for display)
CREATE INDEX IF NOT EXISTS idx_attacks_approved_messages
    ON attacks(target_building_id, message_status, created_at DESC)
    WHERE message_status = 'approved';
