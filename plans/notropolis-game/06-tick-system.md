# Stage 06: Tick System

## Objective

Implement the 10-minute tick system using Cloudflare Workers cron to calculate and distribute profits.

## Dependencies

`[Requires: Stage 01 complete]` - Needs database tables.
`[Requires: Stage 05 complete]` - Needs buildings with calculated profits.
`[Reference: REFERENCE-d1-optimization.md]` - Critical D1 batch patterns for performance.

## Complexity

**High** - Scheduled task processing, batch operations, offline tracking.

## Performance Requirements

Based on [D1 Optimization Reference](REFERENCE-d1-optimization.md):
- 100 maps with 250 buildings each (25,000 buildings) must complete in ~2-3 seconds
- Uses batch() + chunked approach for all database writes
- **Dirty Tracking:** Only recalculate profits for buildings marked `needs_profit_recalc = 1`
- **Minimal Writes:** Most ticks write only company balance updates, not building updates
- Single batch() call per operation type

## Optimization Strategy

| What | When | Writes |
|------|------|--------|
| Recalculate building profits | Only when `needs_profit_recalc = 1` | ~0-50 per tick typically |
| Update company cash balances | Every tick for active companies | ~1 per active company |
| Process fire spread | Only for buildings `is_on_fire = 1` | ~0-20 per tick typically |
| Log tick history | Every tick | ~1 per active company |

**Typical tick with no changes:** ~100-500 company updates (no building updates)
**Tick after 10 buildings placed:** ~100-150 building recalcs + company updates

## Files to Modify

| File | Changes |
|------|---------|
| `authentication-dashboard-system/wrangler.toml` | Add cron trigger |
| `authentication-dashboard-system/src/worker/index.ts` | Add scheduled handler |

## Files to Create

| File | Purpose |
|------|---------|
| `authentication-dashboard-system/src/worker/tick/processor.ts` | Main tick processing logic |
| `authentication-dashboard-system/src/worker/tick/profitCalculator.ts` | Per-company profit calculation |
| `authentication-dashboard-system/src/worker/tick/fireSpread.ts` | Fire spread logic |
| `authentication-dashboard-system/src/worker/tick/damageDecay.ts` | Building damage over time |
| `authentication-dashboard-system/migrations/0015_add_tick_tracking.sql` | Tick history table |

## Implementation Details

### Wrangler Configuration

```toml
# wrangler.toml - add cron trigger
[triggers]
crons = ["*/10 * * * *"]  # Every 10 minutes
```

### Database Migration

```sql
-- 0015_add_tick_tracking.sql
CREATE TABLE tick_history (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  tick_number INTEGER NOT NULL,
  gross_profit INTEGER NOT NULL,
  tax_amount INTEGER NOT NULL,
  security_costs INTEGER NOT NULL,
  net_profit INTEGER NOT NULL,
  building_count INTEGER NOT NULL,
  ticks_since_action INTEGER NOT NULL,
  processed_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (company_id) REFERENCES game_companies(id)
);

CREATE INDEX idx_tick_history_company ON tick_history(company_id);
CREATE INDEX idx_tick_history_time ON tick_history(processed_at);

-- Add tick counter to companies if not exists
-- (Should already be in Stage 01, but ensure it's there)
```

### Main Worker Handler

```typescript
// worker/index.ts - add scheduled handler
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // ... existing fetch handler
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(processTick(env));
  },
};
```

### Tick Processor (Optimized)

