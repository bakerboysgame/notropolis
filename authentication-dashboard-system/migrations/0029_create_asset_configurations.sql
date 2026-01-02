-- Migration: 0029_create_asset_configurations.sql
-- Purpose: Generic asset configuration table for non-building asset types
-- Author: Stage 10 - Asset Manager
-- Date: 2026-01-02

-- ============================================
-- ASSET CONFIGURATIONS
-- Generic configuration for non-building asset types (NPCs, effects, terrain, base ground)
-- Similar to building_configurations but category-based
-- ============================================

CREATE TABLE IF NOT EXISTS asset_configurations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,              -- 'npc', 'effect', 'terrain', 'base_ground', etc.
    asset_key TEXT NOT NULL,             -- e.g., 'pedestrian_male', 'fire', 'grass'

    -- Active sprite
    active_sprite_id INTEGER REFERENCES generated_assets(id),

    -- Generic config (JSON for flexibility)
    config TEXT,                         -- JSON with category-specific settings

    -- Special flag for base_ground (only one can be active)
    is_active BOOLEAN DEFAULT FALSE,

    -- Publication status
    is_published BOOLEAN DEFAULT FALSE,
    published_at DATETIME,
    published_by TEXT,

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(category, asset_key)
);

CREATE INDEX IF NOT EXISTS idx_asset_config_category ON asset_configurations(category);
CREATE INDEX IF NOT EXISTS idx_asset_config_published ON asset_configurations(is_published);
CREATE INDEX IF NOT EXISTS idx_asset_config_active ON asset_configurations(category, is_active);

-- ============================================
-- VIEW: Asset configurations with sprite URLs
-- ============================================

CREATE VIEW IF NOT EXISTS v_asset_configurations AS
SELECT
    ac.id,
    ac.category,
    ac.asset_key,
    ac.active_sprite_id,
    ac.config,
    ac.is_active,
    ac.is_published,
    ac.published_at,
    ac.published_by,
    ac.created_at,
    ac.updated_at,
    ga.r2_url as sprite_url,
    ga.r2_key_private as sprite_r2_key
FROM asset_configurations ac
LEFT JOIN generated_assets ga ON ac.active_sprite_id = ga.id;
