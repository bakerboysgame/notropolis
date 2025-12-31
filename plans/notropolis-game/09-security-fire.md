# Stage 09: Security & Fire Systems

## Objective

Implement building security purchases (cameras, dogs, guards, sprinklers) and complete fire spread mechanics.

## Dependencies

`[Requires: Stage 05 complete]` - Needs buildings to secure.
`[Requires: Stage 06 complete]` - Needs tick system for costs and fire.
`[Requires: Stage 08 complete]` - Needs attack system that security defends against.
`[Reference: REFERENCE-d1-optimization.md]` - Critical D1 batch patterns for performance.

## Complexity

**Medium** - Security purchase system, fire spread refinement.

## Files to Modify

| File | Changes |
|------|---------|
| `authentication-dashboard-system/src/components/game/TileInfo.tsx` | Add security button |
| `authentication-dashboard-system/src/worker/tick/fireSpread.ts` | Enhance fire logic |
| `authentication-dashboard-system/src/worker/routes/game/attacks.ts` | Use security in catch calculation |

## Files to Create

| File | Purpose |
|------|---------|
| `authentication-dashboard-system/src/components/game/SecurityModal.tsx` | Security purchase UI |
| `authentication-dashboard-system/src/components/game/SecurityStatus.tsx` | Display current security |
| `authentication-dashboard-system/src/worker/routes/game/security.ts` | Security API |

## Implementation Details

### Security Definitions

```typescript
// utils/security.ts
export const SECURITY_OPTIONS = {
  cameras: {
    id: 'cameras',
    name: 'Security Cameras',
    icon: '📷',
    purchaseCost: 5000,
    monthlyCost: 500,
    catchBonus: 0.10,
    description: 'Record evidence of attackers. +10% catch rate.',
  },
  guard_dogs: {
    id: 'guard_dogs',
    name: 'Guard Dogs',
    icon: '🐕',
    purchaseCost: 8000,
    monthlyCost: 800,
    catchBonus: 0.15,
    description: 'Dogs patrol the perimeter. +15% catch rate.',
  },
  security_guards: {
    id: 'security_guards',
    name: 'Security Guards',
    icon: '👮',
    purchaseCost: 15000,
    monthlyCost: 1500,
    catchBonus: 0.25,
    description: '24/7 human security. +25% catch rate.',
  },
  sprinklers: {
    id: 'sprinklers',
    name: 'Fire Sprinklers',
    icon: '💦',
    purchaseCost: 10000,
    monthlyCost: 200,
    catchBonus: 0, // Doesn't help catch
    description: 'Automatic fire suppression. Prevents fire spread.',
  },
} as const;

export type SecurityType = keyof typeof SECURITY_OPTIONS;

export function calculateTotalMonthlyCost(security: BuildingSecurity): number {
  let total = 0;
  if (security.has_cameras) total += SECURITY_OPTIONS.cameras.monthlyCost;
  if (security.has_guard_dogs) total += SECURITY_OPTIONS.guard_dogs.monthlyCost;
  if (security.has_security_guards) total += SECURITY_OPTIONS.security_guards.monthlyCost;
  if (security.has_sprinklers) total += SECURITY_OPTIONS.sprinklers.monthlyCost;
  return total;
}

export function calculateSecurityCatchBonus(security: BuildingSecurity | null): number {
  if (!security) return 0;
  let bonus = 0;
  if (security.has_cameras) bonus += SECURITY_OPTIONS.cameras.catchBonus;
  if (security.has_guard_dogs) bonus += SECURITY_OPTIONS.guard_dogs.catchBonus;
  if (security.has_security_guards) bonus += SECURITY_OPTIONS.security_guards.catchBonus;
  return bonus;
}
```

### Security API

