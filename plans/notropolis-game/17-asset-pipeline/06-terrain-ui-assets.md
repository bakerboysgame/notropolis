# Stage 06: Terrain & UI Assets

## Objective

Generate terrain tiles, ownership overlays, and UI elements for the isometric map view.

## Dependencies

`[Requires: Stage 05 complete]` - Scene illustrations should be done first.

## Complexity

**Medium** - 38 terrain tile variants for auto-tiling system, plus UI and NPC assets.

---

## Files to Create

| File | Purpose |
|------|---------|
| `scripts/generate-terrain-ui.js` | Generation script for all small assets |

---

## Asset Specifications

### Terrain Tiles (38 types with auto-tiling variants)

All terrain tiles are 64×32 pixels, diamond shape. All go through Removal.ai for clean edges.

#### Simple Tiles (4)

| ID | Name | Description |
|----|------|-------------|
| `grass` | Grass | Green grass, default buildable land |
| `trees` | Trees | Forest/trees, extends upward |
| `mountain` | Mountain | Rocky terrain, extends upward |
| `sand` | Sand | Sandy terrain near water |

#### Road Tiles - Connection System (15)

Roads auto-connect based on neighboring road tiles. All include sidewalks.

| ID | Connects To | Visual |
|----|-------------|--------|
| `road_ns` | North + South | Straight vertical |
| `road_ew` | East + West | Straight horizontal |
| `road_ne` | North + East | Corner ╮ |
| `road_nw` | North + West | Corner ╭ |
| `road_se` | South + East | Corner ╯ |
| `road_sw` | South + West | Corner ╰ |
| `road_nes` | N + E + S | T-junction ├ |
| `road_new` | N + E + W | T-junction ┴ |
| `road_nsw` | N + S + W | T-junction ┤ |
| `road_esw` | E + S + W | T-junction ┬ |
| `road_nesw` | All 4 | 4-way intersection ┼ |
| `road_n` | North only | Dead end ╵ |
| `road_e` | East only | Dead end ╴ |
| `road_s` | South only | Dead end ╷ |
| `road_w` | West only | Dead end ╶ |

#### Dirt Track Tiles (6)

| ID | Connects To |
|----|-------------|
| `dirt_ns` | North + South |
| `dirt_ew` | East + West |
| `dirt_ne` | Corner |
| `dirt_nw` | Corner |
| `dirt_se` | Corner |
| `dirt_sw` | Corner |

#### Water Tiles - Edge System (13)

| ID | Description |
|----|-------------|
| `water` | Open water (center tile) |
| `water_edge_n` | Land to north |
| `water_edge_e` | Land to east |
| `water_edge_s` | Land to south |
| `water_edge_w` | Land to west |
| `water_corner_ne` | Outer corner (land at NE) |
| `water_corner_nw` | Outer corner (land at NW) |
| `water_corner_se` | Outer corner (land at SE) |
| `water_corner_sw` | Outer corner (land at SW) |
| `water_inner_ne` | Inner/concave corner NE |
| `water_inner_nw` | Inner/concave corner NW |
| `water_inner_se` | Inner/concave corner SE |
| `water_inner_sw` | Inner/concave corner SW |

**Format:** WebP with transparency (lossless), all go through Removal.ai

### Ownership Overlays (2 types)

| ID | Name | Size | Color |
|----|------|------|-------|
| `owned_self` | Player Owned | 64×32 | Green tint (~30% opacity) |
| `owned_other` | Enemy Owned | 64×32 | Red tint (~30% opacity) |

**Format:** WebP with transparency (lossless), semi-transparent diamond fill

### UI Elements (3 types)

| ID | Name | Size | Description |
|----|------|------|-------------|
| `minimap_player` | Player Marker | 8×8 | Bright green dot/diamond |
| `minimap_enemy` | Enemy Marker | 8×8 | Bright red dot/diamond |
| `cursor_select` | Selection Cursor | 68×36 | Diamond outline, glowing |

**Format:** WebP with transparency (lossless)

---

## Implementation Details

### Terrain Tile Prompts

```javascript
// ============================================
// SIMPLE TILES (4)
// ============================================
const simpleTiles = [
    {
        key: 'grass',
        name: 'Grass',
        prompt: `Create a single isometric terrain tile for GRASS.

Format: Diamond/rhombus shaped tile viewed from above at 45-degree isometric angle
Dimensions: 64 x 32 px canvas (2:1 ratio diamond)
Background: TRANSPARENT (PNG-ready)

The grass tile: Lush green grass with subtle variation in shade. Small tufts and texture visible but not overwhelming. Natural, well-maintained lawn appearance.

Style: 90s CGI aesthetic with modern render quality. Clean, stylized grass texture. Soft shadows suggesting gentle undulation. The tile must seamlessly connect when placed adjacent to identical tiles.

This is a FLAT ground tile, not a 3D object. Show only the top surface.`
    },
    {
        key: 'trees',
        name: 'Trees/Forest',
        prompt: `Create a single isometric terrain tile for TREES/FOREST.

Format: Diamond base 64 x 32 px, but trees extend upward (total height ~64-80px)
Background: TRANSPARENT (PNG-ready)

The trees tile: Dense cluster of trees viewed from above and side. Chunky, stylized tree canopy with visible foliage masses. Mix of greens. Trees should extend above the base diamond footprint.

