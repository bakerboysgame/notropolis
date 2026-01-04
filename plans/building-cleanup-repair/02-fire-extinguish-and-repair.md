# Stage 2: Fire Extinguish & Repair

## Objective

Add endpoint for any player to extinguish fires, and endpoint for building owners to fully repair damage.

## Dependencies

`[Requires: Stage 1 complete]` - is_cleaned column must exist on attacks table.

## Complexity

Medium

## Files to Modify

| File | Changes |
|------|---------|
| `worker/index.js` | Add routes for `POST /api/game/buildings/extinguish` and `POST /api/game/buildings/repair` |
| `worker/src/routes/game/attacks.js` | Add `extinguishFire()` and `repairBuilding()` functions |
| `worker/src/middleware/authorization.js` | Add authorization patterns for new endpoints |
| `worker/src/routes/game/events.js` | Add event description formatters for new action types |

## Files to Create

None - all changes in existing files.

## Implementation Details

### extinguishFire() Function

```javascript
/**
 * POST /api/game/buildings/extinguish
 * Put out fire on any building (any player can do this - community action)
 * - Sets is_on_fire = 0
 * - Marks fire_bomb attacks as cleaned
 * - FREE action (no cost)
 */
export async function extinguishFire(request, env, company) {
  const { building_id, map_id, x, y } = await request.json();

  // Validate required fields
  if (!building_id || !map_id || x === undefined || y === undefined) {
    throw new Error('Missing required fields: building_id, map_id, x, y');
  }

  // Validate prison status
  if (company.is_in_prison) {
    throw new Error(`You are in prison! Pay your fine first.`);
  }

  // Get building with location verification
  const building = await env.DB.prepare(`
    SELECT bi.*, t.x, t.y, t.map_id, gc.name as owner_name
    FROM building_instances bi
    JOIN tiles t ON bi.tile_id = t.id
    JOIN game_companies gc ON bi.company_id = gc.id
    WHERE bi.id = ?
  `).bind(building_id).first();

  if (!building) {
    throw new Error('Building not found');
  }

  // Verify location (prevent blind extinguishing by guessing IDs)
  if (building.map_id !== map_id || building.x !== x || building.y !== y) {
    throw new Error('Location mismatch');
  }

  if (!building.is_on_fire) {
    throw new Error('Building is not on fire');
  }

  if (building.is_collapsed) {
    throw new Error('Building has collapsed');
  }

  // Execute extinguish
  await env.DB.batch([
    // Put out fire
    env.DB.prepare(`
      UPDATE building_instances SET is_on_fire = 0 WHERE id = ?
    `).bind(building_id),

    // Mark fire_bomb attacks as cleaned
    env.DB.prepare(`
      UPDATE attacks SET is_cleaned = 1
      WHERE target_building_id = ? AND trick_type = 'fire_bomb' AND is_cleaned = 0
    `).bind(building_id),

    // Update company action tracking
    env.DB.prepare(`
      UPDATE game_companies
      SET total_actions = total_actions + 1, last_action_at = ?, ticks_since_action = 0
      WHERE id = ?
    `).bind(new Date().toISOString(), company.id),

    // Log transaction
    env.DB.prepare(`
      INSERT INTO game_transactions (id, company_id, map_id, action_type, target_building_id, target_company_id, amount)
      VALUES (?, ?, ?, 'extinguish', ?, ?, 0)
    `).bind(
      crypto.randomUUID(),
      company.id,
      building.map_id,
      building_id,
      building.company_id
    ),
  ]);

  // Mark adjacent buildings dirty (fire status affects adjacency)
  await markAffectedBuildingsDirty(env, building.x, building.y, building.map_id);

  return {
    success: true,
    building_id,
    owner_name: building.owner_name,
    message: 'Fire extinguished'
  };
}
```

### repairBuilding() Function

```javascript
/**
 * POST /api/game/buildings/repair
 * Fully repair building damage (owner only)
 * - Resets damage_percent to 0
 * - Cost = damage_percent% of building base cost
 * - Cannot repair collapsed buildings (must demolish)
 */
export async function repairBuilding(request, env, company) {
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
    throw new Error('Cannot repair collapsed buildings - use demolish instead');
  }

  if (building.damage_percent === 0) {
    throw new Error('Building is not damaged');
  }

  if (building.is_on_fire) {
    throw new Error('Put out the fire before repairing');
  }

  // Calculate repair cost: damage% of building base cost
  // e.g., 75% damage on $100,000 building = $75,000 to repair
  const repairCost = Math.round(building.type_cost * (building.damage_percent / 100));

  if (company.cash < repairCost) {
    throw new Error(`Insufficient funds. Repair costs $${repairCost.toLocaleString()}`);
  }

  const oldDamage = building.damage_percent;

  // Execute repair
  await env.DB.batch([
    // Reset damage to 0
    env.DB.prepare(`
      UPDATE building_instances
      SET damage_percent = 0, needs_profit_recalc = 1
      WHERE id = ?
    `).bind(building_id),

    // Deduct cost from company
    env.DB.prepare(`
      UPDATE game_companies
      SET cash = cash - ?, total_actions = total_actions + 1,
          last_action_at = ?, ticks_since_action = 0
      WHERE id = ?
    `).bind(repairCost, new Date().toISOString(), company.id),

    // Log transaction
    env.DB.prepare(`
      INSERT INTO game_transactions (id, company_id, map_id, action_type, target_building_id, amount, details)
      VALUES (?, ?, ?, 'repair', ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      company.id,
      building.map_id,
      building_id,
      -repairCost,
      JSON.stringify({ damage_repaired: oldDamage })
    ),
  ]);

  // Mark adjacent buildings dirty (damage affects adjacency penalties)
  await markAffectedBuildingsDirty(env, building.x, building.y, building.map_id);

  return {
    success: true,
    damage_repaired: oldDamage,
    repair_cost: repairCost
  };
}
```

### Router Registration (index.js)

```javascript
// Update import
import {
  performAttack,
  payFine,
  getAttackHistory,
  cleanupTrick,
  extinguishFire,
  repairBuilding
} from './src/routes/game/attacks.js';

