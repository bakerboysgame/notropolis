# Stage 12: Hero System

## Objective

Implement the hero mechanic allowing players to cash out to offshore and progress to City/Capital.

## Dependencies

`[Requires: Stage 05 complete]` - Needs buildings to sell.
`[Requires: Stage 06 complete]` - Needs tick system for land ownership streak.
`[Requires: Stage 11 complete]` - Level resets on hero.

## Complexity

**High** - Core progression mechanic with multiple pathways and location unlocks.

## Files to Modify

| File | Changes |
|------|---------|
| `authentication-dashboard-system/src/pages/CompanyDashboard.tsx` | Add hero status/button |
| `authentication-dashboard-system/src/worker/tick/processor.ts` | Track land ownership streak |

## Files to Create

| File | Purpose |
|------|---------|
| `authentication-dashboard-system/src/components/game/HeroStatus.tsx` | Hero progress display |
| `authentication-dashboard-system/src/components/game/HeroModal.tsx` | Hero confirmation modal |
| `authentication-dashboard-system/src/pages/HeroSuccess.tsx` | Hero success celebration |
| `authentication-dashboard-system/src/pages/LocationSelect.tsx` | Choose next location |
| `authentication-dashboard-system/src/worker/routes/game/hero.ts` | Hero API |
| `authentication-dashboard-system/src/utils/heroRequirements.ts` | Hero calculations |

## Implementation Details

### Hero Requirements

```typescript
// utils/heroRequirements.ts
export const HERO_REQUIREMENTS = {
  town: {
    netWorth: 5_500_000,
    cash: 4_000_000,
    landPercentage: 6,
    landStreakTicks: 6, // 1 hour
    unlocks: 'city',
    startingCash: 1_000_000,
  },
  city: {
    netWorth: 50_000_000,
    cash: 40_000_000,
    landPercentage: 4,
    landStreakTicks: 6,
    unlocks: 'capital',
    startingCash: 5_000_000,
  },
  capital: {
    netWorth: 500_000_000,
    cash: 400_000_000,
    landPercentage: 3,
    landStreakTicks: 6,
    unlocks: null, // End game
    startingCash: 0, // N/A
  },
} as const;

export interface HeroProgress {
  canHero: boolean;
  qualifiedBy: 'net_worth' | 'cash' | 'land' | null;
  netWorth: { current: number; required: number; progress: number };
  cash: { current: number; required: number; progress: number };
  land: {
    currentPercentage: number;
    requiredPercentage: number;
    currentStreak: number;
    requiredStreak: number;
    progress: number;
  };
}

export function calculateHeroProgress(
  company: GameCompany,
  buildingsValue: number,
  totalTiles: number,
  ownedTiles: number,
  locationType: 'town' | 'city' | 'capital'
): HeroProgress {
  const requirements = HERO_REQUIREMENTS[locationType];

  const netWorth = company.cash + buildingsValue;
  const landPercentage = (ownedTiles / totalTiles) * 100;

  const netWorthMet = netWorth >= requirements.netWorth;
  const cashMet = company.cash >= requirements.cash;
  const landMet = landPercentage >= requirements.landPercentage &&
                  company.land_ownership_streak >= requirements.landStreakTicks;

  let qualifiedBy: 'net_worth' | 'cash' | 'land' | null = null;
  if (netWorthMet) qualifiedBy = 'net_worth';
  else if (cashMet) qualifiedBy = 'cash';
  else if (landMet) qualifiedBy = 'land';

  return {
    canHero: netWorthMet || cashMet || landMet,
    qualifiedBy,
    netWorth: {
      current: netWorth,
      required: requirements.netWorth,
      progress: Math.min(100, (netWorth / requirements.netWorth) * 100),
    },
    cash: {
      current: company.cash,
      required: requirements.cash,
      progress: Math.min(100, (company.cash / requirements.cash) * 100),
    },
    land: {
      currentPercentage: landPercentage,
      requiredPercentage: requirements.landPercentage,
      currentStreak: company.land_ownership_streak,
      requiredStreak: requirements.landStreakTicks,
      progress: Math.min(100, (landPercentage / requirements.landPercentage) * 100),
    },
  };
}
```

### Land Ownership Tracking (Tick Update)

