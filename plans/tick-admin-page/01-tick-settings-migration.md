# Stage 1: tick_settings Migration

## Objective
Create the `tick_settings` database table to store all configurable tick parameters with sensible defaults.

## Dependencies
`[Requires: None]`

## Complexity
**Low** — Single migration file, no code changes

## Files to Create

### `authentication-dashboard-system/migrations/0054_create_tick_settings.sql`
Creates the tick_settings table with all configurable parameters organized by category.

## Implementation Details

### Table Schema

```sql
CREATE TABLE tick_settings (
  id TEXT PRIMARY KEY DEFAULT 'global',

  -- ============================================
  -- FIRE SETTINGS
  -- ============================================
  -- Damage per tick for buildings without sprinklers (0-100)
  fire_damage_base INTEGER DEFAULT 10,

  -- Damage per tick for buildings with sprinklers (0-100)
  fire_damage_with_sprinklers INTEGER DEFAULT 5,

  -- Probability of fire spreading to adjacent building (0.0-1.0)
  fire_spread_chance REAL DEFAULT 0.20,

  -- Probability of fire spreading through trees (0.0-1.0)
  fire_spread_chance_trees REAL DEFAULT 0.35,

  -- Probability of sprinklers extinguishing fire per tick (0.0-1.0)
  sprinkler_extinguish_chance REAL DEFAULT 0.60,

  -- Damage threshold at which building collapses (0-100)
  collapse_threshold INTEGER DEFAULT 100,

  -- ============================================
  -- TAX RATES (by location type)
  -- ============================================
  -- Tax rate for town locations (0.0-1.0)
  tax_rate_town REAL DEFAULT 0.10,

  -- Tax rate for city locations (0.0-1.0)
  tax_rate_city REAL DEFAULT 0.15,

  -- Tax rate for capital locations (0.0-1.0)
  tax_rate_capital REAL DEFAULT 0.20,

  -- ============================================
  -- PROFIT SETTINGS
  -- ============================================
  -- Number of ticks a company can be idle and still earn (1-100)
  earning_threshold_ticks INTEGER DEFAULT 6,

  -- Maintenance cost multiplier for collapsed buildings (0.0-1.0)
  collapsed_maintenance_rate REAL DEFAULT 0.05,

  -- Divisor for spreading monthly security costs across ticks
  security_cost_divisor INTEGER DEFAULT 144,

  -- Damage multiplier for profit reduction (how much damage hurts profit)
  damage_profit_multiplier REAL DEFAULT 1.176,

  -- ============================================
  -- ADJACENCY SETTINGS
  -- ============================================
  -- Range in tiles for adjacency calculations (1-5)
  adjacency_range INTEGER DEFAULT 2,

  -- Penalty per same-type/variant competitor nearby (0.0-0.5)
  competition_penalty REAL DEFAULT 0.08,

  -- Profit penalty per collapsed neighbor (0.0-0.5)
  collapsed_neighbor_profit_penalty REAL DEFAULT 0.12,

  -- Value penalty per collapsed neighbor (0.0-0.5)
  collapsed_neighbor_value_penalty REAL DEFAULT 0.15,

  -- Max value penalty per damaged neighbor (0.0-0.5)
  damaged_neighbor_max_penalty REAL DEFAULT 0.08,

  -- Value bonus per adjacent building (0.0-0.2)
  commercial_synergy_bonus REAL DEFAULT 0.03,

  -- Value bonus for trees adjacency (0.0-0.2)
  premium_terrain_trees REAL DEFAULT 0.05,

  -- Value bonus for water adjacency (0.0-0.2)
  premium_terrain_water REAL DEFAULT 0.08,

  -- Value penalty for dirt track adjacency (0.0-0.2)
  penalty_terrain_dirt_track REAL DEFAULT 0.02,

  -- Minimum building value as percentage of cost (0.0-1.0)
  min_building_value_floor REAL DEFAULT 0.50,

  -- ============================================
  -- HERO SETTINGS
  -- ============================================
  -- Default ticks before forced hero-out (1-20)
  default_forced_hero_ticks INTEGER DEFAULT 6,

  -- Required consecutive ticks for land-based hero eligibility (1-20)
  land_streak_requirement INTEGER DEFAULT 6,

  -- ============================================
  -- LAND COSTS
  -- ============================================
  -- Base cost for free land tiles
  base_land_cost INTEGER DEFAULT 500,

  -- Location multipliers for land cost
  land_multiplier_town REAL DEFAULT 1.0,
  land_multiplier_city REAL DEFAULT 5.0,
  land_multiplier_capital REAL DEFAULT 20.0,

  -- Terrain multipliers for land cost
  terrain_multiplier_free_land REAL DEFAULT 1.0,
  terrain_multiplier_dirt_track REAL DEFAULT 0.8,
  terrain_multiplier_trees REAL DEFAULT 1.2,

  -- ============================================
  -- COMBAT SETTINGS (Dirty Tricks / Prison)
  -- ============================================
  -- Prison fine multiplier (trick_cost * this * location_multiplier)
  prison_fine_multiplier REAL DEFAULT 8.0,

  -- Location multipliers for fine calculation
  fine_multiplier_town REAL DEFAULT 1.0,
  fine_multiplier_city REAL DEFAULT 1.5,
  fine_multiplier_capital REAL DEFAULT 2.0,

  -- Security system bonuses (additive with base catch rate)
  security_bonus_cameras REAL DEFAULT 0.10,
  security_bonus_guard_dogs REAL DEFAULT 0.15,
  security_bonus_security_guards REAL DEFAULT 0.25,

  -- Cleanup cost as percentage of building type cost per attack
  cleanup_cost_percent REAL DEFAULT 0.05,

  -- ============================================
  -- MARKET SETTINGS
  -- ============================================
  -- Sell to state: percentage of building value
  sell_to_state_percent REAL DEFAULT 0.50,

  -- Minimum listing price as percentage of building value
  min_listing_price_percent REAL DEFAULT 0.80,

  -- Forced buy multiplier (calculated_value * this)
  forced_buy_multiplier REAL DEFAULT 6.0,

  -- ============================================
  -- METADATA
  -- ============================================
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT  -- user_id of last updater
);

-- Insert the default global settings row
INSERT INTO tick_settings (id) VALUES ('global');
```

