-- Migration: 0028_pipeline_tracking.sql
-- Purpose: Add pipeline status tracking columns for post-approval processing
-- Author: Stage 5 - Post-Approval Pipeline
-- Date: 2026-01-02

-- ============================================
-- ADD PIPELINE TRACKING COLUMNS
-- Track post-approval processing (bg removal, resize, publish)
-- ============================================

ALTER TABLE generated_assets ADD COLUMN r2_key_processed TEXT;
ALTER TABLE generated_assets ADD COLUMN pipeline_status TEXT DEFAULT NULL;
ALTER TABLE generated_assets ADD COLUMN pipeline_started_at DATETIME;
ALTER TABLE generated_assets ADD COLUMN pipeline_completed_at DATETIME;
ALTER TABLE generated_assets ADD COLUMN pipeline_error TEXT;

-- Index for querying assets by pipeline status
CREATE INDEX IF NOT EXISTS idx_assets_pipeline ON generated_assets(pipeline_status);