Style: 90s CGI aesthetic - chunky, polygonal tree shapes like early 3D games.`
    },
    {
        key: 'mountain',
        name: 'Mountain',
        prompt: `Create a single isometric terrain tile for MOUNTAIN/ROCKY TERRAIN.

Format: Diamond base 64 x 32 px, rocks extend upward (total height ~64-80px)
Background: TRANSPARENT (PNG-ready)

The mountain tile: Rocky, elevated terrain with chunky rock formations. Gray and brown stone with visible facets. Impassable, rugged appearance.

Style: 90s CGI aesthetic - chunky, angular rock shapes with visible polygonal faces.`
    },
    {
        key: 'sand',
        name: 'Sand/Beach',
        prompt: `Create a single isometric terrain tile for SAND/BEACH.

Format: Diamond/rhombus shaped tile, 64 x 32 px canvas
Background: TRANSPARENT (PNG-ready)

The sand tile: Golden/beige sand with subtle ripple texture suggesting wind patterns. Beach/desert sand appearance.

Style: 90s CGI aesthetic. Warm sandy tones. Seamless tiling.`
    }
];

// ============================================
// ROAD TILES - Connection System (15)
// ============================================
// Road naming convention: road_{directions} where directions = connected edges (n/e/s/w)
// All roads include sidewalks on non-connected edges

const roadTiles = [
    // Straight roads (2)
    {
        key: 'road_ns',
        name: 'Road North-South',
        prompt: `Create an isometric ROAD tile that connects NORTH and SOUTH.

Format: Diamond/rhombus, 64 x 32 px canvas. Background: TRANSPARENT.

The road: Dark gray asphalt road running vertically (north to south in isometric = top-right to bottom-left corners). Light gray/beige sidewalks on the EAST and WEST edges only. Road surface has subtle texture, lane markings optional.

Style: 90s CGI aesthetic. The road must seamlessly connect to other road_ns tiles above and below.`
    },
    {
        key: 'road_ew',
        name: 'Road East-West',
        prompt: `Create an isometric ROAD tile that connects EAST and WEST.

Format: Diamond/rhombus, 64 x 32 px canvas. Background: TRANSPARENT.

The road: Dark gray asphalt road running horizontally (east to west in isometric = bottom-right to top-left corners). Light gray/beige sidewalks on the NORTH and SOUTH edges only. Road surface has subtle texture.

Style: 90s CGI aesthetic. The road must seamlessly connect to other road_ew tiles left and right.`
    },
    // Corner roads (4)
    {
        key: 'road_ne',
        name: 'Road Corner NE',
        prompt: `Create an isometric ROAD CORNER tile connecting NORTH and EAST (╮ shape).

Format: Diamond/rhombus, 64 x 32 px canvas. Background: TRANSPARENT.

The road: Dark gray asphalt making an L-turn from north edge to east edge. Sidewalks on the OUTER edges (south and west). Rounded inner corner where road turns. Traffic can flow from top-right corner to bottom-right corner.

Style: 90s CGI aesthetic. Seamlessly connects to road_ns from north and road_ew from east.`
    },
    {
        key: 'road_nw',
        name: 'Road Corner NW',
        prompt: `Create an isometric ROAD CORNER tile connecting NORTH and WEST (╭ shape).

Format: Diamond/rhombus, 64 x 32 px canvas. Background: TRANSPARENT.

The road: Dark gray asphalt making an L-turn from north edge to west edge. Sidewalks on the OUTER edges (south and east). Rounded inner corner where road turns. Traffic can flow from top-right corner to top-left corner.

Style: 90s CGI aesthetic. Seamlessly connects to road_ns from north and road_ew from west.`
    },
    {
        key: 'road_se',
        name: 'Road Corner SE',
        prompt: `Create an isometric ROAD CORNER tile connecting SOUTH and EAST (╯ shape).

Format: Diamond/rhombus, 64 x 32 px canvas. Background: TRANSPARENT.

The road: Dark gray asphalt making an L-turn from south edge to east edge. Sidewalks on the OUTER edges (north and west). Rounded inner corner where road turns. Traffic can flow from bottom-left corner to bottom-right corner.

Style: 90s CGI aesthetic. Seamlessly connects to road_ns from south and road_ew from east.`
    },
    {
        key: 'road_sw',
        name: 'Road Corner SW',
        prompt: `Create an isometric ROAD CORNER tile connecting SOUTH and WEST (╰ shape).

Format: Diamond/rhombus, 64 x 32 px canvas. Background: TRANSPARENT.

The road: Dark gray asphalt making an L-turn from south edge to west edge. Sidewalks on the OUTER edges (north and east). Rounded inner corner where road turns. Traffic can flow from bottom-left corner to top-left corner.

Style: 90s CGI aesthetic. Seamlessly connects to road_ns from south and road_ew from west.`
    },
    // T-junctions (4)
    {
        key: 'road_nes',
        name: 'Road T-Junction NES',
        prompt: `Create an isometric ROAD T-JUNCTION tile connecting NORTH, EAST, and SOUTH (├ shape).

Format: Diamond/rhombus, 64 x 32 px canvas. Background: TRANSPARENT.

The road: Dark gray asphalt T-junction. Main road runs north-south with a branch going east. Sidewalk only on the WEST edge. Three-way intersection where traffic can turn.

