-- Migration: 0061_add_demolished_claim_stake_buildings.sql
-- Purpose: Add demolished and claim_stake building types to Asset Manager
-- Date: 2026-01-05

-- ============================================
-- ADD SPECIAL BUILDING TYPES
-- ============================================

-- Demolished: Visual representation of collapsed/destroyed buildings
INSERT INTO building_types (id, name, cost, base_profit, level_required, requires_license)
VALUES ('demolished', 'Demolished', 0, 0, 1, 0)
ON CONFLICT(id) DO NOTHING;

-- Claim Stake: Visual marker for owned land without buildings
INSERT INTO building_types (id, name, cost, base_profit, level_required, requires_license)
VALUES ('claim_stake', 'Claim Stake', 0, 0, 1, 0)
ON CONFLICT(id) DO NOTHING;

-- ============================================
-- CREATE BUILDING CONFIGURATIONS
-- These allow sprites to be assigned in Asset Manager
-- ============================================

INSERT INTO building_configurations (building_type_id, is_published, created_at, updated_at)
VALUES ('demolished', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT(building_type_id) DO NOTHING;

INSERT INTO building_configurations (building_type_id, is_published, created_at, updated_at)
VALUES ('claim_stake', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT(building_type_id) DO NOTHING;
