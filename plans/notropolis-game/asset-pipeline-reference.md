# Asset Pipeline Reference

This document details the complete workflow for generating game assets, from reference sheets to game-ready sprites.

---

## IMPORTANT: Corrected Specifications

> **The original 16a-asset-requirements.md incorrectly specified isometric diamond tiles.**
> **This section contains the CORRECT specifications.**

### Map Grid: SQUARE Tiles (Not Diamond)

```
┌────┬────┬────┬────┐
│    │    │    │    │   ← Square tiles (e.g., 64x64)
├────┼────┼────┼────┤
│    │    │    │    │   Camera: Elevated ~45° angle
├────┼────┼────┼────┤
│    │    │    │    │
└────┴────┴────┴────┘
```

### Visual Style: 90s CGI + 2025 Render Quality

**Art Direction (90s):** Chunky, geometric, polygonal character, SimCity 3000 feel
**Render Quality (2025):** Soft AO, clean anti-aliasing, subtle GI, specular highlights

### Base Ground (Background)

- **Large seamless image** (512x512+), NOT individual tiles
- Tiled via CSS `background-repeat` or canvas pattern
- Grass texture as default "world floor"

### Terrain Tiles (ON TOP of background)

Only **4 terrain types** needed:
- `road.webp` - Gray asphalt with sidewalks
- `water.webp` - Blue water texture
- `dirt_track.webp` - Worn earth path
- `trees.webp` - Tree canopy cluster

All terrain tiles: 64x64 square with transparency.

### Building Sprites

| Property | Value |
|----------|-------|
| Canvas | **SQUARE** (128, 192, 256, or 320px) |
| View | Elevated angle, front facade + slight right side visible |
| 3D Style | Maintains 3D depth, NOT flat front-on |
| Footprint | Square base fitting square tile |

### Pedestrian Sprites (SIMPLIFIED)

Only **2 frames** total:
- `ped_walk_a.webp` - Right foot forward
- `ped_walk_b.webp` - Left foot forward

Game rotates/flips sprite for all directions (N, S, E, W).

### Vehicle Sprites (SIMPLIFIED)

Only **1 sprite** per vehicle type:
- `car_sedan.webp` - Single top-down sprite

Game rotates sprite for all directions.

### R2 Migration Plan

After asset admin overhaul:
1. Archive existing assets to `R2_PUBLIC/archive/2025-01-pre-overhaul/` (EXCEPT avatars)
2. Start fresh with new structure using corrected prompts
3. Generate new references and sprites

---

## Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  1. GENERATE    │───▶│  2. REVIEW &    │───▶│  3. PROCESS     │───▶│  4. PUBLISH     │
│  Reference      │    │  APPROVE        │    │  Sprite         │    │  Game Asset     │
│  (Gemini)       │    │  (Admin UI)     │    │  (Slazzer +     │    │  (Public R2)    │
│                 │    │                 │    │   CF Transform)  │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## Services Used

| Service | Purpose | Cost |
|---------|---------|------|
| **Google Gemini** (Nano Banana Pro) | AI image generation | Pay per image |
| **Slazzer API** | Background removal + transparent pixel trimming | Pay per image |
| **Cloudflare Image Transformations** | WebP conversion + resize | FREE (included with zone) |
| **Cloudflare R2** (Private) | Store originals, refs, masters | Storage cost only |
| **Cloudflare R2** (Public) | Serve game-ready assets | Storage + bandwidth |

---

## Storage Architecture

### Private Bucket: `notropolis-assets-private`
- **Purpose:** Store originals, reference sheets, and master PNGs
- **Access:** Worker only (not public)
- **URL:** Not publicly accessible

```
notropolis-assets-private/
├── refs/                              # Reference sheets (high-res PNG)
│   ├── building_restaurant_ref_v1.png
│   ├── character_pedestrian_ref_v1.png
│   └── vehicle_car_sedan_ref_v1.png
├── raw/                               # Generated sprites before processing
│   └── building_sprite_restaurant_raw_v1.png
└── sprites/                           # Master transparent PNGs (after bg removal)
    └── building_sprite/
        └── restaurant_v1_transparent.png  # Master - keep forever
```

### Public Bucket: `notropolis-game-assets`
- **Purpose:** Serve game-ready assets to the frontend
- **Access:** Public via CDN
- **URL:** `https://assets.notropolis.net/`