Style: 90s CGI aesthetic. Seamlessly connects to road tiles on three sides.`
    },
    {
        key: 'road_new',
        name: 'Road T-Junction NEW',
        prompt: `Create an isometric ROAD T-JUNCTION tile connecting NORTH, EAST, and WEST (┴ shape).

Format: Diamond/rhombus, 64 x 32 px canvas. Background: TRANSPARENT.

The road: Dark gray asphalt T-junction. Main road runs east-west with a branch going north. Sidewalk only on the SOUTH edge. Three-way intersection.

Style: 90s CGI aesthetic. Seamlessly connects to road tiles on three sides.`
    },
    {
        key: 'road_nsw',
        name: 'Road T-Junction NSW',
        prompt: `Create an isometric ROAD T-JUNCTION tile connecting NORTH, SOUTH, and WEST (┤ shape).

Format: Diamond/rhombus, 64 x 32 px canvas. Background: TRANSPARENT.

The road: Dark gray asphalt T-junction. Main road runs north-south with a branch going west. Sidewalk only on the EAST edge. Three-way intersection.

Style: 90s CGI aesthetic. Seamlessly connects to road tiles on three sides.`
    },
    {
        key: 'road_esw',
        name: 'Road T-Junction ESW',
        prompt: `Create an isometric ROAD T-JUNCTION tile connecting EAST, SOUTH, and WEST (┬ shape).

Format: Diamond/rhombus, 64 x 32 px canvas. Background: TRANSPARENT.

The road: Dark gray asphalt T-junction. Main road runs east-west with a branch going south. Sidewalk only on the NORTH edge. Three-way intersection.

Style: 90s CGI aesthetic. Seamlessly connects to road tiles on three sides.`
    },
    // 4-way intersection (1)
    {
        key: 'road_nesw',
        name: 'Road 4-Way Intersection',
        prompt: `Create an isometric ROAD 4-WAY INTERSECTION tile connecting all directions (┼ shape).

Format: Diamond/rhombus, 64 x 32 px canvas. Background: TRANSPARENT.

The road: Dark gray asphalt full intersection. Roads connect on all four edges (north, east, south, west). NO sidewalks - all edges are road. Small corner areas where sidewalk corners meet at diagonals.

Style: 90s CGI aesthetic. Full crossroads intersection. Seamlessly connects to road tiles on all four sides.`
    },
    // Dead ends (4)
    {
        key: 'road_n',
        name: 'Road Dead End N',
        prompt: `Create an isometric ROAD DEAD END tile connecting only NORTH (╵ shape).

Format: Diamond/rhombus, 64 x 32 px canvas. Background: TRANSPARENT.

The road: Dark gray asphalt cul-de-sac. Road enters from north edge only, ends with a rounded turnaround. Sidewalks surround the other three edges (east, south, west). The road terminates cleanly.

Style: 90s CGI aesthetic. Seamlessly connects to road_ns from north.`
    },
    {
        key: 'road_e',
        name: 'Road Dead End E',
        prompt: `Create an isometric ROAD DEAD END tile connecting only EAST (╴ shape).

Format: Diamond/rhombus, 64 x 32 px canvas. Background: TRANSPARENT.

The road: Dark gray asphalt cul-de-sac. Road enters from east edge only, ends with a rounded turnaround. Sidewalks surround the other three edges (north, south, west). The road terminates cleanly.

Style: 90s CGI aesthetic. Seamlessly connects to road_ew from east.`
    },
    {
        key: 'road_s',
        name: 'Road Dead End S',
        prompt: `Create an isometric ROAD DEAD END tile connecting only SOUTH (╷ shape).

Format: Diamond/rhombus, 64 x 32 px canvas. Background: TRANSPARENT.

The road: Dark gray asphalt cul-de-sac. Road enters from south edge only, ends with a rounded turnaround. Sidewalks surround the other three edges (north, east, west). The road terminates cleanly.

Style: 90s CGI aesthetic. Seamlessly connects to road_ns from south.`
    },
    {
        key: 'road_w',
        name: 'Road Dead End W',
        prompt: `Create an isometric ROAD DEAD END tile connecting only WEST (╶ shape).

Format: Diamond/rhombus, 64 x 32 px canvas. Background: TRANSPARENT.

The road: Dark gray asphalt cul-de-sac. Road enters from west edge only, ends with a rounded turnaround. Sidewalks surround the other three edges (north, east, south). The road terminates cleanly.

Style: 90s CGI aesthetic. Seamlessly connects to road_ew from west.`
    }
];

// ============================================
// DIRT TRACK TILES (6)
// ============================================
// Simpler than roads - just straights and corners, no T-junctions

const dirtTiles = [
    // Straights (2)
    {
        key: 'dirt_ns',
        name: 'Dirt Track North-South',
        prompt: `Create an isometric DIRT TRACK tile connecting NORTH and SOUTH.

Format: Diamond/rhombus, 64 x 32 px canvas. Background: TRANSPARENT.

The dirt track: Brown/tan compacted dirt path running vertically through the tile (north to south in isometric). Grass visible on east and west edges. Track has wheel ruts, small pebbles, worn earth texture.

