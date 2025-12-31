# Stage 10: Prison System

## Objective

Complete the prison mechanics including action blocking, fine payment, and prison status UI.

## Dependencies

`[Requires: Stage 08 complete]` - Prison status set by attack catch.

## Complexity

**Low** - Mostly UI and validation, core mechanics in Stage 08.

## Files to Modify

| File | Changes |
|------|---------|
| `authentication-dashboard-system/src/pages/CompanyDashboard.tsx` | Show prison status prominently |
| `authentication-dashboard-system/src/worker/routes/game/*.ts` | Add prison check to all action endpoints |

## Files to Create

| File | Purpose |
|------|---------|
| `authentication-dashboard-system/src/components/game/PrisonBanner.tsx` | Prison status banner |
| `authentication-dashboard-system/src/pages/Prison.tsx` | Full prison page |
| `authentication-dashboard-system/src/middleware/prisonCheck.ts` | Reusable prison validation |

## Implementation Details

### Prison Check Middleware

```typescript
// middleware/prisonCheck.ts
export function requireNotInPrison(company: GameCompany) {
  if (company.is_in_prison) {
    throw new PrisonError('You are in prison. Pay your fine to continue.');
  }
}

export class PrisonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrisonError';
  }
}
```

### Apply Prison Check to All Actions

```typescript
// worker/routes/game/land.ts
export async function buyLand(request: Request, env: Env, company: GameCompany) {
  requireNotInPrison(company); // Add this line
  // ... rest of implementation
}

// worker/routes/game/buildings.ts
export async function buildBuilding(request: Request, env: Env, company: GameCompany) {
  requireNotInPrison(company);
  // ...
}

// worker/routes/game/market.ts
export async function sellToState(request: Request, env: Env, company: GameCompany) {
  requireNotInPrison(company);
  // ...
}

export async function listForSale(request: Request, env: Env, company: GameCompany) {
  requireNotInPrison(company);
  // ...
}

export async function buyProperty(request: Request, env: Env, company: GameCompany) {
  requireNotInPrison(company);
  // ...
}

// worker/routes/game/attacks.ts
export async function performAttack(request: Request, env: Env, company: GameCompany) {
  requireNotInPrison(company);
  // ...
}

// worker/routes/game/security.ts
export async function purchaseSecurity(request: Request, env: Env, company: GameCompany) {
  requireNotInPrison(company);
  // ...
}

// Note: payFine does NOT have this check - that's how you get out!
```

### Enhanced Pay Fine API

```typescript
// worker/routes/game/attacks.ts
export async function payFine(request: Request, env: Env, company: GameCompany) {
  if (!company.is_in_prison) {
    throw new Error('You are not in prison');
  }

  if (company.cash < company.prison_fine) {
    throw new Error(`Insufficient funds. You need $${company.prison_fine.toLocaleString()} but only have $${company.cash.toLocaleString()}`);
  }

  const finePaid = company.prison_fine;

  await env.DB.batch([
    // Deduct fine and release
    env.DB.prepare(`
      UPDATE game_companies
      SET cash = cash - ?,
          is_in_prison = 0,
          prison_fine = 0,
          total_actions = total_actions + 1,
          last_action_at = ?
      WHERE id = ?
    `).bind(finePaid, new Date().toISOString(), company.id),

    // Log transaction
    env.DB.prepare(`
      INSERT INTO game_transactions (id, company_id, action_type, amount, details)
      VALUES (?, ?, 'pay_fine', ?, ?)
    `).bind(
      crypto.randomUUID(),
      company.id,
      finePaid,
      JSON.stringify({ released: true })
    ),
  ]);

  // Reset tick counter (paying fine counts as action)
  await resetTickCounter(env, company.id);

  return {
    success: true,
    fine_paid: finePaid,
    remaining_cash: company.cash - finePaid,
  };
}
```

### Prison Page

