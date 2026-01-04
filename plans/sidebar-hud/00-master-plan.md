# Sidebar HUD & Map Layout — Master Plan

## Feature Overview
Add a mission control HUD to the sidebar showing company name, cash (£XX.XX format), and level. Fix missing sidebar on map pages. Add mini-map overlay in zoomed view.

## Success Criteria
- [x] Sidebar visible on `/map/:mapId` in both overview and zoomed modes
- [x] HUD displays company name, cash (2 decimal places, e.g., £15678.68), and level
- [x] Right sidebar (`MapOverview`) removed from GameMap
- [x] Prison status indicator shown when applicable
- [x] Sidebar scrollable on mobile
- [x] Mini-map in zoomed mode showing viewport position

## Dependencies & Prerequisites
- CompanyContext already provides `activeCompany` with all needed data
- Layout component already handles sidebar state and map view mode
- No new API endpoints required

## Risk Assessment
| Risk | Mitigation |
|------|------------|
| Map layout breaks when wrapped with Layout | Test both view modes after change |
| HUD doesn't fit in collapsed sidebar | Design compact collapsed variant |

## Stage Index
1. **Stage 1** — Create CompanyHUD component and integrate into Sidebar ✅
2. **Stage 2** — Fix GameMap: wrap with Layout, remove right sidebar ✅
3. **Stage 3** — Fix sidebar mobile scrolling ✅
4. **Stage 4** — Add mini-map overlay in zoomed mode ✅

## Files Modified
- `src/App.tsx` — Wrapped map route with Layout
- `src/components/CompanyHUD.tsx` — New HUD component (£XX.XX format)
- `src/components/Sidebar.tsx` — Added HUD, fixed mobile scrolling
- `src/pages/GameMap.tsx` — Removed right sidebar, added MiniMap
- `src/components/game/MiniMap.tsx` — New mini-map component

## Out of Scope
- Hero goals display
- Extended stats (monthly profit, net worth, buildings)
- API changes