Style: 90s CGI aesthetic. Rural unpaved road feel. Seamlessly tiles vertically.`
    },
    {
        key: 'dirt_ew',
        name: 'Dirt Track East-West',
        prompt: `Create an isometric DIRT TRACK tile connecting EAST and WEST.

Format: Diamond/rhombus, 64 x 32 px canvas. Background: TRANSPARENT.

The dirt track: Brown/tan compacted dirt path running horizontally through the tile (east to west in isometric). Grass visible on north and south edges. Track has wheel ruts, small pebbles, worn earth texture.

Style: 90s CGI aesthetic. Rural unpaved road feel. Seamlessly tiles horizontally.`
    },
    // Corners (4)
    {
        key: 'dirt_ne',
        name: 'Dirt Track Corner NE',
        prompt: `Create an isometric DIRT TRACK CORNER tile connecting NORTH and EAST.

Format: Diamond/rhombus, 64 x 32 px canvas. Background: TRANSPARENT.

The dirt track: Brown/tan compacted dirt path making an L-turn from north edge to east edge. Grass fills the outer corner (south and west). Natural worn curve where path turns.

Style: 90s CGI aesthetic. Rural unpaved road feel.`
    },
    {
        key: 'dirt_nw',
        name: 'Dirt Track Corner NW',
        prompt: `Create an isometric DIRT TRACK CORNER tile connecting NORTH and WEST.

Format: Diamond/rhombus, 64 x 32 px canvas. Background: TRANSPARENT.

The dirt track: Brown/tan compacted dirt path making an L-turn from north edge to west edge. Grass fills the outer corner (south and east). Natural worn curve where path turns.

Style: 90s CGI aesthetic. Rural unpaved road feel.`
    },
    {
        key: 'dirt_se',
        name: 'Dirt Track Corner SE',
        prompt: `Create an isometric DIRT TRACK CORNER tile connecting SOUTH and EAST.

Format: Diamond/rhombus, 64 x 32 px canvas. Background: TRANSPARENT.

The dirt track: Brown/tan compacted dirt path making an L-turn from south edge to east edge. Grass fills the outer corner (north and west). Natural worn curve where path turns.

Style: 90s CGI aesthetic. Rural unpaved road feel.`
    },
    {
        key: 'dirt_sw',
        name: 'Dirt Track Corner SW',
        prompt: `Create an isometric DIRT TRACK CORNER tile connecting SOUTH and WEST.

Format: Diamond/rhombus, 64 x 32 px canvas. Background: TRANSPARENT.

The dirt track: Brown/tan compacted dirt path making an L-turn from south edge to west edge. Grass fills the outer corner (north and east). Natural worn curve where path turns.

Style: 90s CGI aesthetic. Rural unpaved road feel.`
    }
];

// ============================================
// WATER TILES - Edge System (13)
// ============================================
// Water uses edge/corner system instead of connection system
// Naming: water, water_edge_{dir}, water_corner_{dir}, water_inner_{dir}

const waterTiles = [
    // Center (1)
    {
        key: 'water',
        name: 'Water Center',
        prompt: `Create an isometric WATER tile - open water with no land edges.

Format: Diamond/rhombus, 64 x 32 px canvas. Background: TRANSPARENT.

The water: Blue water filling the entire diamond. Subtle ripple texture, gentle reflective quality. Calm water surface. Light caustic patterns optional.

Style: 90s CGI aesthetic. Seamlessly tiles with other water tiles.`
    },
    // Edges (4) - land on one side
    {
        key: 'water_edge_n',
        name: 'Water Edge North',
        prompt: `Create an isometric WATER tile with LAND to the NORTH (beach/shore edge).

Format: Diamond/rhombus, 64 x 32 px canvas. Background: TRANSPARENT.

The tile: Water fills most of the diamond, but the NORTH edge (top-right in isometric) transitions to sandy beach/shore. Gentle water-to-sand gradient at the edge. The shoreline runs along the north edge.

Style: 90s CGI aesthetic. Seamlessly connects to grass/sand tiles to the north, water tiles elsewhere.`
    },
    {
        key: 'water_edge_e',
        name: 'Water Edge East',
        prompt: `Create an isometric WATER tile with LAND to the EAST (beach/shore edge).

Format: Diamond/rhombus, 64 x 32 px canvas. Background: TRANSPARENT.

The tile: Water fills most of the diamond, but the EAST edge (bottom-right in isometric) transitions to sandy beach/shore. Gentle water-to-sand gradient at the edge.

Style: 90s CGI aesthetic. Seamlessly connects to grass/sand tiles to the east, water tiles elsewhere.`
    },
    {
        key: 'water_edge_s',
        name: 'Water Edge South',
        prompt: `Create an isometric WATER tile with LAND to the SOUTH (beach/shore edge).

Format: Diamond/rhombus, 64 x 32 px canvas. Background: TRANSPARENT.

The tile: Water fills most of the diamond, but the SOUTH edge (bottom-left in isometric) transitions to sandy beach/shore. Gentle water-to-sand gradient at the edge.

Style: 90s CGI aesthetic. Seamlessly connects to grass/sand tiles to the south, water tiles elsewhere.`
    },
    {
        key: 'water_edge_w',
        name: 'Water Edge West',
        prompt: `Create an isometric WATER tile with LAND to the WEST (beach/shore edge).

Format: Diamond/rhombus, 64 x 32 px canvas. Background: TRANSPARENT.

