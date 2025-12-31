# Stage 08: Dirty Tricks

## Objective

Implement the PvP attack system including graffiti, bombs, and police catch mechanics.

## Dependencies

`[Requires: Stage 05 complete]` - Needs buildings to attack.
`[Requires: Stage 06 complete]` - Needs tick system for fire spread.
`[Reference: REFERENCE-d1-optimization.md]` - Critical D1 batch patterns for performance.

## Complexity

**High** - Core PvP mechanic with randomness, police system, damage calculation.

## Files to Modify

| File | Changes |
|------|---------|
| `authentication-dashboard-system/src/components/game/TileInfo.tsx` | Add attack button |

## Files to Create

| File | Purpose |
|------|---------|
| `authentication-dashboard-system/src/components/game/AttackModal.tsx` | Attack selection UI |
| `authentication-dashboard-system/src/components/game/AttackResult.tsx` | Result display |
| `authentication-dashboard-system/src/pages/AttackLog.tsx` | Attack history |
| `authentication-dashboard-system/worker/src/routes/game/attacks.js` | Attack API |
| `authentication-dashboard-system/migrations/0017_create_attacks_table.sql` | Attack log table |

## Implementation Details

### Database Migration

```sql
-- 0017_create_attacks_table.sql
CREATE TABLE attacks (
  id TEXT PRIMARY KEY,
  attacker_company_id TEXT NOT NULL,
  target_company_id TEXT NOT NULL,
  target_building_id TEXT NOT NULL,
  map_id TEXT NOT NULL,

  trick_type TEXT NOT NULL,
  -- Types: graffiti, smoke_bomb, stink_bomb, cluster_bomb, fire_bomb, destruction_bomb

  damage_dealt INTEGER NOT NULL,
  was_caught INTEGER DEFAULT 0,
  caught_by TEXT, -- 'police' or 'security'
  fine_amount INTEGER DEFAULT 0,

  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (attacker_company_id) REFERENCES game_companies(id),
  FOREIGN KEY (target_company_id) REFERENCES game_companies(id),
  FOREIGN KEY (target_building_id) REFERENCES building_instances(id),
  FOREIGN KEY (map_id) REFERENCES maps(id)
);

CREATE INDEX idx_attacks_attacker ON attacks(attacker_company_id);
CREATE INDEX idx_attacks_target ON attacks(target_company_id);
CREATE INDEX idx_attacks_time ON attacks(created_at);
```

### Trick Definitions

```typescript
// utils/dirtyTricks.ts
export const DIRTY_TRICKS = {
  graffiti: {
    id: 'graffiti',
    name: 'Graffiti',
    cost: 500,
    baseDamage: 5,
    policeCatchRate: 0.10,
    securityCatchRate: 0.15,
    levelRequired: 1,
    description: 'Spray paint on the building. Minor damage.',
  },
  smoke_bomb: {
    id: 'smoke_bomb',
    name: 'Smoke Bomb',
    cost: 1000,
    baseDamage: 10,
    policeCatchRate: 0.15,
    securityCatchRate: 0.20,
    levelRequired: 1,
    description: 'Smoke damage to the building.',
  },
  stink_bomb: {
    id: 'stink_bomb',
    name: 'Stink Bomb',
    cost: 2000,
    baseDamage: 15,
    policeCatchRate: 0.20,
    securityCatchRate: 0.25,
    levelRequired: 2,
    description: 'Lingering smell reduces business.',
  },
  cluster_bomb: {
    id: 'cluster_bomb',
    name: 'Cluster Bomb',
    cost: 5000,
    baseDamage: 25,
    policeCatchRate: 0.30,
    securityCatchRate: 0.35,
    levelRequired: 3,
    description: 'Multiple small explosions.',
  },
  fire_bomb: {
    id: 'fire_bomb',
    name: 'Fire Bomb',
    cost: 10000,
    baseDamage: 40,
    policeCatchRate: 0.40,
    securityCatchRate: 0.45,
    levelRequired: 4,
    setsFire: true,
    description: 'Sets the building on fire. Can spread.',
  },
  destruction_bomb: {
    id: 'destruction_bomb',
    name: 'Destruction Bomb',
    cost: 25000,
    baseDamage: 60,
    policeCatchRate: 0.50,
    securityCatchRate: 0.55,
    levelRequired: 5,
    description: 'Massive damage. High risk.',
  },
} as const;

export type TrickType = keyof typeof DIRTY_TRICKS;
```

