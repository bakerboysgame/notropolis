# Stage 2: tick_settings_log Migration

## Objective
Create the `tick_settings_log` database table to audit all settings changes with who, when, and what changed.

## Dependencies
`[Requires: None]` (can run parallel with Stage 1)

## Complexity
**Low** — Single migration file, no code changes

## Files to Create

### `authentication-dashboard-system/migrations/0055_create_tick_settings_log.sql`
Creates the audit log table for tracking settings changes.

## Implementation Details

### Table Schema

```sql
CREATE TABLE tick_settings_log (
  id TEXT PRIMARY KEY,

  -- Who made the change
  user_id TEXT NOT NULL,
  user_email TEXT,  -- Denormalized for easy display

  -- When the change was made
  changed_at TEXT DEFAULT CURRENT_TIMESTAMP,

  -- What was changed (JSON object with old and new values)
  -- Format: { "setting_name": { "old": value, "new": value }, ... }
  changes TEXT NOT NULL,

  -- Optional: IP address for audit trail
  ip_address TEXT,

  -- Optional: User agent for audit trail
  user_agent TEXT,

  -- Category of settings changed (fire, tax, profit, adjacency, hero, land)
  category TEXT,

  -- Human-readable summary
  summary TEXT,

  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Index for efficient queries by user and time
CREATE INDEX idx_settings_log_user ON tick_settings_log(user_id);
CREATE INDEX idx_settings_log_time ON tick_settings_log(changed_at DESC);
CREATE INDEX idx_settings_log_category ON tick_settings_log(category);
```

### Full Migration File Content

```sql
-- Migration: 0055_create_tick_settings_log.sql
-- Description: Create audit log table for tick settings changes
-- Author: Claude Code
-- Date: 2026-01-05

-- ============================================
-- TICK SETTINGS LOG TABLE
-- Audit trail for all settings changes
-- ============================================

CREATE TABLE IF NOT EXISTS tick_settings_log (
  id TEXT PRIMARY KEY,

  -- Who made the change
  user_id TEXT NOT NULL,
  user_email TEXT,

  -- When
  changed_at TEXT DEFAULT CURRENT_TIMESTAMP,

  -- What changed (JSON)
  -- Example: {"fire_damage_base": {"old": 10, "new": 15}, "tax_rate_town": {"old": 0.10, "new": 0.12}}
  changes TEXT NOT NULL,

  -- Audit metadata
  ip_address TEXT,
  user_agent TEXT,

  -- Categorization
  category TEXT,
  summary TEXT,

  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_settings_log_user ON tick_settings_log(user_id);
CREATE INDEX IF NOT EXISTS idx_settings_log_time ON tick_settings_log(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_settings_log_category ON tick_settings_log(category);
```

### Example Log Entry

```json
{
  "id": "log_abc123",
  "user_id": "user_xyz",
  "user_email": "admin@example.com",
  "changed_at": "2026-01-05T12:30:00Z",
  "changes": "{\"fire_damage_base\": {\"old\": 10, \"new\": 15}, \"fire_spread_chance\": {\"old\": 0.20, \"new\": 0.25}}",
  "ip_address": "192.168.1.1",
  "category": "fire",
  "summary": "Increased fire damage and spread chance"
}
```

### Category Values

| Category | Settings Included |
|----------|-------------------|
| `fire` | fire_damage_base, fire_damage_with_sprinklers, fire_spread_chance, fire_spread_chance_trees, sprinkler_extinguish_chance, collapse_threshold |
| `tax` | tax_rate_town, tax_rate_city, tax_rate_capital |
| `profit` | earning_threshold_ticks, collapsed_maintenance_rate, security_cost_divisor, damage_profit_multiplier |
| `adjacency` | adjacency_range, competition_penalty, collapsed_neighbor_*, commercial_synergy_bonus, premium_terrain_*, penalty_terrain_*, min_building_value_floor |
| `hero` | default_forced_hero_ticks, land_streak_requirement |
| `land` | base_land_cost, land_multiplier_*, terrain_multiplier_* |
| `combat` | prison_fine_multiplier, fine_multiplier_town/city/capital, security_bonus_cameras/guard_dogs/security_guards, cleanup_cost_percent |
| `market` | sell_to_state_percent, min_listing_price_percent, forced_buy_multiplier |
| `multiple` | When changes span multiple categories |

## Database Changes

| Table | Action | Columns |
|-------|--------|---------|
| tick_settings_log | CREATE | 9 columns |
| (indexes) | CREATE | 3 indexes |

## Test Cases

### Test 1: Table Creation
```sql
SELECT name FROM sqlite_master WHERE type='table' AND name='tick_settings_log';
-- Expected: Returns 1 row
```

### Test 2: All Columns Present
```sql
PRAGMA table_info(tick_settings_log);
-- Expected: 9 columns (id, user_id, user_email, changed_at, changes, ip_address, user_agent, category, summary)
```

### Test 3: Indexes Created
```sql
SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='tick_settings_log';
-- Expected: 3 indexes
```

### Test 4: Insert Test Entry
```sql
INSERT INTO tick_settings_log (id, user_id, user_email, changes, category, summary)
VALUES ('test_001', 'user_test', 'test@example.com', '{"fire_damage_base": {"old": 10, "new": 15}}', 'fire', 'Test change');

SELECT * FROM tick_settings_log WHERE id = 'test_001';
-- Expected: Row returned with all values

-- Cleanup
DELETE FROM tick_settings_log WHERE id = 'test_001';
```

## Acceptance Checklist

- [ ] Migration file created at `migrations/0055_create_tick_settings_log.sql`
- [ ] Table has all 9 columns defined
- [ ] Foreign key references users(id)
- [ ] All 3 indexes created
- [ ] changed_at defaults to CURRENT_TIMESTAMP
- [ ] Migration runs without errors on fresh database
- [ ] Migration runs without errors on existing database (idempotent with IF NOT EXISTS)

## Deployment

### Run Migration (Remote)
```bash
cd authentication-dashboard-system
npx wrangler d1 execute notropolis-database --remote --file=migrations/0055_create_tick_settings_log.sql
```

### Run Migration (Local)
```bash
cd authentication-dashboard-system
npx wrangler d1 execute notropolis-database --local --file=migrations/0055_create_tick_settings_log.sql
```

### Verify Deployment
```bash
npx wrangler d1 execute notropolis-database --remote --command "PRAGMA table_info(tick_settings_log);"
# Expected: 9 columns returned
```

## Handoff Notes

- The `tick_settings_log` table is ready for audit entries
- [See: Stage 4] will insert entries when settings are changed via API
- [See: Stage 9] will display the log in the Settings tab UI
- The `changes` column stores JSON — parse it for display
- Category is determined by which settings were changed (helper function in Stage 4)
- Use UUIDs for the `id` column (generate in worker)
