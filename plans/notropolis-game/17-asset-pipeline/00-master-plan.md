# Stage 17: Asset Generation Pipeline - Master Plan

## Feature Overview

Automated asset generation pipeline using Google Gemini API to create all game visual assets with a staged review workflow. Assets include building reference sheets, building sprites, dirty trick effects, and scene illustrations.

**Why:** Manual asset creation is time-consuming and inconsistent. An automated pipeline with review checkpoints ensures consistent 90s CGI aesthetic while allowing human oversight at each stage.

**What:**
- API-driven image generation via Gemini
- Automatic background removal for sprites
- Admin interface for reviewing, approving, and regenerating assets
- Staged workflow: Reference Sheets → Sprites → Effects → Scenes

---

## Success Criteria

| Category | Count | Format |
|----------|-------|--------|
| Terrain tiles | 38 | PNG 64×32 (with variants) |
| Building reference sheets | 13 | PNG |
| Building sprites (transparent) | 13 | PNG |
| Ownership overlays | 2 | PNG 64×32 |
| Status effect overlays | 6 | PNG |
| Dirty trick effect overlays | 6 | PNG (transparent) |
| UI elements | 3 | PNG |
| Scene templates (bg + fg) | 12 | PNG 1920×1080 (8 bg + 4 fg) |
| Ambient NPC sprites | 8 | PNG (4 ped strips + 4 cars) |
| Avatar assets | 34 | PNG 512×512 (transparent) |
| **Total Assets** | **135** | |

**Avatar Asset Breakdown:**
- 2 base bodies
- 6 hair styles
- 8 outfits
- 6 headwear items
- 6 accessories
- 4 backgrounds
- (Skin tones are CSS filters, not images)

**Image Format:** PNG with transparency where needed. WebP could be used for non-transparent assets for smaller file size (future optimization).

**Definition of Done:**
- [ ] All 38 terrain tiles generated and approved (including road/water/dirt variants)
- [ ] All 13 building reference sheets generated and approved
- [ ] All 13 building sprites generated with transparent backgrounds
- [ ] All 2 ownership overlays created
- [ ] All 6 status effect overlays generated
- [ ] All 6 dirty trick overlays generated with transparent backgrounds
- [ ] All 3 UI elements created
- [ ] All 8 scene template backgrounds generated
- [ ] All 4 scene template foregrounds generated (arrest, prison, hero, dirty_trick)
- [ ] All 8 ambient NPC sprites generated (4 pedestrian + 4 car)
- [ ] All 34 avatar assets generated with transparent backgrounds
- [ ] Admin page allows upload, regenerate, preview for all asset types
- [ ] Avatar composite caching system working
- [ ] Scene compositing with avatar slots working
- [ ] Assets deployed to R2 and accessible in game

---

## Dependencies & Prerequisites

| Dependency | Status | Notes |
|------------|--------|-------|
| Google AI API Key | ✅ Added | Worker secret `GEMINI_API_KEY` (for Imagen 3) |
| Removal.ai API Key | ✅ Added | Worker secret `REMOVAL_AI_API_KEY` (buildings only) |
| R2 Bucket | Exists | `pub-874867b18f8b4b4882277d8a2b7dfe80.r2.dev` |
| Worker environment | Exists | Cloudflare Worker with D1/R2 bindings |
| Asset prompts | Ready | Defined in `16a-asset-requirements.md` |
| Building types table | Exists | `building_types` table in D1 |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Gemini rate limits | Medium | Medium | Implement queue with delays, batch processing |
| Inconsistent style output | High | Medium | Reference sheets as anchors, detailed prompts, regenerate option |
| Background removal artifacts | Medium | Low | Manual touch-up option, quality threshold checks |
| API costs exceed budget | Low | Medium | Track usage, set limits, use cheaper models where possible |
| Generated images too small | Medium | Medium | Upscale post-processing if needed |
| Gemini content filtering | Low | High | Adjust prompts if blocked, manual fallback |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Admin Dashboard                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │Buildings│ │ Dirty   │ │ Scenes  │ │ Queue   │           │
│  │   Tab   │ │ Tricks  │ │   Tab   │ │ Status  │           │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘           │
└───────┼──────────┼──────────┼──────────┼───────────────────┘
        │          │          │          │
        ▼          ▼          ▼          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Worker API Routes                         │
│  POST /api/admin/assets/generate                            │
│  POST /api/admin/assets/remove-background  (all sprites)    │
│  GET  /api/admin/assets/queue                               │
│  PUT  /api/admin/assets/:id/approve                         │
└─────────────────────────────────────────────────────────────┘
        │                              │
        ▼                              ▼
┌───────────────┐              ┌───────────────┐
│ Nano Banana   │              │ Removal.ai    │
│     Pro       │              │ (All Sprites) │
└───────────────┘              └───────────────┘
        │                              │
        └──────────────┬───────────────┘
                       ▼
        ┌───────────────────────────────┐
        │         R2 Storage            │
        │  ┌─────────┐  ┌─────────────┐ │
        │  │ PRIVATE │  │   PUBLIC    │ │
        │  │ /refs/  │  │ /sprites/   │ │
        │  │ /raw/   │  │ /scenes/    │ │
        │  └─────────┘  └─────────────┘ │
        └───────────────────────────────┘
