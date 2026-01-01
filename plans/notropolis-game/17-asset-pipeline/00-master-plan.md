# Stage 17: Asset Generation Pipeline - Master Plan

## Feature Overview

Automated asset generation pipeline using Google Gemini API to create all game visual assets with a staged review workflow. Every main asset category has a **reference sheet** that establishes the style before game sprites are generated.

**Why:** Manual asset creation is time-consuming and inconsistent. An automated pipeline with review checkpoints ensures consistent 90s CGI aesthetic while allowing human oversight at each stage.

**What:**
- API-driven image generation via Gemini (Nano Banana Pro)
- Automatic background removal for sprites (Removal.ai)
- Reference sheet → sprite workflow for style consistency
- Admin interface for reviewing, approving, and regenerating assets

---

## Asset Inventory (Reference → Sprite Workflow)

### Buildings (13 types)
| Building | Ref Sheet | Sprite | Size Class |
|----------|-----------|--------|------------|
| market_stall | `building_ref` | `building_sprite` | 128×128 (SHORT) |
| hot_dog_stand | `building_ref` | `building_sprite` | 128×128 (SHORT) |
| campsite | `building_ref` | `building_sprite` | 128×128 (SHORT) |
| shop | `building_ref` | `building_sprite` | 192×192 (MEDIUM) |
| burger_bar | `building_ref` | `building_sprite` | 192×192 (MEDIUM) |
| motel | `building_ref` | `building_sprite` | 192×192 (MEDIUM) |
| high_street_store | `building_ref` | `building_sprite` | 256×256 (TALL) |
| restaurant | `building_ref` | `building_sprite` | 256×256 (TALL) |
| manor | `building_ref` | `building_sprite` | 256×256 (TALL) |
| police_station | `building_ref` | `building_sprite` | 256×256 (TALL) |
| casino | `building_ref` | `building_sprite` | 320×320 (VERY_TALL) |
| temple | `building_ref` | `building_sprite` | 320×320 (VERY_TALL) |
| bank | `building_ref` | `building_sprite` | 320×320 (VERY_TALL) |

### Characters & NPCs
| Character | Ref Sheet | Sprites Generated |
|-----------|-----------|-------------------|
| pedestrian_business | `character_ref` | `npc`: pedestrian_walk, pedestrian_suit |
| pedestrian_casual | `character_ref` | `npc`: pedestrian_stand, pedestrian_casual |
| avatar_base | `character_ref` | `avatar`: all 34 avatar layers |

### Vehicles (4 types)
| Vehicle | Ref Sheet | Sprite |
|---------|-----------|--------|
| car_sedan | `vehicle_ref` | `npc`: car_sedan (64×32) |
| car_sports | `vehicle_ref` | `npc`: car_sports (64×32) |
| car_van | `vehicle_ref` | `npc`: car_van (64×32) |
| car_taxi | `vehicle_ref` | `npc`: car_taxi (64×32) |

### Effects (6 dirty tricks)
| Effect | Ref Sheet | Sprite |
|--------|-----------|--------|
| fire | `effect_ref` | `effect`: fire (64×64) |
| cluster_bomb | `effect_ref` | `effect`: cluster_bomb (64×64) |
| vandalism | `effect_ref` | `effect`: vandalism (64×64) |
| robbery | `effect_ref` | `effect`: robbery (64×64) |
| poisoning | `effect_ref` | `effect`: poisoning (64×64) |
| blackout | `effect_ref` | `effect`: blackout (64×64) |

### Damage & Status Overlays (no ref needed - simple)
| Overlay | Category | Size |
|---------|----------|------|
| damage_25 | `effect` | 64×64 |
| damage_50 | `effect` | 64×64 |
| damage_75 | `effect` | 64×64 |
| for_sale | `effect` | 24×24 |
| security | `effect` | 24×24 |
| owned_self | `overlay` | 64×32 |
| owned_other | `overlay` | 64×32 |

### Terrain Tiles (38 total - no ref needed)
| Type | Variants | Category |
|------|----------|----------|
| grass | 1 | `terrain` |
| trees | 1 | `terrain` |
| mountain | 1 | `terrain` |
| sand | 1 | `terrain` |
| water | 1 + edge variants | `terrain` |
| road_* | 15 connection variants | `terrain` |
| dirt_* | 15 connection variants | `terrain` |