### Full Migration File Content

```sql
-- Migration: 0054_create_tick_settings.sql
-- Description: Create tick_settings table for configurable game parameters
-- Author: Claude Code
-- Date: 2026-01-05

-- ============================================
-- TICK SETTINGS TABLE
-- Stores all configurable tick parameters
-- Single row design (id = 'global')
-- ============================================

CREATE TABLE IF NOT EXISTS tick_settings (
  id TEXT PRIMARY KEY DEFAULT 'global',

  -- FIRE SETTINGS
  fire_damage_base INTEGER DEFAULT 10,
  fire_damage_with_sprinklers INTEGER DEFAULT 5,
  fire_spread_chance REAL DEFAULT 0.20,
  fire_spread_chance_trees REAL DEFAULT 0.35,
  sprinkler_extinguish_chance REAL DEFAULT 0.60,
  collapse_threshold INTEGER DEFAULT 100,

  -- TAX RATES
  tax_rate_town REAL DEFAULT 0.10,
  tax_rate_city REAL DEFAULT 0.15,
  tax_rate_capital REAL DEFAULT 0.20,

  -- PROFIT SETTINGS
  earning_threshold_ticks INTEGER DEFAULT 6,
  collapsed_maintenance_rate REAL DEFAULT 0.05,
  security_cost_divisor INTEGER DEFAULT 144,
  damage_profit_multiplier REAL DEFAULT 1.176,

  -- ADJACENCY SETTINGS
  adjacency_range INTEGER DEFAULT 2,
  competition_penalty REAL DEFAULT 0.08,
  collapsed_neighbor_profit_penalty REAL DEFAULT 0.12,
  collapsed_neighbor_value_penalty REAL DEFAULT 0.15,
  damaged_neighbor_max_penalty REAL DEFAULT 0.08,
  commercial_synergy_bonus REAL DEFAULT 0.03,
  premium_terrain_trees REAL DEFAULT 0.05,
  premium_terrain_water REAL DEFAULT 0.08,
  penalty_terrain_dirt_track REAL DEFAULT 0.02,
  min_building_value_floor REAL DEFAULT 0.50,

  -- HERO SETTINGS
  default_forced_hero_ticks INTEGER DEFAULT 6,
  land_streak_requirement INTEGER DEFAULT 6,

  -- LAND COSTS
  base_land_cost INTEGER DEFAULT 500,
  land_multiplier_town REAL DEFAULT 1.0,
  land_multiplier_city REAL DEFAULT 5.0,
  land_multiplier_capital REAL DEFAULT 20.0,
  terrain_multiplier_free_land REAL DEFAULT 1.0,
  terrain_multiplier_dirt_track REAL DEFAULT 0.8,
  terrain_multiplier_trees REAL DEFAULT 1.2,

  -- COMBAT SETTINGS
  prison_fine_multiplier REAL DEFAULT 8.0,
  fine_multiplier_town REAL DEFAULT 1.0,
  fine_multiplier_city REAL DEFAULT 1.5,
  fine_multiplier_capital REAL DEFAULT 2.0,
  security_bonus_cameras REAL DEFAULT 0.10,
  security_bonus_guard_dogs REAL DEFAULT 0.15,
  security_bonus_security_guards REAL DEFAULT 0.25,
  cleanup_cost_percent REAL DEFAULT 0.05,

  -- MARKET SETTINGS
  sell_to_state_percent REAL DEFAULT 0.50,
  min_listing_price_percent REAL DEFAULT 0.80,
  forced_buy_multiplier REAL DEFAULT 6.0,

  -- METADATA
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT
);

-- Insert default global settings row
INSERT OR IGNORE INTO tick_settings (id) VALUES ('global');
```