The tile: Water fills most of the diamond, but the WEST edge (top-left in isometric) transitions to sandy beach/shore. Gentle water-to-sand gradient at the edge.

Style: 90s CGI aesthetic. Seamlessly connects to grass/sand tiles to the west, water tiles elsewhere.`
    },
    // Outer corners (4) - land on two adjacent sides (convex shore)
    {
        key: 'water_corner_ne',
        name: 'Water Outer Corner NE',
        prompt: `Create an isometric WATER CORNER tile with LAND to the NORTH and EAST (outer/convex corner).

Format: Diamond/rhombus, 64 x 32 px canvas. Background: TRANSPARENT.

The tile: Water in the southwest portion, sandy beach/shore fills the northeast corner where two land edges meet. This is an OUTER corner of a lake - land wraps around the corner at NE. Curved shoreline from north edge to east edge.

Style: 90s CGI aesthetic. This tile goes at the corner of a lake where land juts into water.`
    },
    {
        key: 'water_corner_nw',
        name: 'Water Outer Corner NW',
        prompt: `Create an isometric WATER CORNER tile with LAND to the NORTH and WEST (outer/convex corner).

Format: Diamond/rhombus, 64 x 32 px canvas. Background: TRANSPARENT.

The tile: Water in the southeast portion, sandy beach/shore fills the northwest corner where two land edges meet. This is an OUTER corner - land wraps around at NW. Curved shoreline from north edge to west edge.

Style: 90s CGI aesthetic. This tile goes at the corner of a lake where land juts into water.`
    },
    {
        key: 'water_corner_se',
        name: 'Water Outer Corner SE',
        prompt: `Create an isometric WATER CORNER tile with LAND to the SOUTH and EAST (outer/convex corner).

Format: Diamond/rhombus, 64 x 32 px canvas. Background: TRANSPARENT.

The tile: Water in the northwest portion, sandy beach/shore fills the southeast corner where two land edges meet. This is an OUTER corner - land wraps around at SE. Curved shoreline from south edge to east edge.

Style: 90s CGI aesthetic. This tile goes at the corner of a lake where land juts into water.`
    },
    {
        key: 'water_corner_sw',
        name: 'Water Outer Corner SW',
        prompt: `Create an isometric WATER CORNER tile with LAND to the SOUTH and WEST (outer/convex corner).

Format: Diamond/rhombus, 64 x 32 px canvas. Background: TRANSPARENT.

The tile: Water in the northeast portion, sandy beach/shore fills the southwest corner where two land edges meet. This is an OUTER corner - land wraps around at SW. Curved shoreline from south edge to west edge.

Style: 90s CGI aesthetic. This tile goes at the corner of a lake where land juts into water.`
    },
    // Inner corners (4) - land only at diagonal (concave shore, water on two adjacent edges)
    {
        key: 'water_inner_ne',
        name: 'Water Inner Corner NE',
        prompt: `Create an isometric WATER INNER CORNER tile (concave corner, land at NE diagonal only).

Format: Diamond/rhombus, 64 x 32 px canvas. Background: TRANSPARENT.

The tile: Mostly water, but a small triangular beach/shore in the NE CORNER ONLY (where the NE diagonal point of the diamond is). This is an INNER corner of a lake - water wraps around the corner, with just a small beach nub poking in. Water touches north and east edges, land only at the corner point.

Style: 90s CGI aesthetic. This tile is used where water wraps around a land corner.`
    },
    {
        key: 'water_inner_nw',
        name: 'Water Inner Corner NW',
        prompt: `Create an isometric WATER INNER CORNER tile (concave corner, land at NW diagonal only).

Format: Diamond/rhombus, 64 x 32 px canvas. Background: TRANSPARENT.

The tile: Mostly water, but a small triangular beach/shore in the NW CORNER ONLY (top point of the diamond). This is an INNER corner - water wraps around, with just a small beach nub at the corner. Water touches north and west edges, land only at the corner point.

Style: 90s CGI aesthetic. This tile is used where water wraps around a land corner.`
    },
    {
        key: 'water_inner_se',
        name: 'Water Inner Corner SE',
        prompt: `Create an isometric WATER INNER CORNER tile (concave corner, land at SE diagonal only).

Format: Diamond/rhombus, 64 x 32 px canvas. Background: TRANSPARENT.

The tile: Mostly water, but a small triangular beach/shore in the SE CORNER ONLY (bottom point of the diamond). This is an INNER corner - water wraps around, with just a small beach nub at the corner. Water touches south and east edges, land only at the corner point.

Style: 90s CGI aesthetic. This tile is used where water wraps around a land corner.`
    },
    {
        key: 'water_inner_sw',
        name: 'Water Inner Corner SW',
        prompt: `Create an isometric WATER INNER CORNER tile (concave corner, land at SW diagonal only).

Format: Diamond/rhombus, 64 x 32 px canvas. Background: TRANSPARENT.

The tile: Mostly water, but a small triangular beach/shore in the SW CORNER ONLY (where the SW diagonal point of the diamond is). This is an INNER corner - water wraps around, with just a small beach nub at the corner. Water touches south and west edges, land only at the corner point.

Style: 90s CGI aesthetic. This tile is used where water wraps around a land corner.`
    }
];

// Combine all terrain tiles (38 total)
const terrainTiles = [...simpleTiles, ...roadTiles, ...dirtTiles, ...waterTiles];
```