### Scene Illustrations (12 total - no ref needed)
| Scene | Type | Size |
|-------|------|------|
| arrest_bg | Background | 1920×1080 |
| court_bg | Background | 1920×1080 |
| prison_bg | Background | 1920×1080 |
| hero_bg | Background | 1920×1080 |
| bank_interior_bg | Background | 1920×1080 |
| temple_interior_bg | Background | 1920×1080 |
| offshore_bg | Background | 1920×1080 |
| dirty_trick_bg | Background | 1920×1080 |
| arrest_fg | Foreground (transparent) | 1920×1080 |
| prison_fg | Foreground (transparent) | 1920×1080 |
| hero_fg | Foreground (transparent) | 1920×1080 |
| dirty_trick_fg | Foreground (transparent) | 1920×1080 |

### UI Elements (3 total - no ref needed)
| Element | Category | Size |
|---------|----------|------|
| minimap_player | `ui` | 8×8 |
| minimap_enemy | `ui` | 8×8 |
| cursor_select | `ui` | 68×36 |

### Avatar Assets (34 total - use character_ref)
| Category | Items | Size |
|----------|-------|------|
| base bodies | base_standard, base_athletic | 512×512 |
| hair styles | short, long, mohawk, bald, slicked, curly | 512×512 |
| outfits | suit, casual, flashy, street, gold_legendary, prison, tropical, formal | 512×512 |
| headwear | tophat, cap, fedora, crown_legendary, hardhat, beanie | 512×512 |
| accessories | sunglasses, watch, cigar, briefcase, chain, earring | 512×512 |
| backgrounds | city, office, mansion, prison | 512×512 |

---

## Success Criteria Summary

| Category | Ref Sheets | Sprites | Total |
|----------|------------|---------|-------|
| Buildings | 13 | 13 | 26 |
| Characters | 3 | 8 (4 ped + 4 car) | 11 |
| Vehicles | 4 | 4 | 8 |
| Effects | 6 | 11 (6 dirty + 5 status) | 17 |
| Terrain | - | 38 | 38 |
| Scenes | - | 12 | 12 |
| UI | - | 3 | 3 |
| Overlays | - | 2 | 2 |
| Avatars | (uses character_ref) | 34 | 34 |
| **TOTAL** | **26** | **125** | **151** |

---

## Dependencies & Prerequisites

| Dependency | Status | Notes |
|------------|--------|-------|
| Google AI API Key | ✅ Added | Worker secret `GEMINI_API_KEY` |
| Removal.ai API Key | ✅ Added | Worker secret `REMOVAL_AI_API_KEY` |
| R2 Buckets | ✅ Exists | Private + Public buckets |
| Worker environment | ✅ Exists | Cloudflare Worker with D1/R2 |
| Asset prompts | ✅ Ready | All prompt builders in assets.js |

---

## API Categories

All prompt builders are implemented in `worker/src/routes/admin/assets.js`:

```
POST /api/admin/assets/generate
{
  "category": "<category>",
  "asset_key": "<key>",
  "custom_details": "<optional>"
}
```

### Reference Sheet Categories
| Category | Asset Keys |
|----------|------------|
| `building_ref` | restaurant, bank, temple, casino, manor, police_station, high_street_store, shop, burger_bar, motel, market_stall, hot_dog_stand, campsite |
| `character_ref` | pedestrian_business, pedestrian_casual, avatar_base |
| `vehicle_ref` | car_sedan, car_sports, car_van, car_taxi |
| `effect_ref` | fire, cluster_bomb, vandalism, robbery, poisoning, blackout |

### Sprite Categories (generated from refs)
| Category | Asset Keys |
|----------|------------|
| `building_sprite` | (same as building_ref) |
| `npc` | pedestrian_walk, pedestrian_stand, pedestrian_suit, pedestrian_casual, car_sedan, car_sports, car_van, car_taxi |
| `effect` | fire, cluster_bomb, vandalism, robbery, poisoning, blackout, damage_25, damage_50, damage_75, for_sale, security |
| `avatar` | base_standard, base_athletic, hair_short, hair_long, ... (34 total) |
| `terrain` | grass, trees, mountain, sand, water, road_*, dirt_* |
| `scene` | arrest_bg, court_bg, prison_bg, hero_bg, bank_interior_bg, temple_interior_bg, offshore_bg, dirty_trick_bg, arrest_fg, prison_fg, hero_fg, dirty_trick_fg |
| `ui` | minimap_player, minimap_enemy, cursor_select |
| `overlay` | owned_self, owned_other |

