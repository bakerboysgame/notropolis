# Stage 2: Fix GameMap Layout

## Objective
Wrap map route with Layout to show sidebar, and remove the redundant right sidebar panel.

## Dependencies
`[Requires: Stage 1 complete]`

## Complexity
Low

## Files to Modify
| Path | Changes |
|------|---------|
| `src/App.tsx` | Wrap `/map/:mapId` route with Layout |
| `src/pages/GameMap.tsx` | Remove right sidebar, adjust layout |

## Implementation Details

### App.tsx (line ~298-303)
Change:
```tsx
<Route path="/map/:mapId" element={
  <ProtectedRoute>
    <GameMap />
  </ProtectedRoute>
} />
```
To:
```tsx
<Route path="/map/:mapId" element={
  <ProtectedRoute>
    <Layout>
      <GameMap />
    </Layout>
  </ProtectedRoute>
} />
```

### GameMap.tsx changes

1. **Remove right sidebar** — Delete the side panel div (lines ~197-216):
```tsx
// DELETE THIS:
<div className="hidden md:block w-80 bg-gray-800 border-l border-gray-700 overflow-y-auto">
  {selectedTile ? (
    <TileInfo ... />
  ) : (
    <MapOverview ... />
  )}
</div>
```

2. **Simplify overview layout** — Change from flex to single full-width:
```tsx
// BEFORE:
<div className="flex h-full">
  <div className="flex-1 relative overflow-hidden">
    ...
  </div>
  {/* side panel - DELETE */}
</div>

// AFTER:
<div className="h-full relative overflow-hidden">
  ...
</div>
```

3. **Remove unused imports**:
```tsx
// Remove these if no longer used:
import { TileInfo } from '../components/game/TileInfo';
import { MapOverview } from '../components/game/MapOverview';
```

4. **Remove selectedTile state** if only used for right sidebar.

## Database Changes
None

## Test Cases
| Scenario | Expected |
|----------|----------|
| Navigate to `/map/map_testerville_001` | Left sidebar visible with HUD |
| Click tile to zoom in | Sidebar remains visible (overlays map) |
| Click "Back to Overview" | Sidebar still present |
| Mobile view | Sidebar minimizable, no right panel |

## Acceptance Checklist
- [ ] Left sidebar appears on map overview mode
- [ ] Left sidebar appears on map zoomed mode
- [ ] Right sidebar completely removed
- [ ] Map fills available space correctly
- [ ] HUD shows company stats on map pages

## Deployment
```bash
npm run build && npm run dev
```
Navigate to `/map/map_testerville_001` to verify sidebar present.

## Handoff Notes
Feature complete after this stage.
