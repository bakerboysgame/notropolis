# Stage 01: Database Migration

## Objective

Add `map_scale` column to `building_configurations` and `asset_configurations` tables with sensible defaults.

## Dependencies

`[Requires: None]` - This is the first stage.

## Complexity

**Low** - Simple ALTER TABLE statements with UPDATE defaults.

---

## Files to Create

| File | Purpose |
|------|---------|
| `authentication-dashboard-system/migrations/0037_add_map_scale.sql` | D1 migration to add map_scale columns |

## Files to Modify

None - migration only.

---

## Implementation Details

### Migration SQL

```sql
-- ============================================
-- Migration: Add map_scale to configuration tables
-- ============================================

-- Add map_scale to building_configurations
ALTER TABLE building_configurations ADD COLUMN map_scale REAL;

-- Add map_scale to asset_configurations
ALTER TABLE asset_configurations ADD COLUMN map_scale REAL;

-- ============================================
-- Set default map_scale values for buildings
-- Based on size class (smaller buildings = smaller scale)
-- 13 building types total
-- ============================================

-- SHORT class (small stalls/stands)
UPDATE building_configurations SET map_scale = 0.4
WHERE building_type_id IN ('market_stall', 'hot_dog_stand', 'campsite');

-- MEDIUM class (shops and eateries)
UPDATE building_configurations SET map_scale = 0.6
WHERE building_type_id IN ('shop', 'burger_bar', 'motel');

-- TALL class (larger establishments)
UPDATE building_configurations SET map_scale = 0.8
WHERE building_type_id IN ('high_street_store', 'restaurant', 'manor', 'police_station');

-- VERY_TALL class (landmarks) - full size
UPDATE building_configurations SET map_scale = 1.0
WHERE building_type_id IN ('casino', 'temple', 'bank');

-- ============================================
-- Set default map_scale for other asset types
-- Actual categories: base_ground, effects, npcs, terrain, tricks
-- ============================================

-- NPCs are small (output 64x64, scale 0.1)
UPDATE asset_configurations SET map_scale = 0.1 WHERE category = 'npcs';

-- Terrain tiles (output 320x320, scale 1.0)
UPDATE asset_configurations SET map_scale = 1.0 WHERE category = 'terrain';

-- Effects match buildings (output 320x320, scale 1.0)
UPDATE asset_configurations SET map_scale = 1.0 WHERE category = 'effects';

-- Base ground (output 320x320, scale 1.0)
UPDATE asset_configurations SET map_scale = 1.0 WHERE category = 'base_ground';

-- Tricks are small effects (scale 0.3)
UPDATE asset_configurations SET map_scale = 0.3 WHERE category = 'tricks';
```

---

## Database Changes

| Table | Column | Type | Default | Notes |
|-------|--------|------|---------|-------|
| building_configurations | map_scale | REAL | NULL | Set via UPDATE after ALTER |
| asset_configurations | map_scale | REAL | NULL | Set via UPDATE after ALTER |

---

## Test Cases

### 1. Verify column added to building_configurations
```sql
SELECT building_type_id, map_scale FROM building_configurations ORDER BY building_type_id;
```
**Expected:** All 13 building types with appropriate map_scale values (0.4-1.0)

### 2. Verify column added to asset_configurations
```sql
SELECT category, asset_key, map_scale FROM asset_configurations ORDER BY category, asset_key;
```
**Expected:** Each category has map_scale set (npcs=0.1, terrain=1.0, effects=1.0, base_ground=1.0, tricks=0.3)

### 3. Verify NULL handling for new rows
```sql
INSERT INTO asset_configurations (category, asset_key) VALUES ('test', 'test_asset');
SELECT map_scale FROM asset_configurations WHERE category = 'test';
```
**Expected:** NULL (will use default from code)

---

## Acceptance Checklist

- [x] Migration file created at `authentication-dashboard-system/migrations/0037_add_map_scale.sql`
- [x] ALTER TABLE runs without error on both tables
- [x] UPDATE statements set correct defaults for all 13 building types
- [x] UPDATE statements set correct defaults for all 5 asset categories
- [x] Can query map_scale from both tables

---

## Deployment

```bash
# Navigate to worker directory (contains wrangler.toml)
cd /Users/riki/notropolis/authentication-dashboard-system/worker

# Execute migration against production D1 (--remote required for production)
npx wrangler d1 execute notropolis-database --env production --remote --file=../migrations/0037_add_map_scale.sql

# Verify migration succeeded
npx wrangler d1 execute notropolis-database --env production --remote --command="SELECT building_type_id, map_scale FROM building_configurations LIMIT 5"
```

**Verification:** Query should return building types with non-NULL map_scale values.

---

## Handoff Notes

- `map_scale` column now exists but is not yet used by the worker API
- Stage 02 will update the worker to use these values
- Stage 03 will expose map_scale in API responses
- If migration fails, column may already exist from a previous attempt - check with `PRAGMA table_info(building_configurations)`