---

## Stage Index

**Workflow:** All API infrastructure is complete. Stage 07 builds the Admin UI for asset generation.

| Stage | Name | Status | Description |
|-------|------|--------|-------------|
| 01 | Infrastructure | ✅ Done | Database schema, API routes, secrets |
| 02 | Building Refs & Sprites | ✅ Done | Prompt builders for 13 buildings |
| 03 | Character & Vehicle Refs | ✅ Done | Prompt builders for NPCs |
| 04 | Effect Refs & Sprites | ✅ Done | Prompt builders for dirty tricks |
| 05 | Scene Templates | ✅ Done | Prompt builders for 12 scenes |
| 06 | Terrain, UI & Overlays | ✅ Done | Prompt builders for remaining assets |
| 07 | Asset Admin Page | **TODO** | Full management UI |
| 08 | Avatar Assets | ✅ Done | Prompt builders for 34 avatar items |

---

## Admin Page Requirements (Stage 07)

### UI Wireframe

```
┌─────────────────────────────────────────────────────────────┐
│  Asset Admin                                                 │
├─────────────────────────────────────────────────────────────┤
│  [Buildings] [Characters] [Vehicles] [Effects] [Scenes] ... │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  BUILDINGS (13)                     [Generate All Refs]      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Restaurant                                            │   │
│  │ ┌─────────────┐  ┌─────────────┐                     │   │
│  │ │ REF SHEET   │  │ SPRITE      │                     │   │
│  │ │ [preview]   │  │ [preview]   │                     │   │
│  │ │ ✅ Approved │  │ ⏳ Pending  │                     │   │
│  │ │ [Regenerate]│  │ [Generate]  │ [Remove BG]         │   │
│  │ └─────────────┘  └─────────────┘                     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema

**Tables in D1:** (see `migrations/0023_create_asset_tables.sql`)

```sql
-- Categories with background removal flag
asset_categories (
    id TEXT PRIMARY KEY,               -- 'building_ref', 'building_sprite', etc.
    requires_background_removal BOOL   -- TRUE for sprites, FALSE for refs/scenes
)

-- Main asset registry
generated_assets (
    id INTEGER PRIMARY KEY,
    category TEXT,                     -- FK to asset_categories
    asset_key TEXT,                    -- 'restaurant', 'fire', etc.
    variant INTEGER DEFAULT 1,
    status TEXT,                       -- 'pending'|'generating'|'review'|'approved'|'rejected'
    r2_key_private TEXT,               -- Private bucket key
    r2_key_public TEXT,                -- Public bucket key (after processing)
    r2_url TEXT,                       -- Public URL for game loading
    background_removed BOOLEAN,
    parent_asset_id INTEGER            -- Links sprite to its ref sheet
)
```

### R2 Bucket Structure

```
PRIVATE: notropolis-assets-private (env.R2_PRIVATE)
├── refs/                              # Reference sheets
│   └── {asset_key}_ref_v{variant}.png
└── raw/                               # Unprocessed sprites (before bg removal)
    └── {category}_{asset_key}_raw_v{variant}.png

PUBLIC: notropolis-game-assets (env.R2_PUBLIC)
├── sprites/
│   ├── buildings/{asset_key}_v{variant}.webp
│   ├── terrain/{asset_key}_v{variant}.webp
│   ├── effects/{asset_key}_v{variant}.webp
│   ├── npc/{asset_key}_v{variant}.webp
│   └── ui/{asset_key}_v{variant}.webp
├── scenes/{asset_key}_v{variant}.webp
└── avatars/{asset_key}_v{variant}.webp
```

**Public bucket URL:** `https://pub-874867b18f8b4b4882277d8a2b7dfe80.r2.dev/`

### Background Removal Requirements

