# Stage 1: Foundation

## Objective
Create HighlightContext for state management with localStorage persistence and wire it into the app.

## Dependencies
None

## Complexity
Low

## Files to Create

### `src/contexts/HighlightContext.tsx`
```typescript
// HIGHLIGHT_COLORS array with 8 preset colors
// HighlightedCompany interface: { companyId, companyName, color }
// HighlightContext with:
//   - highlightedCompanies: Map<string, HighlightedCompany>
//   - setCompanyHighlight(companyId, companyName, color | null)
//   - getCompanyHighlight(companyId): string | null
//   - clearAllHighlights()
// localStorage key: 'notropolis_company_highlights'
// Follow ThemeContext pattern for initialization/persistence
```

## Files to Modify

### `src/App.tsx`
- Import HighlightProvider
- Wrap inside CompanyProvider: `<HighlightProvider>{children}</HighlightProvider>`

## Implementation Details

```typescript
export const HIGHLIGHT_COLORS = [
  { name: 'Orange', hex: '#F97316' },
  { name: 'Yellow', hex: '#EAB308' },
  { name: 'Pink', hex: '#EC4899' },
  { name: 'Purple', hex: '#A855F7' },
  { name: 'Cyan', hex: '#06B6D4' },
  { name: 'Lime', hex: '#84CC16' },
  { name: 'Fuchsia', hex: '#D946EF' },
  { name: 'Amber', hex: '#F59E0B' },
] as const;

// Initialize from localStorage in useState
// useEffect to persist on changes
// Export useHighlights() hook
```

## Database Changes
None

## Test Cases
1. Call `setCompanyHighlight('id1', 'Test Co', '#F97316')` → highlight stored
2. Call `getCompanyHighlight('id1')` → returns '#F97316'
3. Refresh page → highlight persists from localStorage
4. Call `setCompanyHighlight('id1', 'Test Co', null)` → highlight removed

## Acceptance Checklist
- [ ] HighlightContext.tsx created with all exports
- [ ] App.tsx wraps children with HighlightProvider
- [ ] No console errors on app load
- [ ] useHighlights() hook works in any component

## Deployment
```bash
npm run dev  # Verify app loads without errors
```

## Handoff Notes
Context is ready. Stage 2 will use `useHighlights()` hook in the EnemyHeadquarters page.
