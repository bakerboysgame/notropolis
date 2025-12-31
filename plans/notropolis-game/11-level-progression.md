# Stage 11: Level Progression

## Objective

Implement the level system with cash and action thresholds that unlock buildings and tricks.

## Dependencies

`[Requires: Stage 05 complete]` - Needs action counting from purchases.
`[Requires: Stage 08 complete]` - Needs attack action counting.

## Complexity

**Low** - Threshold checking and UI updates.

## Files to Modify

| File | Changes |
|------|---------|
| `authentication-dashboard-system/src/components/game/BuildModal.tsx` | Show level-locked buildings |
| `authentication-dashboard-system/src/components/game/AttackModal.tsx` | Show level-locked tricks |
| `authentication-dashboard-system/src/pages/CompanyDashboard.tsx` | Show level progress |

## Files to Create

| File | Purpose |
|------|---------|
| `authentication-dashboard-system/src/components/game/LevelProgress.tsx` | Level progress display |
| `authentication-dashboard-system/src/components/game/LevelUpModal.tsx` | Level up celebration |
| `authentication-dashboard-system/src/utils/levels.ts` | Level definitions and calculations |
| `authentication-dashboard-system/src/worker/routes/game/levels.ts` | Level check API |

## Implementation Details

### Level Definitions

```typescript
// utils/levels.ts
export const LEVELS = [
  { level: 1, cash: 0, actions: 0 },
  { level: 2, cash: 50_000, actions: 50 },
  { level: 3, cash: 1_000_000, actions: 300 },
  { level: 4, cash: 5_000_000, actions: 1_000 },
  { level: 5, cash: 25_000_000, actions: 5_000 },
] as const;

export interface LevelRequirement {
  level: number;
  cash: number;
  actions: number;
}

export function getCurrentLevel(cash: number, actions: number): number {
  let currentLevel = 1;

  for (const level of LEVELS) {
    if (cash >= level.cash && actions >= level.actions) {
      currentLevel = level.level;
    } else {
      break;
    }
  }

  return currentLevel;
}

export function getNextLevelRequirements(currentLevel: number): LevelRequirement | null {
  const nextLevel = LEVELS.find(l => l.level === currentLevel + 1);
  return nextLevel || null;
}

export function getLevelProgress(
  currentLevel: number,
  cash: number,
  actions: number
): { cashProgress: number; actionsProgress: number } {
  const next = getNextLevelRequirements(currentLevel);

  if (!next) {
    return { cashProgress: 100, actionsProgress: 100 }; // Max level
  }

  const current = LEVELS.find(l => l.level === currentLevel)!;

  const cashRange = next.cash - current.cash;
  const cashProgress = Math.min(100, ((cash - current.cash) / cashRange) * 100);

  const actionsRange = next.actions - current.actions;
  const actionsProgress = Math.min(100, ((actions - current.actions) / actionsRange) * 100);

  return {
    cashProgress: Math.max(0, cashProgress),
    actionsProgress: Math.max(0, actionsProgress),
  };
}

export function getUnlocksAtLevel(level: number): {
  buildings: string[];
  tricks: string[];
} {
  const buildings = Object.values(BUILDING_TYPES)
    .filter(b => b.level_required === level)
    .map(b => b.name);

  const tricks = Object.values(DIRTY_TRICKS)
    .filter(t => t.levelRequired === level)
    .map(t => t.name);

  return { buildings, tricks };
}
```

### Level Check on Actions

