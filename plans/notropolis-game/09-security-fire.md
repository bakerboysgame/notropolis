# Stage 09: Security & Fire Systems

## Objective

Implement building security purchases (cameras, dogs, guards, sprinklers). Fire spread and tick integration already exist from previous stages.

## Dependencies

`[Requires: Stage 05 complete]` - Needs buildings to secure.
`[Requires: Stage 06 complete]` - Needs tick system for costs and fire (already implements sprinkler logic in fireSpread.js).
`[Requires: Stage 08 complete]` - Needs attack system that security defends against (already reads building_security table).
`[Reference: REFERENCE-d1-optimization.md]` - Critical D1 batch patterns for performance.

## Complexity

**Low-Medium** - Security purchase system only. Fire spread and catch bonus already implemented.

## Already Implemented (No Changes Needed)

| File | What's Already Done |
|------|---------------------|
| `worker/src/tick/fireSpread.js` | Full sprinkler logic (60% extinguish, 5% damage, blocks spread) |
| `worker/src/routes/game/attacks.js` | Reads building_security, applies catch bonuses |
| `worker/src/tick/profitCalculator.js` | Deducts monthly security costs |
| `src/components/game/TileInfo.tsx` | Displays security status (cameras, dogs, guards, sprinklers) |

## Files to Modify

| File | Changes |
|------|---------|
| `authentication-dashboard-system/src/components/game/TileInfo.tsx` | Add "Security" button for owned buildings |
| `authentication-dashboard-system/worker/index.js` | Wire security routes |

## Files to Create

| File | Purpose |
|------|---------|
| `authentication-dashboard-system/src/components/game/SecurityModal.tsx` | Security purchase UI |
| `authentication-dashboard-system/worker/src/routes/game/security.js` | Security purchase/remove API |
| `authentication-dashboard-system/worker/src/routes/game/securityConstants.js` | Shared security definitions and cost calculations |

## Implementation Details

### Security Definitions

**Security costs are proportional to building value** - more valuable buildings require more expensive security.

```javascript
// Shared constants (in security.js)
// Costs are calculated as: buildingCost * costMultiplier (with minimum)
// Monthly cost is 10% of purchase cost
export const SECURITY_OPTIONS = {
  cameras: {
    id: 'cameras',
    name: 'Security Cameras',
    icon: '📷',
    costMultiplier: 0.10,  // 10% of building cost
    minCost: 500,
    catchBonus: 0.10,
    description: 'Record evidence of attackers. +10% catch rate.',
  },
  guard_dogs: {
    id: 'guard_dogs',
    name: 'Guard Dogs',
    icon: '🐕',
    costMultiplier: 0.15,  // 15% of building cost
    minCost: 750,
    catchBonus: 0.15,
    description: 'Dogs patrol the perimeter. +15% catch rate.',
  },
  security_guards: {
    id: 'security_guards',
    name: 'Security Guards',
    icon: '👮',
    costMultiplier: 0.25,  // 25% of building cost
    minCost: 1500,
    catchBonus: 0.25,
    description: '24/7 human security. +25% catch rate.',
  },
  sprinklers: {
    id: 'sprinklers',
    name: 'Fire Sprinklers',
    icon: '💦',
    costMultiplier: 0.20,  // 20% of building cost
    minCost: 1000,
    catchBonus: 0, // Doesn't help catch
    description: 'Automatic fire suppression. Prevents fire spread.',
  },
};

// Calculate purchase cost based on building value
export function calculateSecurityCost(option, buildingCost) {
  const cost = Math.max(option.minCost, Math.round(buildingCost * option.costMultiplier));
  return cost;
}

// Monthly cost is 10% of purchase cost
export function calculateMonthlyCost(purchaseCost) {
  return Math.round(purchaseCost * 0.10);
}

export function calculateSecurityCatchBonus(security) {
  if (!security) return 0;
  let bonus = 0;
  if (security.has_cameras) bonus += SECURITY_OPTIONS.cameras.catchBonus;
  if (security.has_guard_dogs) bonus += SECURITY_OPTIONS.guard_dogs.catchBonus;
  if (security.has_security_guards) bonus += SECURITY_OPTIONS.security_guards.catchBonus;
  return bonus;
}
```

**Example Costs by Building:**

| Building | Cost | Cameras | Dogs | Guards | Sprinklers |
|----------|------|---------|------|--------|------------|
| Market Stall | $1k | $500 | $750 | $1,500 | $1,000 |
| Shop | $4k | $500 | $750 | $1,500 | $1,000 |
| Motel | $12k | $1,200 | $1,800 | $3,000 | $2,400 |
| Restaurant | $40k | $4,000 | $6,000 | $10,000 | $8,000 |
| Casino | $80k | $8,000 | $12,000 | $20,000 | $16,000 |

### Security API

