# Terrain System Overhaul - Master Plan

## Feature Overview

Update the terrain system to support:
- All terrain types with pogicity placeholders in asset manager
- Reference sprite upload with pogicity tiles as style references
- Terrain-specific pipeline (remove BG, trim, resize to 63x32)
- Auto-tiling roads in map builder (neighbor-aware variant selection)

## Success Criteria

- [x] Terrain tab shows all terrain types (grass, road, water, dirt_track, trees, snow, sand, mountain)
- [x] Pogicity tiles imported as approved placeholders in asset manager
- [x] Terrain reference system prompt defines 63x32 isometric diamond specs
- [x] Pipeline processes terrain: remove BG → trim → resize to 63x32
- [x] Map builder auto-selects road variants based on neighbors (straight/corner/T-junction/crossroad)
- [x] Phaser game renderer displays correct terrain variants

## Dependencies & Prerequisites

- Existing asset manager at `/admin/assets` with terrain tab
- Cloudflare worker with Slazzer integration for background removal
- Pogicity tiles in `/public/Tiles/` (63x32 isometric diamonds)
- Map builder at `/admin/maps` with tile painting

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Auto-tile logic complexity | Medium | Start with roads only, add water/dirt later |
| Pipeline resize quality | Low | Use Cloudflare's high-quality transforms |
| Breaking existing maps | High | terrain_variant is nullable, defaults to null |

## Stage Index

1. ✅ **Schema + Backend** — Database migration, types, terrain validation, system prompts
2. ✅ **Asset Manager + Pipeline** — Terrain tab UI, pogicity import, terrain-specific processing
3. ✅ **Auto-Tiling + Renderers** — Map builder auto-tile logic, admin grid + Phaser rendering

## Out of Scope

- Water edge auto-tiling (future enhancement)
- Dirt track auto-tiling (future enhancement)
- Multi-tile terrain transitions (e.g., grass-to-sand gradients)
- Terrain height/elevation system