## Database Changes

| Table | Action | Columns |
|-------|--------|---------|
| tick_settings | CREATE | 45 columns (42 settings + id + timestamps + updated_by) |

## Test Cases

### Test 1: Table Creation
```sql
-- Verify table exists
SELECT name FROM sqlite_master WHERE type='table' AND name='tick_settings';
-- Expected: Returns 1 row
```

### Test 2: Default Row Exists
```sql
SELECT id, fire_damage_base, tax_rate_town, adjacency_range FROM tick_settings WHERE id = 'global';
-- Expected: id='global', fire_damage_base=10, tax_rate_town=0.10, adjacency_range=2
```

### Test 3: All Columns Present
```sql
PRAGMA table_info(tick_settings);
-- Expected: 45 columns returned
```

### Test 4: Default Values Correct
```sql
SELECT
  fire_damage_base = 10 as fire_ok,
  tax_rate_city = 0.15 as tax_ok,
  competition_penalty = 0.08 as comp_ok,
  base_land_cost = 500 as land_ok
FROM tick_settings WHERE id = 'global';
-- Expected: All values = 1 (true)
```

## Acceptance Checklist

- [ ] Migration file created at `migrations/0054_create_tick_settings.sql`
- [ ] Table has all 45 columns defined
- [ ] Default values match current hardcoded values
- [ ] INSERT OR IGNORE prevents duplicate global rows
- [ ] Migration runs without errors on fresh database
- [ ] Migration runs without errors on existing database (idempotent)

## Deployment

### Run Migration (Remote)
```bash
cd authentication-dashboard-system
npx wrangler d1 execute notropolis-database --remote --file=migrations/0054_create_tick_settings.sql
```

### Run Migration (Local)
```bash
cd authentication-dashboard-system
npx wrangler d1 execute notropolis-database --local --file=migrations/0054_create_tick_settings.sql
```

### Verify Deployment
```bash
npx wrangler d1 execute notropolis-database --remote --command "SELECT COUNT(*) as count, id FROM tick_settings;"
# Expected: count=1, id='global'
```

## Handoff Notes

- The `tick_settings` table now exists with all default values
- [See: Stage 4] will create the API to read/write these settings
- [See: Stage 5] will update the tick processor to use these settings
- The `updated_by` column should store user_id when settings are changed via API
- Use `INSERT OR IGNORE` to make migration idempotent
