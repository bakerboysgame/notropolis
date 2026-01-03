# Master Plan: Tiered Sprite Output with map_scale

## Feature Overview

Standardize sprite output sizes by category tier and add `map_scale` configuration to control how each asset appears on the game map. This ensures consistent quality within categories while optimizing file sizes for fast load times.

**Why:** Current pipeline outputs variable sizes per building (64-320px), making visual consistency unpredictable. Some sprites are too small, others unnecessarily large. A tiered approach with configurable map_scale gives control over both quality and appearance.

---

## Success Criteria

- [x] All building sprites output at 320x320 WebP ✅
- [x] All effect sprites output at 320x320 WebP ✅
- [x] All terrain sprites output at 320x320 WebP ✅
- [x] All vehicle sprites output at 128x128 WebP ✅
- [x] All NPC sprites output at 64x64 WebP ✅ (0 approved)
- [x] `map_scale` column exists in `building_configurations` table ✅
- [x] `map_scale` column exists in `asset_configurations` table ✅
- [x] Admin UI shows map_scale slider for each asset ✅
- [x] Existing approved sprites reprocessed to new sizes ✅
- [x] Game client can retrieve map_scale via API ✅

---

## Dependencies & Prerequisites

| Dependency | Status | Notes |
|------------|--------|-------|
| Cloudflare Image Transformations | Ready | Already configured for api.notropolis.net |
| Slazzer background removal | Ready | Working in current pipeline |
| R2 public bucket | Ready | assets.notropolis.net configured |
| D1 database | Ready | building_configurations and asset_configurations tables exist |
| Admin dashboard | Ready | AssetManager.tsx has BuildingEditForm pattern |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Cloudflare resize fails for some images | Low | Medium | Keep original in private bucket, log errors, allow manual retry |
| CDN caches old sprites | Medium | Low | Purge cache after reprocessing, use versioned filenames |
| Game client doesn't handle map_scale | Medium | Medium | Add default scale fallback (1.0), document API response format |
| Upscaling small source images looks bad | Low | Medium | Use fit: 'scale-down' to prevent upscaling beyond source size |

---

## Stage Index

| Stage | Name | Status | Description |
|-------|------|--------|-------------|
| 01 | Database Migration | ✅ Complete | Add map_scale columns to configuration tables |
| 02 | Worker Pipeline Update | ✅ Complete | Update getTargetDimensions() and resize logic for tiered sizes |
| 03 | Backend API Updates | ✅ Complete | Modify configuration endpoints to include map_scale |
| 04 | Reprocess Sprites | ✅ Complete | Batch convert all approved sprites to new sizes |
| 05 | Frontend UI | ✅ Complete | Add map_scale slider to admin Asset Manager |

---

## Tiered Size Configuration

| Category | Output Size | Default map_scale | Rationale |
|----------|-------------|-------------------|-----------|
| building_sprite | 320x320 | Per-building (0.2-1.0) | Largest sprites, need detail |
| effect | 320x320 | 1.0 | Overlay effects match building scale |
| terrain | 320x320 | 1.0 | Map tiles need crisp edges |
| vehicle | 128x128 | 0.4 | Cars are medium-sized |
| npc | 64x64 | 0.1 | People are small, save bandwidth |
| overlay | 128x128 | 0.4 | UI overlays don't need full resolution |
| ui | 64x64 | 0.2 | Minimap icons are tiny |

---

## Out of Scope

- **Avatar sprites** - Handled separately in avatar composition system
- **Reference sheets** - These are not resized (used for generation context only)
- **Scene backgrounds** - Full resolution, no map_scale needed
- **Animation frame timing** - This plan covers size/scale, not animation speed
- **Game client rendering logic** - Client team handles how map_scale is applied

---

## File Overview

| File | Stages | Changes |
|------|--------|---------|
| `worker/migrations/0031_add_map_scale.sql` | 01 | New migration file |
| `worker/src/routes/admin/assets.js` | 02, 03 | Pipeline + API updates |
| `src/services/assetApi.ts` | 05 | TypeScript interfaces |
| `src/components/assets/AssetManager.tsx` | 05 | UI slider component |

---

## Deployment Sequence

```
Stage 01: Migration     → wrangler d1 execute
Stage 02: Worker        → wrangler deploy --env production
Stage 03: (included in Stage 02 deployment)
Stage 04: Reprocess     → curl API endpoints
Stage 05: Frontend      → npm run build && wrangler pages deploy
```
