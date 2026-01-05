-- Backfill joined_at for legacy companies based on their first transaction on each map
-- This ensures legacy companies only see messages from when they actually joined the location

-- First, insert message_read_status rows for companies that are currently in a location
-- but don't have a record yet. Use their first transaction on that map as joined_at.
INSERT INTO message_read_status (company_id, map_id, joined_at, last_read_at)
SELECT
  gc.id as company_id,
  gc.current_map_id as map_id,
  MIN(gt.created_at) as joined_at,
  MIN(gt.created_at) as last_read_at
FROM game_companies gc
JOIN game_transactions gt ON gt.company_id = gc.id AND gt.map_id = gc.current_map_id
WHERE gc.current_map_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM message_read_status mrs
    WHERE mrs.company_id = gc.id AND mrs.map_id = gc.current_map_id
  )
GROUP BY gc.id, gc.current_map_id;

-- Update existing message_read_status rows that have NULL joined_at
UPDATE message_read_status
SET joined_at = (
  SELECT MIN(gt.created_at)
  FROM game_transactions gt
  WHERE gt.company_id = message_read_status.company_id
    AND gt.map_id = message_read_status.map_id
)
WHERE joined_at IS NULL;