### Overlay & UI Prompts

```javascript
const overlays = [
    {
        key: 'owned_self',
        name: 'Player Ownership Overlay',
        prompt: `Create an ownership overlay for PLAYER-OWNED tiles.

Format: Diamond shape, 64 x 32 px canvas
Background: TRANSPARENT

A semi-transparent green (#22c55e) diamond fill. Opacity around 30-40%.
Simple solid color, no texture. Clean edges.`
    },
    {
        key: 'owned_other',
        name: 'Enemy Ownership Overlay',
        prompt: `Create an ownership overlay for ENEMY-OWNED tiles.

Format: Diamond shape, 64 x 32 px canvas
Background: TRANSPARENT

A semi-transparent red (#ef4444) diamond fill. Opacity around 30-40%.
Simple solid color, no texture. Clean edges.`
    }
];

const uiElements = [
    {
        key: 'minimap_player',
        name: 'Player Minimap Marker',
        prompt: `Create a tiny minimap marker for the PLAYER.

Format: 8 x 8 px
Background: TRANSPARENT

A small bright GREEN (#22c55e) dot or diamond shape. Solid, highly visible. Simple geometric shape.`
    },
    {
        key: 'minimap_enemy',
        name: 'Enemy Minimap Marker',
        prompt: `Create a tiny minimap marker for ENEMIES.

Format: 8 x 8 px
Background: TRANSPARENT

A small bright RED (#ef4444) dot or diamond shape. Solid, highly visible. Simple geometric shape.`
    },
    {
        key: 'cursor_select',
        name: 'Selection Cursor',
        prompt: `Create a tile selection cursor for the isometric map.

Format: 68 x 36 px (slightly larger than 64x32 tile)
Background: TRANSPARENT

A glowing diamond outline that surrounds an isometric tile. Bright yellow or cyan edge glow. Just the outline - no fill (or very subtle fill). Suggests "this tile is selected".

Style: Clean geometric shape with glow effect. Visible over any terrain.`
    }
];
```

### Generation Script

```javascript
#!/usr/bin/env node

const WORKER_URL = 'https://notropolis-api.rikisenia.workers.dev';
const AUTH_TOKEN = 'your-admin-token';

// terrainTiles, overlays, uiElements defined above...

async function generateAsset(category, assetKey, prompt, variant) {
    const response = await fetch(`${WORKER_URL}/api/admin/assets/generate`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${AUTH_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ category, asset_key: assetKey, prompt, variant })
    });
    return response.json();
}

async function main() {
    console.log('Generating terrain tiles...\n');

    // Terrain tiles
    for (const tile of terrainTiles) {
        console.log(`Generating: ${tile.name}`);
        const result = await generateAsset('terrain', tile.key, tile.prompt, 1);
        console.log(`  ${result.success ? '✓' : '✗'} ${result.url || result.error}`);
        await new Promise(r => setTimeout(r, 2000));
    }

    console.log('\nGenerating ownership overlays...\n');

    // Overlays
    for (const overlay of overlays) {
        console.log(`Generating: ${overlay.name}`);
        const result = await generateAsset('overlay', overlay.key, overlay.prompt, 1);
        console.log(`  ${result.success ? '✓' : '✗'} ${result.url || result.error}`);
        await new Promise(r => setTimeout(r, 2000));
    }

    console.log('\nGenerating UI elements...\n');

    // UI elements
    for (const ui of uiElements) {
        console.log(`Generating: ${ui.name}`);
        const result = await generateAsset('ui', ui.key, ui.prompt, 1);
        console.log(`  ${result.success ? '✓' : '✗'} ${result.url || result.error}`);
        await new Promise(r => setTimeout(r, 2000));
    }

    console.log('\n✓ All terrain & UI assets generated!');
}