```typescript
// worker/tick/processor.ts - Add to tick processing
async function updateLandOwnershipStreak(env: Env, company: any, map: any) {
  // Get tile counts
  const tileStats = await env.DB.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN owner_company_id = ? THEN 1 ELSE 0 END) as owned
    FROM tiles
    WHERE map_id = ?
      AND terrain_type = 'free_land'
  `).bind(company.id, company.current_map_id).first();

  const totalFreeLand = tileStats.total;
  const ownedLand = tileStats.owned;
  const percentage = (ownedLand / totalFreeLand) * 100;

  const requirements = HERO_REQUIREMENTS[company.location_type];
  const meetsThreshold = percentage >= requirements.landPercentage;

  if (meetsThreshold) {
    // Increment streak
    await env.DB.prepare(`
      UPDATE game_companies
      SET land_ownership_streak = land_ownership_streak + 1,
          land_percentage = ?
      WHERE id = ?
    `).bind(percentage, company.id).run();
  } else {
    // Reset streak
    await env.DB.prepare(`
      UPDATE game_companies
      SET land_ownership_streak = 0,
          land_percentage = ?
      WHERE id = ?
    `).bind(percentage, company.id).run();
  }
}
```

### Hero API

```typescript
// worker/routes/game/hero.ts
export async function heroOut(request: Request, env: Env, company: GameCompany) {
  requireNotInPrison(company);

  // Get map info
  const map = await env.DB.prepare(
    'SELECT * FROM maps WHERE id = ?'
  ).bind(company.current_map_id).first();

  // Calculate buildings value
  const buildingsValue = await env.DB.prepare(`
    SELECT COALESCE(SUM(bt.cost), 0) as total
    FROM building_instances bi
    JOIN building_types bt ON bi.building_type_id = bt.id
    WHERE bi.company_id = ? AND bi.is_collapsed = 0
  `).bind(company.id).first();

  // Get tile counts
  const tileStats = await env.DB.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN owner_company_id = ? THEN 1 ELSE 0 END) as owned
    FROM tiles WHERE map_id = ? AND terrain_type = 'free_land'
  `).bind(company.id, map.id).first();

  // Check hero progress
  const progress = calculateHeroProgress(
    company,
    buildingsValue.total,
    tileStats.total,
    tileStats.owned,
    map.location_type
  );

  if (!progress.canHero) {
    throw new Error('Hero requirements not met');
  }

  // Calculate total value to offshore
  // Sell all buildings at 50% value + cash
  const buildingSaleValue = Math.round(buildingsValue.total * 0.5);
  const totalToOffshore = company.cash + buildingSaleValue;

  // Determine unlocked location type
  const requirements = HERO_REQUIREMENTS[map.location_type];
  const unlocksLocationType = requirements.unlocks;

  await env.DB.batch([
    // Delete all buildings
    env.DB.prepare(`
      DELETE FROM building_instances WHERE company_id = ?
    `).bind(company.id),

    // Delete all security
    env.DB.prepare(`
      DELETE FROM building_security WHERE building_id IN (
        SELECT id FROM building_instances WHERE company_id = ?
      )
    `).bind(company.id),

    // Clear all tile ownership
    env.DB.prepare(`
      UPDATE tiles SET owner_company_id = NULL, purchased_at = NULL
      WHERE owner_company_id = ?
    `).bind(company.id),

    // Update company: add to offshore, reset everything
    // NOTE: ticks_since_action = 0 here is a RESET for starting fresh, not a tick reward
    env.DB.prepare(`
      UPDATE game_companies SET
        offshore = offshore + ?,
        cash = 0,
        level = 1,
        total_actions = 0,
        current_map_id = NULL,
        location_type = NULL,
        ticks_since_action = 0,
        land_ownership_streak = 0,
        land_percentage = 0,
        last_action_at = ?
      WHERE id = ?
    `).bind(totalToOffshore, new Date().toISOString(), company.id),

    // Log transaction
    env.DB.prepare(`
      INSERT INTO game_transactions (id, company_id, map_id, action_type, amount, details)
      VALUES (?, ?, ?, 'hero_out', ?, ?)
    `).bind(
      crypto.randomUUID(),
      company.id,
      map.id,
      totalToOffshore,
      JSON.stringify({
        location_type: map.location_type,
        qualified_by: progress.qualifiedBy,
        buildings_sold: buildingSaleValue,
        cash_added: company.cash,
        unlocks: unlocksLocationType,
      })
    ),
  ]);

  return {
    success: true,
    offshore_added: totalToOffshore,
    total_offshore: company.offshore + totalToOffshore,
    unlocks_location_type: unlocksLocationType,
    qualified_by: progress.qualifiedBy,
  };
}

export async function joinNewLocation(request: Request, env: Env, company: GameCompany) {
  const { map_id } = await request.json();

  // Verify company has no current location
  if (company.current_map_id) {
    throw new Error('Company already has a location. Hero out first.');
  }

  // Get map
  const map = await env.DB.prepare(
    'SELECT * FROM maps WHERE id = ? AND is_active = 1'
  ).bind(map_id).first();

  if (!map) throw new Error('Map not found');

  // Check if company has unlocked this location type
  const hasHeroedTown = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM game_transactions
    WHERE company_id = ? AND action_type = 'hero_out'
    AND details LIKE '%"location_type":"town"%'
  `).bind(company.id).first();

  const hasHeroedCity = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM game_transactions
    WHERE company_id = ? AND action_type = 'hero_out'
    AND details LIKE '%"location_type":"city"%'
  `).bind(company.id).first();

  if (map.location_type === 'city' && hasHeroedTown.count === 0) {
    throw new Error('Must hero a town first to unlock cities');
  }

  if (map.location_type === 'capital' && hasHeroedCity.count === 0) {
    throw new Error('Must hero a city first to unlock capitals');
  }

  // Determine starting cash
  const startingCash = {
    town: 50_000,
    city: 1_000_000,
    capital: 5_000_000,
  }[map.location_type];

  // NOTE: ticks_since_action = 0 here is a RESET for starting fresh on new map
  await env.DB.prepare(`
    UPDATE game_companies SET
      current_map_id = ?,
      location_type = ?,
      cash = ?,
      level = 1,
      total_actions = 0,
      ticks_since_action = 0,
      land_ownership_streak = 0,
      land_percentage = 0
    WHERE id = ?
  `).bind(map_id, map.location_type, startingCash, company.id).run();

  return {
    success: true,
    map_id,
    location_type: map.location_type,
    starting_cash: startingCash,
  };
}
```