```typescript
// worker/tick/processor.ts
import { recalculateDirtyBuildings } from './profitCalculator';
import { processFireSpread } from './fireSpread';

export async function processTick(env: Env) {
  console.log('Starting tick processing...');
  const tickId = crypto.randomUUID();
  const startTime = Date.now();

  const results = {
    mapsProcessed: 0,
    companiesUpdated: 0,
    buildingsRecalculated: 0,
    fireProcessed: 0,
    totalProfit: 0,
    errors: 0,
  };

  try {
    // 1. Get all active maps
    const maps = await env.DB.prepare(
      'SELECT id FROM maps WHERE is_active = 1'
    ).all();

    // 2. Process each map
    for (const map of maps.results) {
      try {
        // 2a. Recalculate ONLY dirty buildings (may be 0)
        const recalced = await recalculateDirtyBuildings(env, map.id);
        results.buildingsRecalculated += recalced;

        // 2b. Process fire spread (only affects buildings on fire)
        const fireResults = await processFireSpread(env, map.id);
        results.fireProcessed += fireResults.buildingsAffected;

        results.mapsProcessed++;
      } catch (error) {
        console.error(`Error processing map ${map.id}:`, error);
        results.errors++;
      }
    }

    // 3. Distribute profits to all active companies (single efficient query)
    const companyUpdates = await distributeAllProfits(env);
    results.companiesUpdated = companyUpdates.count;
    results.totalProfit = companyUpdates.totalProfit;

    const duration = Date.now() - startTime;
    console.log(`Tick ${tickId} complete in ${duration}ms:`, results);

    return results;
  } catch (error) {
    console.error('Tick processing failed:', error);
    throw error;
  }
}

// Distribute profits to all companies in a single batch operation
async function distributeAllProfits(env: Env): Promise<{ count: number; totalProfit: number }> {
  // Tax rates by location type
  const TAX_RATES = { town: 0.10, city: 0.15, capital: 0.20 };

  // 1. Get profit totals grouped by company (single query)
  const companyProfits = await env.DB.prepare(`
    SELECT
      bi.company_id,
      gc.ticks_since_action,
      gc.location_type,
      SUM(bi.calculated_profit * (100 - bi.damage_percent) / 100) as gross_profit,
      SUM(COALESCE(bs.monthly_cost, 0)) / 144 as security_cost
    FROM building_instances bi
    JOIN game_companies gc ON bi.company_id = gc.id
    LEFT JOIN building_security bs ON bi.id = bs.building_id
    WHERE bi.is_collapsed = 0
      AND gc.current_map_id IS NOT NULL
      AND gc.is_in_prison = 0
    GROUP BY bi.company_id
  `).all();

  if (companyProfits.results.length === 0) {
    return { count: 0, totalProfit: 0 };
  }

  // 2. Build batch update statements
  const updateStatements = [];
  const historyStatements = [];
  let totalProfit = 0;

  for (const cp of companyProfits.results) {
    const ticksSinceAction = cp.ticks_since_action + 1;
    const isEarning = ticksSinceAction <= 6;

    // Calculate net profit
    const grossProfit = Math.round(cp.gross_profit || 0);
    const taxRate = TAX_RATES[cp.location_type] || 0.10;
    const taxAmount = Math.round(grossProfit * taxRate);
    const securityCost = Math.round(cp.security_cost || 0);
    const netProfit = isEarning ? grossProfit - taxAmount - securityCost : 0;

    totalProfit += netProfit;

    // Company cash update
    updateStatements.push(
      env.DB.prepare(`
        UPDATE game_companies
        SET cash = cash + ?, ticks_since_action = ?
        WHERE id = ?
      `).bind(netProfit, ticksSinceAction, cp.company_id)
    );

    // Tick history (optional - can skip for performance)
    historyStatements.push(
      env.DB.prepare(`
        INSERT INTO tick_history
        (id, company_id, tick_number, gross_profit, tax_amount, security_costs, net_profit, building_count, ticks_since_action)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
      `).bind(
        crypto.randomUUID(),
        cp.company_id,
        ticksSinceAction,
        grossProfit,
        taxAmount,
        securityCost,
        netProfit,
        ticksSinceAction
      )
    );
  }

  // 3. Batch execute all updates (single network call)
  await env.DB.batch([...updateStatements, ...historyStatements]);

  return { count: companyProfits.results.length, totalProfit };
}

// Also update tick counter for companies with no buildings
async function updateIdleCompanies(env: Env) {
  await env.DB.prepare(`
    UPDATE game_companies
    SET ticks_since_action = ticks_since_action + 1
    WHERE current_map_id IS NOT NULL
      AND is_in_prison = 0
      AND id NOT IN (
        SELECT DISTINCT company_id FROM building_instances WHERE is_collapsed = 0
      )
  `).run();
}
```

### Fire Spread Logic (Optimized)