```

---

## Quality & Resolution Strategy

### Image Generation Model: Nano Banana Pro (Gemini 3)

Using **Nano Banana Pro** (`gemini-3-pro-image-preview`) via Google AI API - the latest and highest quality image generation model from Google.

**Model:** `gemini-3-pro-image-preview`
**API Method:** `generateContent` with `responseModalities: ["IMAGE", "TEXT"]`
**Max resolution:** Up to 3840×2160 pixels (4K)

Strategy:
- **Reference sheets**: Generate at **3840×2160 (4K)** for maximum detail/quality
- **Game sprites**: Generate at **exact target size** (no downscaling needed)
- **Scene illustrations**: Generate at 1920×1080 (16:9)

### Image Format: WebP

All game-ready assets use **WebP** format:
- 25-35% smaller than PNG
- Supports transparency (lossless WebP with alpha)
- All modern browsers support it
- Originals kept as PNG for editing compatibility

### Two-Bucket Architecture

```
PRIVATE BUCKET: notropolis-assets-private (not public)
├── refs/                         # Reference sheets (3840×2160 PNG, 4K)
│   └── building_restaurant_ref_v1.png
└── raw/                          # Pre-background-removal sprites (PNG)
    └── building_restaurant_raw_v1.png

PUBLIC BUCKET: notropolis-game-assets (game loads from here)
├── sprites/
│   ├── buildings/                # WebP, transparent, exact size (128-320px)
│   ├── terrain/                  # WebP, 64×32
│   ├── effects/                  # WebP, 64×64
│   ├── overlays/                 # WebP, 64×32
│   ├── ui/                       # WebP, 8-68px
│   └── npc/                      # WebP, 32-64px
└── scenes/                       # WebP, 1280×720
```

### Generation Strategy: Target Size

Generate sprites at **exact target dimensions** for optimal quality and file size:

| Asset Type | Generate At | Format | Notes |
|------------|-------------|--------|-------|
| Reference Sheets | 3840×2160 (4K) | PNG | High-res masters, private bucket |
| Building Sprites | 128-320px | WebP | Exact size per building class |
| Terrain Tiles | 64×32 | WebP | Diamond isometric |
| Effects | 64×64 | WebP | Overlay size |
| Scene Illustrations | 1920×1080 → 1280×720 | WebP | Generate large, optimize down |
| UI Elements | Exact size (8-68px) | WebP | Per element |
| NPC Sprites | 64×32 / 32×32 | WebP | Sprite strips |

### Processing Pipeline

```
1. REFERENCE SHEETS (Private) - NO background removal
   └─→ Generate at 3840×2160 PNG (4K resolution)
   └─→ Store in private bucket /refs/
   └─→ Keep original backgrounds for reference/promo use

2. BUILDING SPRITES (Public) - WITH background removal
   └─→ Generate at EXACT target size (128-320px)
   └─→ Background removal via Removal.ai
   └─→ Convert PNG → WebP (lossless with alpha)
   └─→ Store in public bucket /sprites/buildings/

3. OTHER GAME SPRITES (Public) - WITH background removal
   └─→ Effects, overlays, UI, NPCs
   └─→ Generate at EXACT target size
   └─→ Background removal via Removal.ai
   └─→ Convert PNG → WebP (lossless with alpha)
   └─→ Store in public bucket /sprites/{category}/

4. TERRAIN TILES (Public) - WITH background removal
   └─→ Generate at 64×32 (38 variants for auto-tiling)
   └─→ Background removal via Removal.ai
   └─→ Seamless tiling (roads connect, water edges align)
   └─→ Convert PNG → WebP (lossless with alpha)
   └─→ Store in public bucket /sprites/terrain/

5. SCENE ILLUSTRATIONS (Public) - NO transparency needed
   └─→ Generate at 1920×1080
   └─→ Resize to 1280×720
   └─→ Convert to WebP (lossy, ~85% quality)
   └─→ Store in public bucket /scenes/
```

**Background Removal:** All game sprites need Removal.ai processing except scene illustrations (which have full backgrounds). Terrain tiles also need removal for clean edges on variants with overlapping elements (trees, water edges).

### Why This Architecture?

1. **Lightweight** - No unnecessary resolution, WebP compression
2. **Secure** - High-res originals not publicly accessible
3. **Efficient** - Generate at target size, no processing waste
4. **Future-proof** - Originals preserved for re-generation if needed

---

## Stage Index

| Stage | Name | Description | Complexity |
|-------|------|-------------|------------|
| ✅ 01 | Infrastructure | Database schema, API routes, secrets setup | Medium |
| 02 | Building Reference Sheets | Generate 13 building multi-view references | Medium |
| 03 | Building Sprites | Generate sprites from refs, remove backgrounds | Medium |
| 04 | Effect Assets | 6 dirty trick effects + 6 status effect overlays | Medium |
| 05 | Scene Templates | Generate layered scene backgrounds + foregrounds | Medium |
| 06 | Terrain, UI & NPC Assets | 38 terrain, 2 overlays, 3 UI, 8 NPC sprites | Medium |
| 07 | Asset Admin Page | Full management UI with preview and regenerate | High |
| 08 | Avatar Assets | Generate 34 avatar components (body, outfits, etc.) | High |

---

## Workflow

```
Stage 1: Infrastructure
    │
    ▼
