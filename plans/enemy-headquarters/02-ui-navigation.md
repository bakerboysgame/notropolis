# Stage 2: UI & Navigation

## Objective
Create EnemyHeadquarters page with color picker and make Statistics company names clickable.

## Dependencies
[Requires: Stage 1 complete]

## Complexity
Medium

## Files to Create

### `src/pages/EnemyHeadquarters.tsx`
- Route param: `companyId`
- Fetch company data from statistics or dedicated endpoint
- Display: company name, stats (can be minimal initially)
- Color picker grid using HIGHLIGHT_COLORS
- Back button to Statistics

## Files to Modify

### `src/App.tsx`
Add route:
```typescript
<Route path="/enemy-hq/:companyId" element={
  <ProtectedRoute>
    <Layout><EnemyHeadquarters /></Layout>
  </ProtectedRoute>
} />
```

### `src/pages/Statistics.tsx`
- Import `useNavigate`
- Wrap company names (not own company) in clickable button
- Navigate to `/enemy-hq/${companyId}` on click
- Style: `hover:text-purple-400 hover:underline cursor-pointer`

## Implementation Details

### EnemyHeadquarters.tsx Structure
```typescript
export function EnemyHeadquarters() {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const { getCompanyHighlight, setCompanyHighlight } = useHighlights();
  const [companyData, setCompanyData] = useState(null);

  // Fetch from /api/game/statistics and find company in leaderboard
  // OR create simple backend endpoint

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Back button */}
      {/* Company info card */}
      {/* Color picker: grid of 8 color buttons + "none" option */}
    </div>
  );
}
```

### Color Picker UI
```tsx
<div className="flex flex-wrap gap-3">
  <button onClick={() => handleColorSelect(null)}
    className={`w-10 h-10 rounded-lg border-2 ${!currentHighlight ? 'ring-2 ring-white' : ''}`}>
    <EyeOff className="w-5 h-5 text-gray-400" />
  </button>
  {HIGHLIGHT_COLORS.map(({ name, hex }) => (
    <button key={hex} onClick={() => handleColorSelect(hex)}
      style={{ backgroundColor: hex }}
      className={`w-10 h-10 rounded-lg ${currentHighlight === hex ? 'ring-2 ring-white' : ''}`}
      title={name} />
  ))}
</div>
```

## Database Changes
None (may need simple backend endpoint for company public info)

## Test Cases
1. Click company name in Statistics → navigates to `/enemy-hq/{id}`
2. Own company name is NOT clickable
3. Select orange color → saves to context/localStorage
4. Click "no highlight" → clears the highlight
5. Back button returns to Statistics

## Acceptance Checklist
- [ ] EnemyHeadquarters page renders without errors
- [ ] Company names in Statistics are clickable (except own)
- [ ] Color picker shows 8 colors + none option
- [ ] Selected color persists after page refresh
- [ ] Back navigation works

## Deployment
```bash
npm run dev
# Navigate to /statistics, click enemy company, verify page loads
```

## Handoff Notes
UI complete. Stage 3 will consume the highlights from context to render colored tiles/halos.