```typescript
// worker/tick/fireSpread.ts
import { markAffectedBuildingsDirty } from './profitCalculator';

export async function processFireSpread(
  env: Env,
  mapId: string
): Promise<{ buildingsAffected: number }> {
  // Get all buildings on fire in this map
  const burningBuildings = await env.DB.prepare(`
    SELECT bi.*, t.x, t.y, bs.has_sprinklers
    FROM building_instances bi
    JOIN tiles t ON bi.tile_id = t.id
    LEFT JOIN building_security bs ON bi.id = bs.building_id
    WHERE t.map_id = ? AND bi.is_on_fire = 1 AND bi.is_collapsed = 0
  `).bind(mapId).all();

  if (burningBuildings.results.length === 0) {
    return { buildingsAffected: 0 };
  }

  const statements = [];
  const tilesToMarkDirty = [];
  let buildingsAffected = 0;

  for (const burning of burningBuildings.results) {
    // Sprinkler extinguish check (60% chance)
    if (burning.has_sprinklers && Math.random() < 0.60) {
      statements.push(
        env.DB.prepare('UPDATE building_instances SET is_on_fire = 0 WHERE id = ?')
          .bind(burning.id)
      );
      continue;
    }

    // Fire damage (5% with sprinklers, 10% without)
    const damageIncrease = burning.has_sprinklers ? 5 : 10;
    const newDamage = Math.min(100, burning.damage_percent + damageIncrease);

    if (newDamage >= 100) {
      // Building collapses
      statements.push(
        env.DB.prepare(`
          UPDATE building_instances
          SET damage_percent = 100, is_collapsed = 1, is_on_fire = 0
          WHERE id = ?
        `).bind(burning.id)
      );
      tilesToMarkDirty.push({ x: burning.x, y: burning.y });
      buildingsAffected++;
    } else if (newDamage !== burning.damage_percent) {
      // Damage increased - mark neighbors dirty (damage affects their profit)
      statements.push(
        env.DB.prepare('UPDATE building_instances SET damage_percent = ? WHERE id = ?')
          .bind(newDamage, burning.id)
      );
      // Only mark dirty if damage crossed 50% threshold (profit penalty kicks in)
      if ((burning.damage_percent <= 50 && newDamage > 50) ||
          (burning.damage_percent > 50 && newDamage <= 50)) {
        tilesToMarkDirty.push({ x: burning.x, y: burning.y });
      }
      buildingsAffected++;
    }

    // Fire spread to adjacent buildings (only if not sprinklered)
    if (!burning.has_sprinklers) {
      const adjacentBuildings = await env.DB.prepare(`
        SELECT bi.id, bs.has_sprinklers, t.x, t.y, t.terrain_type
        FROM building_instances bi
        JOIN tiles t ON bi.tile_id = t.id
        LEFT JOIN building_security bs ON bi.id = bs.building_id
        WHERE t.map_id = ?
          AND bi.is_on_fire = 0
          AND bi.is_collapsed = 0
          AND ABS(t.x - ?) <= 1 AND ABS(t.y - ?) <= 1
          AND NOT (t.x = ? AND t.y = ?)
      `).bind(mapId, burning.x, burning.y, burning.x, burning.y).all();

      for (const adj of adjacentBuildings.results) {
        if (adj.has_sprinklers) continue;

        // Spread chance: 20% base, 35% if on trees
        const spreadChance = adj.terrain_type === 'trees' ? 0.35 : 0.20;
        if (Math.random() < spreadChance) {
          statements.push(
            env.DB.prepare('UPDATE building_instances SET is_on_fire = 1 WHERE id = ?')
              .bind(adj.id)
          );
          buildingsAffected++;
        }
      }
    }
  }

  // Batch execute all fire updates
  if (statements.length > 0) {
    await env.DB.batch(statements);
  }

  // Mark affected buildings as dirty for profit recalc
  for (const tile of tilesToMarkDirty) {
    await markAffectedBuildingsDirty(env, tile.x, tile.y, mapId);
  }

  return { buildingsAffected };
}
```

### Action Reset

```typescript
// When any action is performed, reset the tick counter
// Add this to all action handlers (buy, build, attack, etc.)
export async function resetTickCounter(env: Env, companyId: string) {
  await env.DB.prepare(`
    UPDATE game_companies
    SET ticks_since_action = 0,
        last_action_at = ?
    WHERE id = ?
  `).bind(new Date().toISOString(), companyId).run();
}
```

### Tick Status API

```typescript
// GET /api/game/company/:id/tick-status
interface TickStatusResponse {
  ticksSinceAction: number;
  isEarningProfit: boolean;
  ticksRemaining: number;
  lastTickProfit: number;
  estimatedNextProfit: number;
  nextTickIn: number; // seconds until next tick
}

export async function getTickStatus(env: Env, companyId: string): Promise<TickStatusResponse> {
  const company = await env.DB.prepare(
    'SELECT * FROM game_companies WHERE id = ?'
  ).bind(companyId).first();

  const lastTick = await env.DB.prepare(`
    SELECT * FROM tick_history
    WHERE company_id = ?
    ORDER BY processed_at DESC
    LIMIT 1
  `).bind(companyId).first();

  // Calculate time until next tick (aligned to 10-minute intervals)
  const now = new Date();
  const minutes = now.getMinutes();
  const nextTickMinute = Math.ceil(minutes / 10) * 10;
  const secondsUntilNextTick = ((nextTickMinute - minutes) * 60) - now.getSeconds();

  return {
    ticksSinceAction: company.ticks_since_action,
    isEarningProfit: company.ticks_since_action < 6,
    ticksRemaining: Math.max(0, 6 - company.ticks_since_action),
    lastTickProfit: lastTick?.net_profit || 0,
    estimatedNextProfit: lastTick?.net_profit || 0, // Same as last unless things changed
    nextTickIn: secondsUntilNextTick,
  };
}
```

