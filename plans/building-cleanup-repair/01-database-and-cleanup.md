# Stage 1: Database & Attack Cleanup

## Objective

Add `is_cleaned` column to attacks table and implement the cleanup endpoint that removes trick effects from buildings.

## Dependencies

None - this is the first stage.

## Complexity

Medium

## Files to Modify

| File | Changes |
|------|---------|
| `worker/index.js` | Add route for `POST /api/game/buildings/cleanup` |
| `worker/src/routes/game/attacks.js` | Add `cleanupTrick()` function |
| `worker/src/middleware/authorization.js` | Add authorization pattern for new endpoint |

## Files to Create

| File | Purpose |
|------|---------|
| `migrations/0048_add_attack_cleanup.sql` | Add `is_cleaned` column to attacks table |

## Implementation Details

### Migration: Add is_cleaned column

```sql
-- migrations/0048_add_attack_cleanup.sql
ALTER TABLE attacks ADD COLUMN is_cleaned INTEGER DEFAULT 0;
CREATE INDEX idx_attacks_uncleaned ON attacks(target_building_id, is_cleaned) WHERE is_cleaned = 0;
```

### Cleanup Cost Formula

```javascript
// Cleanup costs 5% of the building's base cost per uncleaned attack
const CLEANUP_COST_PERCENT = 0.05;
const cleanupCost = Math.round(buildingType.cost * CLEANUP_COST_PERCENT * uncleanedAttackCount);
```

### cleanupTrick() Function

```javascript
/**
 * POST /api/game/buildings/cleanup
 * Clean up all trick effects on a building (owner only)
 * - Marks all uncleaned attacks as cleaned
 * - Removes visual effects (graffiti, smoke, stink)
 * - Does NOT reduce damage_percent (use repair for that)
 * - Does NOT extinguish fire (use put-out-fire for that)
 */
export async function cleanupTrick(request, env, company) {
  const { building_id } = await request.json();

  // Validate prison status
  if (company.is_in_prison) {
    throw new Error(`You are in prison! Pay your fine first.`);
  }

  // Get building with type info
  const building = await env.DB.prepare(`
    SELECT bi.*, bt.cost as type_cost, bt.name as type_name,
           t.x, t.y, t.map_id
    FROM building_instances bi
    JOIN building_types bt ON bi.building_type_id = bt.id
    JOIN tiles t ON bi.tile_id = t.id
    WHERE bi.id = ? AND bi.company_id = ?
  `).bind(building_id, company.id).first();

  if (!building) {
    throw new Error('Building not found or not owned by you');
  }
  if (building.is_collapsed) {
    throw new Error('Cannot cleanup collapsed buildings');
  }

  // Get uncleaned attacks on this building (excluding fire_bomb - handled separately)
  const uncleanedAttacks = await env.DB.prepare(`
    SELECT id, trick_type FROM attacks
    WHERE target_building_id = ? AND is_cleaned = 0
    AND trick_type != 'fire_bomb'
  `).bind(building_id).all();

  if (uncleanedAttacks.results.length === 0) {
    throw new Error('No trick effects to clean up');
  }

  // Calculate cleanup cost
  const cleanupCost = Math.round(building.type_cost * 0.05 * uncleanedAttacks.results.length);

  if (company.cash < cleanupCost) {
    throw new Error(`Insufficient funds. Cleanup costs $${cleanupCost.toLocaleString()}`);
  }

  // Execute cleanup
  await env.DB.batch([
    // Mark attacks as cleaned
    env.DB.prepare(`
      UPDATE attacks SET is_cleaned = 1
      WHERE target_building_id = ? AND is_cleaned = 0 AND trick_type != 'fire_bomb'
    `).bind(building_id),

    // Deduct cost from company
    env.DB.prepare(`
      UPDATE game_companies
      SET cash = cash - ?, total_actions = total_actions + 1,
          last_action_at = ?, ticks_since_action = 0
      WHERE id = ?
    `).bind(cleanupCost, new Date().toISOString(), company.id),

    // Log transaction
    env.DB.prepare(`
      INSERT INTO game_transactions (id, company_id, map_id, action_type, target_building_id, amount, details)
      VALUES (?, ?, ?, 'cleanup', ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      company.id,
      building.map_id,
      building_id,
      -cleanupCost,
      JSON.stringify({ attacks_cleaned: uncleanedAttacks.results.length })
    ),
  ]);

  return {
    success: true,
    attacks_cleaned: uncleanedAttacks.results.length,
    cleanup_cost: cleanupCost
  };
}
```

### Router Registration (index.js)

```javascript
// Add import
import { performAttack, payFine, getAttackHistory, cleanupTrick } from './src/routes/game/attacks.js';

// Add case in switch
case path === '/api/game/buildings/cleanup' && method === 'POST':
  return handleMarketAction(request, authService, env, corsHeaders, cleanupTrick);
```

### Authorization Pattern

```javascript
// Add to GAME_ROUTE_PATTERNS array
{ pattern: '/api/game/buildings/cleanup', roles: [], companyIsolation: false },
```

## Database Changes

| Table | Column | Type | Default | Purpose |
|-------|--------|------|---------|---------|
| attacks | is_cleaned | INTEGER | 0 | Track if trick effect was cleaned |

## Test Cases

| Scenario | Input | Expected |
|----------|-------|----------|
| Clean single attack | building_id with 1 uncleaned graffiti | Cost = 5% of building, attack marked cleaned |
| Clean multiple attacks | building_id with 3 uncleaned attacks | Cost = 15% of building, all marked cleaned |
| No attacks to clean | building_id with 0 uncleaned | Error: "No trick effects to clean up" |
| Not owner | building_id owned by other | Error: "Building not found or not owned" |
| In prison | company.is_in_prison = 1 | Error: "You are in prison" |
| Insufficient funds | cash < cleanup cost | Error with cost amount |
| Collapsed building | is_collapsed = 1 | Error: "Cannot cleanup collapsed" |
| Fire attacks excluded | building with only fire_bomb | Error: "No trick effects to clean up" |

## Acceptance Checklist

- [ ] Migration runs without error
- [ ] `is_cleaned` column exists on attacks table
- [ ] Cleanup endpoint rejects non-owners
- [ ] Cleanup endpoint rejects imprisoned players
- [ ] Cleanup correctly calculates cost based on uncleaned attack count
- [ ] Fire bomb attacks are NOT marked as cleaned (separate action)
- [ ] Transaction logged to game_transactions
- [ ] Company cash deducted correctly

## Deployment

```bash
# Run migration
wrangler d1 execute notropolis-db --remote --file=migrations/0048_add_attack_cleanup.sql

# Deploy worker
cd authentication-dashboard-system/worker
wrangler deploy

# Verify
curl -X POST https://api.notropolis.com/api/game/buildings/cleanup \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"building_id": "test-id"}'
```

## Handoff Notes

- Stage 2 will add fire extinguishing and damage repair
- The `is_cleaned` column is now available for querying active effects on buildings
- Frontend can query uncleaned attacks to show visual effects
