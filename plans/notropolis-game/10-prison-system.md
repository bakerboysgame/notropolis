# Stage 10: Prison System

> **Spec reviewed 2025-12-31:** Fixed file paths (`.ts` → `.js`), identified existing implementations (`payFine`, `performAttack` prison check, `PrisonStatus` component), updated code snippets to match actual codebase structure.

## Objective

Complete the prison mechanics including action blocking, fine payment, and prison status UI.

## Dependencies

`[Requires: Stage 08 complete]` - Prison status set by attack catch.

## Complexity

**Low** - Mostly UI and validation, core mechanics in Stage 08.

## Files to Modify

| File | Changes |
|------|---------|
| `authentication-dashboard-system/worker/index.js` | Add prison check to `handleBuyLand`, `handleBuildBuilding` |
| `authentication-dashboard-system/worker/src/routes/game/market.js` | Add prison check to all market actions |
| `authentication-dashboard-system/worker/src/routes/game/security.js` | Add prison check to security purchase |
| `authentication-dashboard-system/worker/src/routes/game/attacks.js` | Update `payFine` to reset tick counter |
| `authentication-dashboard-system/src/App.tsx` | Add route for Prison page |

## Files to Create

| File | Purpose |
|------|---------|
| `authentication-dashboard-system/src/components/game/PrisonBanner.tsx` | Prison status banner (shown on all game pages) |
| `authentication-dashboard-system/src/pages/Prison.tsx` | Full prison page with pay fine button |

## Already Implemented (Needs Integration)

| File | What Exists |
|------|-------------|
| `authentication-dashboard-system/src/pages/CompanyDashboard.tsx` | Already shows prison status (lines 329-340) |
| `authentication-dashboard-system/worker/src/routes/game/attacks.js` | `performAttack` already has prison check (lines 43-46), `payFine` exists but needs tick reset fix |
| `authentication-dashboard-system/src/components/game/PrisonStatus.tsx` | Full prison status component with pay fine button - EXISTS but not used yet |

## Implementation Details

### Prison Check Helper Function

Add a simple inline prison check function at the top of each route file that needs it:

```javascript
// Helper function - add to each file that needs it
function checkPrisonStatus(company, corsHeaders) {
  if (company.is_in_prison) {
    return new Response(JSON.stringify({
      success: false,
      error: `You are in prison! Pay your fine of $${company.prison_fine?.toLocaleString()} to continue.`
    }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  return null; // Not in prison, continue
}
```

### Apply Prison Check to Endpoints

**In `worker/index.js` - for `handleBuyLand` and `handleBuildBuilding`:**

Add early in each function after fetching the company:

```javascript
// Add after: const company = await env.DB.prepare(...).first();
if (company.is_in_prison) {
  return new Response(JSON.stringify({
    success: false,
    error: `You are in prison! Pay your fine of $${company.prison_fine?.toLocaleString()} to continue.`
  }), {
    status: 403,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
```

**In `worker/src/routes/game/market.js` - for all market actions:**

Add at the start of `sellToState`, `listForSale`, `cancelListing`, `buyProperty`, `demolishBuilding`:

```javascript
// Add as first check after function signature
if (company.is_in_prison) {
  throw new Error(`You are in prison! Pay your fine of $${company.prison_fine?.toLocaleString()} to continue.`);
}
```

**In `worker/src/routes/game/security.js` - for `purchaseSecurity`:**

```javascript
// Add as first check in purchaseSecurity
if (company.is_in_prison) {
  throw new Error(`You are in prison! Pay your fine of $${company.prison_fine?.toLocaleString()} to continue.`);
}
```

**Note:** `performAttack` in attacks.js already has the prison check (lines 43-46). No change needed.

### Fix Existing Pay Fine API

The `payFine` function already exists in `worker/src/routes/game/attacks.js` (lines 251-283).

**Required change:** Update the SQL to reset `ticks_since_action` to 0 (paying fine counts as an action):

```javascript
// In worker/src/routes/game/attacks.js, update the payFine function's UPDATE query:
// Change from:
    env.DB.prepare(`
      UPDATE game_companies
      SET cash = cash - ?,
          is_in_prison = 0,
          prison_fine = 0
      WHERE id = ?
    `).bind(fine, company.id),

// Change to:
    env.DB.prepare(`
      UPDATE game_companies
      SET cash = cash - ?,
          is_in_prison = 0,
          prison_fine = 0,
          ticks_since_action = 0,
          total_actions = total_actions + 1,
          last_action_at = ?
      WHERE id = ?
    `).bind(fine, new Date().toISOString(), company.id),
```

