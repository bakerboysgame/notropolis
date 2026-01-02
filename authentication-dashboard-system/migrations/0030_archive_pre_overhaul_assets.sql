-- Migration: 0030_archive_pre_overhaul_assets.sql
-- Purpose: Archive all non-avatar assets prior to asset admin overhaul
-- Date: 2026-01-02
-- Notes: Preserves R2 URLs so archived assets can still be viewed in UI

-- ============================================
-- ARCHIVE NON-AVATAR ASSETS
-- Marks assets as 'archived' but keeps R2 URLs intact for visibility
-- ============================================

-- Mark all non-avatar assets as archived
UPDATE generated_assets
SET
    status = 'archived',
    updated_at = CURRENT_TIMESTAMP
WHERE category NOT LIKE '%avatar%'
  AND status != 'archived';

-- Log the archival action
INSERT INTO asset_audit_log (action, asset_id, actor, details, created_at)
VALUES ('bulk_archive', NULL, 'system', '{"reason": "pre-overhaul cleanup", "date": "2026-01-02", "notes": "R2 URLs preserved for visibility"}', CURRENT_TIMESTAMP);
