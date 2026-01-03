# Stage 16a: Asset Requirements

## Objective

Document all visual assets required for the isometric zoomed map view. This stage is preparation-only - no code changes.

## Dependencies

`[Requires: Asset creation by designer/user]`

## Complexity

**N/A** - Asset preparation only.

---

## Asset Generation Pipeline

Assets defined in this document are generated via the automated pipeline in **Stage 17**.

**Pipeline Documentation:** [plans/notropolis-game/17-asset-pipeline/00-master-plan.md](17-asset-pipeline/00-master-plan.md)

**Two-Bucket Architecture:**

```
PRIVATE BUCKET: notropolis-assets-private (not public)
├── refs/                         # Reference sheets (3840×2160 PNG, 4K)
│   └── building_restaurant_ref_v1.png
└── raw/                          # Pre-background-removal sprites (PNG)
    └── building_restaurant_raw_v1.png

PUBLIC BUCKET: notropolis-game-assets
https://pub-874867b18f8b4b4882277d8a2b7dfe80.r2.dev/
├── sprites/
│   ├── buildings/                # WebP, transparent, exact size (128-320px)
│   ├── terrain/                  # WebP, 64×32
│   ├── effects/                  # WebP, 64×64
│   ├── overlays/                 # WebP, 64×32
│   ├── ui/                       # WebP, 8-68px
│   └── npc/                      # WebP, 32-64px
└── scenes/                       # WebP, 1280×720
```

**Image Format:**
- **Reference sheets**: PNG at 3840×2160 (4K, Nano Banana Pro max) → private bucket
- **Game sprites**: WebP with alpha, exact target size → public bucket
- **Scene illustrations**: WebP at 1280×720 → public bucket

**Generation Process:**
1. Prompts from this document feed into Nano Banana Pro API
2. **Reference sheets** generated at 3840×2160 PNG (4K), stored in private bucket `/refs/`
3. **Game sprites** generated at exact target size
4. **All game sprites** get background removal via Removal.ai (except scenes)
5. PNG → WebP conversion for game-ready assets
6. Game loads WebP from public bucket - originals kept in private for reference

---

## Isometric Grid System

The game uses a **diamond isometric** projection (also called "2:1 isometric"):

```
        /\
       /  \
      /    \
     /      \
    <   64   >  width = 64px
     \      /
      \    /
       \  /
        \/
        32      height = 32px (half of width)
```

All tiles are diamond-shaped when viewed from above. Buildings sit on top of tiles and extend upward.

---

## Asset Categories

### 1. Terrain & Environment Assets

#### Background Tile (1)

| Asset | Description | Size | Filename |
|-------|-------------|------|----------|
| Grass Background | Large seamless grass texture for map background | 512×512 or larger | `terrain_grass_bg.webp` |

This is a **non-isometric** tile that sits behind all other assets as the base layer.

#### Tree Sprite (1)

| Asset | Description | Size | Filename |
|-------|-------------|------|----------|
| Trees | Forest/tree cluster, isometric | 64×64 (extends upward) | `terrain_trees.webp` |

#### Road Tiles - Rotatable System (5)

Roads use 5 base tiles that can be **rotated in code** (0°, 90°, 180°, 270°) to create all variations.

| ID | Type | Visual | Filename | Rotations |
|----|------|--------|----------|-----------|
| `road_straight` | Straight | ═══ | `terrain_road_straight.webp` | 0°, 90° |
| `road_corner` | Corner | ╮ | `terrain_road_corner.webp` | 0°, 90°, 180°, 270° |
| `road_tjunction` | T-Junction | ┬ | `terrain_road_tjunction.webp` | 0°, 90°, 180°, 270° |
| `road_crossroad` | Crossroad | ┼ | `terrain_road_crossroad.webp` | None needed |
| `road_end` | Dead End | ╷ | `terrain_road_end.webp` | 0°, 90°, 180°, 270° |

**Size:** 64×32 px (isometric diamond)

#### Dirt Track Tiles - Rotatable System (5)

Same structure as roads, different visual style.

| ID | Type | Filename | Rotations |
|----|------|----------|-----------|
| `dirt_straight` | Straight | `terrain_dirt_straight.webp` | 0°, 90° |
| `dirt_corner` | Corner | `terrain_dirt_corner.webp` | 0°, 90°, 180°, 270° |
| `dirt_tjunction` | T-Junction | `terrain_dirt_tjunction.webp` | 0°, 90°, 180°, 270° |
| `dirt_crossroad` | Crossroad | `terrain_dirt_crossroad.webp` | None needed |
| `dirt_end` | Dead End | `terrain_dirt_end.webp` | 0°, 90°, 180°, 270° |

**Size:** 64×32 px (isometric diamond)

#### Water Tiles - Edge System (13)

Water uses an edge-based system. Naming indicates which sides have land.

| ID | Description | Filename |
|----|-------------|----------|
| `water` | Open water (center) | `terrain_water.webp` |
| `water_edge_n` | Land to north | `terrain_water_edge_n.webp` |
| `water_edge_e` | Land to east | `terrain_water_edge_e.webp` |
| `water_edge_s` | Land to south | `terrain_water_edge_s.webp` |
| `water_edge_w` | Land to west | `terrain_water_edge_w.webp` |
| `water_corner_ne` | Outer corner (land NE) | `terrain_water_corner_ne.webp` |
| `water_corner_nw` | Outer corner (land NW) | `terrain_water_corner_nw.webp` |
| `water_corner_se` | Outer corner (land SE) | `terrain_water_corner_se.webp` |
| `water_corner_sw` | Outer corner (land SW) | `terrain_water_corner_sw.webp` |
| `water_inner_ne` | Inner corner (concave NE) | `terrain_water_inner_ne.webp` |
| `water_inner_nw` | Inner corner (concave NW) | `terrain_water_inner_nw.webp` |
| `water_inner_se` | Inner corner (concave SE) | `terrain_water_inner_se.webp` |
| `water_inner_sw` | Inner corner (concave SW) | `terrain_water_inner_sw.webp` |

**Size:** 64×32 px (isometric diamond)

---

### Terrain Summary

| Category | Count | Notes |
|----------|-------|-------|
| Background | 1 | Large grass tile behind everything |
| Trees | 1 | Isometric tree cluster |
| Road | 5 | Rotated in code for all variations |
| Dirt | 5 | Rotated in code for all variations |
| Water | 13 | Edge-based auto-tiling |
| **Total** | **25** | |

