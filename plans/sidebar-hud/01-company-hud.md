# Stage 1: Create CompanyHUD Component

## Objective
Create a compact HUD component showing company name, cash, and level, and integrate it into the Sidebar below the logo.

## Dependencies
None

## Complexity
Low

## Files to Create
| Path | Purpose |
|------|---------|
| `src/components/CompanyHUD.tsx` | HUD component with company stats |

## Files to Modify
| Path | Changes |
|------|---------|
| `src/components/Sidebar.tsx` | Import and render CompanyHUD below logo |

## Implementation Details

### CompanyHUD.tsx
```tsx
import { useActiveCompany } from '../contexts/CompanyContext'
import { clsx } from 'clsx'

interface CompanyHUDProps {
  isCollapsed: boolean
  isMobile: boolean
}

// Format cash to 2 decimal places with £ symbol
const formatCash = (amount: number): string => {
  return `£${amount.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

export function CompanyHUD({ isCollapsed, isMobile }: CompanyHUDProps) {
  const { activeCompany } = useActiveCompany()

  if (!activeCompany) return null

  // Collapsed: show cash only
  if (isCollapsed && !isMobile) {
    return (
      <div className="px-2 py-3 text-center border-b border-neutral-200/50 dark:border-neutral-800/50">
        <p className="text-xs text-green-500 font-mono font-bold truncate">
          {formatCash(activeCompany.cash)}
        </p>
      </div>
    )
  }

  return (
    <div className="px-4 py-3 border-b border-neutral-200/50 dark:border-neutral-800/50">
      {/* Company Name */}
      <h2 className="text-sm font-bold text-neutral-900 dark:text-white truncate">
        {activeCompany.name}
      </h2>

      {/* Cash + Level row */}
      <div className="flex items-center justify-between mt-1">
        <span className="text-sm text-green-500 font-mono font-bold">
          {formatCash(activeCompany.cash)}
        </span>
        <span className="text-xs bg-primary-500/20 text-primary-400 px-1.5 py-0.5 rounded">
          Lv.{activeCompany.level}
        </span>
      </div>

      {/* Prison indicator */}
      {activeCompany.is_in_prison && (
        <div className="mt-1 text-xs text-red-400 flex items-center gap-1">
          <span>⚠</span> In Prison
        </div>
      )}
    </div>
  )
}
```

### Sidebar.tsx changes
Add after logo section (line ~262):
```tsx
import { CompanyHUD } from './CompanyHUD'

// Inside component, after logo div:
<CompanyHUD isCollapsed={isCollapsed} isMobile={isMobile} />
```

## Database Changes
None

## Test Cases
| Scenario | Expected |
|----------|----------|
| Active company with £1234.50 cash | Shows "£1,234.50" |
| No active company | HUD hidden |
| Collapsed sidebar | Shows cash only |
| Company in prison | Shows "⚠ In Prison" |

## Acceptance Checklist
- [ ] HUD appears below logo when company active
- [ ] Cash formatted as £XX,XXX.XX with 2 decimals
- [ ] Level badge displays
- [ ] Prison warning shows when applicable
- [ ] Collapsed state shows cash only

## Deployment
```bash
npm run build && npm run dev
```
Navigate to any page with active company to verify HUD.

## Handoff Notes
Stage 2 will wrap the map route with Layout so the sidebar (with new HUD) appears on map pages.
