# Enemy Headquarters Feature - Master Plan

## Feature Overview
Allow users to view enemy company info from Statistics page and highlight their properties with custom colors on both zoomed-out and zoomed-in map views.

## Success Criteria
- [ ] Clicking company name in Statistics navigates to Enemy HQ page
- [ ] Enemy HQ page displays company info and color picker with 8 colors
- [ ] Selected highlights persist in localStorage across sessions
- [ ] Zoomed-out map shows highlighted companies as solid colored squares
- [ ] Zoomed-in map shows highlighted companies with colored halos

## Dependencies & Prerequisites
- Statistics page exists and shows company leaderboards
- MapCanvas and IsometricView render ownership correctly
- React Context pattern established (ThemeContext as reference)

## Risk Assessment
| Risk | Mitigation |
|------|------------|
| Backend may not have public company endpoint | Use data from statistics API or create simple endpoint |
| Color conflicts with existing map colors | Using 8 carefully selected colors avoiding blue/red/green |

## Stage Index
1. **Foundation** — Create HighlightContext and wire into App.tsx
2. **UI & Navigation** — Create EnemyHeadquarters page, update Statistics for navigation
3. **Map Rendering** — Update MapCanvas, mapRenderer, and IsometricView for highlights

## Out of Scope
- Admin controls for highlights
- Sharing highlights between users
- Custom color picker (preset colors only)
- Backend API for persisting highlights (localStorage only)

## Color Palette
```
Orange (#F97316), Yellow (#EAB308), Pink (#EC4899), Purple (#A855F7)
Cyan (#06B6D4), Lime (#84CC16), Fuchsia (#D946EF), Amber (#F59E0B)
```
