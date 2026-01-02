# Asset Generation Reference

## Overview

This document contains Gemini prompts and specifications for generating game assets.

## Visual Hierarchy

```
Layer 5: Effects (fire, damage indicators)
Layer 4: Buildings (3D sprites)
Layer 3: Ownership Overlays (green/red tints)
Layer 2: Terrain Tiles (roads, water, dirt tracks, trees)
Layer 1: BASE GROUND (large seamless background image)
```

---

## Base Ground (Background Image)

The base ground is a **large seamless background image** (NOT individual tiles). It's displayed via CSS `background-repeat` or canvas pattern fill.

### Technical Specifications

| Property | Value |
|----------|-------|
| **Dimensions** | 512 x 512 pixels (or larger) |
| **Format** | WebP |
| **Tiling** | CSS `background-repeat: repeat` or canvas pattern |
| **Category** | `background` |
| **R2 Path** | `/backgrounds/base_ground_grass.webp` |

### Gemini Prompt - GRASS BACKGROUND

```
Create a seamless tiling grass texture for use as a game map background.

Dimensions: 512x512 pixels (will be repeated via CSS)
Format: Square image, NO transparency needed (solid grass)

CRITICAL REQUIREMENT - SEAMLESS TILING:
This texture will be repeated infinitely as the game world floor.
The grass pattern MUST tile seamlessly in all directions.
- All four edges must blend perfectly when repeated
- No distinct features that would create obvious repetition
- Avoid any gradients or directional lighting

The grass texture:
- Lush, healthy green grass viewed from above
- Subtle variation in green tones
- Natural lawn appearance
- Soft texture suggesting grass blades

Style: 90s CGI aesthetic with modern render quality.

Do NOT include:
- Flowers, rocks, or debris
- Shadows or lighting direction
- Any features that break seamless tiling
```

---

## Terrain Tiles

These sprites appear ON TOP of the base ground background.

### Resolution Strategy

| Stage | Resolution | Format |
|-------|------------|--------|
| Reference Sheet | 1024+ px | PNG |
| Original Sprite | 256x256 or 512x512 | PNG |
| Game-Ready | 64x64 | WebP |

**Cloudflare Image Transformations** handle resize + WebP conversion from high-res originals.

### Technical Specifications (Final Output)

| Property | Value |
|----------|-------|
| **Dimensions** | 64 x 64 pixels (SQUARE) |
| **Format** | WebP with transparency |
| **View** | Elevated angle (~45°) |
| **Category** | `terrain` |

---

## ROAD Terrain (5 variants)

### Road Variants

| Variant | Description | Connections |
|---------|-------------|-------------|
| `road_straight` | Straight road | N-S or E-W |
| `road_corner` | 90° turn | 2 adjacent sides |
| `road_t_junction` | T intersection | 3 sides |
| `road_crossroads` | 4-way intersection | All 4 sides |
| `road_end` | Dead end | 1 side only |

### ROAD - Reference Sheet Prompt

```
Create a REFERENCE SHEET showing a road/street from an elevated-view city game.

This reference sheet shows the road from multiple angles for consistency.
The road will be rendered as game tiles later.

Include views:
1. Top-down view showing road surface and sidewalks
2. Elevated 45° angle view
3. Surface texture detail (asphalt + sidewalk materials)

The road:
- Gray asphalt surface with subtle texture
- Narrow concrete/beige sidewalks on edges
- Clean, well-maintained city street
- No lane markings (keep simple)

Style: 90s CGI aesthetic with modern render quality.
Think SimCity 3000 art direction rendered with 2025 quality.

Do NOT include: cars, pedestrians, objects, damage
```

### ROAD - Straight Sprite Prompt

```
Create a STRAIGHT ROAD tile sprite.

Dimensions: 256x256 pixel SQUARE (will be resized to 64x64)
Background: TRANSPARENT
View: Elevated angle (~45 degrees)

The road runs from top edge to bottom edge (north-south).
- Gray asphalt in center
- Sidewalks on left and right edges
- Road surface has subtle texture
- Edges connect cleanly to adjacent road tiles

Style: 90s CGI aesthetic with modern render quality.
```

### ROAD - Corner Sprite Prompt

```
Create a CORNER ROAD tile sprite (90-degree turn).

Dimensions: 256x256 pixel SQUARE (will be resized to 64x64)
Background: TRANSPARENT
View: Elevated angle (~45 degrees)

The road curves from bottom edge to right edge.
- Gray asphalt with natural curve
- Sidewalks follow the corner
- Clean connection points at bottom and right edges

Style: 90s CGI aesthetic with modern render quality.
```