### Integrate PrisonStatus into GameMap

The `PrisonStatus` component already exists at `src/components/game/PrisonStatus.tsx`. Integrate it into the GameMap page:

```tsx
// In GameMap.tsx, add the import:
import { PrisonStatus } from '../components/game/PrisonStatus';

// Add PrisonStatus at the top of the game view (after header, before map):
{activeCompany && (
  <PrisonStatus
    isInPrison={activeCompany.is_in_prison}
    prisonFine={activeCompany.prison_fine}
    companyCash={activeCompany.cash}
    activeCompanyId={activeCompany.id}
    onPaidFine={() => refreshCompany()}
  />
)}
```

### Prison Page (Optional - simpler approach)

Since `PrisonStatus` component already provides a full UI with pay fine functionality, a dedicated Prison page is **optional**. The existing component shown on GameMap may be sufficient.

If you do want a dedicated `/prison` route, create a simple wrapper:

```tsx
// pages/Prison.tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveCompany } from '../contexts/CompanyContext';
import { PrisonStatus } from '../components/game/PrisonStatus';

export function Prison() {
  const { activeCompany, refreshCompany } = useActiveCompany();
  const navigate = useNavigate();

  // Redirect if not in prison
  useEffect(() => {
    if (activeCompany && !activeCompany.is_in_prison) {
      navigate('/game');
    }
  }, [activeCompany?.is_in_prison, navigate]);

  if (!activeCompany) return null;

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-xl w-full">
        <PrisonStatus
          isInPrison={activeCompany.is_in_prison}
          prisonFine={activeCompany.prison_fine}
          companyCash={activeCompany.cash}
          activeCompanyId={activeCompany.id}
          onPaidFine={() => {
            refreshCompany();
            navigate('/game');
          }}
        />
      </div>
    </div>
  );
}
```

### Prison Banner Component (Optional)

If you want a persistent banner across all pages instead of just on GameMap:

```tsx
// components/game/PrisonBanner.tsx
import { useActiveCompany } from '../../contexts/CompanyContext';
import { AlertCircle } from 'lucide-react';

export function PrisonBanner() {
  const { activeCompany } = useActiveCompany();

  if (!activeCompany?.is_in_prison) return null;

  return (
    <div className="bg-red-900 border-b-2 border-red-600">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-center gap-3">
        <AlertCircle className="w-5 h-5 text-red-400" />
        <span className="text-white font-medium">
          You are in prison! Fine: ${activeCompany.prison_fine.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
```

### Frontend Prison Handling

The existing `PrisonStatus` component already handles UI feedback. For modal/action buttons, check `activeCompany.is_in_prison` before allowing actions:

```tsx
// Pattern for modals - check prison status and show warning
const { activeCompany } = useActiveCompany();
const isInPrison = activeCompany?.is_in_prison;

// In your button:
<button
  onClick={handleAction}
  disabled={isInPrison || !canAfford}
  className="..."
>
  {isInPrison ? '🔒 In Prison' : 'Buy Land'}
</button>
```

**Note:** Server-side validation is the source of truth. Frontend checks are for UX only.

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

### Backend (Required)
- [ ] Prison check added to `handleBuyLand` in worker/index.js
- [ ] Prison check added to `handleBuildBuilding` in worker/index.js
- [ ] Prison check added to `sellToState` in market.js
- [ ] Prison check added to `listForSale` in market.js
- [ ] Prison check added to `cancelListing` in market.js
- [ ] Prison check added to `buyProperty` in market.js
- [ ] Prison check added to `demolishBuilding` in market.js
- [ ] Prison check added to `purchaseSecurity` in security.js
- [ ] `payFine` updated to reset `ticks_since_action` in attacks.js

### Frontend (Required)
- [ ] `PrisonStatus` component integrated into GameMap page
- [ ] Company refreshes after paying fine

### Verification
- [ ] Cannot buy land while in prison (API returns 403)
- [ ] Cannot build while in prison (API returns error)
- [ ] Cannot attack while in prison (already works)
- [ ] Cannot buy/sell property while in prison
- [ ] Cannot purchase security while in prison
- [ ] Can pay fine to get released
- [ ] Fine payment resets tick counter
- [ ] Can view map while in prison
- [ ] Still receives tick income while in prison

## Deployment

**Worker deployment:**
```bash
cd authentication-dashboard-system/worker
CLOUDFLARE_API_TOKEN="..." CLOUDFLARE_ACCOUNT_ID="..." npx wrangler deploy
```

**Frontend deployment:**
```bash
cd authentication-dashboard-system
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
