# Visual Upgrade: Pogocity Sprites - Master Plan

## Feature Overview

Upgrade Notropolis zoomed map view with pogocity's high-quality building/character sprites and vertical slice rendering for proper depth sorting. This is a **visual-only upgrade** — zero changes to game mechanics, database schema, or API endpoints.

**Why**: Current single-sprite rendering causes depth sorting issues where characters always render fully behind OR fully in front of buildings. Pogocity's proven vertical slice algorithm allows natural interleaving (characters can walk "through" buildings).

**What**: Replace 15 building sprites, add apple character option, implement vertical slice rendering, add lamp glow effects.

---

## Success Criteria

✅ **Visual Quality**
- All 15 Notropolis buildings render with appropriate pogocity sprites
- Characters/vehicles properly interleave with building slices (behind some parts, in front of others)
- Lamp glow effects add ambiance without performance impact
- No visual artifacts, clipping, or z-fighting

✅ **Performance**
- Maintain 60 FPS with 100+ buildings + 20+ characters/vehicles
- No memory leaks
- Load time < 3 seconds for building textures

✅ **Compatibility**
- Existing save games work without changes
- All game mechanics unchanged (costs, profits, adjacency)
- Backward compatible with existing character sprites

---

## Dependencies & Prerequisites

**Required**:
- ✅ Stage 4 complete (CharacterSystem, VehicleSystem, depthFromSortPoint already implemented)
- ✅ Asset Manager system operational at https://boss.notropolis.net/admin/assets
- ✅ Building sprites can be published via Asset Manager UI
- ✅ Local fallback sprites in `/public/Building/` (for development)
- ✅ Apple character GIFs in `/public/Characters/` (already present)
- ✅ Phaser 3.90+ with texture slicing support

**Key Architecture**:
- **Sprite URLs come from Asset Manager API** - not hardcoded paths
- Footprint metadata stored locally in `buildingMetadata.ts`
- `assetLoader.ts` provides sprite URL cache that can be populated from API

**Assumptions**:
- Buildings remain 1x1 placement (multi-tile placement deferred to future)
- South-facing orientation only (rotation deferred to future)
- No database schema changes

---

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Vertical slice depth bugs | High | Medium | Use exact pogocity algorithm, extensive testing |
| Performance degradation | Medium | Low | Early benchmarking, LOD if needed |
| Sprite mapping aesthetics | Low | Medium | Easy config change, no code required |
| Build size increase | Low | Low | Assets already present (16MB) |

**Rollback Strategy**: Feature flags allow reverting to single-sprite rendering while keeping metadata infrastructure.

---

## Stage Index

**Stage 1: Foundation** ✅ COMPLETE (Low complexity)
- Create building metadata configuration
- Update asset loader with helper functions
- Add depth layer constants
- **Deliverable**: Metadata system ready, no visual changes yet

**Stage 2: Vertical Slice Rendering** (High complexity)
- Implement vertical slice renderer utility
- Refactor BuildingRenderer to use slices
- Update depth calculations
- **Deliverable**: Buildings render with slices, characters/vehicles interleave properly

**Stage 3: Character Sprites & Visual Effects** (Medium complexity)
- Add apple character GIF support
- Implement lamp glow effects
- Polish and testing
- **Deliverable**: Apple character available, glows add ambiance

---

## Out of Scope

❌ **Not Included**:
- Multi-tile building placement (buildings stay 1x1)
- Building rotation (N/E/W directions)
- Database schema modifications
- Game balance changes (costs, profits, adjacency)
- Save/Load system
- Building categories UI
- New game mechanics

❌ **Deferred to Future**:
- Props/decorations system
- Animated buildings
- Weather effects
- Day/night cycle

---

## Implementation Sequence

```
Stage 1 (Foundation) → Stage 2 (Rendering) → Stage 3 (Polish)
     ↓                      ↓                      ↓
  No visual change    Major visual change    Final touches
  Test: metadata      Test: depth sorting    Test: full integration
```

---

## File Structure

```
src/
├── config/
│   └── buildingMetadata.ts (NEW - Stage 1)
├── components/game/phaser/
    ├── utils/
    │   ├── assetLoader.ts (UPDATE - Stage 1)
    │   └── verticalSliceRenderer.ts (NEW - Stage 2)
    ├── systems/
    │   ├── BuildingRenderer.ts (MAJOR UPDATE - Stage 2)
    │   ├── CharacterSystem.ts (UPDATE - Stage 3)
    │   └── EffectsRenderer.ts (UPDATE - Stage 3)
    └── gameConfig.ts (UPDATE - Stage 1)
```

---

## Deployment Notes

- No database migrations required
- Build and deploy to Cloudflare Pages
- Deployment command: `npm run build && npx wrangler pages deploy dist`
- Verification: Visit https://boss.notropolis.net and check zoomed view

---

## Total Effort Estimate

- **Stage 1**: 1-2 hours (setup)
- **Stage 2**: 3-4 hours (core implementation)
- **Stage 3**: 2-3 hours (polish)
- **Total**: 6-9 hours across 3 stages

---

## References

- [Ref: pogocity-reference/app/components/game/phaser/MainScene.ts] - Vertical slice algorithm
- [Ref: /Users/riki/.claude/plans/serialized-moseying-wolf.md] - Original detailed plan
- [Ref: STAGE4_SUMMARY.md] - Character/vehicle system documentation