### UI Component for Tick Status

```tsx
// components/game/TickStatus.tsx
export function TickStatus() {
  const { activeCompany } = useCompany();
  const { data: tickStatus, refetch } = useTickStatus(activeCompany?.id);

  // Countdown timer
  const [countdown, setCountdown] = useState(tickStatus?.nextTickIn || 0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          refetch(); // Refresh tick status
          return tickStatus?.nextTickIn || 600;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [tickStatus]);

  if (!tickStatus) return null;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <div className="flex justify-between items-center mb-2">
        <span className="text-gray-400">Next Tick</span>
        <span className="text-white font-mono">{formatTime(countdown)}</span>
      </div>

      <div className="flex justify-between items-center mb-2">
        <span className="text-gray-400">Status</span>
        {tickStatus.isEarningProfit ? (
          <span className="text-green-400">Earning ({tickStatus.ticksRemaining} ticks left)</span>
        ) : (
          <span className="text-yellow-400">Idle - Take action to earn</span>
        )}
      </div>

      {tickStatus.isEarningProfit && (
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Est. Profit</span>
          <span className="text-green-400">+${tickStatus.estimatedNextProfit.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}
```

## Database Changes

- New `tick_history` table for logging tick results
- Uses existing `ticks_since_action` column on companies

## Test Cases

| Test | Input | Expected Output |
|------|-------|-----------------|
| Active company tick | Company with buildings, < 6 ticks | Profit added to cash |
| Idle company tick | Company with 6+ ticks since action | No profit, tick counter increments |
| No buildings tick | Company with no buildings | No profit, tick counter increments |
| Tax calculation | Town with 1000 gross profit | 100 tax (10%) |
| Security cost | Building with 1440/day security | 10 deducted per tick |
| Fire damage | Building on fire | +10% damage per tick |
| Fire spread | Adjacent to burning building | 20% chance to catch fire |
| Sprinkler extinguish | Burning building with sprinklers | 50% chance to extinguish |
| Building collapse | 100% damage | Building marked collapsed |
| Action reset | Any action performed | ticks_since_action = 0 |

## Acceptance Checklist

- [ ] Cron trigger configured in wrangler.toml
- [ ] Tick runs every 10 minutes
- [ ] Profit calculated correctly (base - tax - security)
- [ ] Damage reduces profit proportionally
- [ ] Ticks stop after 6 without action
- [ ] Action resets tick counter
- [ ] Fire spreads to adjacent buildings
- [ ] Sprinklers reduce fire spread
- [ ] Collapsed buildings don't earn profit
- [ ] Tick history logged
- [ ] UI shows tick countdown and status

## Deployment

```bash
# Run migration
CLOUDFLARE_API_TOKEN="..." npx wrangler d1 execute notropolis-database --file=migrations/0015_add_tick_tracking.sql --remote

# Deploy with cron trigger
CLOUDFLARE_API_TOKEN="..." npx wrangler deploy

# Verify cron is scheduled
# Check Cloudflare dashboard > Workers > Your Worker > Triggers
```

## Handoff Notes

- Tick runs globally every 10 minutes (not per-company)
- 6-tick limit = 1 hour of offline income
- Tax rates: Town 10%, City 15%, Capital 20%
- Fire spread is per-tick, not instant
- Sprinklers are the only fire defense
- Collapsed buildings need demolishing before land is usable [See: Stage 07]
- Consider adding tick notification system in future

### Optimization Notes (Critical)

- **Dirty Tracking:** Buildings are only recalculated when `needs_profit_recalc = 1`
- **Minimal Writes:** Typical tick = company updates only (no building updates)
- **Batch Operations:** All updates use `env.DB.batch()` for single network call
- **Cost Efficiency:** Optimized approach reduces D1 writes by ~95%+
- See [REFERENCE-d1-optimization.md](REFERENCE-d1-optimization.md) for patterns
- `recalculateDirtyBuildings()` is called from Stage 05's adjacency code
- `markAffectedBuildingsDirty()` must be called after any profit-affecting change
