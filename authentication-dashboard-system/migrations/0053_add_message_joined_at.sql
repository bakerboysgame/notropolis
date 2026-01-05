-- Add joined_at column to message_read_status to track when a company joined a location
-- This is separate from last_read_at which tracks when they last viewed messages
-- joined_at is used to filter messages (only show messages after join time)
-- last_read_at is used for unread count calculation

ALTER TABLE message_read_status ADD COLUMN joined_at TEXT;

-- Backfill existing rows: set joined_at to last_read_at for existing entries
UPDATE message_read_status SET joined_at = last_read_at WHERE joined_at IS NULL;