```tsx
// pages/Prison.tsx
export function Prison() {
  const { activeCompany, refreshCompany } = useCompany();
  const navigate = useNavigate();

  // Redirect if not in prison
  useEffect(() => {
    if (activeCompany && !activeCompany.is_in_prison) {
      navigate('/game');
    }
  }, [activeCompany]);

  if (!activeCompany?.is_in_prison) return null;

  const canAfford = activeCompany.cash >= activeCompany.prison_fine;
  const shortfall = activeCompany.prison_fine - activeCompany.cash;

  const handlePayFine = async () => {
    try {
      await api.attacks.payFine();
      await refreshCompany();
      navigate('/game');
    } catch (error) {
      console.error('Failed to pay fine:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-800 rounded-lg p-8 text-center">
        {/* Prison icon */}
        <div className="text-8xl mb-6">🔒</div>

        <h1 className="text-3xl font-bold text-red-400 mb-2">In Prison</h1>
        <p className="text-gray-400 mb-8">
          You were caught performing illegal activities.
          Pay your fine to get out and continue playing.
        </p>

        {/* Fine details */}
        <div className="bg-gray-700 rounded-lg p-6 mb-6">
          <p className="text-gray-400 mb-2">Fine Amount</p>
          <p className="text-4xl font-bold text-yellow-400">
            ${activeCompany.prison_fine.toLocaleString()}
          </p>
        </div>

        {/* Cash status */}
        <div className="bg-gray-700 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Your Cash</span>
            <span className={`font-mono ${canAfford ? 'text-green-400' : 'text-red-400'}`}>
              ${activeCompany.cash.toLocaleString()}
            </span>
          </div>
          {!canAfford && (
            <div className="mt-2 text-sm text-red-400">
              You need ${shortfall.toLocaleString()} more
            </div>
          )}
        </div>

        {/* Pay button */}
        <button
          onClick={handlePayFine}
          disabled={!canAfford}
          className={`w-full py-4 rounded-lg font-bold text-lg transition ${
            canAfford
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          {canAfford ? 'Pay Fine & Get Out' : 'Insufficient Funds'}
        </button>

        {!canAfford && (
          <p className="text-sm text-gray-500 mt-4">
            Wait for tick income or receive a bank transfer from another company.
          </p>
        )}

        {/* What you can do */}
        <div className="mt-8 text-left">
          <p className="text-sm text-gray-500 mb-2">While in prison you can:</p>
          <ul className="text-sm text-gray-400 list-disc list-inside">
            <li>View the map (but not interact)</li>
            <li>Receive bank transfers from your other companies</li>
            <li>Wait for tick income (if eligible)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
```

### Prison Banner Component

```tsx
// components/game/PrisonBanner.tsx
export function PrisonBanner() {
  const { activeCompany } = useCompany();
  const navigate = useNavigate();

  if (!activeCompany?.is_in_prison) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bg-red-900 border-b-2 border-red-600 z-50">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🔒</span>
          <div>
            <p className="font-bold text-white">You are in prison!</p>
            <p className="text-sm text-red-200">
              Fine: ${activeCompany.prison_fine.toLocaleString()}
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/prison')}
          className="px-4 py-2 bg-white text-red-900 font-bold rounded hover:bg-gray-100"
        >
          Pay Fine
        </button>
      </div>
    </div>
  );
}
```

### Blocked Action UI Feedback

```tsx
// hooks/useGameAction.ts
export function useGameAction() {
  const { activeCompany } = useCompany();

  const performAction = async (action: () => Promise<any>) => {
    if (activeCompany?.is_in_prison) {
      toast.error('You are in prison. Pay your fine to continue.');
      return null;
    }

    try {
      return await action();
    } catch (error) {
      if (error.message.includes('prison')) {
        toast.error('You are in prison. Pay your fine to continue.');
      } else {
        toast.error(error.message);
      }
      throw error;
    }
  };

  return { performAction, isInPrison: activeCompany?.is_in_prison };
}
```

### Disabled State for All Action Buttons

```tsx
// Example: BuyLandModal with prison check
export function BuyLandModal({ tile, map, onBuy, onClose }) {
  const { isInPrison } = useGameAction();
  const cost = calculateLandCost(tile, map);
  const { activeCompany } = useCompany();
  const canAfford = activeCompany.cash >= cost;

  return (
    <Modal onClose={onClose}>
      {/* ... */}

      {isInPrison && (
        <div className="mb-4 p-3 bg-red-900/50 rounded border border-red-600">
          <p className="text-red-400">🔒 You cannot buy land while in prison.</p>
        </div>
      )}

      <button
        onClick={() => onBuy(tile)}
        disabled={!canAfford || isInPrison}
        className="flex-1 py-2 bg-green-600 text-white rounded disabled:opacity-50"
      >
        {isInPrison ? 'In Prison' : 'Buy Land'}
      </button>
    </Modal>
  );
}
```

### Bank Transfer While in Prison

```typescript
// Bank transfers can be RECEIVED while in prison
// This is handled in Stage 13, but note here:
// - Receiving transfers: ALLOWED (this is how you can afford the fine)
// - Sending transfers: BLOCKED (you're in prison)
```

## Database Changes

None - uses existing `is_in_prison` and `prison_fine` columns.

## Test Cases

| Test | Input | Expected Output |
|------|-------|-----------------|
| Buy land in prison | In prison, try to buy | Error: in prison |
| Build in prison | In prison, try to build | Error: in prison |
| Attack in prison | In prison, try to attack | Error: in prison |
| Pay fine | Sufficient funds | Released, fine deducted |
| Pay fine insufficient | Not enough cash | Error: insufficient funds |
| View map in prison | In prison | Can view, cannot interact |
| Receive transfer in prison | Other company sends | Cash received |
| Tick income in prison | Has buildings, < 6 ticks | Still receives income |

## Acceptance Checklist

- [ ] Prison check added to all action endpoints
- [ ] Cannot buy land while in prison
- [ ] Cannot build while in prison
- [ ] Cannot attack while in prison
- [ ] Cannot buy/sell property while in prison
- [ ] Cannot purchase security while in prison
- [ ] Can pay fine to get out
- [ ] Can view map while in prison
- [ ] Can receive bank transfers while in prison
- [ ] Still receives tick income while in prison
- [ ] Prison banner shows on all pages
- [ ] Prison page displays correctly
- [ ] Fine payment resets tick counter

## Deployment

```bash
npm run build
CLOUDFLARE_API_TOKEN="..." CLOUDFLARE_ACCOUNT_ID="..." npx wrangler pages deploy ./dist --project-name=notropolis-dashboard
```

## Handoff Notes

- Prison blocks ACTIONS, not passive income
- Tick income still flows to imprisoned companies
- Bank transfers can be received (to afford the fine)
- Paying the fine counts as an action (resets tick counter)
- Prison status is per-company, not per-user
- Other companies owned by same user are unaffected
- Consider adding "bail" option from other companies in future