| Category | Needs BG Removal | Notes |
|----------|------------------|-------|
| `building_ref` | ❌ No | Keep backgrounds for reference |
| `character_ref` | ❌ No | Keep backgrounds for reference |
| `vehicle_ref` | ❌ No | Keep backgrounds for reference |
| `effect_ref` | ❌ No | Keep backgrounds for reference |
| `building_sprite` | ✅ Yes | Transparent for game |
| `npc` | ✅ Yes | Transparent pedestrians/cars |
| `effect` | ✅ Yes | Transparent overlays |
| `terrain` | ✅ Yes | Transparent edges |
| `ui` | ✅ Yes | Transparent icons |
| `avatar` | ✅ Yes | Transparent layers for compositing |
| `overlay` | ❌ No | Semi-transparent by design |
| `scene` | ❌ No | Full backgrounds |

### API Endpoints

```
POST /api/admin/assets/generate
  Body: { category, asset_key, variant?, custom_details? }
  Returns: { asset, message }

POST /api/admin/assets/remove-background/{id}
  Calls Removal.ai, stores result in R2_PRIVATE
  Returns: { success, r2Key }

PUT /api/admin/assets/{id}/approve
  Sets status='approved', approved_at, approved_by

PUT /api/admin/assets/{id}/reject
  Body: { reason }
  Sets status='rejected', creates rejection record

POST /api/admin/assets/{id}/publish
  Moves from R2_PRIVATE to R2_PUBLIC, converts to WebP
  Returns: { r2_url }

GET /api/admin/assets/queue
  Returns pending/generating assets

GET /api/admin/assets?category={cat}&status={status}
  List assets with filters
```

### Features Required

1. **Tab navigation** - Buildings, Characters, Vehicles, Effects, Scenes, Terrain, Avatars, UI
2. **For each asset:**
   - Preview thumbnail (from `r2_key_private` or `r2_url`)
   - Status badge (pending/generating/review/approved/rejected)
   - Generate button → `POST /generate`
   - Regenerate with feedback textarea
   - Approve/Reject buttons
3. **Reference → Sprite flow:**
   - Show ref first, sprite disabled until ref approved
   - `parent_asset_id` links sprite to its ref
4. **Background removal:**
   - Button visible for categories where `requires_background_removal=TRUE`
   - Calls `POST /remove-background/{id}`
   - Shows `background_removed` status
5. **Publish to game:**
   - After approved + bg removed (if needed)
   - Calls `POST /publish`, sets `r2_url`
6. **Batch operations:**
   - "Generate All Refs" per category
   - "Generate All Sprites" (only for approved refs)

---

## Two-Bucket Architecture

```
PRIVATE BUCKET: notropolis-assets-private
├── refs/                         # Reference sheets (high-res PNG)
│   ├── building_restaurant_ref_v1.png
│   ├── character_pedestrian_business_ref_v1.png
│   ├── vehicle_car_sedan_ref_v1.png
│   └── effect_fire_ref_v1.png
└── raw/                          # Pre-background-removal sprites
    └── building_restaurant_raw_v1.png

PUBLIC BUCKET: notropolis-game-assets
├── sprites/
│   ├── buildings/                # Transparent WebP
│   ├── terrain/                  # 64×32 WebP
│   ├── effects/                  # 64×64 WebP
│   ├── overlays/                 # 64×32 WebP
│   ├── ui/                       # Various sizes WebP
│   └── npc/                      # 32-64px WebP
├── scenes/                       # 1280×720 WebP
└── avatars/                      # 512×512 WebP
```

---

## Style Guide (Embedded in All Prompts)

All prompts automatically include:

- **90s CGI aesthetic** with modern rendering quality
- **Pixar's The Incredibles / Two Point Hospital** visual reference
- **Top-left lighting at 45 degrees** (consistent across all assets)
- **No external shadows** (for background removal compatibility)
- **Chunky, slightly exaggerated proportions**
- **Muted but vibrant colors**
- **Clean, anti-aliased edges**

Reference sheets establish the "source of truth" - all sprites must match their reference.

---

## References

- [Ref: plans/notropolis-game/16a-asset-requirements.md] - Original asset specifications
- [Ref: plans/notropolis-game/15-avatar-system.md] - Avatar layer system
- [Ref: 17-asset-pipeline/character sheet template.jpg] - Character style reference
- [Ref: worker/src/routes/admin/assets.js] - All prompt builders