```typescript
// worker/routes/game/security.ts
export async function purchaseSecurity(request: Request, env: Env, company: GameCompany) {
  const { building_id, security_type } = await request.json();

  const option = SECURITY_OPTIONS[security_type];
  if (!option) throw new Error('Invalid security type');

  // Get building
  const building = await env.DB.prepare(`
    SELECT * FROM building_instances WHERE id = ? AND company_id = ?
  `).bind(building_id, company.id).first();

  if (!building) throw new Error('Building not found or not owned');
  if (building.is_collapsed) throw new Error('Cannot add security to collapsed building');

  // Check funds
  if (company.cash < option.purchaseCost) {
    throw new Error('Insufficient funds');
  }

  // Get or create security record
  let security = await env.DB.prepare(
    'SELECT * FROM building_security WHERE building_id = ?'
  ).bind(building_id).first();

  const columnMap = {
    cameras: 'has_cameras',
    guard_dogs: 'has_guard_dogs',
    security_guards: 'has_security_guards',
    sprinklers: 'has_sprinklers',
  };

  const column = columnMap[security_type];

  if (security) {
    // Check if already has this security
    if (security[column]) {
      throw new Error(`Building already has ${option.name.toLowerCase()}`);
    }

    // Calculate new monthly cost
    const currentCost = security.monthly_cost || 0;
    const newCost = currentCost + option.monthlyCost;

    await env.DB.batch([
      // Update security
      env.DB.prepare(`
        UPDATE building_security
        SET ${column} = 1, monthly_cost = ?
        WHERE building_id = ?
      `).bind(newCost, building_id),

      // Deduct cost and reset tick counter
      env.DB.prepare(
        'UPDATE game_companies SET cash = cash - ?, total_actions = total_actions + 1, last_action_at = ?, ticks_since_action = 0 WHERE id = ?'
      ).bind(option.purchaseCost, new Date().toISOString(), company.id),

      // Log transaction
      env.DB.prepare(`
        INSERT INTO game_transactions (id, company_id, action_type, target_building_id, amount, details)
        VALUES (?, ?, 'security_purchase', ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        company.id,
        building_id,
        option.purchaseCost,
        JSON.stringify({ type: security_type })
      ),
    ]);
  } else {
    // Create new security record
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO building_security (id, building_id, ${column}, monthly_cost)
        VALUES (?, ?, 1, ?)
      `).bind(crypto.randomUUID(), building_id, option.monthlyCost),

      env.DB.prepare(
        'UPDATE game_companies SET cash = cash - ?, total_actions = total_actions + 1, last_action_at = ?, ticks_since_action = 0 WHERE id = ?'
      ).bind(option.purchaseCost, new Date().toISOString(), company.id),

      env.DB.prepare(`
        INSERT INTO game_transactions (id, company_id, action_type, target_building_id, amount, details)
        VALUES (?, ?, 'security_purchase', ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        company.id,
        building_id,
        option.purchaseCost,
        JSON.stringify({ type: security_type })
      ),
    ]);
  }

  await resetTickCounter(env, company.id);

  return {
    success: true,
    security_type,
    purchase_cost: option.purchaseCost,
    monthly_cost: option.monthlyCost,
  };
}