**Visual Style Reference:** [iso-city.com](https://iso-city.com/) - clean, slightly cartoonish

---

### 2. Building Sprites (10 types) ✅ DONE

Buildings are placed on top of terrain tiles. They extend upward from a diamond footprint within a SQUARE canvas.

| ID | Name | Canvas Size | Size Class | Filename | Status |
|----|------|-------------|------------|----------|--------|
| `market_stall` | Market Stall | 128x128 | Short | `building_market_stall.webp` | ✅ |
| `hot_dog_stand` | Hot Dog Stand | 128x128 | Short | `building_hot_dog_stand.webp` | ✅ |
| `campsite` | Campsite | 128x128 | Short | `building_campsite.webp` | ✅ |
| `shop` | Shop | 192x192 | Medium | `building_shop.webp` | ✅ |
| `burger_bar` | Burger Bar | 192x192 | Medium | `building_burger_bar.webp` | ✅ |
| `motel` | Motel | 192x192 | Medium | `building_motel.webp` | ✅ |
| `high_street_store` | High Street Store | 256x256 | Tall | `building_high_street_store.webp` | ✅ |
| `restaurant` | Restaurant | 256x256 | Tall | `building_restaurant.webp` | ✅ |
| `manor` | Manor | 256x256 | Tall | `building_manor.webp` | ✅ |
| `casino` | Casino | 320x320 | Very Tall | `building_casino.webp` | ✅ |

**Size Classes (SQUARE canvas):**
- **Short** (128x128): Small structures like stalls, tents
- **Medium** (192x192): Single-story buildings
- **Tall** (256x256): Two-story buildings
- **Very Tall** (320x320): Large/impressive buildings

**Specifications:**
- Canvas: **SQUARE** (see Size Class for dimensions)
- Footprint: **DIAMOND** shape at bottom of canvas
- Format: WebP with transparency (lossless with alpha)
- Building should be centered on the canvas width
- Diamond footprint at bottom, building extends upward

**Alignment Guide:**
```
┌────────────────┐
│                │
│   Building     │
│   extends      │
│   upward       │
│       /\       │
│      /  \      │  ← Diamond footprint
│     <    >     │
│      \  /      │
└───────\/───────┘
   SQUARE canvas
```

---

### 3. Special Buildings (3 types) ✅ DONE

Non-player buildings that appear on the map.

| ID | Name | Canvas Size | Size Class | Filename | Status |
|----|------|-------------|------------|----------|--------|
| `temple` | Temple | 320x320 | Very Tall | `special_temple.webp` | ✅ |
| `bank` | Bank | 320x320 | Very Tall | `special_bank.webp` | ✅ |
| `police_station` | Police Station | 256x256 | Tall | `special_police.webp` | ✅ |

**Specifications:** Same SQUARE canvas with diamond footprint as regular buildings.

---

### 4. Ownership Overlays - React/CSS (No images needed)

Semi-transparent overlays rendered via CSS/Canvas, not image assets.

| Element | Implementation | Color |
|---------|----------------|-------|
| Player Owned | CSS `clip-path: polygon()` or Canvas fill | `rgba(34, 197, 94, 0.3)` green |
| Enemy Owned | CSS `clip-path: polygon()` or Canvas fill | `rgba(239, 68, 68, 0.3)` red |

**Benefits:**
- No asset loading required
- Dynamic color changes possible
- Perfect scaling at any zoom level

---

### 5. Status Effects (Future - Post-MVP)

These are nice-to-have for visual polish but not required for MVP.

| ID | Name | Description | Status |
|----|------|-------------|--------|
| `fire` | Fire Effect | Flames on building | Future |
| `damage_25` | Light Damage | Cracks/wear at 25% | Future |
| `damage_50` | Medium Damage | More damage at 50% | Future |
| `damage_75` | Heavy Damage | Severe damage at 75% | Future |
| `for_sale` | For Sale Sign | Small sign indicator | Future |
| `security` | Security Icon | Shield/camera icon | Future |

---

### 6. UI Elements - React/CSS (No images needed)

All UI elements rendered via React components and CSS, not image assets.

| Element | Implementation |
|---------|----------------|
| Selection Cursor | CSS border/glow with `box-shadow` or SVG stroke, animated pulse |
| Minimap Player Marker | `<div className="w-2 h-2 rounded-full bg-green-500">` |
| Minimap Enemy Marker | `<div className="w-2 h-2 rounded-full bg-red-500">` |

**Benefits:**
- No asset loading required
- Smaller bundle size
- Easy to animate with CSS
- Dynamic theming possible

---

## Directory Structure

```
PUBLIC BUCKET: notropolis-game-assets
└── sprites/
    ├── terrain/
    │   ├── terrain_grass_bg.webp          # Background (1)
    │   ├── terrain_trees.webp             # Trees (1)
    │   ├── terrain_road_straight.webp     # Road (5) - rotated in code
    │   ├── terrain_road_corner.webp
    │   ├── terrain_road_tjunction.webp
    │   ├── terrain_road_crossroad.webp
    │   ├── terrain_road_end.webp
    │   ├── terrain_dirt_straight.webp     # Dirt (5) - rotated in code
    │   ├── terrain_dirt_corner.webp
    │   ├── terrain_dirt_tjunction.webp
    │   ├── terrain_dirt_crossroad.webp
    │   ├── terrain_dirt_end.webp
    │   ├── terrain_water.webp             # Water (13)
    │   ├── terrain_water_edge_n.webp
    │   ├── terrain_water_edge_e.webp
    │   ├── terrain_water_edge_s.webp
    │   ├── terrain_water_edge_w.webp
    │   ├── terrain_water_corner_ne.webp
    │   ├── terrain_water_corner_nw.webp
    │   ├── terrain_water_corner_se.webp
    │   ├── terrain_water_corner_sw.webp
    │   ├── terrain_water_inner_ne.webp
    │   ├── terrain_water_inner_nw.webp
    │   ├── terrain_water_inner_se.webp
    │   └── terrain_water_inner_sw.webp
    │
    ├── buildings/                          # ✅ DONE (10)
    │   ├── building_market_stall.webp
    │   ├── building_hot_dog_stand.webp
    │   ├── building_campsite.webp
    │   ├── building_shop.webp
    │   ├── building_burger_bar.webp
    │   ├── building_motel.webp
    │   ├── building_high_street_store.webp
    │   ├── building_restaurant.webp
    │   ├── building_manor.webp
    │   └── building_casino.webp
    │
    ├── special/                            # ✅ DONE (3)
    │   ├── special_temple.webp
    │   ├── special_bank.webp
    │   └── special_police.webp
    │
    └── effects/                            # Future (post-MVP)
        ├── effect_fire.webp
        ├── effect_damage_25.webp
        ├── effect_damage_50.webp
        ├── effect_damage_75.webp
        ├── effect_for_sale.webp
        └── effect_security.webp

# Note: No /ui/ folder - UI elements rendered via React/CSS
# Note: No /overlays/ folder - ownership overlays rendered via Canvas/CSS
```

---

## Visual Style Guide

### Color Palette (Suggested)

| Element | Colors |
|---------|--------|
| Grass | `#4a7c23`, `#5a8c33` (varied greens) |
| Water | `#2980b9`, `#3498db` (blues) |
| Road | `#7f8c8d`, `#95a5a6` (grays) |
| Dirt | `#8b7355`, `#a0826d` (browns) |
| Buildings | Warm colors, brick reds, cream walls |
| Owned (self) | `rgba(34, 197, 94, 0.3)` green tint |
| Owned (enemy) | `rgba(239, 68, 68, 0.3)` red tint |

### Style Notes

1. **Consistent lighting:** Light source from top-left
2. **Outlines:** Optional thin dark outline for clarity
3. **Shadows:** Buildings can have small shadow on the ground
4. **Detail level:** Medium detail - visible at 1x zoom, recognizable at 0.5x
5. **No text on sprites:** Building names shown via UI, not on sprites

---

## Asset Checklist

### Required for MVP (Stage 16)

**Terrain (25 images):**
- [ ] 1 grass background tile (512×512+)
- [ ] 1 tree sprite (64×64)
- [ ] 5 road tiles (straight, corner, t-junction, crossroad, end)
- [ ] 5 dirt tiles (same variants as road)
- [ ] 13 water tiles (center + edges + corners)

**Buildings (13 images) ✅ DONE:**
- [x] 10 building sprites
- [x] 3 special building sprites

**UI Elements (0 images - React/CSS):**
- [x] Ownership overlays → Canvas fill
- [x] Selection cursor → CSS/SVG
- [x] Minimap markers → React divs

### Nice to Have (Post-MVP)

- [ ] Damage effect overlays (3 levels)
- [ ] Fire effect (animated or static)
- [ ] For sale sign icon
- [ ] Security icon
- [ ] Water animation frames

---

## Template Files

To help with asset creation, placeholder templates can be generated:

```bash
# Generate placeholder templates (64x32 terrain, 64x64 building base)
# These would be simple colored shapes for testing
```

---

## Testing Assets

For development before final assets are ready, use solid-colored placeholders:

| Asset | Placeholder |
|-------|-------------|
| Grass | Green diamond |
| Water | Blue diamond |
| Buildings | Gray rectangles with building ID text |
| Owned overlay | Semi-transparent colored diamonds |

The code will work with placeholders and can swap to final assets via R2 URLs.

---

## Handoff Notes

- All assets should be provided as individual PNG files
- Assets will be uploaded to R2 bucket under the directory structure above
- Database `building_types` table will be updated with R2 keys
- Terrain sprites are hardcoded in `isometricRenderer.ts`
- Consider creating a sprite sheet for performance (future optimization)

---

# Gemini Gem Asset Generation Prompts

The following prompts are designed for use with a Google Gemini "Gem" configured for Notropolis asset generation. See the Gem system prompt below, then use the individual asset prompts.

---

## Gem System Prompt

Copy this into your Gemini Gem's "Instructions" field:

```
You are an asset generator for "Notropolis", a business simulation game with a distinctive 90s CGI aesthetic. Your role is to create consistent, high-quality visual assets that match the established style.

## VISUAL STYLE

The art direction is RETRO 90s CGI, but rendered with MODERN quality.

Style (what to replicate):
- Chunky, geometric 3D forms with visible polygonal edges
- Slightly exaggerated proportions (stocky characters, blocky buildings)
- Muted, slightly desaturated color palette
- Subtle texture detail (brick patterns, fabric weaves)
- Clean, professional feel (think RenderWare, early Pixar, SimCity 3000)

Render Quality (modern polish):
- Soft ambient occlusion in corners and under overhangs
- Subtle global illumination / bounced light
- Gentle rim lighting to separate edges from background
- Soft shadows (not harsh or pixelated)
- Clean, smooth surface rendering (no noise or grain)
- Subtle specular highlights on appropriate materials (glass, metal, polished surfaces)
- Defined material separation (brick looks different from wood looks different from metal)
- High resolution, crisp edges with clean anti-aliasing
- Professional studio lighting setup
- "Box art" or "promotional render" quality

Think: A modern HD remaster of a 90s game - the art direction is retro but the rendering technology is current. Like if Pixar's 1995 art style was rendered with 2024 technology.

Lighting direction: Consistent top-left lighting across all assets.

## REFERENCE KNOWLEDGE

I have reference sheets uploaded showing the exact style to match. ALWAYS reference these when generating new assets to ensure style consistency. As more assets are added to knowledge, use them all as style guides.

## CRITICAL RULES

### SQUARE CANVAS WITH DIAMOND FOOTPRINT
All building game sprites must fit inside a SQUARE canvas. The building's footprint is a DIAMOND shape within that square.

Building size classes:
- SHORT (small structures): 128 x 128 px square canvas
- MEDIUM (single-story buildings): 192 x 192 px square canvas
- TALL (two-story buildings): 256 x 256 px square canvas
- VERY TALL (large/impressive buildings): 320 x 320 px square canvas

The diamond footprint sits at the BOTTOM of the square canvas:
```
┌────────────────┐
│                │
│   Building     │
│   extends      │
│   upward       │
│       /\       │
│      /  \      │  ← Diamond footprint
│     <    >     │
│      \  /      │
└───────\/───────┘
   SQUARE canvas
```

The building grows UPWARD from the diamond base, filling the square canvas vertically.

### TEMPLATE CONSISTENCY
When creating any reference sheet, you MUST replicate the EXACT layout structure from the existing templates - same view arrangement, same label positions, same border style, same background. Only the subject itself changes, never the template format.

### BUILDING ORIENTATION
For ALL building sprites and reference sheets, the 45 DEGREE ISOMETRIC VIEW must have the entry point/door positioned on the BOTTOM LEFT side of the building. The front facade should face bottom-left, with the building extending toward the top-right. This is critical for map view consistency.

### COUNTRY-NEUTRAL
All assets must be COUNTRY-NEUTRAL. Do not include:
- National flags of any country
- Country-specific signage, text, or symbols
- Currency symbols (no $, £, €, etc.)
- Nationality-specific architectural descriptions
- Emergency service colors/markings specific to one country
- Region-specific brands or references

Buildings should feel generic and internationally recognizable. Keep all text generic (e.g., "POLICE", "BANK", "MOTEL").

### CLEAN BUILDINGS
All building assets must show ONLY the building itself. Do not include:
- Vehicles (cars, trucks, bikes, etc.)
- People or characters
- Animals
- Street furniture (benches, lamp posts, trash cans)
- Other buildings or structures
- Trees, bushes, or landscaping

The building should be isolated on its footprint with nothing else around it.

### UNIVERSAL EFFECTS
Dirty trick effects must work on ANY building type (from canvas tent to stone temple). Avoid specific building materials in effects. Use only universal elements: smoke, fire, sparks, generic debris, dust clouds.

## ASSET TYPES

### 1. BUILDING GAME SPRITES
Format: 45-degree isometric view, single image
Canvas: SQUARE (see size classes above)
Background: TRANSPARENT (PNG-ready)
Footprint: DIAMOND at bottom of square canvas
Orientation: Entry/front on BOTTOM LEFT

Building size assignments:
- SHORT (128x128): Market Stall, Hot Dog Stand, Campsite
- MEDIUM (192x192): Shop, Burger Bar, Motel
- TALL (256x256): High Street Store, Restaurant, Manor, Police Station
- VERY TALL (320x320): Casino, Temple, Bank

### 2. BUILDING REFERENCE SHEETS
Format: Multi-view reference sheet with labeled views
Views required:
- FRONT VIEW (top left)
- SIDE PROFILE VIEW (top right)
- BACK VIEW (middle left)
- 45 DEGREE ISOMETRIC VIEW (middle right)
- CLOSE UP DETAILS (bottom)

Title format: "BUILDING REFERENCE SHEET: 90s CGI [BUILDING NAME]"

Building types: Market Stall, Hot Dog Stand, Campsite, Shop, Burger Bar, Motel, High Street Store, Restaurant, Manor, Casino, Temple, Bank, Police Station

### 3. CHARACTER REFERENCE SHEETS
Format: Multi-view reference sheet with labeled views
Views required:
- FRONT VIEW
- SIDE PROFILE VIEW
- BACK VIEW
- Face close-up inset

Title format: "CHARACTER REFERENCE SHEET: 90s CGI [CHARACTER TYPE]"

### 4. DIRTY TRICK EFFECTS (Attack Overlays)
Format: 45-degree isometric view ONLY
Background: TRANSPARENT (PNG-ready)
Content: The effect ONLY - no building visible

Effect types:
- Cluster Bomb: Smoke plumes, fire bursts, grey dust clouds, sparks, scorch marks
- Arson: Flames, smoke, embers, orange glow
- Vandalism: Spray paint marks, generic trash, broken glass shards
- Robbery: Broken glass, open door imagery, scattered papers
- Poisoning: Green toxic clouds, wilted plants, bubbling puddles
- Blackout: Darkness overlay, electrical sparks, broken light elements

Effects must be sized to overlay a standard building footprint at 45-degree isometric angle.

### 5. SCENE ILLUSTRATIONS
Format: Full scene with background
Style: Same 90s CGI aesthetic with modern render quality

Examples: Being arrested, court appearance, prison cell, celebration, building interiors

## COMPOSITION GUIDELINES

Building game sprites:
- SQUARE canvas (128/192/256/320 px depending on size class)
- DIAMOND footprint at bottom of canvas
- Building extends upward to fill the square
- Transparent background
- Entry/door on BOTTOM LEFT

Reference sheets:
- Gray background (#808080 or similar neutral)
- White border boxes around each view
- Bold, blocky pixel-style font for labels
- Sparkle/shine element in corner (as seen in templates)

Effects/overlays:
- Transparent background
- 45-degree isometric angle matching building perspective
```

---

## Terrain Tile Prompts (7 types)

### GRASS TILE
```
Create a single isometric terrain tile for GRASS.

Format: Diamond/rhombus shaped tile viewed from above at 45-degree isometric angle
Dimensions: The tile should be a flat diamond that would fit a 64x32 pixel canvas (2:1 ratio)
Background: TRANSPARENT (PNG-ready)

The grass tile: Lush green grass with subtle variation in shade. Small tufts and texture visible but not overwhelming. Natural, well-maintained lawn appearance.

Style: 90s CGI aesthetic with modern render quality. Clean, slightly stylized grass texture. Soft shadows suggesting gentle undulation. The tile must seamlessly connect when placed adjacent to identical tiles.

This is a FLAT ground tile, not a 3D object. Show only the top surface as if looking down at an angle.
```

### WATER TILE
```
Create a single isometric terrain tile for WATER.

Format: Diamond/rhombus shaped tile viewed from above at 45-degree isometric angle
Dimensions: The tile should be a flat diamond that would fit a 64x32 pixel canvas (2:1 ratio)
Background: TRANSPARENT (PNG-ready)

The water tile: Blue water with subtle ripple texture. Gentle reflective quality suggesting calm water surface. Light caustic patterns optional.

Style: 90s CGI aesthetic with modern render quality. Clean, stylized water surface. Subtle specular highlights. The tile must seamlessly connect when placed adjacent to identical tiles.

This is a FLAT ground tile, not a 3D object. Show only the top surface as if looking down at an angle.
```

### ROAD TILE
```
Create a single isometric terrain tile for a ROAD WITH SIDEWALKS.

Format: Diamond/rhombus shaped tile viewed from above at 45-degree isometric angle
Dimensions: The tile should be a flat diamond that would fit a 64x32 pixel canvas (2:1 ratio)
Background: TRANSPARENT (PNG-ready)

The road tile: Dark gray asphalt road running through the center of the tile. Light gray/beige sidewalks on both edges of the diamond. Clear visual distinction between road surface (for vehicles) and sidewalk areas (for pedestrians). Road runs corner-to-corner diagonally.

Style: 90s CGI aesthetic with modern render quality. Clean surfaces with subtle texture. Asphalt should have fine grain texture, sidewalks should look like concrete/paving. The tile must seamlessly connect when placed adjacent to identical tiles.

This is a FLAT ground tile, not a 3D object. Show only the top surface as if looking down at an angle.
```

### DIRT TRACK TILE
```
Create a single isometric terrain tile for a DIRT TRACK.

Format: Diamond/rhombus shaped tile viewed from above at 45-degree isometric angle
Dimensions: The tile should be a flat diamond that would fit a 64x32 pixel canvas (2:1 ratio)
Background: TRANSPARENT (PNG-ready)

The dirt track tile: Brown/tan compacted dirt path. Visible texture suggesting worn earth - small pebbles, subtle tire/foot track impressions. Earthy, natural appearance.

Style: 90s CGI aesthetic with modern render quality. Warm brown tones with variation. The tile must seamlessly connect when placed adjacent to identical tiles.

This is a FLAT ground tile, not a 3D object. Show only the top surface as if looking down at an angle.
```

### TREES/FOREST TILE
```
Create a single isometric terrain tile for TREES/FOREST.

Format: Diamond/rhombus shaped tile viewed from above at 45-degree isometric angle
Dimensions: The tile should be a flat diamond that would fit a 64x32 pixel canvas (2:1 ratio) but trees extend upward
Background: TRANSPARENT (PNG-ready)

The trees tile: Dense cluster of trees viewed from above and the side. Chunky, stylized tree canopy with visible foliage masses. Mix of greens. Trees should extend above the base diamond footprint.

Style: 90s CGI aesthetic with modern render quality - chunky, polygonal tree shapes like early 3D games. Soft shadows between trees. Ambient occlusion in foliage depths. The base footprint should tile seamlessly.

Show trees as 3D objects sitting on the diamond base, extending upward.
```

### MOUNTAIN TILE
```
Create a single isometric terrain tile for MOUNTAIN/ROCKY TERRAIN.

Format: Diamond/rhombus shaped tile viewed from above at 45-degree isometric angle
Dimensions: The tile should be a flat diamond that would fit a 64x32 pixel canvas (2:1 ratio) but rocks extend upward
Background: TRANSPARENT (PNG-ready)

The mountain tile: Rocky, elevated terrain with chunky rock formations. Gray and brown stone with visible facets. Impassable, rugged appearance.

Style: 90s CGI aesthetic with modern render quality - chunky, angular rock shapes with visible polygonal faces. Strong shadows on rock faces. The base footprint should tile seamlessly.

Show rocks as 3D objects sitting on the diamond base, extending upward.
```

### SAND/BEACH TILE
```
Create a single isometric terrain tile for SAND/BEACH.

Format: Diamond/rhombus shaped tile viewed from above at 45-degree isometric angle
Dimensions: The tile should be a flat diamond that would fit a 64x32 pixel canvas (2:1 ratio)
Background: TRANSPARENT (PNG-ready)

The sand tile: Golden/beige sand with subtle ripple texture suggesting wind patterns. Small variation in tone. Beach/desert sand appearance.

Style: 90s CGI aesthetic with modern render quality. Warm sandy tones with soft texture. The tile must seamlessly connect when placed adjacent to identical tiles.

This is a FLAT ground tile, not a 3D object. Show only the top surface as if looking down at an angle.
```

---

## Building Game Sprite Prompts (10 types)

These are standalone 45-degree isometric building sprites for direct use in the game map. Each building fits inside a SQUARE canvas with a diamond footprint at the bottom.

### MARKET STALL
```
Create a single isometric game sprite for a MARKET STALL.

Format: 45-degree isometric view, single image
Canvas: 128 x 128 px SQUARE
Background: TRANSPARENT (PNG-ready)
Size class: SHORT (small structure)
Orientation: Entry/customer-facing side on BOTTOM LEFT, building extends toward top-right

The market stall: Small outdoor wooden vendor booth with canvas awning. Weathered timber frame with visible wood grain. Fabric awning with subtle cloth folds. Display counter with crates of colorful goods. Hand-painted signage. Rustic and humble.

The building sits on a DIAMOND-shaped footprint at the BOTTOM of the square canvas. The structure extends UPWARD from the diamond base to fill the canvas vertically.

Style: 90s CGI chunky polygonal aesthetic with modern render quality. Soft ambient occlusion under awning. Clean anti-aliased edges. Top-left lighting. Country-neutral (no flags or nationality-specific elements). Building only - no vehicles, people, or surrounding objects.
```

### HOT DOG STAND
```
Create a single isometric game sprite for a HOT DOG STAND.

Format: 45-degree isometric view, single image
Canvas: 128 x 128 px SQUARE
Background: TRANSPARENT (PNG-ready)
Size class: SHORT (small structure)
Orientation: Serving counter/customer-facing side on BOTTOM LEFT, cart extends toward top-right

The hot dog stand: Wheeled street vendor cart with large fabric umbrella. Polished metal serving counter with subtle reflections. Condiment bottles visible. Steamer box. Menu board. Classic street food vendor style.

The building sits on a DIAMOND-shaped footprint at the BOTTOM of the square canvas. The structure extends UPWARD from the diamond base to fill the canvas vertically.

Style: 90s CGI chunky polygonal aesthetic with modern render quality. Specular highlights on metal. Soft shadows under umbrella. Top-left lighting. Country-neutral. Building only - no vehicles, people, or surrounding objects.
```

### CAMPSITE
```
Create a single isometric game sprite for a CAMPSITE.

Format: 45-degree isometric view, single image
Canvas: 128 x 128 px SQUARE
Background: TRANSPARENT (PNG-ready)
Size class: SHORT (small structure)
Orientation: Tent entrance on BOTTOM LEFT, campsite extends toward top-right

The campsite: Canvas A-frame tent with visible fabric tension. Stone campfire ring with charred logs. Wooden supply crates. Oil lantern on a post. Outdoorsy and rugged.

The campsite sits on a DIAMOND-shaped footprint at the BOTTOM of the square canvas. The structure extends UPWARD from the diamond base to fill the canvas vertically.

Style: 90s CGI chunky polygonal aesthetic with modern render quality. Soft light through canvas. Ambient occlusion in fabric folds. Top-left lighting. Country-neutral. Site only - no vehicles, people, or surrounding objects.
```

### SHOP
```
Create a single isometric game sprite for a SHOP.

Format: 45-degree isometric view, single image
Canvas: 192 x 192 px SQUARE
Background: TRANSPARENT (PNG-ready)
Size class: MEDIUM (single-story building)
Orientation: Shop entrance on BOTTOM LEFT, building extends toward top-right

The shop: Small single-story retail store. Brick or stucco facade with visible texture. Large display window with subtle glass reflections. Fabric awning over entrance. Wooden door with handle. "OPEN" sign in window. Modest neighborhood corner shop feel.

The building sits on a DIAMOND-shaped footprint at the BOTTOM of the square canvas. The structure extends UPWARD from the diamond base to fill the canvas vertically.

Style: 90s CGI chunky polygonal aesthetic with modern render quality. Glass reflections on window. Soft shadows under awning. Top-left lighting. Country-neutral. Building only - no vehicles, people, or surrounding objects.
```

### BURGER BAR
```
Create a single isometric game sprite for a BURGER BAR.

Format: 45-degree isometric view, single image
Canvas: 192 x 192 px SQUARE
Background: TRANSPARENT (PNG-ready)
Size class: MEDIUM (single-story building)
Orientation: Diner entrance on BOTTOM LEFT, building extends toward top-right

The burger bar: 1950s diner style building. Chrome trim with specular reflections. Red and white color scheme. Neon "BURGERS" sign. Large plate glass windows showing checkered floor inside. Retro roadside restaurant vibe.

The building sits on a DIAMOND-shaped footprint at the BOTTOM of the square canvas. The structure extends UPWARD from the diamond base to fill the canvas vertically.

Style: 90s CGI chunky polygonal aesthetic with modern render quality. Bright chrome reflections. Neon glow effect. Warm interior lighting visible. Top-left lighting. Country-neutral. Building only - no vehicles, people, or surrounding objects.
```

### MOTEL
```
Create a single isometric game sprite for a MOTEL.

Format: 45-degree isometric view, single image
Canvas: 192 x 192 px SQUARE
Background: TRANSPARENT (PNG-ready)
Size class: MEDIUM (single-story, but wide)
Orientation: Room doors/front facade on BOTTOM LEFT, building extends toward top-right

The motel: Single-story row of connected rooms. Stucco or painted concrete exterior. Individual doors with room numbers and small windows. Flat roof with overhang. Tall "MOTEL" sign with "VACANCY" underneath. Ice machine alcove. Classic roadside motel.

The building sits on a DIAMOND-shaped footprint at the BOTTOM of the square canvas. The structure extends UPWARD from the diamond base to fill the canvas vertically.

Style: 90s CGI chunky polygonal aesthetic with modern render quality. Warm glow from windows. Sign lighting effect. Soft shadows under roof overhang. Top-left lighting. Country-neutral. Building only - no vehicles, people, or surrounding objects.
```

### HIGH STREET STORE
```
Create a single isometric game sprite for a HIGH STREET STORE.

Format: 45-degree isometric view, single image
Canvas: 256 x 256 px SQUARE
Background: TRANSPARENT (PNG-ready)
Size class: TALL (two-story building)
Orientation: Shop entrance on BOTTOM LEFT, building extends toward top-right

The high street store: Two-story traditional retail building. Ground floor with large shop windows in frames. Decorative upper floor with smaller windows and ornamental details. Prominent signage area above entrance. Recessed doorway. Classic urban shopping district architecture.

The building sits on a DIAMOND-shaped footprint at the BOTTOM of the square canvas. The structure extends UPWARD from the diamond base to fill the canvas vertically.

Style: 90s CGI chunky polygonal aesthetic with modern render quality. Glass reflections on shop windows. Ambient occlusion in recessed doorway. Top-left lighting. Country-neutral. Building only - no vehicles, people, or surrounding objects.
```

### RESTAURANT
```
Create a single isometric game sprite for a RESTAURANT.

Format: 45-degree isometric view, single image
Canvas: 256 x 256 px SQUARE
Background: TRANSPARENT (PNG-ready)
Size class: TALL (two-story building)
Orientation: Restaurant entrance on BOTTOM LEFT, building extends toward top-right

The restaurant: Upscale dining establishment. Elegant facade with rendered or stone-effect walls. Large windows with sheer curtains diffusing warm interior light. Decorative entrance with small canopy. Brass door furniture. Outdoor menu display case. Classy atmosphere.

The building sits on a DIAMOND-shaped footprint at the BOTTOM of the square canvas. The structure extends UPWARD from the diamond base to fill the canvas vertically.

Style: 90s CGI chunky polygonal aesthetic with modern render quality. Warm golden interior glow. Polished brass reflections. Soft fabric translucency on curtains. Top-left lighting. Country-neutral. Building only - no vehicles, people, or surrounding objects.
```

### MANOR
```
Create a single isometric game sprite for a MANOR.

Format: 45-degree isometric view, single image
Canvas: 256 x 256 px SQUARE
Background: TRANSPARENT (PNG-ready)
Size class: TALL (large multi-story mansion)
Orientation: Manor entrance on BOTTOM LEFT, building extends toward top-right

The manor: Grand mansion with multiple stories. Ornate architectural details - cornices, window surrounds, decorative stonework. Large columned entrance portico with steps. Many tall windows with shutters. Steep rooflines with chimneys. Wealthy estate feel - imposing and prestigious.

The building sits on a DIAMOND-shaped footprint at the BOTTOM of the square canvas. The structure extends UPWARD from the diamond base to fill the canvas vertically.

Style: 90s CGI chunky polygonal aesthetic with modern render quality. Dramatic lighting emphasizing grandeur. Soft shadows in decorative recesses. Top-left lighting. Country-neutral. Building only - no vehicles, people, or surrounding objects.
```

### CASINO
```
Create a single isometric game sprite for a CASINO.

Format: 45-degree isometric view, single image
Canvas: 320 x 320 px SQUARE
Background: TRANSPARENT (PNG-ready)
Size class: VERY TALL (impressive large building)
Orientation: Casino entrance on BOTTOM LEFT, building extends toward top-right

The casino: Flashy entertainment building. Facade covered in decorative lights. Grand double-door entrance with brass and glass. Large "CASINO" signage with illuminated lettering. Gold and red color accents. Plush carpet visible through glass doors. Glamorous gambling hall style.

The building sits on a DIAMOND-shaped footprint at the BOTTOM of the square canvas. The structure extends UPWARD from the diamond base to fill the canvas vertically.

Style: 90s CGI chunky polygonal aesthetic with modern render quality. Bright lighting effects. Gold metallic reflections. Warm inviting glow from entrance. Top-left lighting. Country-neutral. Building only - no vehicles, people, or surrounding objects.
```

---

## Special Building Prompts (3 types)

### TEMPLE
```
Create a single isometric game sprite for a TEMPLE.

Format: 45-degree isometric view, single image
Canvas: 320 x 320 px SQUARE
Background: TRANSPARENT (PNG-ready)
Size class: VERY TALL (impressive sacred building)
Orientation: Temple entrance/front steps on BOTTOM LEFT, building extends toward top-right

The temple: Sacred spiritual building. Ornate multi-tiered roofing with curved eaves and decorative ridge tiles. Grand entrance stairs leading to main doors. Decorative columns or pillars with carved details. Intricate architectural ornamentation. Stone foundation with polished wooden upper structure. Peaceful, reverent, ancient atmosphere.

The building sits on a DIAMOND-shaped footprint at the BOTTOM of the square canvas. The structure extends UPWARD from the diamond base to fill the canvas vertically.

Style: 90s CGI chunky polygonal aesthetic with modern render quality. Warm wood tones with subtle grain. Cool stone contrasts. Soft lighting suggesting serenity. Ambient occlusion in architectural details. Top-left lighting. Country-neutral (generic spiritual architecture, not specific to any religion or country). Building only - no vehicles, people, or surrounding objects.
```

### BANK
```
Create a single isometric game sprite for a BANK.

Format: 45-degree isometric view, single image
Canvas: 320 x 320 px SQUARE
Background: TRANSPARENT (PNG-ready)
Size class: VERY TALL (imposing institutional building)
Orientation: Bank entrance/front columns on BOTTOM LEFT, building extends toward top-right

The bank: Imposing neoclassical building. Large stone columns at entrance with detailed capitals. Heavy bronze or brass doors with secure appearance. "BANK" carved into stone facade or on polished brass plaque. Barred lower windows with decorative ironwork. Clock mounted above entrance. Solid stone or marble facade. Institutional grandeur - solid, trustworthy, monumental.

The building sits on a DIAMOND-shaped footprint at the BOTTOM of the square canvas. The structure extends UPWARD from the diamond base to fill the canvas vertically.

Style: 90s CGI chunky polygonal aesthetic with modern render quality. Weighty stone materiality. Polished bronze reflections. Strong shadows from columns. Top-left lighting. Country-neutral. Building only - no vehicles, people, or surrounding objects.
```

### POLICE STATION
```
Create a single isometric game sprite for a POLICE STATION.

Format: 45-degree isometric view, single image
Canvas: 256 x 256 px SQUARE
Background: TRANSPARENT (PNG-ready)
Size class: TALL (official government building)
Orientation: Station entrance/front doors on BOTTOM LEFT, building extends toward top-right

The police station: Official government building. Brick and concrete construction with functional design. "POLICE" signage prominently displayed. Blue lamp mounted outside entrance (traditional police lamp). Heavy-duty double doors with reinforced frames. Barred windows on lower level for security. Utilitarian but authoritative architecture.

The building sits on a DIAMOND-shaped footprint at the BOTTOM of the square canvas. The structure extends UPWARD from the diamond base to fill the canvas vertically.

Style: 90s CGI chunky polygonal aesthetic with modern render quality. Blue lamp glow effect. Strong institutional lighting. Ambient occlusion on brick texture. Top-left lighting. Country-neutral (generic police building, no specific national markings or flag). Building only - no vehicles, people, or surrounding objects.
```

---

## Building Reference Sheet Prompts (13 types)

For creating full multi-view reference sheets instead of game sprites.

### MARKET STALL - REFERENCE SHEET
```
Create a building reference sheet for a MARKET STALL.

Match the EXACT template layout from the existing building references:
- Same gray background, white border boxes, label positions, font style
- Views: FRONT VIEW (top left), SIDE PROFILE VIEW (top right), BACK VIEW (middle left), 45 DEGREE ISOMETRIC VIEW (middle right), CLOSE UP DETAILS (bottom)
- Title: "BUILDING REFERENCE SHEET: 90s CGI MARKET STALL"
- 45 degree view: Entry/customer-facing side on BOTTOM LEFT

The market stall: Small outdoor wooden vendor booth with canvas awning. Weathered timber frame with visible wood grain texture. Fabric awning with subtle cloth folds catching the light. Display counter with crates of colorful goods. Hand-painted signage. Rustic and humble.

Materials to highlight in close-up: Wood grain on frame, canvas texture on awning, produce/goods detail.

90s CGI chunky style with modern render quality - soft ambient occlusion under the awning, subtle rim lighting on edges, clean anti-aliased finish.
```

### HOT DOG STAND - REFERENCE SHEET
```
Create a building reference sheet for a HOT DOG STAND.

Match the EXACT template layout from the existing building references:
- Same gray background, white border boxes, label positions, font style
- Views: FRONT VIEW (top left), SIDE PROFILE VIEW (top right), BACK VIEW (middle left), 45 DEGREE ISOMETRIC VIEW (middle right), CLOSE UP DETAILS (bottom)
- Title: "BUILDING REFERENCE SHEET: 90s CGI HOT DOG STAND"
- 45 degree view: Serving counter/customer-facing side on BOTTOM LEFT

The hot dog stand: Wheeled street vendor cart with large fabric umbrella. Polished metal serving counter with subtle reflections. Glass sneeze guard over the food area. Condiment bottles (mustard, ketchup) with glossy surfaces. Steamer box with gentle steam wisps. Menu board with hand-lettered text.

Materials to highlight in close-up: Brushed metal counter surface, glass panel reflections, umbrella fabric texture, wheel rubber and metal spokes.

90s CGI chunky style with modern render quality - specular highlights on metal and glass, soft shadows under umbrella, warm lighting suggesting food service.
```

### CAMPSITE - REFERENCE SHEET
```
Create a building reference sheet for a CAMPSITE.

Match the EXACT template layout from the existing building references:
- Same gray background, white border boxes, label positions, font style
- Views: FRONT VIEW (top left), SIDE PROFILE VIEW (top right), BACK VIEW (middle left), 45 DEGREE ISOMETRIC VIEW (middle right), CLOSE UP DETAILS (bottom)
- Title: "BUILDING REFERENCE SHEET: 90s CGI CAMPSITE"
- 45 degree view: Tent entrance on BOTTOM LEFT

The campsite: Canvas A-frame tent with visible fabric tension and subtle wrinkles. Guy ropes anchored to ground. Stone campfire ring with charred logs and ash. Wooden supply crates with metal reinforcements. Oil lantern on a post with glass housing. Rough ground texture beneath.

Materials to highlight in close-up: Canvas weave texture, rope fiber detail, stone texture on fire ring, weathered wood grain on crates, glass lantern with internal wick visible.

90s CGI chunky style with modern render quality - soft light filtering through canvas, warm glow suggestion from lantern, ambient occlusion in fabric folds and around stones.
```

### SHOP - REFERENCE SHEET
```
Create a building reference sheet for a SHOP.

Match the EXACT template layout from the existing building references:
- Same gray background, white border boxes, label positions, font style
- Views: FRONT VIEW (top left), SIDE PROFILE VIEW (top right), BACK VIEW (middle left), 45 DEGREE ISOMETRIC VIEW (middle right), CLOSE UP DETAILS (bottom)
- Title: "BUILDING REFERENCE SHEET: 90s CGI SHOP"
- 45 degree view: Shop entrance on BOTTOM LEFT

The shop: Small single-story retail store. Brick or stucco facade with visible texture. Large display window with subtle glass reflections showing goods inside. Fabric awning with metal frame over entrance. Wooden door with brass handle. "OPEN" sign in window. Simple, modest neighborhood corner shop feel.

Materials to highlight in close-up: Brick/stucco wall texture, glass window reflections, awning fabric and metal frame, door wood grain, brass handle with specular highlight.

90s CGI chunky style with modern render quality - glass reflections on window, soft shadows under awning, warm interior glow visible through glass, clean material definition.
```

### BURGER BAR - REFERENCE SHEET
```
Create a building reference sheet for a BURGER BAR.

Match the EXACT template layout from the existing building references:
- Same gray background, white border boxes, label positions, font style
- Views: FRONT VIEW (top left), SIDE PROFILE VIEW (top right), BACK VIEW (middle left), 45 DEGREE ISOMETRIC VIEW (middle right), CLOSE UP DETAILS (bottom)
- Title: "BUILDING REFERENCE SHEET: 90s CGI BURGER BAR"
- 45 degree view: Diner entrance on BOTTOM LEFT

The burger bar: 1950s diner style building. Chrome trim with bright specular reflections. Red and white color scheme. Neon "BURGERS" sign (tubes visible). Large plate glass windows showing checkered floor and counter seating inside. Tiled or steel panel exterior. Small canopy over entrance.

Materials to highlight in close-up: Chrome trim reflections, neon tube detail, glass windows with interior visible, checkered floor pattern, tile or panel texture on walls.

90s CGI chunky style with modern render quality - bright chrome reflections, neon glow effect, warm interior lighting visible through windows, polished retro-futuristic feel.
```

### MOTEL - REFERENCE SHEET
```
Create a building reference sheet for a MOTEL.

Match the EXACT template layout from the existing building references:
- Same gray background, white border boxes, label positions, font style
- Views: FRONT VIEW (top left), SIDE PROFILE VIEW (top right), BACK VIEW (middle left), 45 DEGREE ISOMETRIC VIEW (middle right), CLOSE UP DETAILS (bottom)
- Title: "BUILDING REFERENCE SHEET: 90s CGI MOTEL"
- 45 degree view: Room doors/front facade on BOTTOM LEFT

The motel: Single-story row of connected rooms. Stucco or painted concrete exterior with subtle texture. Individual doors with room numbers, each with a small window. Larger windows with curtains partially visible. Flat roof with slight overhang. Tall "MOTEL" sign with "VACANCY" underneath (bulb-style lettering). Ice machine alcove. Paved area in front.

Materials to highlight in close-up: Stucco wall texture, painted metal doors, curtain fabric behind glass, sign with individual bulb sockets, concrete paving texture.

90s CGI chunky style with modern render quality - evening/dusk lighting with warm glow from windows, sign lighting effect, soft shadows under roof overhang, slightly worn roadside feel.
```

### HIGH STREET STORE - REFERENCE SHEET
```
Create a building reference sheet for a HIGH STREET STORE.

Match the EXACT template layout from the existing building references:
- Same gray background, white border boxes, label positions, font style
- Views: FRONT VIEW (top left), SIDE PROFILE VIEW (top right), BACK VIEW (middle left), 45 DEGREE ISOMETRIC VIEW (middle right), CLOSE UP DETAILS (bottom)
- Title: "BUILDING REFERENCE SHEET: 90s CGI HIGH STREET STORE"
- 45 degree view: Shop entrance on BOTTOM LEFT

The high street store: Two-story traditional retail building. Ground floor with large shop windows in wooden or metal frames. Decorative upper floor with smaller windows and ornamental details. Prominent signage area above entrance (blank or generic "STORE"). Recessed doorway with tiled entrance. Classic urban shopping district architecture.

Materials to highlight in close-up: Window frame detail, decorative molding on upper floor, signage area texture, entrance tile pattern, brick or rendered wall finish.

90s CGI chunky style with modern render quality - glass reflections on shop windows, ambient occlusion in recessed doorway, subtle architectural detail shadows, established and respectable feel.
```

### RESTAURANT - REFERENCE SHEET
```
Create a building reference sheet for a RESTAURANT.

Match the EXACT template layout from the existing building references:
- Same gray background, white border boxes, label positions, font style
- Views: FRONT VIEW (top left), SIDE PROFILE VIEW (top right), BACK VIEW (middle left), 45 DEGREE ISOMETRIC VIEW (middle right), CLOSE UP DETAILS (bottom)
- Title: "BUILDING REFERENCE SHEET: 90s CGI RESTAURANT"
- 45 degree view: Restaurant entrance on BOTTOM LEFT

The restaurant: Upscale dining establishment. Elegant facade with rendered or stone-effect walls. Large windows with sheer curtains diffusing warm interior light. Decorative entrance with small canopy or awning. Brass or polished metal door furniture. Outdoor menu display case with glass front. Subtle architectural details suggesting quality.

Materials to highlight in close-up: Stone or render wall texture, brass door handles and fixtures, glass menu case, curtain fabric behind windows, canopy material.

90s CGI chunky style with modern render quality - warm golden interior glow through windows, polished brass reflections, soft fabric translucency on curtains, inviting upscale atmosphere.
```

### MANOR - REFERENCE SHEET
```
Create a building reference sheet for a MANOR.

Match the EXACT template layout from the existing building references:
- Same gray background, white border boxes, label positions, font style
- Views: FRONT VIEW (top left), SIDE PROFILE VIEW (top right), BACK VIEW (middle left), 45 DEGREE ISOMETRIC VIEW (middle right), CLOSE UP DETAILS (bottom)
- Title: "BUILDING REFERENCE SHEET: 90s CGI MANOR"
- 45 degree view: Manor entrance on BOTTOM LEFT

The manor: Grand mansion with multiple stories. Ornate architectural details - cornices, window surrounds, decorative stonework. Large columned entrance portico with steps. Many tall windows with shutters. Steep rooflines with multiple chimneys. Wealthy estate feel. Imposing and prestigious. Stone or rendered facade with aged patina.

Materials to highlight in close-up: Carved stone column detail, ornate window surround, roof tile/slate texture, chimney brickwork, decorative ironwork on railings.

90s CGI chunky style with modern render quality - dramatic lighting emphasizing architectural grandeur, soft shadows in decorative recesses, subtle material aging, powerful and wealthy atmosphere.
```

### CASINO - REFERENCE SHEET
```
Create a building reference sheet for a CASINO.

Match the EXACT template layout from the existing building references:
- Same gray background, white border boxes, label positions, font style
- Views: FRONT VIEW (top left), SIDE PROFILE VIEW (top right), BACK VIEW (middle left), 45 DEGREE ISOMETRIC VIEW (middle right), CLOSE UP DETAILS (bottom)
- Title: "BUILDING REFERENCE SHEET: 90s CGI CASINO"
- 45 degree view: Casino entrance on BOTTOM LEFT

The casino: Flashy entertainment building. Facade covered in decorative lights (bulbs and strips). Grand double-door entrance with brass and glass. Large "CASINO" signage with illuminated lettering. Gold and red color accents throughout. Plush red carpet visible through glass doors. Ornate but gaudy architectural details. Vegas glamour style.

Materials to highlight in close-up: Individual light bulbs on facade, brass door frame and handles, carpet texture through glass, illuminated sign detail, decorative gold trim.

90s CGI chunky style with modern render quality - bright lighting effects, gold metallic reflections, warm inviting glow from entrance, exciting and glamorous atmosphere.
```

### BANK - REFERENCE SHEET
```
Create a building reference sheet for a BANK.

Match the EXACT template layout from the existing building references:
- Same gray background, white border boxes, label positions, font style
- Views: FRONT VIEW (top left), SIDE PROFILE VIEW (top right), BACK VIEW (middle left), 45 DEGREE ISOMETRIC VIEW (middle right), CLOSE UP DETAILS (bottom)
- Title: "BUILDING REFERENCE SHEET: 90s CGI BANK"
- 45 degree view: Bank entrance on BOTTOM LEFT

The bank: Imposing neoclassical building. Large stone columns at entrance with detailed capitals. Heavy bronze or brass doors with secure appearance. "BANK" carved into stone facade or on polished brass plaque. Barred lower windows with decorative ironwork. Clock mounted above entrance. Solid stone or marble facade. Institutional grandeur.

Materials to highlight in close-up: Carved stone column fluting and capital, bronze door patina and detail, iron window bars, carved lettering, clock face with metallic frame.

90s CGI chunky style with modern render quality - weighty stone materiality, polished bronze reflections, strong shadows from columns, trustworthy and monumental atmosphere.
```

### POLICE STATION - REFERENCE SHEET
```
Create a building reference sheet for a POLICE STATION.

Match the EXACT template layout from the existing building references:
- Same gray background, white border boxes, label positions, font style
- Views: FRONT VIEW (top left), SIDE PROFILE VIEW (top right), BACK VIEW (middle left), 45 DEGREE ISOMETRIC VIEW (middle right), CLOSE UP DETAILS (bottom)
- Title: "BUILDING REFERENCE SHEET: 90s CGI POLICE STATION"
- 45 degree view: Station entrance on BOTTOM LEFT

The police station: Official government building. Brick and concrete construction with functional design. "POLICE" signage prominently displayed. Blue lamp mounted outside entrance (traditional police lamp). Heavy-duty double doors with reinforced frames. Barred windows on lower level for security. Utilitarian but authoritative architecture.

Materials to highlight in close-up: Brick wall texture, blue lamp glass with internal glow, reinforced door frame detail, window bar ironwork, concrete trim elements.

90s CGI chunky style with modern render quality - blue lamp glow effect, strong institutional lighting, ambient occlusion on brick texture, authoritative and secure atmosphere.
```

### TEMPLE - REFERENCE SHEET
```
Create a building reference sheet for a TEMPLE.

Match the EXACT template layout from the existing building references:
- Same gray background, white border boxes, label positions, font style
- Views: FRONT VIEW (top left), SIDE PROFILE VIEW (top right), BACK VIEW (middle left), 45 DEGREE ISOMETRIC VIEW (middle right), CLOSE UP DETAILS (bottom)
- Title: "BUILDING REFERENCE SHEET: 90s CGI TEMPLE"
- 45 degree view: Temple entrance on BOTTOM LEFT

The temple: Sacred spiritual building. Ornate multi-tiered roofing with curved eaves and decorative ridge tiles. Grand entrance stairs leading to main doors. Decorative columns or pillars with carved details. Intricate architectural ornamentation. Stone foundation with polished wooden upper structure. Peaceful, reverent, and ancient atmosphere.

Materials to highlight in close-up: Roof tile layering and ridge decoration, carved pillar detail, stone stair texture, wooden door with metal fittings, ornamental carvings.

90s CGI chunky style with modern render quality - warm wood tones with subtle grain, cool stone contrasts, soft lighting suggesting serenity, ambient occlusion in architectural details, spiritual and timeless atmosphere.
```

---

## Status Effect / Overlay Prompts (6 types)

### FIRE EFFECT
```
Create a dirty trick effect overlay for FIRE/ARSON.

Format: 45-degree isometric view
Background: TRANSPARENT (PNG-ready)
Purpose: This will be overlaid on ANY building to show it's on fire

Show ONLY the fire effect elements - NO BUILDING VISIBLE:
- Bright orange and yellow flames rising upward
- Dark smoke plumes billowing
- Glowing embers floating
- Heat distortion suggestion
- Flickering fire tongues at different heights

The effect should be sized to overlay a standard building footprint at 45-degree isometric angle. Flames should rise from where a building base would be.

CRITICAL: Use only universal elements. No specific building materials visible. The effect must work whether overlaid on a canvas tent, wooden shack, or stone temple.

Style: 90s CGI aesthetic with modern render quality. Stylized but dramatic flames. Volumetric smoke. Clean anti-aliased edges on transparent background.
```

### LIGHT DAMAGE (25%)
```
Create a damage effect overlay for LIGHT DAMAGE (25% health).

Format: 45-degree isometric view
Background: TRANSPARENT (PNG-ready)
Purpose: This will be overlaid on ANY building to show minor damage

Show ONLY the damage effect elements - NO BUILDING VISIBLE:
- Scattered dust and small debris particles
- Thin wisps of smoke from a few points
- Generic scuff marks and scratches (not on any surface - floating in space at building positions)
- Minor discoloration patches
- A few floating broken glass shards

The effect should be sized to overlay a standard building footprint at 45-degree isometric angle. Damage elements should appear where walls/surfaces would be.

CRITICAL: Use only universal elements. No bricks, wood planks, concrete chunks, or any specific building materials. The effect must work on any building type.

Style: 90s CGI aesthetic with modern render quality. Subtle damage suggestion. Clean anti-aliased edges on transparent background.
```

### MEDIUM DAMAGE (50%)
```
Create a damage effect overlay for MEDIUM DAMAGE (50% health).

Format: 45-degree isometric view
Background: TRANSPARENT (PNG-ready)
Purpose: This will be overlaid on ANY building to show moderate damage

Show ONLY the damage effect elements - NO BUILDING VISIBLE:
- More prominent dust clouds and debris particles
- Multiple smoke wisps rising from various points
- Larger floating debris (generic gray rubble, not identifiable materials)
- Scorch marks and soot patches
- Broken glass scattered
- Some structural warping suggestion

The effect should be sized to overlay a standard building footprint at 45-degree isometric angle.

CRITICAL: Use only universal elements. No bricks, wood planks, concrete chunks, or any specific building materials. The effect must work on any building type.

Style: 90s CGI aesthetic with modern render quality. Noticeable damage state. Clean anti-aliased edges on transparent background.
```

### HEAVY DAMAGE (75%)
```
Create a damage effect overlay for HEAVY DAMAGE (75% health).

Format: 45-degree isometric view
Background: TRANSPARENT (PNG-ready)
Purpose: This will be overlaid on ANY building to show severe damage

Show ONLY the damage effect elements - NO BUILDING VISIBLE:
- Heavy dust and smoke clouds
- Thick smoke columns rising
- Significant floating debris field (generic gray/black rubble)
- Large scorch marks and burn patches
- Sparks and embers
- Structural collapse suggestion (bent/warped shapes, not specific materials)
- Exposed framework silhouettes

The effect should be sized to overlay a standard building footprint at 45-degree isometric angle.

CRITICAL: Use only universal elements. No bricks, wood planks, concrete chunks, or any specific building materials. The effect must work on any building type.

Style: 90s CGI aesthetic with modern render quality. Dramatic near-destruction state. Clean anti-aliased edges on transparent background.
```

### FOR SALE SIGN
```
Create a small UI indicator for a FOR SALE status.

Format: Small icon/sign, slight 3D perspective
Background: TRANSPARENT (PNG-ready)
Size: Small - approximately 24x24 pixels worth of detail
Purpose: Positioned at top-right of a building to show it's for sale

The sign: A small wooden or metal sign post with a hanging "FOR SALE" placard. Classic real estate sign style. Red and white coloring. Simple and recognizable.

Style: 90s CGI aesthetic with modern render quality. Chunky, readable at small size. Clean anti-aliased edges on transparent background. Country-neutral (no currency symbols, just "FOR SALE" text).
```

### SECURITY ICON
```
Create a small UI indicator for SECURITY status.

Format: Small icon, slight 3D perspective
Background: TRANSPARENT (PNG-ready)
Size: Small - approximately 24x24 pixels worth of detail
Purpose: Positioned at top-right of a building to show it has security

The icon: A shield shape with a checkmark or lock symbol. Alternatively, a small security camera. Blue and silver coloring. Protective, secure feeling.

Style: 90s CGI aesthetic with modern render quality. Chunky, readable at small size. Clean anti-aliased edges on transparent background. Instantly recognizable as "protected/secure".
```

---

## UI Element Prompts (3 types)

### MINIMAP PLAYER MARKER
```
Create a small minimap marker icon for the PLAYER.

Format: Tiny icon viewed from above
Background: TRANSPARENT (PNG-ready)
Size: Very small - approximately 8x8 pixels worth of detail
Purpose: Shows player's buildings on the minimap

The marker: A small bright GREEN dot or diamond shape. Solid, highly visible color. Simple geometric shape. Could have a subtle glow or highlight.

Style: Clean, simple, easily distinguishable at very small size. Bright green (#22c55e or similar). Must stand out against a minimap background.
```

### MINIMAP ENEMY MARKER
```
Create a small minimap marker icon for ENEMIES.

Format: Tiny icon viewed from above
Background: TRANSPARENT (PNG-ready)
Size: Very small - approximately 8x8 pixels worth of detail
Purpose: Shows enemy buildings on the minimap

The marker: A small bright RED dot or diamond shape. Solid, highly visible color. Simple geometric shape. Could have a subtle glow or highlight.

Style: Clean, simple, easily distinguishable at very small size. Bright red (#ef4444 or similar). Must stand out against a minimap background and be clearly different from the green player marker.
```

### SELECTION CURSOR
```
Create a tile selection cursor for the isometric map.

Format: Diamond/rhombus outline at 45-degree isometric angle
Background: TRANSPARENT (PNG-ready)
Size: Slightly larger than a tile - approximately 68x36 pixels (to surround a 64x32 tile)
Purpose: Highlights the currently selected/hovered tile on the game map

The cursor: A glowing diamond outline that surrounds an isometric tile. Bright, noticeable edge glow. Could be yellow, white, or cyan. Animated pulse effect optional. Just the outline - no fill (or very subtle semi-transparent fill).

Style: Clean geometric shape. Bright enough to be visible over any terrain or building. Suggests "this tile is selected". Smooth anti-aliased edges.
```

---

## Avatar Asset Prompts (17 items)

### BASE BODIES

#### BASE - STANDARD
```
Create an avatar base body layer: STANDARD BUILD.

Format: Front-facing character silhouette/body shape
Background: TRANSPARENT (PNG-ready)
Size: Square canvas suitable for avatar preview (e.g., 256x256 or 512x512)
Purpose: Base layer that other avatar elements layer on top of

The body: A standard adult human body silhouette. Neutral standing pose, arms slightly away from body. Average/normal build proportions. This is the underlying shape - skin tone will be applied as a separate layer.

Show as a flat gray or neutral base color (skin will overlay this). Chunky, slightly stylized proportions matching the 90s CGI character aesthetic - stocky, geometric forms.

Style: 90s CGI aesthetic with modern render quality. Match the character template style. This is a BASE layer - keep it simple and neutral. Country-neutral, gender-neutral if possible, or provide as male business character base.
```

#### BASE - ATHLETIC
```
Create an avatar base body layer: ATHLETIC BUILD.

Format: Front-facing character silhouette/body shape
Background: TRANSPARENT (PNG-ready)
Size: Square canvas suitable for avatar preview (e.g., 256x256 or 512x512)
Purpose: Base layer that other avatar elements layer on top of

The body: An athletic adult human body silhouette. Neutral standing pose, arms slightly away from body. Broader shoulders, more muscular proportions than standard. This is the underlying shape - skin tone will be applied as a separate layer.

Show as a flat gray or neutral base color (skin will overlay this). Chunky, slightly stylized proportions matching the 90s CGI character aesthetic.

Style: 90s CGI aesthetic with modern render quality. Match the character template style. This is a BASE layer - keep it simple and neutral.
```

### SKIN TONES

#### SKIN - LIGHT
```
Create an avatar skin tone layer: LIGHT SKIN.

Format: Skin coloring overlay matching base body shape
Background: TRANSPARENT (PNG-ready)
Size: Square canvas matching base body size (e.g., 256x256 or 512x512)
Purpose: Layers over base body to apply skin color

The skin layer: Light/fair skin tone applied to visible skin areas (face, hands, neck). Soft, natural skin coloring with subtle shading for depth. Peachy/pink undertones.

Must align exactly with base body shapes to layer correctly. Only show skin on areas that would be exposed (face, hands) - clothing will cover the rest.

Style: 90s CGI aesthetic with modern render quality. Smooth skin rendering with subtle ambient occlusion. Natural human skin appearance.
```

#### SKIN - MEDIUM
```
Create an avatar skin tone layer: MEDIUM SKIN.

Format: Skin coloring overlay matching base body shape
Background: TRANSPARENT (PNG-ready)
Size: Square canvas matching base body size (e.g., 256x256 or 512x512)
Purpose: Layers over base body to apply skin color

The skin layer: Medium/tan skin tone applied to visible skin areas (face, hands, neck). Soft, natural skin coloring with subtle shading for depth. Warm olive/golden undertones.

Must align exactly with base body shapes to layer correctly. Only show skin on areas that would be exposed (face, hands) - clothing will cover the rest.

Style: 90s CGI aesthetic with modern render quality. Smooth skin rendering with subtle ambient occlusion. Natural human skin appearance.
```

#### SKIN - DARK
```
Create an avatar skin tone layer: DARK SKIN.

Format: Skin coloring overlay matching base body shape
Background: TRANSPARENT (PNG-ready)
Size: Square canvas matching base body size (e.g., 256x256 or 512x512)
Purpose: Layers over base body to apply skin color

The skin layer: Dark/deep skin tone applied to visible skin areas (face, hands, neck). Rich, natural skin coloring with subtle shading for depth. Warm brown undertones.

Must align exactly with base body shapes to layer correctly. Only show skin on areas that would be exposed (face, hands) - clothing will cover the rest.

Style: 90s CGI aesthetic with modern render quality. Smooth skin rendering with subtle ambient occlusion and highlights. Natural human skin appearance.
```

### HAIR STYLES

#### HAIR - SHORT
```
Create an avatar hair layer: SHORT HAIR.

Format: Hair overlay for character head
Background: TRANSPARENT (PNG-ready)
Size: Square canvas matching base body size (e.g., 256x256 or 512x512)
Purpose: Layers over base body/skin to add hair

The hair: Short, professional haircut. Neat and tidy. Dark brown or black color (or neutral that works with any skin tone). Visible hair texture but chunky/stylized. Business-appropriate.

Must align with the head position on base body. Hair should frame the face appropriately.

Style: 90s CGI aesthetic with modern render quality. Chunky hair masses with subtle strand detail. Soft highlights. Match character template style.
```

#### HAIR - LONG
```
Create an avatar hair layer: LONG HAIR.

Format: Hair overlay for character head
Background: TRANSPARENT (PNG-ready)
Size: Square canvas matching base body size (e.g., 256x256 or 512x512)
Purpose: Layers over base body/skin to add hair

The hair: Longer hair, past the ears, could reach shoulders. Styled but not overly formal. Dark brown or black color. Visible hair texture but chunky/stylized.

Must align with the head position on base body. Hair should frame the face and extend down appropriately.

Style: 90s CGI aesthetic with modern render quality. Chunky hair masses with subtle strand detail. Soft highlights and shadows. Match character template style.
```

#### HAIR - MOHAWK
```
Create an avatar hair layer: MOHAWK.

Format: Hair overlay for character head
Background: TRANSPARENT (PNG-ready)
Size: Square canvas matching base body size (e.g., 256x256 or 512x512)
Purpose: Layers over base body/skin to add hair

The hair: Bold mohawk hairstyle. Spiked up in the center, shaved/short on sides. Could be a bold color (or dark). Punk/rebellious style. Chunky, stylized spikes.

Must align with the head position on base body.

Style: 90s CGI aesthetic with modern render quality. Exaggerated, fun mohawk shape. Chunky stylized spikes. Match character template style but with more attitude.
```

### OUTFITS

#### OUTFIT - BUSINESS SUIT
```
Create an avatar outfit layer: BUSINESS SUIT.

Format: Clothing overlay for character body
Background: TRANSPARENT (PNG-ready)
Size: Square canvas matching base body size (e.g., 256x256 or 512x512)
Purpose: Layers over base body to add clothing

The outfit: Professional business suit. Dark gray or navy jacket and trousers. White dress shirt visible at collar. Tie. Polished appearance. Classic corporate businessman attire.

Must align with base body shape. Cover the torso, arms, and legs appropriately. Leave face and hands exposed for skin layer.

Style: 90s CGI aesthetic with modern render quality. Chunky fabric folds and suit structure. Subtle fabric texture. Professional and respectable appearance. Match character template style.
```

#### OUTFIT - CASUAL
```
Create an avatar outfit layer: CASUAL CLOTHES.

Format: Clothing overlay for character body
Background: TRANSPARENT (PNG-ready)
Size: Square canvas matching base body size (e.g., 256x256 or 512x512)
Purpose: Layers over base body to add clothing

The outfit: Casual everyday clothes. Could be polo shirt and chinos, or button-down shirt with sleeves rolled up and jeans. Relaxed but presentable. Earth tones or muted colors.

Must align with base body shape. Cover the torso, arms, and legs appropriately. Leave face and hands exposed for skin layer.

Style: 90s CGI aesthetic with modern render quality. Relaxed fabric appearance. Comfortable everyday look. Match character template style.
```

#### OUTFIT - MYTHIC GOLD SUIT (LEGENDARY)
```
Create an avatar outfit layer: MYTHIC GOLD SUIT.

Format: Clothing overlay for character body
Background: TRANSPARENT (PNG-ready)
Size: Square canvas matching base body size (e.g., 256x256 or 512x512)
Purpose: LEGENDARY rarity outfit - rare unlock reward
Rarity: LEGENDARY

The outfit: An extraordinary golden suit. Shimmering metallic gold fabric that catches the light. Luxurious and ostentatious. Gold jacket, gold trousers, possibly gold shirt or black shirt for contrast. Opulent, wealthy, "I made it" appearance. Perhaps subtle sparkle effects.

Must align with base body shape. Cover the torso, arms, and legs appropriately. Leave face and hands exposed for skin layer.

Style: 90s CGI aesthetic with modern render quality. Strong metallic gold reflections and specular highlights. This should look SPECIAL and RARE. Premium quality rendering. Impressive and desirable.
```

### HEADWEAR

#### HEADWEAR - TOP HAT
```
Create an avatar headwear layer: TOP HAT.

Format: Hat overlay for character head
Background: TRANSPARENT (PNG-ready)
Size: Square canvas matching base body size (e.g., 256x256 or 512x512)
Purpose: Layers over hair/head to add headwear

The hat: Classic tall top hat. Black with a band around the base. Formal, old-money wealthy appearance. Cylindrical shape with flat top and brim.

Must align with head position on base body. Should sit on top of/replace visible hair appropriately.

Style: 90s CGI aesthetic with modern render quality. Chunky geometric hat shape. Subtle fabric/felt texture. Dignified appearance.
```

#### HEADWEAR - BASEBALL CAP
```
Create an avatar headwear layer: BASEBALL CAP.

Format: Hat overlay for character head
Background: TRANSPARENT (PNG-ready)
Size: Square canvas matching base body size (e.g., 256x256 or 512x512)
Purpose: Layers over hair/head to add headwear

The hat: Casual baseball cap. Curved brim facing forward. Solid color (blue, red, or neutral). Relaxed, sporty appearance. No specific team logos or text.

Must align with head position on base body. Should sit on top of head with hair possibly visible underneath at sides/back.

Style: 90s CGI aesthetic with modern render quality. Chunky cap shape. Fabric texture on crown. Casual and approachable.
```

#### HEADWEAR - LEGENDARY CROWN (LEGENDARY)
```
Create an avatar headwear layer: LEGENDARY CROWN.

Format: Crown overlay for character head
Background: TRANSPARENT (PNG-ready)
Size: Square canvas matching base body size (e.g., 256x256 or 512x512)
Purpose: LEGENDARY rarity headwear - rare unlock reward
Rarity: LEGENDARY

The crown: A magnificent royal crown. Gold with embedded jewels (rubies, sapphires, emeralds). Ornate metalwork with detailed filigree. Regal points rising from the band. Fit for a king/queen. Possibly subtle glow or sparkle effect.

Must align with head position on base body. Should sit majestically on top of head.

Style: 90s CGI aesthetic with modern render quality. Rich gold metallic reflections. Sparkling gem highlights. This should look INCREDIBLY SPECIAL and PRESTIGIOUS. Premium quality rendering. The ultimate status symbol.
```

### ACCESSORIES

#### ACCESSORY - SUNGLASSES
```
Create an avatar accessory layer: SUNGLASSES.

Format: Accessory overlay for character face
Background: TRANSPARENT (PNG-ready)
Size: Square canvas matching base body size (e.g., 256x256 or 512x512)
Purpose: Layers over face to add accessory

The accessory: Cool sunglasses. Dark lenses with subtle reflection. Could be aviator style or classic wayfarers. Confident, stylish appearance.

Must align with face position on base body. Should sit on nose and cover eyes appropriately.

Style: 90s CGI aesthetic with modern render quality. Reflective lens surface. Chunky frame. Cool and confident vibe.
```

#### ACCESSORY - WATCH
```
Create an avatar accessory layer: WATCH.

Format: Accessory overlay for character wrist
Background: TRANSPARENT (PNG-ready)
Size: Square canvas matching base body size (e.g., 256x256 or 512x512)
Purpose: Layers over wrist/arm to add accessory

The accessory: Luxury wristwatch. Metal band (silver or gold). Round or square face with visible dial. Expensive, successful businessman accessory.

Must align with wrist position on base body. Should be visible on one wrist.

Style: 90s CGI aesthetic with modern render quality. Metallic reflections on band. Watch face detail. Status symbol appearance.
```

### BACKGROUNDS

#### BACKGROUND - CITY SKYLINE
```
Create an avatar background layer: CITY SKYLINE.

Format: Background scene behind character
Background: Full coverage (no transparency - this IS the background)
Size: Square canvas matching avatar preview size (e.g., 256x256 or 512x512)
Purpose: Background layer that character layers display in front of

The background: City skyline at dusk or golden hour. Multiple skyscraper silhouettes. Warm sky gradient (orange, pink, purple). Urban, successful, metropolitan feel. Suggests wealth and business success.

This should fill the entire canvas as a background scene. Character elements will be composited on top.

Style: 90s CGI aesthetic with modern render quality. Stylized city buildings. Beautiful atmospheric lighting. Aspirational business success backdrop.
```

#### BACKGROUND - OFFICE
```
Create an avatar background layer: OFFICE.

Format: Background scene behind character
Background: Full coverage (no transparency - this IS the background)
Size: Square canvas matching avatar preview size (e.g., 256x256 or 512x512)
Purpose: Background layer that character layers display in front of

The background: Executive office interior. Large window with city view. Bookshelf, desk edge, or wood paneling visible. Warm professional lighting. Suggests corner office, success, executive status.

This should fill the entire canvas as a background scene. Character elements will be composited on top.

Style: 90s CGI aesthetic with modern render quality. Rich wood textures. Professional corporate environment. Successful executive backdrop.
```

---

## Scene Illustration Prompts (8 types)

### SCENE - BEING ARRESTED
```
Create a scene illustration: BEING ARRESTED.

Format: Full scene with background
Aspect ratio: 16:9 or similar widescreen
Purpose: Shown when a player gets arrested in the game

The scene: A businessman character in handcuffs being escorted by police officers. The businessman looks dejected/worried. Police officers on either side holding his arms. Could be outside a building or on a street. Blue and red police lights visible. Dramatic moment of capture.

Characters should match the 90s CGI chunky character style from the character template. Stocky proportions, geometric forms.

Style: 90s CGI aesthetic with modern render quality. Dramatic lighting with police light colors. Tense atmosphere. Country-neutral (generic police uniforms, no specific national markings). Clean, polished rendering.
```

### SCENE - COURT APPEARANCE
```
Create a scene illustration: COURT APPEARANCE.

Format: Full scene with background
Aspect ratio: 16:9 or similar widescreen
Purpose: Shown during trial/court proceedings in the game

The scene: Courtroom interior. A businessman character standing in the defendant's dock or at a table. Judge's bench visible (with or without judge). Wooden courtroom furniture. Formal, serious legal atmosphere. Scales of justice or legal symbols optional.

Characters should match the 90s CGI chunky character style. Stocky proportions, geometric forms.

Style: 90s CGI aesthetic with modern render quality. Formal, imposing courtroom atmosphere. Wood paneling and official furniture. Serious legal proceeding feel. Country-neutral (generic courtroom, no specific national symbols).
```

### SCENE - PRISON CELL
```
Create a scene illustration: PRISON CELL.

Format: Full scene with background
Aspect ratio: 16:9 or similar widescreen
Purpose: Shown when a player is in prison in the game

The scene: Prison cell interior. A businessman character sitting dejectedly on a basic bunk bed. Bars visible (either as cell door or window). Concrete or brick walls. Sparse furnishings - bed, toilet, maybe small sink. Harsh lighting. Confined, punishing atmosphere.

Characters should match the 90s CGI chunky character style. The businessman should still be recognizable but in a prison jumpsuit or disheveled suit.

Style: 90s CGI aesthetic with modern render quality. Cold, institutional lighting. Oppressive confined space. Consequence of crime atmosphere. Country-neutral.
```

### SCENE - HERO CELEBRATION
```
Create a scene illustration: HERO CELEBRATION / SUCCESS.

Format: Full scene with background
Aspect ratio: 16:9 or similar widescreen
Purpose: Shown when a player successfully "heroes out" (retires wealthy) in the game

The scene: Triumphant celebration moment. A businessman character with arms raised in victory, huge smile. Could be on a yacht, at a tropical beach, in front of a mansion, or with champagne. Confetti or celebratory elements optional. Sunny, bright, successful atmosphere. Living the dream.

Characters should match the 90s CGI chunky character style. The businessman should look ecstatic and successful.

Style: 90s CGI aesthetic with modern render quality. Bright, warm, celebratory lighting. Joy and success radiating. Aspirational "you made it" feeling. Country-neutral luxury setting.
```

### SCENE - BANK INTERIOR
```
Create a scene illustration: BANK INTERIOR.

Format: Full scene with background
Aspect ratio: 16:9 or similar widescreen
Purpose: Background or scene for bank-related interactions in the game

The scene: Grand bank interior. Marble floors and columns. Teller windows or counters. High ceilings. Vault door visible in background. Brass fixtures and railings. Wealthy, institutional, secure atmosphere. Classic bank grandeur.

Could include a businessman character at a counter, or be an empty interior for UI overlay.

Style: 90s CGI aesthetic with modern render quality. Rich marble and brass materials. Impressive institutional architecture. Trustworthy and wealthy atmosphere. Country-neutral.
```

### SCENE - TEMPLE INTERIOR
```
Create a scene illustration: TEMPLE INTERIOR.

Format: Full scene with background
Aspect ratio: 16:9 or similar widescreen
Purpose: Background or scene for temple/donation interactions in the game

The scene: Peaceful temple interior. Ornate but serene. Soft light filtering through windows or from candles. Altar or shrine area. Incense suggestion. Wooden beams and decorative elements. Spiritual, contemplative atmosphere. Place of reflection and donation.

Could include a businessman character in prayer/meditation pose, or be an empty interior for UI overlay.

Style: 90s CGI aesthetic with modern render quality. Warm, soft, spiritual lighting. Peaceful and reverent atmosphere. Country-neutral and religion-neutral (generic spiritual space, not specific to any religion).
```

### SCENE - OFFSHORE PARADISE
```
Create a scene illustration: OFFSHORE BANK / TAX HAVEN.

Format: Full scene with background
Aspect ratio: 16:9 or similar widescreen
Purpose: Shown for offshore banking features in the game

The scene: Tropical paradise with hidden wealth suggestion. Palm trees, crystal blue water, white sand beach. A small but elegant bank building or vault partially visible among the palms. Swiss-style bank meets Caribbean island. Secretive luxury.

Could include a businessman character relaxing or examining documents, or be a scenic establishing shot.

Style: 90s CGI aesthetic with modern render quality. Bright tropical lighting. Paradise atmosphere with hint of financial secrecy. Aspirational tax haven imagery. Country-neutral (generic tropical island, not specific location).
```

### SCENE - DIRTY TRICK IN ACTION
```
Create a scene illustration: DIRTY TRICK ATTACK.

Format: Full scene with background
Aspect ratio: 16:9 or similar widescreen
Purpose: Shown when executing an attack on a rival's business

The scene: Nighttime scene of sabotage. A shadowy figure (businessman or hired goon) sneaking near a building. Could show the moment before or during an attack - spray paint in hand, lighter ready, or suspicious package. Dark, secretive atmosphere. Criminal mischief about to happen.

Style: 90s CGI aesthetic with modern render quality. Dramatic noir lighting - moonlight, shadows, maybe a streetlamp. Suspenseful atmosphere. The thrill of corporate espionage and sabotage. Country-neutral.
```

---

## Asset Summary

| Category | Count | Notes |
|----------|-------|-------|
| Terrain Tiles | 7 | Flat diamond tiles |
| Building Game Sprites | 10 | Isometric sprites for map |
| Special Buildings | 3 | Temple, Bank, Police |
| Building Reference Sheets | 13 | Multi-view references |
| Status Effects | 6 | Overlays and indicators |
| UI Elements | 3 | Minimap and cursor |
| Avatar - Bodies | 2 | Base layers |
| Avatar - Skins | 3 | Skin tone layers |
| Avatar - Hair | 3 | Hair styles |
| Avatar - Outfits | 3 | Including legendary |
| Avatar - Headwear | 3 | Including legendary |
| Avatar - Accessories | 2 | Sunglasses, watch |
| Avatar - Backgrounds | 2 | City, office |
| Scene Illustrations | 8 | Full scenes |
| **TOTAL** | **68** | Prompts ready to use |
