# Phaser Integration Master Plan

## Feature Overview
Replace Canvas2D `IsometricView.tsx` with Phaser 3 game engine using true isometric projection (88x44 tiles), adding animated characters and vehicles.

**Why:** Current Canvas2D lacks hardware acceleration, animations, and entity systems. Phaser provides GPU rendering, sprite batching, and built-in animation support.

## Success Criteria
- [x] Phaser view renders all tiles/buildings identically to current view
- [x] Click, pan, zoom work on desktop and mobile
- [x] Ownership outlines and damage/fire overlays render correctly
- [x] Characters walk with 4-direction animations
- [x] Vehicles follow road tiles
- [ ] 60 FPS with 100+ buildings on mid-range devices (needs performance testing)

## Dependencies & Prerequisites
- Pogicity reference repo cloned at `pogicity-reference/`
- Existing R2 sprite pipeline functional
- Current IsometricView.tsx working for comparison

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Phaser bundle size (~1MB) | High | Medium | Lazy load, code split |
| Mobile WebGL issues | Medium | High | Phaser.CANVAS fallback |
| Asset loading race conditions | Medium | Medium | Proper async handling |
| Coordinate math bugs | Low | High | Unit tests for conversions |

## Stage Index
1. ✅ **Foundation** — Phaser setup, coordinate system, basic tile rendering [COMPLETE]
2. ✅ **Buildings & Terrain** — All terrain types, building sprites, ownership outlines [COMPLETE]
3. ✅ **Interactions & Effects** — Click/pan/zoom, damage overlays, fire effects [COMPLETE]
4. ✅ **Characters & Vehicles** — GIF animations, walking NPCs, road-following cars [COMPLETE]

## Out of Scope
- Asset regeneration for 88x44 (use existing sprites with scaling)
- Road auto-connection visual system (future enhancement)
- Weather effects
- Sound integration
- Multiplayer entity sync

## Key Constants
```typescript
TILE_WIDTH = 88
TILE_HEIGHT = 44
DEPTH_Y_MULT = 10000
```

## Reference Files
- `[Ref: pogicity-reference/app/components/game/phaser/PhaserGame.tsx]`
- `[Ref: pogicity-reference/app/components/game/phaser/MainScene.ts]`
- `[Ref: pogicity-reference/app/components/game/phaser/GifLoader.ts]`
- `[Ref: authentication-dashboard-system/src/components/game/IsometricView.tsx]` — current Canvas2D implementation
- `[Ref: authentication-dashboard-system/src/hooks/useIsometricAssets.ts]` — sprite loading
- `[Ref: authentication-dashboard-system/src/utils/isometricRenderer.ts]` — coordinate utils & sprite URLs
