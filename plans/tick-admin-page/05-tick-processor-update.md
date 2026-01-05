# Stage 5: Update Tick Processor

## Objective
Modify the tick processor and related modules to read settings from the database instead of hardcoded constants, with fallback to defaults.

## Dependencies
`[Requires: Stage 1 complete]` (tick_settings table with data)
`[Requires: Stage 4 complete]` (settings API for testing)

## Complexity
**Medium** — Modify 4 files, refactor constant usage to settings object

## Files to Modify

### 1. `authentication-dashboard-system/worker/src/tick/processor.js`
- Fetch settings at start of tick
- Pass settings object to sub-processors

### 2. `authentication-dashboard-system/worker/src/tick/fireSpread.js`
- Replace hardcoded fire constants with settings parameter

### 3. `authentication-dashboard-system/worker/src/tick/profitCalculator.js`
- Replace hardcoded tax rates and profit constants with settings parameter

### 4. `authentication-dashboard-system/worker/src/adjacencyCalculator.js`
- Replace hardcoded adjacency constants with settings parameter

## Implementation Details

### Default Settings (Fallback)

```javascript
// Shared default settings object - use if DB fetch fails
const DEFAULT_SETTINGS = {
  // Fire
  fire_damage_base: 10,
  fire_damage_with_sprinklers: 5,
  fire_spread_chance: 0.20,
  fire_spread_chance_trees: 0.35,
  sprinkler_extinguish_chance: 0.60,
  collapse_threshold: 100,

  // Tax
  tax_rate_town: 0.10,
  tax_rate_city: 0.15,
  tax_rate_capital: 0.20,

  // Profit
  earning_threshold_ticks: 6,
  collapsed_maintenance_rate: 0.05,
  security_cost_divisor: 144,
  damage_profit_multiplier: 1.176,

  // Adjacency
  adjacency_range: 2,
  competition_penalty: 0.08,
  collapsed_neighbor_profit_penalty: 0.12,
  collapsed_neighbor_value_penalty: 0.15,
  damaged_neighbor_max_penalty: 0.08,
  commercial_synergy_bonus: 0.03,
  premium_terrain_trees: 0.05,
  premium_terrain_water: 0.08,
  penalty_terrain_dirt_track: 0.02,
  min_building_value_floor: 0.50,

  // Hero
  default_forced_hero_ticks: 6,
  land_streak_requirement: 6,

  // Land
  base_land_cost: 500,
  land_multiplier_town: 1.0,
  land_multiplier_city: 5.0,
  land_multiplier_capital: 20.0,
  terrain_multiplier_free_land: 1.0,
  terrain_multiplier_dirt_track: 0.8,
  terrain_multiplier_trees: 1.2,
};
```

### processor.js Changes

```javascript
// worker/src/tick/processor.js

import { processMapFires } from './fireSpread.js';
import { processMapProfits } from './profitCalculator.js';

// Add DEFAULT_SETTINGS at top of file
const DEFAULT_SETTINGS = { /* ... as above ... */ };

// Helper: fetch settings with fallback
async function getTickSettings(env) {
  try {
    const settings = await env.DB.prepare(
      'SELECT * FROM tick_settings WHERE id = ?'
    ).bind('global').first();

    if (!settings) {
      console.warn('No tick_settings found, using defaults');
      return DEFAULT_SETTINGS;
    }

    // Remove non-setting columns
    const { id, created_at, updated_at, updated_by, ...settingsOnly } = settings;
    return settingsOnly;
  } catch (error) {
    console.error('Failed to fetch tick_settings, using defaults:', error);
    return DEFAULT_SETTINGS;
  }
}

export async function processTick(env) {
  const tickId = crypto.randomUUID();
  const startTime = Date.now();

  console.log(`Starting tick processing: ${tickId}`);

  // Fetch settings ONCE at start of tick
  const settings = await getTickSettings(env);

  // ... existing tick logic ...

  // Pass settings to each processor
  for (const map of activeMaps) {
    try {
      // Fire processing with settings
      const fireResult = await processMapFires(env, map.id, settings);

      // Profit processing with settings
      const profitResult = await processMapProfits(env, map.id, settings);

      // Hero processing with settings
      const heroResult = await processForcedHeroOuts(env, map, settings);

      // ... rest of processing ...
    } catch (error) {
      // ... error handling ...
    }
  }

  // ... rest of tick logic ...
}

// Update processForcedHeroOuts to use settings
async function processForcedHeroOuts(env, map, settings) {
  // Use settings.default_forced_hero_ticks instead of hardcoded DEFAULT_FORCED_HERO_TICKS
  const forcedHeroThreshold = map.forced_hero_after_ticks ?? settings.default_forced_hero_ticks;

  // ... rest of function ...
}
```