export async function removeSecurity(request: Request, env: Env, company: GameCompany) {
  const { building_id, security_type } = await request.json();

  const option = SECURITY_OPTIONS[security_type];
  if (!option) throw new Error('Invalid security type');

  const building = await env.DB.prepare(`
    SELECT * FROM building_instances WHERE id = ? AND company_id = ?
  `).bind(building_id, company.id).first();

  if (!building) throw new Error('Building not found or not owned');

  const columnMap = {
    cameras: 'has_cameras',
    guard_dogs: 'has_guard_dogs',
    security_guards: 'has_security_guards',
    sprinklers: 'has_sprinklers',
  };

  const column = columnMap[security_type];

  const security = await env.DB.prepare(
    'SELECT * FROM building_security WHERE building_id = ?'
  ).bind(building_id).first();

  if (!security || !security[column]) {
    throw new Error(`Building doesn't have ${option.name.toLowerCase()}`);
  }

  const newCost = (security.monthly_cost || 0) - option.monthlyCost;

  await env.DB.prepare(`
    UPDATE building_security
    SET ${column} = 0, monthly_cost = ?
    WHERE building_id = ?
  `).bind(Math.max(0, newCost), building_id).run();

  return { success: true };
}
```

### Enhanced Fire Spread

```typescript
// worker/tick/fireSpread.ts - Enhanced version
export async function processFireSpread(env: Env) {
  // Get all buildings on fire
  const burningBuildings = await env.DB.prepare(`
    SELECT bi.*, t.x, t.y, t.map_id,
           bs.has_sprinklers
    FROM building_instances bi
    JOIN tiles t ON bi.tile_id = t.id
    LEFT JOIN building_security bs ON bi.id = bs.building_id
    WHERE bi.is_on_fire = 1 AND bi.is_collapsed = 0
  `).all();

  if (burningBuildings.results.length === 0) return;

  for (const burning of burningBuildings.results) {
    // Sprinkler check - chance to extinguish
    if (burning.has_sprinklers) {
      // 60% chance to extinguish fire each tick
      if (Math.random() < 0.60) {
        await env.DB.prepare(`
          UPDATE building_instances SET is_on_fire = 0 WHERE id = ?
        `).bind(burning.id).run();

        console.log(`Sprinklers extinguished fire on building ${burning.id}`);
        continue;
      }
    }

    // Fire damage increases
    const damageIncrease = burning.has_sprinklers ? 5 : 10; // Sprinklers reduce damage rate
    const newDamage = Math.min(100, burning.damage_percent + damageIncrease);

    if (newDamage >= 100) {
      // Building collapses
      await env.DB.prepare(`
        UPDATE building_instances
        SET damage_percent = 100, is_collapsed = 1, is_on_fire = 0
        WHERE id = ?
      `).bind(burning.id).run();

      console.log(`Building ${burning.id} collapsed from fire`);
      continue;
    }

    await env.DB.prepare(`
      UPDATE building_instances SET damage_percent = ? WHERE id = ?
    `).bind(newDamage, burning.id).run();

    // Fire spread to adjacent buildings
    const adjacentBuildings = await env.DB.prepare(`
      SELECT bi.id, bs.has_sprinklers, t.terrain_type
      FROM building_instances bi
      JOIN tiles t ON bi.tile_id = t.id
      LEFT JOIN building_security bs ON bi.id = bs.building_id
      WHERE t.map_id = ?
        AND bi.is_on_fire = 0
        AND bi.is_collapsed = 0
        AND ABS(t.x - ?) <= 1
        AND ABS(t.y - ?) <= 1
        AND NOT (t.x = ? AND t.y = ?)
    `).bind(
      burning.map_id,
      burning.x, burning.y,
      burning.x, burning.y
    ).all();

    for (const adjacent of adjacentBuildings.results) {
      // Sprinklers prevent fire spread
      if (adjacent.has_sprinklers) {
        console.log(`Sprinklers prevented fire spread to building ${adjacent.id}`);
        continue;
      }

      // Water terrain acts as firebreak
      // Check if there's water between the buildings
      // (simplified: just check the adjacent tile terrain)

      // Base 20% spread chance
      let spreadChance = 0.20;

      // Trees increase spread chance
      if (adjacent.terrain_type === 'trees') {
        spreadChance = 0.35;
      }

      if (Math.random() < spreadChance) {
        await env.DB.prepare(`
          UPDATE building_instances SET is_on_fire = 1 WHERE id = ?
        `).bind(adjacent.id).run();

        console.log(`Fire spread to building ${adjacent.id}`);
      }
    }
  }
}
```

### Water Firebreak Logic

```typescript
// Check if water exists between two tiles (simplified)
async function hasWaterBetween(
  env: Env,
  mapId: string,
  x1: number, y1: number,
  x2: number, y2: number
): Promise<boolean> {
  // Check tiles in a line between the two points
  const dx = Math.sign(x2 - x1);
  const dy = Math.sign(y2 - y1);

  // Simple case: just check if adjacent tile is water
  const betweenTile = await env.DB.prepare(`
    SELECT terrain_type FROM tiles
    WHERE map_id = ? AND x = ? AND y = ?
  `).bind(mapId, x1 + dx, y1 + dy).first();

  return betweenTile?.terrain_type === 'water';
}
```

### UI Components

```tsx
// SecurityModal.tsx
export function SecurityModal({ building, onClose }) {
  const { activeCompany, refreshCompany } = useCompany();
  const { data: security, refetch } = useBuildingSecurity(building.id);

  const handlePurchase = async (type: SecurityType) => {
    await api.security.purchase(building.id, type);
    await refetch();
    await refreshCompany();
  };

  const handleRemove = async (type: SecurityType) => {
    await api.security.remove(building.id, type);
    await refetch();
  };

  const hasType = (type: SecurityType) => {
    if (!security) return false;
    const map = {
      cameras: security.has_cameras,
      guard_dogs: security.has_guard_dogs,
      security_guards: security.has_security_guards,
      sprinklers: security.has_sprinklers,
    };
    return map[type];
  };

  return (
    <Modal onClose={onClose}>
      <h2 className="text-xl font-bold text-white mb-4">Building Security</h2>

      <div className="space-y-3">
        {Object.values(SECURITY_OPTIONS).map(option => {
          const owned = hasType(option.id);
          const canAfford = activeCompany.cash >= option.purchaseCost;

          return (
            <div
              key={option.id}
              className={`p-4 rounded-lg ${owned ? 'bg-green-900/30 border border-green-600' : 'bg-gray-700'}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-white">
                    {option.icon} {option.name}
                    {owned && <span className="ml-2 text-green-400">(Installed)</span>}
                  </p>
                  <p className="text-sm text-gray-400">{option.description}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Monthly cost: ${option.monthlyCost.toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  {owned ? (
                    <button
                      onClick={() => handleRemove(option.id)}
                      className="text-sm text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      onClick={() => handlePurchase(option.id)}
                      disabled={!canAfford}
                      className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
                    >
                      ${option.purchaseCost.toLocaleString()}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {security && (
        <div className="mt-4 p-3 bg-gray-800 rounded">
          <p className="text-gray-400">Total Monthly Cost</p>
          <p className="text-xl text-yellow-400">
            ${calculateTotalMonthlyCost(security).toLocaleString()}/month
          </p>
          <p className="text-sm text-gray-500">
            (~${Math.round(calculateTotalMonthlyCost(security) / 144)}/tick)
          </p>
        </div>
      )}

      <button
        onClick={onClose}
        className="w-full mt-4 py-2 bg-gray-600 text-white rounded"
      >
        Close
      </button>
    </Modal>
  );
}
```

```tsx
// SecurityStatus.tsx (for TileInfo panel)
export function SecurityStatus({ security }: { security: BuildingSecurity | null }) {
  if (!security) return null;

  const hasAny = security.has_cameras || security.has_guard_dogs ||
                 security.has_security_guards || security.has_sprinklers;

  if (!hasAny) return null;

  return (
    <div className="mb-4">
      <p className="text-sm text-gray-500 mb-2">Security</p>
      <div className="flex gap-2 flex-wrap">
        {security.has_cameras && (
          <span className="px-2 py-1 bg-blue-900/50 rounded text-xs text-blue-300">
            📷 Cameras
          </span>
        )}
        {security.has_guard_dogs && (
          <span className="px-2 py-1 bg-amber-900/50 rounded text-xs text-amber-300">
            🐕 Dogs
          </span>
        )}
        {security.has_security_guards && (
          <span className="px-2 py-1 bg-purple-900/50 rounded text-xs text-purple-300">
            👮 Guards
          </span>
        )}
        {security.has_sprinklers && (
          <span className="px-2 py-1 bg-cyan-900/50 rounded text-xs text-cyan-300">
            💦 Sprinklers
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 mt-1">
        Catch bonus: +{Math.round(calculateSecurityCatchBonus(security) * 100)}%
      </p>
    </div>
  );
}
```

## Database Changes

Uses existing `building_security` table from Stage 01.

## Test Cases

| Test | Input | Expected Output |
|------|-------|-----------------|
| Purchase cameras | Sufficient funds | Cameras added, cost deducted |
| Purchase all security | All 4 types | All flags set, costs summed |
| Duplicate purchase | Already has cameras | Error: already has |
| Remove security | Has cameras | Cameras removed, no refund |
| Fire with sprinklers | Building on fire | 60% chance to extinguish |
| Fire damage reduction | Sprinklers active | 5% damage instead of 10% |
| Fire spread blocked | Target has sprinklers | Fire doesn't spread |
| Fire spread trees | Adjacent on trees | 35% spread chance |
| Security catch bonus | Guards + cameras | +35% catch rate |
| Monthly cost deduction | Tick with security | Cost deducted from profit |

## Acceptance Checklist

- [ ] Can purchase all 4 security types
- [ ] Cannot purchase duplicate security
- [ ] Can remove security
- [ ] Purchase cost deducted correctly
- [ ] Monthly cost calculated and stored
- [ ] Security bonus affects attack catch rate
- [ ] Sprinklers can extinguish fire (60%)
- [ ] Sprinklers reduce fire damage rate
- [ ] Sprinklers block fire spread
- [ ] Trees increase fire spread chance
- [ ] Security status displayed on buildings
- [ ] Monthly costs deducted during tick

## Deployment

```bash
npm run build
CLOUDFLARE_API_TOKEN="..." CLOUDFLARE_ACCOUNT_ID="..." npx wrangler pages deploy ./dist --project-name=notropolis-dashboard
```

## Handoff Notes

- Security is per-building, not per-company
- Monthly costs are deducted during tick processing [See: Stage 06]
- Catch bonus stacks: cameras(10%) + dogs(15%) + guards(25%) = 50%
- Sprinklers only affect fire, not catch rate
- Fire damage: 10%/tick without sprinklers, 5%/tick with
- Sprinklers have 60% chance to extinguish per tick
- **Damage Economics:** ANY damage change marks adjacent buildings dirty (graduated neighbor penalty)
- **Neighbor Penalty:** Scales 0-10% based on damage level (see Stage 06)
- Trees terrain = higher fire spread risk
- Water terrain = natural firebreak (blocks spread)
- No refund when removing security