### ROAD - T Junction Sprite Prompt

```
Create a T-JUNCTION ROAD tile sprite.

Dimensions: 256x256 pixel SQUARE (will be resized to 64x64)
Background: TRANSPARENT
View: Elevated angle (~45 degrees)

The road connects on three sides: bottom, left, and right.
Top edge has sidewalk only (no road connection).
- Gray asphalt intersection
- Sidewalks on all edges
- Clean connection points

Style: 90s CGI aesthetic with modern render quality.
```

### ROAD - Crossroads Sprite Prompt

```
Create a CROSSROADS (4-way intersection) tile sprite.

Dimensions: 256x256 pixel SQUARE (will be resized to 64x64)
Background: TRANSPARENT
View: Elevated angle (~45 degrees)

The road connects on all four sides.
- Gray asphalt intersection in center
- Small sidewalk corners at each corner
- Clean connection points on all edges

Style: 90s CGI aesthetic with modern render quality.
```

### ROAD - End Sprite Prompt

```
Create an END OF ROAD (dead end) tile sprite.

Dimensions: 256x256 pixel SQUARE (will be resized to 64x64)
Background: TRANSPARENT
View: Elevated angle (~45 degrees)

The road enters from bottom edge and ends in the tile.
- Gray asphalt ending in a rounded cap or cul-de-sac
- Sidewalks wrap around the end
- Top, left, right edges have sidewalk only

Style: 90s CGI aesthetic with modern render quality.
```

---

## WATER Terrain (4 variants)

### Water Variants

| Variant | Description | Grass edges |
|---------|-------------|-------------|
| `water_pond` | 1-tile pond | All 4 sides surrounded by grass |
| `water_outlet` | 3 sides blocked | 1 side connects to more water |
| `water_channel` | 2 sides blocked | 2 opposite sides connect |
| `water_inlet` | 1 side blocked | 3 sides connect to more water |

### WATER - Reference Sheet Prompt

```
Create a REFERENCE SHEET showing water/pond for an elevated-view city game.

Include views:
1. Top-down view of water surface
2. Elevated 45° angle view
3. Water-to-grass edge transition detail

The water:
- Clear blue water
- Subtle ripple texture
- Slight specular highlights
- Natural grass edge where water meets land

Style: 90s CGI aesthetic with modern render quality.
Clean, stylized water - not photorealistic.
```

### WATER - Pond (1 tile) Sprite Prompt

```
Create a POND tile sprite (water surrounded by grass on all sides).

Dimensions: 256x256 pixel SQUARE (will be resized to 64x64)
Background: TRANSPARENT
View: Elevated angle (~45 degrees)

A small pond that fits in one tile:
- Blue water in center
- Grass edges around all four sides
- Natural rounded pond shape
- Water has subtle ripple texture

Style: 90s CGI aesthetic with modern render quality.
```

### WATER - Outlet (3 blocked, 1 open) Sprite Prompt

```
Create a WATER OUTLET tile sprite.

Dimensions: 256x256 pixel SQUARE (will be resized to 64x64)
Background: TRANSPARENT
View: Elevated angle (~45 degrees)

Water connects to bottom edge only.
Top, left, right edges have grass shore.
- Blue water in center extending to bottom edge
- Grass shore on three sides
- Natural shoreline

Style: 90s CGI aesthetic with modern render quality.
```

### WATER - Channel (2 blocked, 2 open) Sprite Prompt

```
Create a WATER CHANNEL tile sprite.

Dimensions: 256x256 pixel SQUARE (will be resized to 64x64)
Background: TRANSPARENT
View: Elevated angle (~45 degrees)

Water flows through from top to bottom (or left to right).
Two opposite edges connect to water, two have grass shore.
- Blue water channel through center
- Grass shore on two sides
- Water extends to top and bottom edges

Style: 90s CGI aesthetic with modern render quality.
```

### WATER - Inlet (1 blocked, 3 open) Sprite Prompt

```
Create a WATER INLET tile sprite.

Dimensions: 256x256 pixel SQUARE (will be resized to 64x64)
Background: TRANSPARENT
View: Elevated angle (~45 degrees)

Water connects on three sides (top, left, right).
Bottom edge has grass shore.
- Blue water filling most of tile
- Small grass shore at bottom
- Water extends to three edges

Style: 90s CGI aesthetic with modern render quality.
```

---

## DIRT TRACK Terrain (5 variants)