### fireSpread.js Changes

```javascript
// worker/src/tick/fireSpread.js

// REMOVE these constants:
// const FIRE_DAMAGE_BASE = 10;
// const FIRE_DAMAGE_WITH_SPRINKLERS = 5;
// const FIRE_SPREAD_CHANCE = 0.20;
// const FIRE_SPREAD_CHANCE_TREES = 0.35;
// const SPRINKLER_EXTINGUISH_CHANCE = 0.60;
// const COLLAPSE_THRESHOLD = 100;

// UPDATE function signature to accept settings
export async function processMapFires(env, mapId, settings) {
  // Use settings instead of constants
  const FIRE_DAMAGE_BASE = settings.fire_damage_base;
  const FIRE_DAMAGE_WITH_SPRINKLERS = settings.fire_damage_with_sprinklers;
  const FIRE_SPREAD_CHANCE = settings.fire_spread_chance;
  const FIRE_SPREAD_CHANCE_TREES = settings.fire_spread_chance_trees;
  const SPRINKLER_EXTINGUISH_CHANCE = settings.sprinkler_extinguish_chance;
  const COLLAPSE_THRESHOLD = settings.collapse_threshold;

  // ... rest of function uses these local constants ...
  // No other changes needed to the logic

  const burningBuildings = await env.DB.prepare(`...`).bind(mapId).all();

  for (const building of burningBuildings.results) {
    const hasSprinklers = building.has_sprinklers === 1;

    // Apply damage
    const damageAmount = hasSprinklers ? FIRE_DAMAGE_WITH_SPRINKLERS : FIRE_DAMAGE_BASE;
    const newDamage = Math.min(100, building.damage_percent + damageAmount);

    // Check for extinguish
    if (hasSprinklers && Math.random() < SPRINKLER_EXTINGUISH_CHANCE) {
      // Extinguish fire
    }

    // Check for collapse
    if (newDamage >= COLLAPSE_THRESHOLD) {
      // Building collapses
    }

    // Check for spread
    if (Math.random() < FIRE_SPREAD_CHANCE) {
      // Spread to adjacent
    }

    // ... etc ...
  }
}
```

### profitCalculator.js Changes