### Fine Calculation

```typescript
export function calculateFine(trickType: TrickType, map: GameMap): number {
  const trick = DIRTY_TRICKS[trickType];

  // Base fine: 3x the trick cost
  let fine = trick.cost * 3;

  // Location multiplier
  const locationMultipliers = {
    town: 1.0,
    city: 1.5,
    capital: 2.0,
  };
  fine *= locationMultipliers[map.location_type];

  return Math.round(fine);
}
```

### Police Strike Check

```typescript
export function isPoliceStrike(map: GameMap): boolean {
  const today = new Date().getDay(); // 0 = Sunday, 6 = Saturday
  return map.police_strike_day === today;
}
```

### Attack API

```typescript
// worker/routes/game/attacks.ts
export async function performAttack(request: Request, env: Env, company: GameCompany) {
  const { building_id, trick_type } = await request.json();

  // Validate trick type
  const trick = DIRTY_TRICKS[trick_type];
  if (!trick) throw new Error('Invalid trick type');

  // Check level requirement
  if (company.level < trick.levelRequired) {
    throw new Error(`Requires level ${trick.levelRequired}`);
  }

  // Check if in prison
  if (company.is_in_prison) {
    throw new Error('Cannot attack while in prison');
  }

  // Check funds
  if (company.cash < trick.cost) {
    throw new Error('Insufficient funds');
  }

  // Get target building
  const building = await env.DB.prepare(`
    SELECT bi.*, t.map_id
    FROM building_instances bi
    JOIN tiles t ON bi.tile_id = t.id
    WHERE bi.id = ?
  `).bind(building_id).first();

  if (!building) throw new Error('Building not found');
  if (building.company_id === company.id) throw new Error('Cannot attack your own building');
  if (building.is_collapsed) throw new Error('Building already collapsed');

  // Verify same map
  if (building.map_id !== company.current_map_id) {
    throw new Error('Building is not in your location');
  }

  const map = await env.DB.prepare(
    'SELECT * FROM maps WHERE id = ?'
  ).bind(building.map_id).first();

  // Get security status
  const security = await env.DB.prepare(
    'SELECT * FROM building_security WHERE building_id = ?'
  ).bind(building_id).first();

  // Calculate catch chances
  const policeActive = !isPoliceStrike(map);
  let caughtBy: string | null = null;
  let wasCaught = false;

  // Security check first (always active)
  if (security) {
    let securityBonus = 0;
    if (security.has_cameras) securityBonus += 0.10;
    if (security.has_guard_dogs) securityBonus += 0.15;
    if (security.has_security_guards) securityBonus += 0.25;

    const totalSecurityRate = trick.securityCatchRate + securityBonus;

    if (Math.random() < totalSecurityRate) {
      wasCaught = true;
      caughtBy = 'security';
    }
  }

  // Police check (if not already caught by security and police not on strike)
  if (!wasCaught && policeActive) {
    if (Math.random() < trick.policeCatchRate) {
      wasCaught = true;
      caughtBy = 'police';
    }
  }

  // Calculate fine
  const fineAmount = wasCaught ? calculateFine(trick_type, map) : 0;

  // Apply damage (even if caught, damage still happens)
  const newDamage = Math.min(100, building.damage_percent + trick.baseDamage);
  const isNowCollapsed = newDamage >= 100;

  // Handle fire
  const setsFire = trick.setsFire && !isNowCollapsed;

  // Begin transaction
  const updates = [
    // Deduct trick cost and reset tick counter
    env.DB.prepare(
      'UPDATE game_companies SET cash = cash - ?, total_actions = total_actions + 1, last_action_at = ?, ticks_since_action = 0 WHERE id = ?'
    ).bind(trick.cost, new Date().toISOString(), company.id),

    // Apply damage
    env.DB.prepare(`
      UPDATE building_instances
      SET damage_percent = ?,
          is_collapsed = ?,
          is_on_fire = CASE WHEN ? THEN 1 ELSE is_on_fire END
      WHERE id = ?
    `).bind(newDamage, isNowCollapsed ? 1 : 0, setsFire, building_id),

    // Log attack
    env.DB.prepare(`
      INSERT INTO attacks
      (id, attacker_company_id, target_company_id, target_building_id, map_id, trick_type, damage_dealt, was_caught, caught_by, fine_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      company.id,
      building.company_id,
      building_id,
      map.id,
      trick_type,
      trick.baseDamage,
      wasCaught ? 1 : 0,
      caughtBy,
      fineAmount
    ),

    // Log transaction
    env.DB.prepare(`
      INSERT INTO game_transactions
      (id, company_id, map_id, action_type, target_building_id, target_company_id, amount, details)
      VALUES (?, ?, ?, 'dirty_trick', ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      company.id,
      map.id,
      building_id,
      building.company_id,
      trick.cost,
      JSON.stringify({ trick_type, damage: trick.baseDamage, caught: wasCaught })
    ),
  ];

  // If caught, put in prison
  if (wasCaught) {
    updates.push(
      env.DB.prepare(
        'UPDATE game_companies SET is_in_prison = 1, prison_fine = ? WHERE id = ?'
      ).bind(fineAmount, company.id)
    );
  }

  await env.DB.batch(updates);

  // Mark affected buildings for profit recalculation
  // ANY damage change affects neighbor profits (graduated penalty: 0-10% based on damage)
  if (newDamage !== building.damage_percent) {
    // Get tile coordinates for dirty tracking
    const tile = await env.DB.prepare(
      'SELECT x, y FROM tiles WHERE id = ?'
    ).bind(building.tile_id).first();

    await markAffectedBuildingsDirty(env, tile.x, tile.y, building.map_id);
  }

  return {
    success: true,
    damage_dealt: trick.baseDamage,
    new_damage_percent: newDamage,
    building_collapsed: isNowCollapsed,
    set_fire: setsFire,
    was_caught: wasCaught,
    caught_by: caughtBy,
    fine_amount: fineAmount,
    police_active: policeActive,
  };
}
```

### Pay Fine (Get Out of Prison)

```typescript
export async function payFine(request: Request, env: Env, company: GameCompany) {
  if (!company.is_in_prison) {
    throw new Error('You are not in prison');
  }

  if (company.cash < company.prison_fine) {
    throw new Error('Insufficient funds to pay fine');
  }

  await env.DB.batch([
    // Deduct fine (NOTE: Does NOT reset ticks_since_action - this is a penalty/recovery action)
    env.DB.prepare(
      'UPDATE game_companies SET cash = cash - ?, is_in_prison = 0, prison_fine = 0 WHERE id = ?'
    ).bind(company.prison_fine, company.id),

    // Log transaction
    env.DB.prepare(`
      INSERT INTO game_transactions (id, company_id, action_type, amount)
      VALUES (?, ?, 'pay_fine', ?)
    `).bind(crypto.randomUUID(), company.id, company.prison_fine),
  ]);

  return { success: true, fine_paid: company.prison_fine };
}
```

### UI Components

```tsx
// AttackModal.tsx
export function AttackModal({ building, buildingType, onClose }) {
  const { activeCompany } = useCompany();
  const [selectedTrick, setSelectedTrick] = useState<TrickType | null>(null);
  const [result, setResult] = useState<AttackResult | null>(null);
  const { map } = useCurrentMap();

  const isPoliceStrikeDay = isPoliceStrike(map);

  const availableTricks = Object.values(DIRTY_TRICKS).filter(
    trick => trick.levelRequired <= activeCompany.level
  );

  const handleAttack = async () => {
    if (!selectedTrick) return;
    const result = await api.attacks.perform(building.id, selectedTrick);
    setResult(result);
  };

  if (result) {
    return (
      <Modal onClose={onClose}>
        <AttackResult result={result} trick={DIRTY_TRICKS[selectedTrick!]} onClose={onClose} />
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} size="lg">
      <h2 className="text-xl font-bold text-white mb-2">Attack {buildingType.name}</h2>
      <p className="text-gray-400 mb-4">Current damage: {building.damage_percent}%</p>

      {isPoliceStrikeDay && (
        <div className="mb-4 p-3 bg-yellow-900/30 rounded border border-yellow-600">
          <p className="text-yellow-400 font-bold">🚨 Police Strike Day!</p>
          <p className="text-sm text-yellow-300">Police are not patrolling. Lower catch risk.</p>
        </div>
      )}

      <div className="space-y-2 mb-6">
        {availableTricks.map(trick => {
          const canAfford = activeCompany.cash >= trick.cost;
          const isSelected = selectedTrick === trick.id;

          return (
            <div
              key={trick.id}
              onClick={() => canAfford && setSelectedTrick(trick.id)}
              className={`p-4 rounded-lg cursor-pointer transition ${
                !canAfford ? 'opacity-50 cursor-not-allowed bg-gray-800' :
                isSelected ? 'bg-red-600 ring-2 ring-red-400' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-white">{trick.name}</p>
                  <p className="text-sm text-gray-400">{trick.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-yellow-400">${trick.cost.toLocaleString()}</p>
                  <p className="text-sm text-red-400">+{trick.baseDamage}% damage</p>
                </div>
              </div>
              <div className="mt-2 flex gap-4 text-xs text-gray-500">
                <span>Police risk: {Math.round(trick.policeCatchRate * 100)}%</span>
                <span>Security risk: {Math.round(trick.securityCatchRate * 100)}%</span>
                {trick.setsFire && <span className="text-orange-400">🔥 Sets fire</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-4">
        <button onClick={onClose} className="flex-1 py-2 bg-gray-600 text-white rounded">
          Cancel
        </button>
        <button
          onClick={handleAttack}
          disabled={!selectedTrick}
          className="flex-1 py-2 bg-red-600 text-white rounded disabled:opacity-50"
        >
          Attack
        </button>
      </div>
    </Modal>
  );
}
```

```tsx
// AttackResult.tsx
export function AttackResult({ result, trick, onClose }) {
  return (
    <div className="text-center">
      {result.was_caught ? (
        <>
          <div className="text-6xl mb-4">🚔</div>
          <h2 className="text-2xl font-bold text-red-400 mb-2">Caught!</h2>
          <p className="text-gray-300 mb-4">
            You were caught by {result.caught_by === 'police' ? 'the police' : 'security guards'}!
          </p>
          <div className="bg-gray-700 p-4 rounded mb-4">
            <p className="text-gray-400">Damage dealt</p>
            <p className="text-xl text-red-400">+{result.damage_dealt}%</p>
            <p className="text-gray-400 mt-2">Fine</p>
            <p className="text-xl text-yellow-400">${result.fine_amount.toLocaleString()}</p>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            You are now in prison. Pay the fine to continue playing.
          </p>
        </>
      ) : (
        <>
          <div className="text-6xl mb-4">💥</div>
          <h2 className="text-2xl font-bold text-green-400 mb-2">Success!</h2>
          <p className="text-gray-300 mb-4">
            Your {trick.name.toLowerCase()} was successful!
          </p>
          <div className="bg-gray-700 p-4 rounded mb-4">
            <p className="text-gray-400">Damage dealt</p>
            <p className="text-xl text-red-400">+{result.damage_dealt}%</p>
            <p className="text-gray-400 mt-2">New damage level</p>
            <p className="text-xl text-orange-400">{result.new_damage_percent}%</p>
            {result.set_fire && (
              <p className="text-orange-500 mt-2">🔥 Building is on fire!</p>
            )}
            {result.building_collapsed && (
              <p className="text-red-500 mt-2">💀 Building collapsed!</p>
            )}
          </div>
        </>
      )}

      <button
        onClick={onClose}
        className="w-full py-2 bg-gray-600 text-white rounded"
      >
        Close
      </button>
    </div>
  );
}
```

```tsx
// PrisonStatus.tsx (for company dashboard)
export function PrisonStatus() {
  const { activeCompany, refreshCompany } = useCompany();

  if (!activeCompany.is_in_prison) return null;

  const handlePayFine = async () => {
    await api.attacks.payFine();
    await refreshCompany();
  };

  const canAfford = activeCompany.cash >= activeCompany.prison_fine;

  return (
    <div className="bg-red-900/50 border border-red-600 rounded-lg p-6 mb-6">
      <div className="flex items-center gap-4">
        <span className="text-4xl">🚔</span>
        <div>
          <h3 className="text-xl font-bold text-red-400">In Prison</h3>
          <p className="text-gray-300">You cannot perform any actions until you pay your fine.</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div>
          <p className="text-gray-400">Fine Amount</p>
          <p className="text-2xl font-bold text-yellow-400">
            ${activeCompany.prison_fine.toLocaleString()}
          </p>
        </div>
        <button
          onClick={handlePayFine}
          disabled={!canAfford}
          className="px-6 py-3 bg-green-600 text-white rounded-lg disabled:opacity-50"
        >
          {canAfford ? 'Pay Fine & Get Out' : 'Insufficient Funds'}
        </button>
      </div>
    </div>
  );
}
```

## Database Changes

- New `attacks` table for attack history

## Test Cases

| Test | Input | Expected Output |
|------|-------|-----------------|
| Basic attack | Graffiti on building | 5% damage applied |
| Fire bomb | Fire bomb on building | 40% damage + fire status |
| Level restriction | Level 1 tries destruction bomb | Error: requires level 5 |
| Insufficient funds | Attack without money | Error: insufficient funds |
| Attack own building | Target own building | Error: cannot attack own |
| Police catch | Random roll succeeds | Prison + fine |
| Police strike day | Attack on strike day | No police catch possible |
| Security catch | Building has guards | Higher catch chance |
| Pay fine | Sufficient funds | Released from prison |
| Building collapse | 100% damage reached | Building marked collapsed |

## Acceptance Checklist

- [ ] All 6 trick types implemented
- [ ] Level requirements enforced
- [ ] Costs deducted correctly
- [ ] Damage applied correctly
- [ ] Fire status set by fire bomb
- [ ] Police catch mechanic works
- [ ] Police strike day disables police
- [ ] Security increases catch chance
- [ ] Prison status blocks actions
- [ ] Fine payment releases from prison
- [ ] Building collapse at 100%
- [ ] Attack history logged

## Deployment

```bash
# Run migration
CLOUDFLARE_API_TOKEN="..." npx wrangler d1 execute notropolis-database --file=migrations/0017_create_attacks_table.sql --remote

# Build and deploy
npm run build
CLOUDFLARE_API_TOKEN="..." CLOUDFLARE_ACCOUNT_ID="..." npx wrangler pages deploy ./dist --project-name=notropolis-dashboard
```

## Handoff Notes

- Damage is applied even if attacker is caught
- Fire spreads during tick processing [See: Stage 06]
- Security stacks: cameras + dogs + guards = high catch rate
- Police strike day is per-map (stored in map settings)
- Fine = 3x trick cost × location multiplier
- Prison blocks ALL actions until fine paid
- Consider adding attack notifications in future
- **Dirty Tracking:** Call `markAffectedBuildingsDirty()` on ANY damage change (graduated neighbor penalty 0-10%)
- **Damage Economics:** 85% damage (15% health) = $0 profit, then goes negative
- **Neighbor Penalty:** Scales with damage level (10% damage = -1% penalty, 100% damage = -10% penalty)
- See [REFERENCE-d1-optimization.md](REFERENCE-d1-optimization.md) for batch patterns