main().catch(console.error);
```

---

## Test Cases

### 1. Terrain Tile Seamless Test
- Generate grass tile
- Place 4 copies adjacent in a square
- Verify edges align seamlessly

### 2. Overlay Visibility Test
- Overlay `owned_self` on building sprite
- Verify green tint is visible but not overwhelming

### 3. Cursor Visibility Test
- Place selection cursor over various terrain tiles
- Verify it's visible on all backgrounds

---

## Acceptance Checklist

### Terrain Tiles (38 total)
- [ ] All 4 simple tiles generated (grass, trees, mountain, sand)
- [ ] All 15 road variants generated (straights, corners, T-junctions, 4-way, dead ends)
- [ ] All 6 dirt track variants generated
- [ ] All 13 water variants generated (center, edges, corners, inner corners)
- [ ] All terrain tiles have backgrounds removed (via Removal.ai)
- [ ] Terrain tiles connect seamlessly (auto-tiling works)
- [ ] Trees and mountain tiles extend upward properly
- [ ] Road sidewalks align correctly between variants

### Other Assets
- [ ] Both ownership overlays generated
- [ ] Overlays have correct opacity (~30-40%)
- [ ] All 3 UI elements generated
- [ ] UI elements have backgrounds removed (via Removal.ai)
- [ ] Minimap markers are 8×8 and visible
- [ ] Selection cursor is 68×36 with glow effect
- [ ] All NPC sprites generated (4 ped strips + 4 cars)
- [ ] NPC sprites have backgrounds removed (via Removal.ai)
- [ ] All assets uploaded to R2 in correct folders

---

---

## Part D: Ambient NPC Assets (12 sprites)

Optional enhancement assets for visual polish - pedestrians and vehicles that animate on roads.

### Pedestrians (8 sprites - 4 directions × 2 frames)

| ID | Name | Size | Description |
|----|------|------|-------------|
| `ped_walk_n_1` | Pedestrian North Frame 1 | 32×32 | Walking north, left foot forward |
| `ped_walk_n_2` | Pedestrian North Frame 2 | 32×32 | Walking north, right foot forward |
| `ped_walk_s_1` | Pedestrian South Frame 1 | 32×32 | Walking south, left foot forward |
| `ped_walk_s_2` | Pedestrian South Frame 2 | 32×32 | Walking south, right foot forward |
| `ped_walk_e_1` | Pedestrian East Frame 1 | 32×32 | Walking east, left foot forward |
| `ped_walk_e_2` | Pedestrian East Frame 2 | 32×32 | Walking east, right foot forward |
| `ped_walk_w_1` | Pedestrian West Frame 1 | 32×32 | Walking west, left foot forward |
| `ped_walk_w_2` | Pedestrian West Frame 2 | 32×32 | Walking west, right foot forward |

### Cars (4 sprites - 4 directions)

| ID | Name | Size | Description |
|----|------|------|-------------|
| `car_n` | Car North | 32×32 | Car facing/driving north |
| `car_s` | Car South | 32×32 | Car facing/driving south |
| `car_e` | Car East | 32×32 | Car facing/driving east |
| `car_w` | Car West | 32×32 | Car facing/driving west |

### NPC Prompts

```javascript
const npcAssets = [
    // Pedestrians - each direction needs 2 walk frames
    {
        key: 'ped_walk_n',
        name: 'Pedestrian Walking North',
        prompt: `Create a 2-frame walk cycle sprite sheet for a PEDESTRIAN walking NORTH (away from camera).

Format: Horizontal sprite strip, 64 x 32 px total (two 32x32 frames side by side)
Background: TRANSPARENT (PNG-ready)

Frame 1 (left): Left foot forward, right arm forward
Frame 2 (right): Right foot forward, left arm forward

The pedestrian: Generic businessman/businesswoman in business casual attire. Chunky 90s CGI style figure. Viewed from behind at isometric angle, walking away (north direction in isometric = toward top-right of screen).

Style: 90s CGI chunky aesthetic. Simple but recognizable human figure. Works at small size on isometric map.`
    },
    {
        key: 'ped_walk_s',
        name: 'Pedestrian Walking South',
        prompt: `Create a 2-frame walk cycle sprite sheet for a PEDESTRIAN walking SOUTH (toward camera).

Format: Horizontal sprite strip, 64 x 32 px total (two 32x32 frames side by side)
Background: TRANSPARENT (PNG-ready)

Frame 1 (left): Left foot forward, right arm forward
Frame 2 (right): Right foot forward, left arm forward

The pedestrian: Generic businessman/businesswoman in business casual attire. Chunky 90s CGI style figure. Viewed from front at isometric angle, walking toward camera (south direction in isometric = toward bottom-left of screen).

Style: 90s CGI chunky aesthetic. Simple but recognizable human figure.`
    },
    {
        key: 'ped_walk_e',
        name: 'Pedestrian Walking East',
        prompt: `Create a 2-frame walk cycle sprite sheet for a PEDESTRIAN walking EAST.

Format: Horizontal sprite strip, 64 x 32 px total (two 32x32 frames side by side)
Background: TRANSPARENT (PNG-ready)

Frame 1 (left): Left foot forward, right arm forward
Frame 2 (right): Right foot forward, left arm forward

The pedestrian: Generic businessman/businesswoman in business casual attire. Chunky 90s CGI style figure. Side view walking right at isometric angle (east direction = toward bottom-right of screen).

Style: 90s CGI chunky aesthetic. Simple but recognizable human figure.`
    },
    {
        key: 'ped_walk_w',
        name: 'Pedestrian Walking West',
        prompt: `Create a 2-frame walk cycle sprite sheet for a PEDESTRIAN walking WEST.

Format: Horizontal sprite strip, 64 x 32 px total (two 32x32 frames side by side)
Background: TRANSPARENT (PNG-ready)

Frame 1 (left): Left foot forward, right arm forward
Frame 2 (right): Right foot forward, left arm forward

The pedestrian: Generic businessman/businesswoman in business casual attire. Chunky 90s CGI style figure. Side view walking left at isometric angle (west direction = toward top-left of screen).

Style: 90s CGI chunky aesthetic. Simple but recognizable human figure.`
    },
    // Cars - static sprites, one per direction
    {
        key: 'car_n',
        name: 'Car Driving North',
        prompt: `Create a small CAR sprite driving NORTH.

Format: Single sprite, 32 x 32 px
Background: TRANSPARENT (PNG-ready)

The car: Generic sedan or compact car viewed from above/behind at isometric angle. Driving away from camera (north = toward top-right). Simple, chunky design. Could be any color (suggest blue or red).

Style: 90s CGI chunky aesthetic. Recognizable as a car at small size. No specific brand.`
    },
    {
        key: 'car_s',
        name: 'Car Driving South',
        prompt: `Create a small CAR sprite driving SOUTH.

Format: Single sprite, 32 x 32 px
Background: TRANSPARENT (PNG-ready)

The car: Generic sedan or compact car viewed from above/front at isometric angle. Driving toward camera (south = toward bottom-left). Simple, chunky design.

Style: 90s CGI chunky aesthetic. Recognizable as a car at small size. No specific brand.`
    },
    {
        key: 'car_e',
        name: 'Car Driving East',
        prompt: `Create a small CAR sprite driving EAST.

Format: Single sprite, 32 x 32 px
Background: TRANSPARENT (PNG-ready)

The car: Generic sedan or compact car viewed from above at isometric angle. Driving right (east = toward bottom-right). Side view showing driver side or passenger side.

Style: 90s CGI chunky aesthetic. Recognizable as a car at small size. No specific brand.`
    },
    {
        key: 'car_w',
        name: 'Car Driving West',
        prompt: `Create a small CAR sprite driving WEST.

Format: Single sprite, 32 x 32 px
Background: TRANSPARENT (PNG-ready)

The car: Generic sedan or compact car viewed from above at isometric angle. Driving left (west = toward top-left). Side view.

Style: 90s CGI chunky aesthetic. Recognizable as a car at small size. No specific brand.`
    }
];
```

### NPC Generation Script Addition

Add to `scripts/generate-terrain-ui.js`:

```javascript
console.log('\nGenerating ambient NPC assets...\n');