```javascript
// worker/src/tick/profitCalculator.js

// REMOVE these constants:
// const TAX_RATES = { town: 0.10, city: 0.15, capital: 0.20 };

// UPDATE function signature to accept settings
export async function processMapProfits(env, mapId, settings) {
  // Build tax rates from settings
  const TAX_RATES = {
    town: settings.tax_rate_town,
    city: settings.tax_rate_city,
    capital: settings.tax_rate_capital,
  };

  // Use settings for other values
  const EARNING_THRESHOLD = settings.earning_threshold_ticks;
  const COLLAPSED_MAINTENANCE_RATE = settings.collapsed_maintenance_rate;
  const SECURITY_COST_DIVISOR = settings.security_cost_divisor;

  // Get map info for tax rate
  const map = await env.DB.prepare('SELECT * FROM maps WHERE id = ?').bind(mapId).first();
  const taxRate = TAX_RATES[map.location_type] || TAX_RATES.town;

  // ... profit calculation logic ...

  // Update the SQL to use settings
  // Change: monthly_cost / 144 → monthly_cost / ?
  // Change: bt.cost * 0.05 → bt.cost * ?

  const companiesQuery = `
    SELECT
      gc.id,
      gc.ticks_since_action,
      SUM(bi.calculated_profit) as base_profit,
      SUM(COALESCE(bs.monthly_cost, 0)) / ? as security_cost,
      SUM(CASE WHEN bi.is_collapsed = 1 THEN bt.cost * ? ELSE 0 END) as maintenance_cost
    FROM game_companies gc
    JOIN building_instances bi ON bi.company_id = gc.id
    JOIN tiles t ON bi.tile_id = t.id AND t.map_id = ?
    JOIN building_types bt ON bi.building_type_id = bt.id
    LEFT JOIN building_security bs ON bs.building_id = bi.id
    GROUP BY gc.id
  `;

  const companies = await env.DB.prepare(companiesQuery)
    .bind(SECURITY_COST_DIVISOR, COLLAPSED_MAINTENANCE_RATE, mapId)
    .all();

  for (const company of companies.results) {
    // Only pay active companies
    if (company.ticks_since_action >= EARNING_THRESHOLD) {
      continue; // Skip idle companies
    }

    // ... rest of profit calculation ...
  }
}

// Also update recalculateDirtyBuildings to accept settings
export async function recalculateDirtyBuildings(env, mapId, settings) {
  // Pass settings to adjacencyCalculator
  const { calculateBuildingProfit, calculateBuildingValue } = await import('../adjacencyCalculator.js');

  // ... get dirty buildings ...

  for (const building of dirtyBuildings) {
    const profit = calculateBuildingProfit(building, allBuildings, tiles, settings);
    const value = calculateBuildingValue(building, allBuildings, tiles, settings);

    // ... update building ...
  }
}
```

### adjacencyCalculator.js Changes

```javascript
// worker/src/adjacencyCalculator.js

// REMOVE these constants at top:
// const ADJACENCY_RANGE = 2;
// const VALUE_MODIFIERS = { ... };
// const COMPETITION_PENALTY = -0.08;

// UPDATE functions to accept settings parameter

export function calculateBuildingProfit(building, allBuildings, tiles, settings) {
  const ADJACENCY_RANGE = settings.adjacency_range;
  const COMPETITION_PENALTY = -settings.competition_penalty;
  const COLLAPSED_PENALTY = -settings.collapsed_neighbor_profit_penalty;
  const DAMAGED_PENALTY_MAX = -settings.damaged_neighbor_max_penalty;

  // ... rest of profit calculation logic ...
  // Use the local constants derived from settings

  for (let dx = -ADJACENCY_RANGE; dx <= ADJACENCY_RANGE; dx++) {
    for (let dy = -ADJACENCY_RANGE; dy <= ADJACENCY_RANGE; dy++) {
      // ... adjacency checks ...
    }
  }
}

export function calculateBuildingValue(building, allBuildings, tiles, settings) {
  const ADJACENCY_RANGE = settings.adjacency_range;

  const VALUE_MODIFIERS = {
    collapsed_neighbor: -settings.collapsed_neighbor_value_penalty,
    damaged_neighbor_max: -settings.damaged_neighbor_max_penalty,
    commercial_synergy: settings.commercial_synergy_bonus,
    premium_terrain: {
      trees: settings.premium_terrain_trees,
      water: settings.premium_terrain_water,
    },
    penalty_terrain: {
      dirt_track: -settings.penalty_terrain_dirt_track,
    },
  };

  const MIN_VALUE_FLOOR = settings.min_building_value_floor;

  // ... rest of value calculation logic ...

  // Ensure minimum value
  const finalValue = Math.max(baseCost * MIN_VALUE_FLOOR, calculatedValue);
  return finalValue;
}

export function calculateLandCost(tile, locationContext, settings) {
  const baseCost = settings.base_land_cost;

  const terrainMultipliers = {
    free_land: settings.terrain_multiplier_free_land,
    dirt_track: settings.terrain_multiplier_dirt_track,
    trees: settings.terrain_multiplier_trees,
    road: 0, // Can't buy
    water: 0, // Can't buy
  };

  const locationMultipliers = {
    town: settings.land_multiplier_town,
    city: settings.land_multiplier_city,
    capital: settings.land_multiplier_capital,
  };

  const terrainMult = terrainMultipliers[tile.terrain_type] ?? 1.0;
  const locationMult = locationMultipliers[locationContext] ?? 1.0;

  return Math.round(baseCost * terrainMult * locationMult);
}
```