```javascript
// worker/src/routes/game/security.js
import { SECURITY_OPTIONS, calculateSecurityCost, calculateMonthlyCost } from './securityConstants.js';

export async function purchaseSecurity(request, env, company) {
  const { building_id, security_type } = await request.json();

  const option = SECURITY_OPTIONS[security_type];
  if (!option) throw new Error('Invalid security type');

  // Get building with its type info for cost calculation
  const building = await env.DB.prepare(`
    SELECT bi.*, bt.cost as building_cost
    FROM building_instances bi
    JOIN building_types bt ON bi.building_type_id = bt.id
    WHERE bi.id = ? AND bi.company_id = ?
  `).bind(building_id, company.id).first();

  if (!building) throw new Error('Building not found or not owned');
  if (building.is_collapsed) throw new Error('Cannot add security to collapsed building');

  // Calculate costs based on building value
  const purchaseCost = calculateSecurityCost(option, building.building_cost);
  const monthlyCost = calculateMonthlyCost(purchaseCost);

  // Check funds
  if (company.cash < purchaseCost) {
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
    const newTotalMonthlyCost = currentCost + monthlyCost;

    await env.DB.batch([
      // Update security
      env.DB.prepare(`
        UPDATE building_security
        SET ${column} = 1, monthly_cost = ?
        WHERE building_id = ?
      `).bind(newTotalMonthlyCost, building_id),

      // Deduct cost and reset tick counter
      env.DB.prepare(
        'UPDATE game_companies SET cash = cash - ?, total_actions = total_actions + 1, last_action_at = ?, ticks_since_action = 0 WHERE id = ?'
      ).bind(purchaseCost, new Date().toISOString(), company.id),

      // Log transaction
      env.DB.prepare(`
        INSERT INTO game_transactions (id, company_id, action_type, target_building_id, amount, details)
        VALUES (?, ?, 'security_purchase', ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        company.id,
        building_id,
        purchaseCost,
        JSON.stringify({ type: security_type, monthly_cost: monthlyCost })
      ),
    ]);
  } else {
    // Create new security record
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO building_security (id, building_id, ${column}, monthly_cost)
        VALUES (?, ?, 1, ?)
      `).bind(crypto.randomUUID(), building_id, monthlyCost),

      env.DB.prepare(
        'UPDATE game_companies SET cash = cash - ?, total_actions = total_actions + 1, last_action_at = ?, ticks_since_action = 0 WHERE id = ?'
      ).bind(purchaseCost, new Date().toISOString(), company.id),

      env.DB.prepare(`
        INSERT INTO game_transactions (id, company_id, action_type, target_building_id, amount, details)
        VALUES (?, ?, 'security_purchase', ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        company.id,
        building_id,
        purchaseCost,
        JSON.stringify({ type: security_type, monthly_cost: monthlyCost })
      ),
    ]);
  }

  return {
    success: true,
    security_type,
    purchase_cost: purchaseCost,
    monthly_cost: monthlyCost,
    building_cost: building.building_cost,
  };
}