### Hero Status Component

```tsx
// components/game/HeroStatus.tsx
export function HeroStatus() {
  const { activeCompany } = useCompany();
  const { data: heroProgress, isLoading } = useHeroProgress(activeCompany?.id);

  if (isLoading || !heroProgress) return null;

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-white">Hero Progress</h3>
        {heroProgress.canHero && (
          <span className="px-2 py-1 bg-yellow-600 text-yellow-100 text-xs rounded">
            Ready!
          </span>
        )}
      </div>

      {/* Net Worth Path */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-400">Net Worth</span>
          <span className={heroProgress.netWorth.progress >= 100 ? 'text-green-400' : 'text-gray-400'}>
            ${heroProgress.netWorth.current.toLocaleString()} / ${heroProgress.netWorth.required.toLocaleString()}
          </span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full">
          <div
            className={`h-full rounded-full ${heroProgress.netWorth.progress >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
            style={{ width: `${heroProgress.netWorth.progress}%` }}
          />
        </div>
      </div>

      {/* Cash Path */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-400">Cash Only</span>
          <span className={heroProgress.cash.progress >= 100 ? 'text-green-400' : 'text-gray-400'}>
            ${heroProgress.cash.current.toLocaleString()} / ${heroProgress.cash.required.toLocaleString()}
          </span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full">
          <div
            className={`h-full rounded-full ${heroProgress.cash.progress >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
            style={{ width: `${heroProgress.cash.progress}%` }}
          />
        </div>
      </div>

      {/* Land Path */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-400">Land Ownership</span>
          <span className="text-gray-400">
            {heroProgress.land.currentPercentage.toFixed(1)}% / {heroProgress.land.requiredPercentage}%
          </span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full">
          <div
            className="h-full rounded-full bg-blue-500"
            style={{ width: `${heroProgress.land.progress}%` }}
          />
        </div>
        {heroProgress.land.currentPercentage >= heroProgress.land.requiredPercentage && (
          <p className="text-xs text-gray-500 mt-1">
            Streak: {heroProgress.land.currentStreak} / {heroProgress.land.requiredStreak} ticks
          </p>
        )}
      </div>

      {heroProgress.canHero && (
        <HeroButton qualifiedBy={heroProgress.qualifiedBy} />
      )}
    </div>
  );
}
```

### Hero Modal

```tsx
// components/game/HeroModal.tsx
export function HeroModal({ progress, onConfirm, onClose }) {
  const { activeCompany } = useCompany();
  const { data: summary } = useHeroSummary(activeCompany?.id);

  return (
    <Modal onClose={onClose} size="lg">
      <div className="text-center mb-6">
        <div className="text-6xl mb-4">🏆</div>
        <h2 className="text-2xl font-bold text-yellow-400">Hero Out!</h2>
        <p className="text-gray-400 mt-2">
          Qualified by: {progress.qualifiedBy.replace('_', ' ')}
        </p>
      </div>

      <div className="bg-gray-700 rounded-lg p-4 mb-6">
        <h3 className="font-bold text-white mb-3">Summary</h3>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Current Cash</span>
            <span className="text-green-400">${activeCompany.cash.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Buildings Value (50%)</span>
            <span className="text-green-400">+${summary?.buildingSaleValue.toLocaleString()}</span>
          </div>
          <div className="border-t border-gray-600 my-2" />
          <div className="flex justify-between font-bold">
            <span className="text-white">To Offshore</span>
            <span className="text-yellow-400">${summary?.totalToOffshore.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4 mb-6">
        <p className="text-yellow-300 font-bold mb-2">Warning</p>
        <ul className="text-sm text-yellow-200 space-y-1">
          <li>• All buildings will be sold</li>
          <li>• All land ownership will be released</li>
          <li>• You will start at Level 1 in the next location</li>
          <li>• This cannot be undone</li>
        </ul>
      </div>

      <div className="flex gap-4">
        <button
          onClick={onClose}
          className="flex-1 py-3 bg-gray-600 text-white rounded-lg"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 py-3 bg-yellow-600 text-white font-bold rounded-lg hover:bg-yellow-700"
        >
          Hero Out!
        </button>
      </div>
    </Modal>
  );
}
```

## Database Changes

Uses existing columns: `offshore`, `land_ownership_streak`, `land_percentage`.

## Test Cases

| Test | Input | Expected Output |
|------|-------|-----------------|
| Hero by net worth | 5.5M net worth | Can hero, offshore += value |
| Hero by cash | 4M cash | Can hero, offshore += cash |
| Hero by land | 6% land for 6 ticks | Can hero |
| Land streak reset | Drop below 6% | Streak resets to 0 |
| Land streak increment | Stay above 6% | Streak += 1 per tick |
| Not qualified | None met | Cannot hero |
| Hero resets level | After hero | Level = 1 |
| Hero resets actions | After hero | Actions = 0 |
| Unlock city | Hero town | City locations available |
| Unlock capital | Hero city | Capital locations available |
| Join city first time | Haven't heroed town | Error: must hero town first |

## Acceptance Checklist

- [ ] Hero progress calculated correctly
- [ ] Three hero paths work (net worth, cash, land)
- [ ] Land ownership streak tracked per tick
- [ ] Land streak resets if below threshold
- [ ] Hero sells all buildings at 50%
- [ ] Hero adds to offshore
- [ ] Hero resets cash to 0
- [ ] Hero resets level to 1
- [ ] Hero clears map assignment
- [ ] Can join new location after hero
- [ ] City locked until town heroed
- [ ] Capital locked until city heroed
- [ ] Starting cash correct per location type

## Deployment

```bash
npm run build
CLOUDFLARE_API_TOKEN="..." CLOUDFLARE_ACCOUNT_ID="..." npx wrangler pages deploy ./dist --project-name=notropolis-dashboard
```

## Handoff Notes

- Hero is the core progression loop
- Offshore is permanent - never decreases (except buying company slots)
- Three paths provide flexibility: save cash, build empire, or dominate territory
- Land path requires holding 6%+ for 6 consecutive ticks (1 hour)
- Location unlock is per-company (each company tracks separately)
- Consider adding hero notifications/leaderboard in future
- Consider adding hero badges/trophies [See: Stage 17]