```
notropolis-game-assets/
└── sprites/
    ├── building_sprite/
    │   └── restaurant_v1.webp          # 256x256 WebP (game-ready)
    ├── terrain/
    │   └── grass_v1.webp               # 64x32 WebP
    └── npc/
        └── pedestrian_walk_n_v1.webp   # 32x32 WebP
```

---

## Workflow: Buildings (Complete Example)

### Phase 1: Generate Reference Sheet

**Endpoint:** `POST /api/admin/assets/generate`

```json
{
  "category": "building_ref",
  "asset_key": "restaurant"
}
```

**What happens:**
1. Gemini generates a reference sheet showing the building from multiple angles
2. PNG saved to private bucket: `refs/building_restaurant_ref_v1.png`
3. Database record created with `status: 'review'`

**Reference sheet contains:**
- Front, back, left, right views
- Isometric view (45° angle)
- Material/texture closeups
- Consistent style guide applied

### Phase 2: Approve Reference

**Endpoint:** `PUT /api/admin/assets/approve/{id}`

**What happens:**
1. Status changed to `approved`
2. Reference becomes the "source of truth" for sprite generation

### Phase 3: Generate Sprite from Reference

**Endpoint:** `POST /api/admin/assets/generate`

```json
{
  "category": "building_sprite",
  "asset_key": "restaurant"
}
```

**What happens:**
1. Gemini receives the approved reference sheet as visual input
2. Generates isometric game sprite matching the reference
3. PNG saved to private bucket: `raw/building_sprite_restaurant_raw_v1.png`
4. Database record created with `status: 'review'`

### Phase 4: Approve Sprite (Auto-Processing)

**Endpoint:** `PUT /api/admin/assets/approve/{id}`

**What happens automatically on approval:**

#### Step 1: Background Removal (Slazzer)
```
Input:  raw/building_sprite_restaurant_raw_v1.png (with background)
Output: sprites/building_sprite/restaurant_v1_transparent.png (no background, trimmed)
```
- Calls Slazzer API with `crop: true` to trim transparent pixels
- Saves master PNG to private bucket
- Sets `background_removed: TRUE` in database

#### Step 2: Convert & Resize (Cloudflare Image Transformations)
```
Input:  restaurant_v1_transparent.png (1024x1024 PNG)
Output: restaurant_v1.webp (256x256 WebP)
```
- Uses Cloudflare Image Transformations via Worker `cf.image` fetch option
- Resizes to target dimensions based on building size class
- Converts to WebP format with optimized compression
- FREE - included with Cloudflare zone

#### Step 3: Publish to Public Bucket
```
Output: https://assets.notropolis.net/sprites/building_sprite/restaurant_v1.webp
```
- Saves game-ready WebP to public R2 bucket
- Updates database with `r2_url` for frontend to use

---

## Building Size Classes

| Size Class | Buildings | Target Dimensions |
|------------|-----------|-------------------|
| TINY | claim_stake | 64 x 64 |
| SHORT | market_stall, hot_dog_stand, campsite | 128 x 128 |
| MEDIUM | shop, burger_bar, motel | 192 x 192 |
| TALL | high_street_store, restaurant, manor, police_station | 256 x 256 |
| VERY_TALL | casino, temple, bank | 320 x 320 |

---

## Workflow: Terrain Tiles

### Generate
```json
{
  "category": "terrain",
  "asset_key": "grass"
}
```

### Target Dimensions
All terrain tiles: **64 x 64** (square tiles, NOT isometric diamond)

### Terrain Types Needed
Only 4 terrain types (grass is now a background image, not a tile):
- `road` - Asphalt with sidewalks
- `water` - Blue water texture
- `dirt_track` - Worn earth path
- `trees` - Tree canopy cluster

**Note:** Grass/base ground is a large seamless background image, NOT individual tiles.

---

## Workflow: NPCs (Pedestrians)

> **SIMPLIFIED:** Only 2 frames needed. Game rotates for all directions.

### Phase 1: Generate Character Reference

```json
{
  "category": "character_ref",
  "asset_key": "pedestrian_business"
}
```

### Phase 2: Approve Reference
Approving a pedestrian reference auto-queues **2 walk cycle frames** (not 4 directions):
- `ped_walk_a` (right foot forward)
- `ped_walk_b` (left foot forward)

### Phase 3: Generate Walk Frames

```json
{
  "category": "npc",
  "asset_key": "ped_walk_a"
}
```

### Target Dimensions
| Asset Type | Dimensions | Notes |
|------------|------------|-------|
| Pedestrians | 32 x 32 or 48 x 48 | Top-down/elevated view, game rotates for direction |