// NPC assets
for (const npc of npcAssets) {
    console.log(`Generating: ${npc.name}`);
    const result = await generateAsset('npc', npc.key, npc.prompt, 1);
    console.log(`  ${result.success ? '✓' : '✗'} ${result.url || result.error}`);
    await new Promise(r => setTimeout(r, 2000));
}
```

---

## R2 Storage Structure

```
sprites/
├── terrain/
│   ├── # Simple Tiles (4)
│   ├── terrain_grass.webp
│   ├── terrain_trees.webp
│   ├── terrain_mountain.webp
│   ├── terrain_sand.webp
│   │
│   ├── # Road Tiles (15)
│   ├── terrain_road_ns.webp
│   ├── terrain_road_ew.webp
│   ├── terrain_road_ne.webp
│   ├── terrain_road_nw.webp
│   ├── terrain_road_se.webp
│   ├── terrain_road_sw.webp
│   ├── terrain_road_nes.webp
│   ├── terrain_road_new.webp
│   ├── terrain_road_nsw.webp
│   ├── terrain_road_esw.webp
│   ├── terrain_road_nesw.webp
│   ├── terrain_road_n.webp
│   ├── terrain_road_e.webp
│   ├── terrain_road_s.webp
│   ├── terrain_road_w.webp
│   │
│   ├── # Dirt Track Tiles (6)
│   ├── terrain_dirt_ns.webp
│   ├── terrain_dirt_ew.webp
│   ├── terrain_dirt_ne.webp
│   ├── terrain_dirt_nw.webp
│   ├── terrain_dirt_se.webp
│   ├── terrain_dirt_sw.webp
│   │
│   ├── # Water Tiles (13)
│   ├── terrain_water.webp
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
├── overlays/
│   ├── overlay_owned_self.webp
│   └── overlay_owned_other.webp
│
├── ui/
│   ├── ui_minimap_player.webp
│   ├── ui_minimap_enemy.webp
│   └── ui_cursor_select.webp
│
└── npc/
    ├── ped_walk_n.webp      (64x32 sprite strip)
    ├── ped_walk_s.webp
    ├── ped_walk_e.webp
    ├── ped_walk_w.webp
    ├── car_n.webp           (32x32 static)
    ├── car_s.webp
    ├── car_e.webp
    └── car_w.webp
```

---

## Deployment

```bash
# 1. Generate all terrain & UI assets (38 terrain + 2 overlays + 3 UI + 8 NPC = 51 assets)
node scripts/generate-terrain-ui.js

# 2. Remove backgrounds via Removal.ai for ALL game sprites:
#    - All 38 terrain tiles (for clean edges on trees, water transitions, etc.)
#    - UI elements (minimap markers, cursor)
#    - NPC sprites (pedestrians, cars)
#    NOTE: Only overlays do NOT need background removal (they're solid color fills)
node scripts/batch-remove-backgrounds.js --category terrain
node scripts/batch-remove-backgrounds.js --category ui
node scripts/batch-remove-backgrounds.js --category npc

# 3. Convert all assets to WebP format (lossless with alpha)

# 4. Review generated assets in R2 bucket

# 5. Approve good ones, regenerate if needed

# 6. Test auto-tiling:
#    - Place roads in various configurations, verify seamless connections
#    - Create a lake with shore, verify edge/corner tiles align correctly
#    - Test dirt tracks connecting to roads

# 7. Update any code that references these sprites
```

---

## Handoff Notes

**For Stage 07 (Asset Admin Page):**
- All asset categories now complete
- Admin page should include tabs for: Buildings, Terrain, Effects, UI, Scenes
- Terrain/UI assets are simpler - may not need reference sheets

**Asset Categories in Database:**
Add these to `asset_categories` table:
- `terrain` - Terrain tiles
- `overlay` - Ownership overlays
- `ui` - UI elements