```typescript
// worker/routes/game/levels.ts
export async function checkAndUpdateLevel(env: Env, company: GameCompany): Promise<{
  leveledUp: boolean;
  newLevel: number;
  unlocks: { buildings: string[]; tricks: string[] };
}> {
  const calculatedLevel = getCurrentLevel(company.cash, company.total_actions);

  if (calculatedLevel > company.level) {
    // Level up!
    await env.DB.prepare(
      'UPDATE game_companies SET level = ? WHERE id = ?'
    ).bind(calculatedLevel, company.id).run();

    const unlocks = getUnlocksAtLevel(calculatedLevel);

    // Log level up
    await env.DB.prepare(`
      INSERT INTO game_transactions (id, company_id, action_type, details)
      VALUES (?, ?, 'level_up', ?)
    `).bind(
      crypto.randomUUID(),
      company.id,
      JSON.stringify({ from: company.level, to: calculatedLevel, unlocks })
    ).run();

    return {
      leveledUp: true,
      newLevel: calculatedLevel,
      unlocks,
    };
  }

  return {
    leveledUp: false,
    newLevel: company.level,
    unlocks: { buildings: [], tricks: [] },
  };
}

// Call this after any action that increments total_actions
// Add to buyLand, buildBuilding, performAttack, etc.
export async function postActionCheck(env: Env, companyId: string) {
  const company = await env.DB.prepare(
    'SELECT * FROM game_companies WHERE id = ?'
  ).bind(companyId).first();

  return checkAndUpdateLevel(env, company);
}
```

### Level Progress Component

```tsx
// components/game/LevelProgress.tsx
export function LevelProgress() {
  const { activeCompany } = useCompany();

  if (!activeCompany) return null;

  const { cashProgress, actionsProgress } = getLevelProgress(
    activeCompany.level,
    activeCompany.cash,
    activeCompany.total_actions
  );

  const nextLevel = getNextLevelRequirements(activeCompany.level);
  const unlocks = nextLevel ? getUnlocksAtLevel(nextLevel.level) : null;

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <p className="text-gray-400 text-sm">Current Level</p>
          <p className="text-3xl font-bold text-white">{activeCompany.level}</p>
        </div>
        <div className="text-right">
          <p className="text-gray-400 text-sm">Total Actions</p>
          <p className="text-xl font-mono text-white">
            {activeCompany.total_actions.toLocaleString()}
          </p>
        </div>
      </div>

      {nextLevel ? (
        <>
          <p className="text-sm text-gray-400 mb-2">Progress to Level {nextLevel.level}</p>

          {/* Cash progress */}
          <div className="mb-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Cash</span>
              <span>${activeCompany.cash.toLocaleString()} / ${nextLevel.cash.toLocaleString()}</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${cashProgress}%` }}
              />
            </div>
          </div>

          {/* Actions progress */}
          <div className="mb-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Actions</span>
              <span>{activeCompany.total_actions.toLocaleString()} / {nextLevel.actions.toLocaleString()}</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${actionsProgress}%` }}
              />
            </div>
          </div>

          {/* Unlocks preview */}
          {unlocks && (unlocks.buildings.length > 0 || unlocks.tricks.length > 0) && (
            <div className="mt-4 p-3 bg-gray-700/50 rounded">
              <p className="text-xs text-gray-400 mb-2">Unlocks at Level {nextLevel.level}:</p>
              <div className="flex flex-wrap gap-2">
                {unlocks.buildings.map(b => (
                  <span key={b} className="px-2 py-1 bg-blue-900/50 text-blue-300 text-xs rounded">
                    🏢 {b}
                  </span>
                ))}
                {unlocks.tricks.map(t => (
                  <span key={t} className="px-2 py-1 bg-red-900/50 text-red-300 text-xs rounded">
                    💣 {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-4">
          <p className="text-yellow-400 font-bold">Max Level Reached!</p>
          <p className="text-sm text-gray-400">All buildings and tricks unlocked</p>
        </div>
      )}
    </div>
  );
}
```

### Level Up Modal