export async function removeSecurity(request, env, company) {
  const { building_id, security_type } = await request.json();

  const option = SECURITY_OPTIONS[security_type];
  if (!option) throw new Error('Invalid security type');

  // Get building with cost info to calculate monthly cost reduction
  const building = await env.DB.prepare(`
    SELECT bi.*, bt.cost as building_cost
    FROM building_instances bi
    JOIN building_types bt ON bi.building_type_id = bt.id
    WHERE bi.id = ? AND bi.company_id = ?
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

  // Calculate the monthly cost that was added for this security type
  const purchaseCost = calculateSecurityCost(option, building.building_cost);
  const monthlyCostToRemove = calculateMonthlyCost(purchaseCost);
  const newCost = Math.max(0, (security.monthly_cost || 0) - monthlyCostToRemove);

  await env.DB.prepare(`
    UPDATE building_security
    SET ${column} = 0, monthly_cost = ?
    WHERE building_id = ?
  `).bind(newCost, building_id).run();

  return { success: true, monthly_cost_removed: monthlyCostToRemove };
}
```

### UI Components

```tsx
// SecurityModal.tsx
// Security cost calculations (mirror backend logic)
const SECURITY_OPTIONS = {
  cameras: { id: 'cameras', name: 'Security Cameras', icon: '📷', costMultiplier: 0.10, minCost: 500, catchBonus: 0.10, description: 'Record evidence of attackers. +10% catch rate.' },
  guard_dogs: { id: 'guard_dogs', name: 'Guard Dogs', icon: '🐕', costMultiplier: 0.15, minCost: 750, catchBonus: 0.15, description: 'Dogs patrol the perimeter. +15% catch rate.' },
  security_guards: { id: 'security_guards', name: 'Security Guards', icon: '👮', costMultiplier: 0.25, minCost: 1500, catchBonus: 0.25, description: '24/7 human security. +25% catch rate.' },
  sprinklers: { id: 'sprinklers', name: 'Fire Sprinklers', icon: '💦', costMultiplier: 0.20, minCost: 1000, catchBonus: 0, description: 'Automatic fire suppression. Prevents fire spread.' },
};

const calculateSecurityCost = (option, buildingCost) => Math.max(option.minCost, Math.round(buildingCost * option.costMultiplier));
const calculateMonthlyCost = (purchaseCost) => Math.round(purchaseCost * 0.10);

export function SecurityModal({ building, onClose }) {
  const { activeCompany, refreshCompany } = useActiveCompany();
  const [security, setSecurity] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch security on mount
  useEffect(() => {
    // Security data comes from tile detail API
  }, [building.id]);

  const handlePurchase = async (type) => {
    setLoading(true);
    try {
      await api.post('/api/game/security/purchase', {
        company_id: activeCompany.id,
        building_id: building.id,
        security_type: type,
      });
      await refreshCompany();
      // Refetch security state
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (type) => {
    setLoading(true);
    try {
      await api.post('/api/game/security/remove', {
        company_id: activeCompany.id,
        building_id: building.id,
        security_type: type,
      });
      // Refetch security state
    } finally {
      setLoading(false);
    }
  };

  const hasType = (type) => {
    if (!security) return false;
    const map = {
      cameras: security.has_cameras,
      guard_dogs: security.has_guard_dogs,
      security_guards: security.has_security_guards,
      sprinklers: security.has_sprinklers,
    };
    return map[type];
  };

  // Get building cost from building prop (need to pass this from TileInfo)
  const buildingCost = building.cost || 10000; // fallback

  return (
    <Modal onClose={onClose}>
      <h2 className="text-xl font-bold text-white mb-4">Building Security</h2>
      <p className="text-sm text-gray-400 mb-4">
        {building.name} (${buildingCost.toLocaleString()} value)
      </p>

      <div className="space-y-3">
        {Object.values(SECURITY_OPTIONS).map(option => {
          const purchaseCost = calculateSecurityCost(option, buildingCost);
          const monthlyCost = calculateMonthlyCost(purchaseCost);
          const owned = hasType(option.id);
          const canAfford = activeCompany.cash >= purchaseCost;

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
                    Monthly: ${monthlyCost.toLocaleString()} (~${Math.round(monthlyCost / 144)}/tick)
                  </p>
                </div>
                <div className="text-right">
                  {owned ? (
                    <button
                      onClick={() => handleRemove(option.id)}
                      disabled={loading}
                      className="text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      onClick={() => handlePurchase(option.id)}
                      disabled={!canAfford || loading}
                      className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
                    >
                      ${purchaseCost.toLocaleString()}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {security && security.monthly_cost > 0 && (
        <div className="mt-4 p-3 bg-gray-800 rounded">
          <p className="text-gray-400">Total Monthly Cost</p>
          <p className="text-xl text-yellow-400">
            ${security.monthly_cost.toLocaleString()}/month
          </p>
          <p className="text-sm text-gray-500">
            (~${Math.round(security.monthly_cost / 144)}/tick)
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

**Note:** SecurityStatus display is already implemented in TileInfo.tsx (lines 148-178).

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

### New Implementation (This Stage)
- [ ] Can purchase all 4 security types via API
- [ ] Cannot purchase duplicate security
- [ ] Can remove security via API
- [ ] Purchase cost deducted correctly
- [ ] Monthly cost calculated and stored in building_security
- [ ] Security button appears for owned buildings in TileInfo
- [ ] SecurityModal opens and shows all options

### Already Working (Verify Only)
- [x] Security bonus affects attack catch rate (attacks.js)
- [x] Sprinklers can extinguish fire 60% (fireSpread.js)
- [x] Sprinklers reduce fire damage rate (fireSpread.js)
- [x] Sprinklers block fire spread (fireSpread.js)
- [x] Trees increase fire spread chance (fireSpread.js)
- [x] Security status displayed on buildings (TileInfo.tsx)
- [x] Monthly costs deducted during tick (profitCalculator.js)

## Deployment

```bash
npm run build
CLOUDFLARE_API_TOKEN="..." CLOUDFLARE_ACCOUNT_ID="..." npx wrangler pages deploy ./dist --project-name=notropolis-dashboard
```

## Handoff Notes

### This Stage Implements:
- Security purchase/remove API endpoints
- SecurityModal UI component
- Security button in TileInfo for owned buildings

### Already Implemented (No Changes):
- Security is per-building, not per-company
- Monthly costs deducted during tick processing (profitCalculator.js line 56)
- Catch bonus stacks: cameras(10%) + dogs(15%) + guards(25%) = 50% (attacks.js)
- Sprinklers only affect fire, not catch rate
- Fire damage: 10%/tick without sprinklers, 5%/tick with (fireSpread.js)
- Sprinklers have 60% chance to extinguish per tick (fireSpread.js)
- **Damage Economics:** ANY damage change marks adjacent buildings dirty
- Trees terrain = higher fire spread risk (fireSpread.js)
- No refund when removing security