### Game Client Usage
```typescript
// Alternate between frames A and B every ~200ms
// Rotate sprite based on movement direction
const rotation = {
  n: 0,      // facing up
  e: 90,     // facing right
  s: 180,    // facing down
  w: 270     // facing left
};
```

---

## Workflow: Vehicles

> **SIMPLIFIED:** Only 1 sprite needed per vehicle. Game rotates for all directions.

### Phase 1: Generate Vehicle Reference

```json
{
  "category": "vehicle_ref",
  "asset_key": "car_sedan"
}
```

### Phase 2: Approve Reference
Approving auto-queues **1 sprite** (not 4 directions):
- `car_sedan` (single top-down sprite, game rotates)

### Target Dimensions
| Asset Type | Dimensions | Notes |
|------------|------------|-------|
| Cars | 48 x 48 or 64 x 64 | Top-down view, game rotates for direction |

### Game Client Usage
```typescript
// Rotate sprite based on travel direction
const vehicleRotation = {
  n: 0,      // facing up
  e: 90,     // facing right
  s: 180,    // facing down
  w: 270     // facing left
};
```

---

## Database Schema

### `generated_assets` Table

| Column | Description |
|--------|-------------|
| `id` | Primary key |
| `category` | Asset category (building_ref, building_sprite, terrain, npc, etc.) |
| `asset_key` | Unique identifier within category (restaurant, grass, etc.) |
| `variant` | Version number (1, 2, 3...) |
| `status` | pending, generating, review, approved, rejected |
| `r2_key_private` | Path in private bucket |
| `r2_key_public` | Path in public bucket |
| `r2_url` | Full public URL for game |
| `background_removed` | TRUE after Slazzer processing |
| `parent_asset_id` | Links sprite to its reference sheet |

### `asset_categories` Table

| Column | Description |
|--------|-------------|
| `id` | Category identifier |
| `requires_background_removal` | TRUE for sprites, FALSE for refs/scenes |

---

## API Endpoints Summary

| Endpoint | Purpose |
|----------|---------|
| `POST /api/admin/assets/generate` | Generate new asset (ref or sprite) |
| `PUT /api/admin/assets/approve/{id}` | Approve + auto-process sprite |
| `PUT /api/admin/assets/reject/{id}` | Reject with feedback |
| `POST /api/admin/assets/remove-background/{id}` | Manual bg removal |
| `POST /api/admin/assets/reprocess-sprites` | Batch reprocess existing sprites |
| `GET /api/admin/assets/approved-refs` | List refs ready for sprite generation |
| `POST /api/admin/assets/generate-from-ref/{id}` | Generate sprite from specific ref |

---

## Reprocessing Existing Assets

If you need to re-convert existing approved sprites (e.g., after changing dimensions):

```bash
# Dry run - see what would be processed
curl -X POST 'https://api.notropolis.net/api/admin/assets/reprocess-sprites' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"category": "building_sprite", "dry_run": true}'

# Actually reprocess
curl -X POST 'https://api.notropolis.net/api/admin/assets/reprocess-sprites' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"category": "building_sprite"}'
```

---

## File Flow Diagram

```
                                    PRIVATE BUCKET                    PUBLIC BUCKET
                                    ──────────────                    ─────────────
GENERATE REF    ──────────────────▶ refs/building_restaurant_ref_v1.png
      │
      ▼
APPROVE REF     (no file change, just status update)
      │
      ▼
GENERATE SPRITE ──────────────────▶ raw/building_sprite_restaurant_raw_v1.png
      │
      ▼
APPROVE SPRITE
      │
      ├─[Slazzer]─────────────────▶ sprites/building_sprite/restaurant_v1_transparent.png
      │                            (master PNG - keep forever)
      │
      └─[CF Transform]────────────────────────────────────────────────▶ sprites/building_sprite/restaurant_v1.webp
                                                                       (game-ready - 256x256 WebP)
```

---

## Extending to New Asset Types

When adding new asset types (e.g., effects, UI elements):

1. **Add size mapping** in `getTargetDimensions()` function in `assets.js`
2. **Add category** to `asset_categories` table with `requires_background_removal` flag
3. **Create prompt builder** function (e.g., `buildEffectPrompt()`)
4. **Update admin UI** to show new category tab

---

## Environment Variables

```toml
# Worker secrets (set via wrangler secret put)
GEMINI_API_KEY      # Google AI API key
SLAZZER_API_KEY     # Background removal API key
# Note: WebP resize uses Cloudflare Image Transformations (no API key needed, enabled on zone)
```
