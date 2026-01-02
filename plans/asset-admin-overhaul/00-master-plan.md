# Asset Admin System Overhaul - Master Plan

## Feature Overview

**What:** Complete redesign of the asset generation admin system at `https://boss.notropolis.net/admin/assets` to provide full control over AI prompts, reference images, and Gemini generation settings.

**Why:**
- Current system wastes expensive Gemini tokens due to poor prompt control
- Outcomes are bad because prompts are hardcoded and not editable
- No ability to provide reference images to guide generation
- No visibility into or control over Gemini configuration parameters
- Workflow is confusing with unclear regeneration behavior

**Current State:**
- Prompts hardcoded in `assets.js` (~49,000 lines)
- No prompt editing UI (view-only)
- No reference image management
- No Gemini settings exposed (temperature, topK, topP)
- Regenerate behavior unclear (doesn't preserve old versions properly)

**Target State:**
- Three-stage workflow with full control at each stage
- Editable prompts stored in database
- Reference image library (upload + select from existing)
- All Gemini parameters exposed
- Clean regeneration flow that preserves history

---

## Success Criteria

| Criterion | Measurement |
|-----------|-------------|
| Prompt Editing | User can view, edit, and save prompts for any asset type before generation |
| Reference Images | User can upload images to library AND select approved assets as references |
| Gemini Settings | Temperature, topK, topP sliders available in generation UI |
| Manual Sprite Generation | User generates sprites 1-by-1 with full control over prompt, references, and Gemini settings |
| Sprite Requirements | System knows which sprites each asset type needs (hardcoded: buildings=1, terrain=5, etc.) |
| Regenerate Preservation | Regenerating creates NEW version; old stays as "Ready for Review" |
| Post-Approval Pipeline | Approve on sprite triggers: bg removal → trim → private PNG → Cloudflare WebP → public |
| Prompt Templates | Base prompts stored in DB, editable per category/asset_key |
| Settings Persistence | Generation settings stored per-asset for reproducibility |
| Asset Manager | All asset types configurable with price editing for buildings, publish for all |
| Base Ground Layer | Seamless tiling grass texture that appears BEHIND all terrain (roads, dirt, properties) |
| Game Integration | Approved + Published assets available via public URLs for game consumption |

---

## Schema Verification (Completed)

| Check | Status | Notes |
|-------|--------|-------|
| Existing migrations reviewed | ✅ | 0001-0025a exist; new migration = 0026 |
| `generated_assets` table | ✅ | Needs: generation_settings, auto_created, auto_created_from, is_active |
| Test tokens file | ✅ | `docs/REFERENCE-test-tokens/CLAUDE.md` exists with valid master_admin token |
| No column conflicts | ✅ | New columns don't exist yet in any migration |
| Category table | ✅ | All required categories exist in 0024 |

---

## Dependencies & Prerequisites

### Required Before Starting
- [ ] Access to Cloudflare Workers environment
- [ ] Access to D1 database (migrations)
- [ ] Access to R2 buckets (R2_PRIVATE, R2_PUBLIC)
- [ ] Gemini API key configured
- [ ] Slazzer API key configured (background removal)

### External Services
- **Gemini API**: `gemini-3-pro-image-preview` model
- **Slazzer API**: Background removal service
- **Cloudflare Image Transformations**: Resize + WebP conversion

### Existing Code Dependencies
- [Ref: authentication-dashboard-system/worker/src/routes/admin/assets.js] - Core backend
- [Ref: authentication-dashboard-system/src/components/assets/] - Frontend components
- [Ref: authentication-dashboard-system/src/services/assetApi.ts] - API client
- [Ref: authentication-dashboard-system/migrations/0023_create_asset_tables.sql] - Current schema

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Migration breaks existing data | High | Low | Test migrations on staging first; backup DB |
| Gemini API changes | Medium | Low | Abstract API calls; version check responses |
| Large file breaks `assets.js` | Medium | Medium | Consider splitting into modules after overhaul |
| Reference images bloat R2 | Low | Medium | Implement archive/cleanup; thumbnail generation |
| Prompt templates diverge from code | Medium | Medium | Seed from existing; maintain sync mechanism |

---

## Stage Index

| Stage | Name | Description |
|-------|------|-------------|
| 01 ✅ | Database Schema | Create new tables: reference_images, asset_reference_links, prompt_templates; alter generated_assets |
| 02 ✅ | Reference Library Backend | API endpoints for uploading, listing, and managing reference images |
| 03 ✅ | Prompt Templates Backend | API endpoints for viewing, editing, and versioning prompt templates |
| 04 ✅ | Enhanced Generate Endpoint | Modify generate to accept custom prompts, reference images, and Gemini settings |
| 05 ✅ | Post-Approval Pipeline | Sprite approval triggers: bg removal → trim → private PNG → Cloudflare WebP → public |
| 05a ✅ | Sprite Generation Flow | Manual sprite generation with parent ref selection, full Gemini control, sprite requirements tracking |
| 06 ✅ | Regenerate Flow | Modify regenerate to preserve old versions and accept parameter overrides |
| 07 ✅ | Frontend Generate Modal | Multi-step wizard with prompt editor, reference picker, parent ref selector, and settings |
| 08 ✅ | Frontend Preview Modal | Add prompt editing, reference display, settings display, enhanced regenerate |
| 08a ✅ | System Instructions UI | Add system instructions editing to prompt editor (Advanced Settings) |
| 09 ✅ | Integration Testing | End-to-end testing of all stages; performance verification |
| 10 ✅ | Asset Manager | Expand Building Manager with price editing + all asset types (NPCs, effects, terrain, base ground) |
| 11 | UI Testing Guide | Manual testing of all features through the admin UI |
| 12 ✅ | R2 Asset Archival | Archive existing assets to make way for fresh generation with corrected specs |
| 13 ✅ | Prompt Template Migration | Update templates with square format, system instructions, comprehensive prompts |

---

## Out of Scope

This plan does NOT cover:

- **Bulk operations** - Mass regeneration, bulk approval (future enhancement)
- **Prompt versioning UI** - History view exists but no rollback UI
- **A/B testing framework** - Comparing prompt effectiveness
- **Cost tracking** - Monitoring Gemini token usage per generation
- **Prompt suggestions/AI assist** - Auto-improving prompts based on rejections
- **Reference image tagging** - Advanced search/filter for library
- **Auto-sprite creation** - All sprites are manually generated with full control (NO auto-spawn)
- **Splitting assets.js** - Code organization refactor (separate effort)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        ADMIN UI                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ GenerateModal│  │PreviewModal  │  │RefLibrary    │          │
│  │ (Wizard)     │  │(Edit/Approve)│  │(Upload/Select)│          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
└─────────┼─────────────────┼─────────────────┼───────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      assetApi.ts                                 │
│  generate() | approve() | regenerate() | uploadRef() | ...      │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    assets.js (Backend)                          │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │/generate   │ │/approve    │ │/regenerate │ │/ref-library│   │
│  │            │ │            │ │            │ │            │   │
│  │- prompt    │ │- pipeline  │ │- preserve  │ │- upload    │   │
│  │- refs      │ │  (sprites) │ │  old ver   │ │- list      │   │
│  │- settings  │ │- bg remove │ │- new ver   │ │- delete    │   │
│  │- parent_id │ │- trim/webp │ │            │ │            │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                       D1 Database                                │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐      │
│  │generated_assets│ │reference_images│ │prompt_templates│      │
│  │+ gen_settings  │ │                │ │                │      │
│  │+ auto_created  │ │                │ │                │      │
│  └────────────────┘ └────────────────┘ └────────────────┘      │
│                                                                  │
│  ┌────────────────┐                                             │
│  │asset_ref_links │ (joins assets ↔ references)                 │
│  └────────────────┘                                             │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    External Services                             │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                  │
│  │ Gemini API │ │ Slazzer    │ │ Cloudflare │                  │
│  │ (Generate) │ │ (BG Remove)│ │ (Resize)   │                  │
│  └────────────┘ └────────────┘ └────────────┘                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
authentication-dashboard-system/
├── migrations/
│   ├── 0026_asset_generation_overhaul.sql  [NEW - Stage 01]
│   └── 0028_create_asset_configurations.sql [NEW - Stage 10]
├── worker/src/routes/admin/
│   └── assets.js                            [MODIFY - Stages 02-06, 10]
└── src/
    ├── components/assets/
    │   ├── GenerateModal/                   [NEW - Stage 07]
    │   │   ├── index.tsx
    │   │   ├── CategoryStep.tsx
    │   │   ├── PromptEditorStep.tsx
    │   │   ├── ReferenceImagesStep.tsx
    │   │   ├── SettingsStep.tsx
    │   │   └── ReviewStep.tsx
    │   ├── ReferenceLibrary/                [NEW - Stage 07]
    │   │   ├── index.tsx
    │   │   ├── UploadDropzone.tsx
    │   │   └── ReferenceImageCard.tsx
    │   ├── GenerateModal.tsx                [REPLACE - Stage 07]
    │   ├── AssetPreviewModal.tsx            [MODIFY - Stage 08]
    │   ├── BuildingManager.tsx              [RENAME → AssetManager.tsx - Stage 10]
    │   └── AssetManager.tsx                 [NEW - Stage 10]
    └── services/
        └── assetApi.ts                      [MODIFY - Stages 02-06, 10]
```

---

## Deployment Strategy

1. **Database First** - Run migration before any code changes
2. **Backend Next** - Deploy worker with new endpoints (backward compatible)
3. **Frontend Last** - Deploy UI changes after backend is stable
4. **Feature Flag** - Consider `USE_NEW_GENERATE_MODAL` flag for rollback

---

## Base Ground Layer Concept

The game map requires a **base ground layer** that appears BEHIND all other terrain. This is a **large tiled background image** (not individual tile sprites) - typically grass that creates the "world floor".

### Visual Hierarchy (Bottom to Top)
1. **Base Ground** - Large seamless background image (CSS/canvas tiled)
2. **Terrain Tiles** - Roads, water, dirt tracks, trees (placed on top)
3. **Ownership Overlays** - Green/red tints for owned tiles
4. **Buildings** - Building sprites
5. **Effects** - Fire, damage, status indicators

### Base Ground Requirements
- **Large Image**: One seamless background image, NOT individual tiles
- **CSS/Canvas Tiled**: Repeated via CSS `background-repeat` or canvas pattern
- **Configurable**: Can be changed in Asset Manager
- **Generated via Gemini**: Single large seamless texture

### Terrain Tiles Needed (ON TOP of base ground)
Only these terrain types need individual sprites:
- **Road** - Asphalt with sidewalks
- **Water** - Blue water texture
- **Dirt Track** - Worn earth path
- **Trees** - Forest/tree clusters

### R2 Storage
```
PUBLIC BUCKET: notropolis-game-assets
├── backgrounds/
│   └── base_ground_grass.webp    # Large seamless background
└── sprites/
    └── terrain/
        ├── road_*.webp           # Road variants
        ├── water_*.webp          # Water variants
        ├── dirt_track_*.webp     # Dirt track variants
        └── trees_*.webp          # Tree variants
```

---

## Related Documents

- [Ref: 01-database-schema.md] - Database migration details
- [Ref: 02-reference-library-backend.md] - Reference library API
- [Ref: 03-prompt-templates-backend.md] - Prompt template API
- [Ref: 04-enhanced-generate-endpoint.md] - Generate endpoint changes
- [Ref: 05-post-approval-pipeline.md] - Sprite approval pipeline (bg removal, trim, resize, publish)
- [Ref: 05a-sprite-generation-flow.md] - Manual sprite generation with full Gemini control
- [Ref: 06-regenerate-flow.md] - Regeneration behavior
- [Ref: 07-frontend-generate-modal.md] - New generate wizard with parent ref selector
- [Ref: 08-frontend-preview-modal.md] - Preview modal updates
- [Ref: 08a-system-instructions-ui.md] - System instructions editing in Advanced Settings
- [Ref: 09-integration-testing.md] - Testing plan
- [Ref: 10-asset-manager.md] - Asset Manager with price editing
- [Ref: 11-ui-testing-guide.md] - Manual UI testing guide
- [Ref: 12-r2-asset-archival.md] - R2 asset archival procedure
- [Ref: asset-pipeline-reference.md] - Base ground asset prompts and specifications
- [Ref: WORKER-PROMPTS.md] - Worker prompts for implementation

---

## R2 Asset Archival Plan

After the asset admin overhaul is complete, archive existing assets and start fresh with corrected specifications.

### What to Archive

| Category | Action | Reason |
|----------|--------|--------|
| Buildings (refs + sprites) | Archive | Regenerate with square tiles, correct perspective |
| Terrain | Archive | Regenerate as 64x64 square tiles (not 64x32 diamond) |
| NPCs | Archive | Regenerate with simplified 2-frame walk cycle |
| Vehicles | Archive | Regenerate with single rotatable sprite |
| Effects | Archive | Regenerate with correct specs |
| **Avatars** | **KEEP** | Avatar assets remain in place |

### Archival Process

```bash
# Step 1: Create archive folder structure
# (Run after overhaul is complete, before generating new assets)

# Move to archive - EXCEPT avatars
R2_PUBLIC/
├── archive/
│   └── 2025-01-pre-overhaul/
│       ├── buildings/        # Moved from sprites/buildings/
│       ├── terrain/          # Moved from sprites/terrain/
│       ├── npc/              # Moved from sprites/npc/
│       ├── vehicles/         # Moved from sprites/vehicles/
│       └── effects/          # Moved from sprites/effects/
└── sprites/
    └── avatars/              # STAYS IN PLACE - do not archive
```

### Database Cleanup

After archiving R2 assets:
1. Mark archived assets as `status: 'archived'` in `generated_assets` table
2. Clear `r2_url` for archived assets
3. Keep avatar records unchanged

### Fresh Start

With corrected specifications:
- **Buildings**: Square canvas, elevated view, 3D with front + right side
- **Terrain**: 64x64 square tiles
- **Pedestrians**: 2 frames (A/B), game rotates for direction
- **Vehicles**: 1 sprite per type, game rotates for direction
- **Base Ground**: 64x64 seamless tiling texture