Stage 2: Building Reference Sheets ──────┐
    │                                     │
    ├── Generate 13 refs                  │ Manual
    ├── Upload to R2/refs/                │ Review
    └── Admin review ◄────────────────────┘ Checkpoint
    │
    ▼
Stage 3: Building Sprites ───────────────┐
    │                                     │
    ├── Generate from refs                │ Manual
    ├── Remove backgrounds                │ Review
    ├── Upload to R2/sprites/             │ Checkpoint
    └── Admin review ◄────────────────────┘
    │
    ▼
Stage 4: Dirty Trick Assets ─────────────┐
    │                                     │
    ├── Generate effect refs              │ Manual
    ├── Generate overlay sprites          │ Review
    └── Admin review ◄────────────────────┘ Checkpoint
    │
    ▼
Stage 5: Scene Templates ────────────────┐
    │                                     │
    ├── Generate 8 backgrounds            │ Manual
    ├── Generate 4 foregrounds            │ Review
    ├── Configure avatar slots            │ Checkpoint
    └── Admin review ◄────────────────────┘
    │
    ▼
Stage 6: Terrain, UI & NPC Assets
    │
    ▼
Stage 7: Asset Admin Page
    │
    ├── Full CRUD UI
    ├── Preview on map tile
    ├── Scene compositing preview
    ├── Regenerate buttons
    └── Batch operations
    │
    ▼
Stage 8: Avatar Assets ──────────────────┐
    │                                     │
    ├── Generate 2 base bodies            │ Manual
    ├── Generate 6 hair styles            │ Review
    ├── Generate 8 outfits                │ Checkpoint
    ├── Generate 6 headwear               │
    ├── Generate 6 accessories            │
    ├── Generate 4 backgrounds            │
    ├── Remove backgrounds                │
    └── Admin review ◄────────────────────┘
```

---

## Out of Scope

This plan does NOT cover:

- **Animated sprites** - Static images only (pedestrians have 2-frame walk cycle but no full animation)
- **Sound effects** - Audio is separate system
- **3D model generation** - 2D sprites only
- **AI upscaling** - Gemini outputs at sufficient resolution; we downscale for game use
- **Version control for assets** - Single approved version per asset (originals kept for reference)

**Note:** Avatar assets are NOW included in Stage 08, integrating with the avatar system defined in Stage 15.

---

## API Keys (Production Secrets)

Secrets are stored in Cloudflare Worker:

| Secret | Purpose | Status |
|--------|---------|--------|
| `GEMINI_API_KEY` | Nano Banana Pro image generation via Google AI API | ✅ Added |
| `REMOVAL_AI_API_KEY` | Background removal for all game sprites | ✅ Added |

**API Documentation:**
- Gemini Image Generation: https://ai.google.dev/gemini-api/docs/image-generation
- Removal.ai: https://removal.ai/api-documentation/

---

## Cost Estimate

| Service | Usage | Est. Cost |
|---------|-------|-----------|
| Nano Banana Pro | ~120 images (refs + sprites + terrain + scenes × 2 variants) | ~$3-5 |
| Removal.ai | ~79 images (all game sprites including terrain) | Paid credits available |
| R2 Storage | ~50MB images | Free tier |
| **Total** | | **~$2-3** |

*Note: Costs assume 2 variants per asset for selection, some regenerations. Removal.ai needed for all game sprites (~79 assets including 38 terrain tiles).*

---

## File Structure

```
authentication-dashboard-system/
├── src/
│   ├── pages/
│   │   └── AssetAdminPage.tsx          # New admin page
│   ├── components/
│   │   └── assets/
│   │       ├── AssetGrid.tsx           # Grid display
│   │       ├── AssetPreview.tsx        # Preview modal
│   │       ├── GenerationQueue.tsx     # Queue status
│   │       └── BuildingPreview.tsx     # Isometric preview
│   └── services/
│       └── assetApi.ts                 # API client
├── worker/
│   └── src/
│       └── routes/
│           └── admin/
│               └── assets.js           # Asset generation routes
├── migrations/
│   └── 0022_create_asset_tables.sql    # Asset management tables
```

---

## References

- [Ref: plans/notropolis-game/16a-asset-requirements.md] - All prompts and specifications
- [Ref: plans/notropolis-game/15-avatar-system.md] - Avatar layer system (integration)
- [Ref: plans/notropolis-game/16-visual-polish.md] - Visual requirements
- [Ref: 17-asset-pipeline/08-avatar-assets.md] - Avatar asset generation specs
- [Ref: 17-asset-pipeline/character sheet template.jpg] - Character style reference
