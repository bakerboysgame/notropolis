-- Migration: 0032_reference_image_metadata.sql
-- Purpose: Add source_type column to track how reference images were added
-- Date: 2026-01-02

-- ============================================
-- ADD SOURCE_TYPE COLUMN
-- Tracks how the image was added to the library:
-- 'upload' - Manual file upload
-- 'external_url' - Imported from external URL
-- 'generated' - Created by AI generation and saved to library
-- 'imported' - Bulk imported from another source
-- ============================================

ALTER TABLE reference_images ADD COLUMN source_type TEXT DEFAULT 'upload';

-- Update existing records to have source_type = 'upload' (default)
UPDATE reference_images SET source_type = 'upload' WHERE source_type IS NULL;

-- Create index for filtering by source_type
CREATE INDEX IF NOT EXISTS idx_ref_images_source_type ON reference_images(source_type);

-- ============================================
-- LOG THE MIGRATION
-- ============================================

INSERT INTO asset_audit_log (action, details, created_at)
VALUES ('schema_migration', '{"version": "0032", "changes": "Added source_type column to reference_images"}', CURRENT_TIMESTAMP);