Same variants as road:
- `dirt_straight`
- `dirt_corner`
- `dirt_t_junction`
- `dirt_crossroads`
- `dirt_end`

### DIRT TRACK - Reference Sheet Prompt

```
Create a REFERENCE SHEET showing a dirt track/path for an elevated-view city game.

Include views:
1. Top-down view of dirt path
2. Elevated 45° angle view
3. Surface texture detail

The dirt track:
- Worn brown compacted earth
- Subtle tire/foot track impressions
- Natural, rural unpaved road appearance
- Grass edges where path meets ground

Style: 90s CGI aesthetic with modern render quality.
Rustic country road feel.
```

(Use same variant prompts as ROAD, but replace "Gray asphalt" with "Brown compacted dirt" and "sidewalks" with "grass edges")

---

## TREES Terrain (1 variant)

### TREES - 3D Tree Sprite Prompt

```
Create a TREE CLUSTER sprite for an elevated-view city game.

Dimensions: 256x256 pixel SQUARE (will be resized to 64x64)
Background: TRANSPARENT
View: Elevated angle (~45 degrees) - LIKE A BUILDING

This is a 3D tree cluster viewed from the same angle as buildings.
NOT a flat top-down canopy view.

The trees:
- 2-3 trees clustered together
- Visible tree trunks at base
- Full leafy canopy
- 3D form with visible height/depth
- Fits on one tile like a small building

Style: 90s CGI aesthetic with modern render quality.
Chunky, stylized trees with visible 3D form.
Think park trees in SimCity 3000.

Do NOT include:
- Pure top-down canopy view (we need 3D depth)
- Individual leaves (keep stylized)
- Bare branches
```

---

## Generation Settings

Recommended Gemini settings:

| Setting | Value | Notes |
|---------|-------|-------|
| **Temperature** | 0.6-0.8 | Moderate creativity |
| **TopK** | 40 | Standard variation |
| **TopP** | 0.9 | Standard |

---

## Validation Checklist

### Base Ground Background
- [ ] Image is 512x512 or larger
- [ ] Tiles seamlessly (test in CSS `background-repeat`)
- [ ] No visible seams or repeating features
- [ ] Consistent lighting (no directional shadows)

### Terrain Tiles
- [ ] Tile is exactly 64x64 pixels
- [ ] Background is transparent
- [ ] Edges connect cleanly with adjacent tiles
- [ ] Matches 90s CGI aesthetic

---

## R2 Storage Structure

```
PRIVATE BUCKET: notropolis-assets-private
├── refs/                              # High-res reference sheets (1024+ px)
│   ├── terrain_road_ref_v1.png
│   ├── terrain_water_ref_v1.png
│   ├── terrain_dirt_ref_v1.png
│   └── terrain_trees_ref_v1.png
└── sprites/                           # High-res sprites (256x256 PNG)
    └── terrain/
        ├── road_straight_v1.png
        ├── road_corner_v1.png
        └── ...

PUBLIC BUCKET: notropolis-game-assets
├── backgrounds/
│   └── base_ground_grass.webp         # Large seamless background (512x512)
└── sprites/
    └── terrain/
        ├── road_straight.webp         # Road variants (64x64 WebP)
        ├── road_corner.webp
        ├── road_t_junction.webp
        ├── road_crossroads.webp
        ├── road_end.webp
        ├── water_pond.webp            # Water variants
        ├── water_outlet.webp
        ├── water_channel.webp
        ├── water_inlet.webp
        ├── dirt_straight.webp         # Dirt track variants
        ├── dirt_corner.webp
        ├── dirt_t_junction.webp
        ├── dirt_crossroads.webp
        ├── dirt_end.webp
        └── trees.webp                 # Tree cluster
```

---

## Game Client Usage

```typescript
// Set base ground as CSS background
mapContainer.style.backgroundImage = `url(${baseGroundUrl})`;
mapContainer.style.backgroundRepeat = 'repeat';

// Render terrain tiles ON TOP of background
for (const tile of visibleTiles) {
  if (tile.terrain_type !== 'free_land') {
    renderTile(terrainSprites[tile.terrain_type], tile.x, tile.y);
  }
}
```

---

## API Endpoints

### Get Active Background

```bash
curl "https://api.notropolis.net/api/admin/assets/background/active"
```

Response:
```json
{
  "success": true,
  "background": {
    "asset_key": "grass",
    "url": "https://assets.notropolis.net/backgrounds/base_ground_grass.webp"
  }
}
```