```tsx
// components/game/LevelUpModal.tsx
export function LevelUpModal({ level, unlocks, onClose }) {
  return (
    <Modal onClose={onClose}>
      <div className="text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-3xl font-bold text-yellow-400 mb-2">Level Up!</h2>
        <p className="text-xl text-white mb-6">You reached Level {level}</p>

        {(unlocks.buildings.length > 0 || unlocks.tricks.length > 0) && (
          <div className="bg-gray-700 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm text-gray-400 mb-3">New Unlocks:</p>

            {unlocks.buildings.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-blue-400 mb-2">Buildings</p>
                <div className="flex flex-wrap gap-2">
                  {unlocks.buildings.map(b => (
                    <span key={b} className="px-3 py-1 bg-blue-900 text-blue-200 rounded">
                      🏢 {b}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {unlocks.tricks.length > 0 && (
              <div>
                <p className="text-xs text-red-400 mb-2">Dirty Tricks</p>
                <div className="flex flex-wrap gap-2">
                  {unlocks.tricks.map(t => (
                    <span key={t} className="px-3 py-1 bg-red-900 text-red-200 rounded">
                      💣 {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-3 bg-yellow-600 text-white font-bold rounded-lg hover:bg-yellow-700"
        >
          Continue
        </button>
      </div>
    </Modal>
  );
}
```

### Level-Locked UI States

```tsx
// In BuildModal - show locked buildings
{buildingTypes.map(type => {
  const isLocked = type.level_required > activeCompany.level;

  return (
    <div
      key={type.id}
      onClick={() => !isLocked && handleSelect(type.id)}
      className={`p-3 rounded ${
        isLocked
          ? 'opacity-50 cursor-not-allowed bg-gray-800'
          : selected === type.id
            ? 'bg-blue-600'
            : 'bg-gray-700 hover:bg-gray-600 cursor-pointer'
      }`}
    >
      <div className="flex justify-between">
        <span className="font-bold text-white">{type.name}</span>
        {isLocked ? (
          <span className="text-yellow-400">🔒 Lvl {type.level_required}</span>
        ) : (
          <span className="text-yellow-400">${type.cost.toLocaleString()}</span>
        )}
      </div>
    </div>
  );
})}

// In AttackModal - show locked tricks
{Object.values(DIRTY_TRICKS).map(trick => {
  const isLocked = trick.levelRequired > activeCompany.level;

  return (
    <div
      key={trick.id}
      className={isLocked ? 'opacity-50' : ''}
    >
      {/* ... */}
      {isLocked && (
        <p className="text-xs text-yellow-400">
          🔒 Requires Level {trick.levelRequired}
        </p>
      )}
    </div>
  );
})}
```

## Database Changes

None - uses existing `level` and `total_actions` columns.

## Test Cases

| Test | Input | Expected Output |
|------|-------|-----------------|
| Start at level 1 | New company | Level = 1 |
| Level up to 2 | 50k cash, 50 actions | Level = 2, unlocks shown |
| Cash only | 50k cash, 10 actions | Still level 1 |
| Actions only | 10k cash, 100 actions | Still level 1 |
| Level 5 | 25M cash, 5000 actions | Level 5, max level |
| Locked building | Level 1, try casino | Cannot build |
| Locked trick | Level 1, try fire bomb | Cannot use |
| Progress display | Level 2 company | Shows progress to level 3 |

## Acceptance Checklist

- [ ] Level calculated from cash + actions
- [ ] Level up triggers on threshold met
- [ ] Level up modal shows unlocks
- [ ] Progress bar shows cash progress
- [ ] Progress bar shows actions progress
- [ ] Locked buildings greyed out
- [ ] Locked tricks greyed out
- [ ] Level displayed in dashboard
- [ ] Transaction logged on level up
- [ ] Level 5 shows "max level"

## Deployment

```bash
npm run build
CLOUDFLARE_API_TOKEN="..." CLOUDFLARE_ACCOUNT_ID="..." npx wrangler pages deploy ./dist --project-name=notropolis-dashboard
```

## Handoff Notes

- Both cash AND actions required for level up
- Level is calculated, not just stored (recalculate on load)
- Level check happens after every action
- Level determines building access [See: Stage 05]
- Level determines trick access [See: Stage 08]
- Level resets when you hero out to new location [See: Stage 12]
- Consider adding level-up notification toast