// Add cases in switch
case path === '/api/game/buildings/extinguish' && method === 'POST':
  return handleMarketAction(request, authService, env, corsHeaders, extinguishFire);

case path === '/api/game/buildings/repair' && method === 'POST':
  return handleMarketAction(request, authService, env, corsHeaders, repairBuilding);
```

### Authorization Patterns

```javascript
// Add to GAME_ROUTE_PATTERNS array
{ pattern: '/api/game/buildings/extinguish', roles: [], companyIsolation: false },
{ pattern: '/api/game/buildings/repair', roles: [], companyIsolation: false },
```

### Event Descriptions (events.js)

Add to `formatEventDescription()` switch:

```javascript
case 'cleanup':
  const cleanedCount = details?.attacks_cleaned || 0;
  return `${actor} cleaned up ${cleanedCount} trick effect${cleanedCount !== 1 ? 's' : ''} for ${amount}`;

case 'extinguish':
  return target
    ? `${actor} extinguished fire on ${target}'s building`
    : `${actor} extinguished a fire`;

case 'repair':
  const damageFixed = details?.damage_repaired || 0;
  return `${actor} repaired ${damageFixed}% damage for ${amount}`;
```

## Database Changes

None - uses existing columns.

## Test Cases

### Extinguish Fire

| Scenario | Input | Expected |
|----------|-------|----------|
| Extinguish own building | building on fire, owner | Success, is_on_fire = 0 |
| Extinguish other's building | building on fire, not owner | Success (anyone can extinguish) |
| Not on fire | building.is_on_fire = 0 | Error: "Building is not on fire" |
| Collapsed | is_collapsed = 1 | Error: "Building has collapsed" |
| In prison | company.is_in_prison = 1 | Error: "You are in prison" |
| Location mismatch | wrong x/y coordinates | Error: "Location mismatch" |

### Repair Building

| Scenario | Input | Expected |
|----------|-------|----------|
| Full repair 75% damage | $100k building, 75% damage | Cost = $75k, damage = 0 |
| Full repair 25% damage | $100k building, 25% damage | Cost = $25k, damage = 0 |
| No damage | damage_percent = 0 | Error: "Building is not damaged" |
| Building on fire | is_on_fire = 1 | Error: "Put out the fire before repairing" |
| Not owner | building owned by other | Error: "Building not found or not owned" |
| In prison | company.is_in_prison = 1 | Error: "You are in prison" |
| Collapsed | is_collapsed = 1 | Error: "Cannot repair collapsed buildings" |
| Insufficient funds | cash < repair cost | Error with cost amount |

## Acceptance Checklist

- [ ] Extinguish endpoint works for any player on any building
- [ ] Extinguish is free (no cost deducted)
- [ ] Extinguish requires location verification (x, y, map_id)
- [ ] Extinguish marks fire_bomb attacks as cleaned
- [ ] Repair endpoint rejects non-owners
- [ ] Repair endpoint rejects buildings on fire
- [ ] Repair cost = damage_percent% of building base cost
- [ ] Repair resets damage_percent to 0
- [ ] Both actions log to game_transactions
- [ ] Both actions update adjacent building dirty flags
- [ ] Event descriptions show correctly in feed

## Deployment

```bash
# Deploy worker (no migration needed for this stage)
cd authentication-dashboard-system/worker
wrangler deploy

# Test extinguish (get a burning building first)
curl -X POST https://api.notropolis.com/api/game/buildings/extinguish \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"building_id": "xxx", "map_id": "xxx", "x": 5, "y": 10}'

# Test repair
curl -X POST https://api.notropolis.com/api/game/buildings/repair \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"building_id": "xxx"}'
```

## Handoff Notes

- All three endpoints are now complete: cleanup, extinguish, repair
- Frontend needs to:
  - Query uncleaned attacks to show visual effects
  - Show "Put Out Fire" button for any player on burning buildings
  - Show "Cleanup" and "Repair" buttons for building owners
  - Display costs before confirmation
- Future: Automated fire brigade could use the extinguish logic