### Update All Callers

Find all places that call these functions and add the settings parameter:

```javascript
// In processor.js - already updated above

// In any route handlers that call adjacencyCalculator directly:
// e.g., building placement preview

// worker/src/routes/game/buildings.js
export async function handleBuildingPreview(request, env, ...) {
  // Fetch settings for preview calculation
  const settings = await env.DB.prepare('SELECT * FROM tick_settings WHERE id = ?')
    .bind('global').first() || DEFAULT_SETTINGS;

  const profit = calculateBuildingProfit(building, neighbors, tiles, settings);
  const value = calculateBuildingValue(building, neighbors, tiles, settings);
  // ...
}
```

## Database Changes

None — reads from existing tick_settings table

## Test Cases

### Test 1: Tick Runs With DB Settings
```bash
# Trigger a tick (wait for cron or manually invoke)
# Check logs for "Starting tick processing"
# Verify no "using defaults" warning
```

### Test 2: Tick Falls Back to Defaults
```sql
-- Temporarily remove settings
DELETE FROM tick_settings WHERE id = 'global';
-- Trigger tick
-- Check logs for "using defaults" warning
-- Restore settings
INSERT INTO tick_settings (id) VALUES ('global');
```

### Test 3: Changed Settings Take Effect
```bash
# Change fire damage via API
curl -X PUT -H "Authorization: Bearer $TOKEN" \
  -d '{"fire_damage_base": 20}' \
  "https://api.example.com/api/admin/tick/settings"

# Start a fire on a building
# Wait for next tick
# Verify building takes 20% damage instead of 10%
```

### Test 4: Tax Rate Changes Apply
```bash
# Change town tax rate
curl -X PUT -H "Authorization: Bearer $TOKEN" \
  -d '{"tax_rate_town": 0.25}' \
  "https://api.example.com/api/admin/tick/settings"

# Check company profit after next tick
# Verify 25% tax applied instead of 10%
```

### Test 5: Adjacency Settings Apply
```sql
-- Query building values before and after changing settings
SELECT id, calculated_value FROM building_instances WHERE map_id = 'test_map';

-- Change competition penalty
-- Trigger recalculation (place/remove building or wait for tick)
-- Query values again, verify difference
```

## Acceptance Checklist

- [ ] processor.js fetches settings at tick start
- [ ] processor.js has fallback to DEFAULT_SETTINGS
- [ ] fireSpread.js accepts settings parameter
- [ ] fireSpread.js uses settings values for all fire constants
- [ ] profitCalculator.js accepts settings parameter
- [ ] profitCalculator.js uses settings for tax rates
- [ ] profitCalculator.js uses settings for earning threshold
- [ ] adjacencyCalculator.js accepts settings parameter
- [ ] adjacencyCalculator.js uses settings for adjacency range
- [ ] adjacencyCalculator.js uses settings for all modifiers
- [ ] All callers updated to pass settings
- [ ] Tick completes successfully with DB settings
- [ ] Tick completes successfully with fallback defaults
- [ ] Changed settings take effect on next tick

## Deployment

```bash
cd authentication-dashboard-system/worker
npx wrangler deploy
```

### Verify
```bash
# Check worker logs during next tick
wrangler tail
# Look for "Starting tick processing" without "using defaults" warning
```

## Handoff Notes

- Tick processor now reads settings from DB at start of each tick
- Settings are cached for duration of single tick (not across ticks)
- Fallback to hardcoded defaults if DB read fails
- [See: Stage 8] will display these settings effects in tick history
- [See: Stage 9] will provide UI to modify settings
- Building placement preview also uses settings (for accurate profit display)
- Any future functions needing settings should accept settings parameter
