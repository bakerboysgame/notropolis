# Stage Prompts

## Stage 1: Foundation
```
Implement Stage 1 per plans/enemy-headquarters/01-foundation.md

Create src/contexts/HighlightContext.tsx following ThemeContext.tsx pattern:
- HIGHLIGHT_COLORS: 8 colors (Orange #F97316, Yellow #EAB308, Pink #EC4899, Purple #A855F7, Cyan #06B6D4, Lime #84CC16, Fuchsia #D946EF, Amber #F59E0B)
- Map<companyId, {companyId, companyName, color}> state
- localStorage key: 'notropolis_company_highlights'
- Exports: useHighlights(), setCompanyHighlight(), getCompanyHighlight(), HIGHLIGHT_COLORS

Update src/App.tsx to wrap with HighlightProvider inside CompanyProvider.
```

## Stage 2: UI & Navigation
```
Implement Stage 2 per plans/enemy-headquarters/02-ui-navigation.md

Create src/pages/EnemyHeadquarters.tsx:
- Route param: companyId
- Display company info (fetch from statistics data or simple endpoint)
- Color picker: 8 preset colors + "none" option
- Uses useHighlights() to get/set highlights
- Back button to /statistics

Update src/App.tsx: Add route /enemy-hq/:companyId (same protection as /statistics)

Update src/pages/Statistics.tsx:
- Make company names clickable (except user's own)
- Navigate to /enemy-hq/{companyId}
- Style: hover:text-purple-400 hover:underline
```

## Stage 3: Map Rendering
```
Implement Stage 3 per plans/enemy-headquarters/03-map-rendering.md

Highlighted companies should render EXACTLY like user's own properties:
- Zoomed out (mapRenderer.ts): solid color square, no white dot
- Zoomed in (IsometricView.tsx): colored halo via ctx.shadowColor

Update src/utils/mapRenderer.ts:
- Add param: highlightedCompanies?: Map<string, string>
- Add hexToRgba() utility
- For highlighted rivals: use solid highlight color (same as user's blue logic)
- Skip white dot for highlighted companies (same as isOwnedByUser check)

Update src/components/game/MapCanvas.tsx:
- Import useHighlights(), convert to Map<id, color>
- Pass highlightMap to all renderMap() calls

Update src/components/game/IsometricView.tsx:
- Import useHighlights(), hexToRgba
- For buildings/stakes: if highlighted, apply ctx.shadowColor = hexToRgba(color)
- Same shadow pattern as user's blue halo (shadowBlur = 12 * zoom)
```
