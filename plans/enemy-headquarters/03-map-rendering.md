# Stage 3: Map Rendering

## Objective
Update map renderers to display highlighted companies with custom colors in both zoomed-out and zoomed-in views.

## Dependencies
[Requires: Stage 1 complete]

## Complexity
Medium

## Files to Modify

### `src/utils/mapRenderer.ts`
Add parameter and logic. **Highlighted companies render exactly like user's own properties:**
```typescript
export function renderMap(
  ctx, map, tiles, buildings, activeCompanyId, zoom, offset,
  highlightedCompanies?: Map<string, string>  // NEW
): void {
  // Check highlight status (treat like ownership for rendering)
  const isOwnedByUser = tile.owner_company_id === activeCompanyId;
  const highlightColor = highlightedCompanies?.get(tile.owner_company_id);
  const isHighlighted = !!highlightColor;

  // In ownership section (~line 108):
  if (tile.owner_company_id) {
    if (isOwnedByUser) {
      color = '#3b82f6';  // existing blue
    } else if (isHighlighted) {
      color = highlightColor;  // solid highlight color (same as user)
    } else {
      color = blendColors(color, '#ef4444', 0.3);  // red tint for non-highlighted
    }
  }

  // Skip white dot for BOTH user-owned AND highlighted companies (~line 124):
  if (building && tileSize >= 8 && !isOwnedByUser && !isHighlighted) {
    // draw white dot only for non-highlighted rivals
  }
}

// Add utility function:
export function hexToRgba(hex: string, alpha = 0.8): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
```

### `src/components/game/MapCanvas.tsx`
```typescript
import { useHighlights } from '../../contexts/HighlightContext';

export function MapCanvas({ ... }) {
  const { highlightedCompanies } = useHighlights();

  const highlightMap = useMemo(() => {
    const m = new Map<string, string>();
    highlightedCompanies.forEach((data, id) => m.set(id, data.color));
    return m;
  }, [highlightedCompanies]);

  // Pass to renderMap calls:
  renderMap(ctx, map, tileMap, buildingMap, activeCompanyId, zoom, offset, highlightMap);
}
```

### `src/components/game/IsometricView.tsx`
```typescript
import { useHighlights } from '../../contexts/HighlightContext';
import { hexToRgba } from '../../utils/mapRenderer';

// In component:
const { getCompanyHighlight } = useHighlights();

// In render callback, for buildings (~line 224):
const isOwned = tile.owner_company_id === activeCompanyId;
const highlightColor = !isOwned && tile.owner_company_id
  ? getCompanyHighlight(tile.owner_company_id) : null;

if (isOwned) {
  ctx.shadowColor = 'rgba(59, 130, 246, 0.8)';  // existing blue
  ctx.shadowBlur = 12 * zoom;
} else if (highlightColor) {
  ctx.shadowColor = hexToRgba(highlightColor, 0.8);
  ctx.shadowBlur = 12 * zoom;
}
// ... draw building ...
if (isOwned || highlightColor) {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
}

// Same pattern for claim stakes (~line 299)
```

## Database Changes
None

## Test Cases
1. Highlight company orange → zoomed-out shows solid orange squares
2. Highlight company purple → zoomed-in shows purple halo on buildings
3. Multiple companies highlighted → each shows its own color
4. Remove highlight → reverts to red tint (zoomed-out) / no halo (zoomed-in)
5. User's own properties still show blue (unchanged)

## Acceptance Checklist
- [ ] Zoomed-out map shows highlighted companies as solid colored squares
- [ ] Zoomed-in map shows highlighted companies with colored halos
- [ ] User's blue properties unchanged
- [ ] Non-highlighted rivals show red tint (zoomed-out) / no halo (zoomed-in)
- [ ] Highlights update immediately when changed

## Deployment
```bash
npm run dev
# Set highlight on enemy company
# Navigate to map, verify colors in both zoom levels
```

## Handoff Notes
Feature complete. All stages implemented.
