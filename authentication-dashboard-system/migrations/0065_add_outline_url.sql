-- Migration: Add outline URL column for building sprite highlights
-- Outlines are pre-generated silhouettes that can be tinted at runtime
-- for ownership/highlight effects without expensive realtime filters

ALTER TABLE generated_assets ADD COLUMN outline_url TEXT;

-- Index for quick lookup of assets with outlines
CREATE INDEX IF NOT EXISTS idx_assets_outline ON generated_assets(outline_url) WHERE outline_url IS NOT NULL;
