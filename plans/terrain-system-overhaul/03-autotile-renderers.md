# Stage 3: Auto-Tiling + Renderers

## Objective
Implement road auto-tiling in map builder and update both admin grid and Phaser renderers to display terrain variants.

## Dependencies
[Requires: Stage 2 complete]

## Complexity
High

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useMapBuilder.ts` | Integrate auto-tile on paint, update neighbors |
| `src/components/admin/MapGrid.tsx` | Render terrain variant sprites |
| `src/components/game/phaser/utils/assetLoader.ts` | Add variant URL support |
| `src/components/game/phaser/systems/TerrainRenderer.ts` | Load/render variants |

## Files to Create

| File | Purpose |
|------|---------|
| `src/utils/autoTile.ts` | Auto-tile neighbor detection and variant selection |

## Implementation Details

### 1. Auto-Tile Utility (src/utils/autoTile.ts)

```typescript
import { TerrainType, Tile } from '../types/game';

interface TileNeighbors {
  n: boolean;  // Has same terrain type to north
  e: boolean;
  s: boolean;
  w: boolean;
}

const AUTO_TILE_TYPES: TerrainType[] = ['road'];

export function isAutoTileType(terrainType: TerrainType): boolean {
  return AUTO_TILE_TYPES.includes(terrainType);
}

export function getAutoTileVariant(terrainType: TerrainType, neighbors: TileNeighbors): string | null {
  if (!isAutoTileType(terrainType)) return null;

  const { n, e, s, w } = neighbors;
  const count = [n, e, s, w].filter(Boolean).length;

  if (terrainType === 'road') {
    if (count === 4) return 'crossroad';
    if (count === 3) {
      if (!n) return 'tjunction_s';
      if (!e) return 'tjunction_w';
      if (!s) return 'tjunction_n';
      if (!w) return 'tjunction_e';
    }
    if (count === 2) {
      if (n && s) return 'straight_ns';
      if (e && w) return 'straight_ew';
      if (n && e) return 'corner_ne';
      if (n && w) return 'corner_nw';
      if (s && e) return 'corner_se';
      if (s && w) return 'corner_sw';
    }
    if (count === 1) {
      if (n) return 'deadend_s';
      if (e) return 'deadend_w';
      if (s) return 'deadend_n';
      if (w) return 'deadend_e';
    }
    return 'crossroad';  // Isolated road = crossroad
  }

  return null;
}

export function getNeighbors(
  x: number, y: number,
  terrainType: TerrainType,
  tiles: Tile[],
  width: number, height: number
): TileNeighbors {
  const getTile = (tx: number, ty: number) =>
    tiles.find(t => t.x === tx && t.y === ty);

  return {
    n: y > 0 && getTile(x, y - 1)?.terrain_type === terrainType,
    e: x < width - 1 && getTile(x + 1, y)?.terrain_type === terrainType,
    s: y < height - 1 && getTile(x, y + 1)?.terrain_type === terrainType,
    w: x > 0 && getTile(x - 1, y)?.terrain_type === terrainType,
  };
}
```

### 2. Map Builder Integration (useMapBuilder.ts)

Import and use auto-tile in paint function (~line 276):

```typescript
import { isAutoTileType, getAutoTileVariant, getNeighbors } from '../utils/autoTile';

// Inside paint function, after setting terrain_type:
function updateAutoTile(x: number, y: number) {
  const tile = tiles.find(t => t.x === x && t.y === y);
  if (!tile || !isAutoTileType(tile.terrain_type)) {
    if (tile) tile.terrain_variant = null;
    return;
  }

  const neighbors = getNeighbors(x, y, tile.terrain_type, tiles, map.width, map.height);
  tile.terrain_variant = getAutoTileVariant(tile.terrain_type, neighbors);
}

// After painting a tile, update it and all 4 neighbors:
const affectedPositions = [
  { x, y },
  { x, y: y - 1 },
  { x: x + 1, y },
  { x, y: y + 1 },
  { x: x - 1, y },
];

for (const pos of affectedPositions) {
  if (pos.x >= 0 && pos.x < map.width && pos.y >= 0 && pos.y < map.height) {
    updateAutoTile(pos.x, pos.y);
  }
}
```

### 3. Admin MapGrid Renderer (MapGrid.tsx)

Update tile rendering to use variant sprites:

```typescript
// Add sprite loading for terrain variants
const TERRAIN_SPRITES: Record<string, HTMLImageElement> = {};

function getTerrainSpriteKey(tile: Tile): string {
  if (tile.terrain_variant) {
    return `${tile.terrain_type}_${tile.terrain_variant}`;
  }
  return tile.terrain_type;
}

// In render function, use sprite if available:
const spriteKey = getTerrainSpriteKey(tile);
if (TERRAIN_SPRITES[spriteKey]) {
  ctx.drawImage(TERRAIN_SPRITES[spriteKey], drawX, drawY, tileWidth, tileHeight);
} else {
  // Fallback to color
  ctx.fillStyle = COLORS[tile.terrain_type];
  ctx.fillRect(drawX, drawY, tileWidth, tileHeight);
}
```

### 4. Asset Loader Variant Support (assetLoader.ts)

```typescript
export function getTerrainUrl(terrainType: TerrainType, variant?: string | null): string {
  if (variant) {
    // Check if variant sprite exists, fallback to base
    const variantUrl = `${SPRITE_BASE_URL}/terrain/${terrainType}_${variant}.png`;
    return variantUrl;
  }
  return LOCAL_TERRAIN_MAPPING[terrainType] || LOCAL_TERRAIN_MAPPING.free_land;
}
```

### 5. Phaser TerrainRenderer (TerrainRenderer.ts)

Update to preload variant sprites and render based on terrain_variant:

```typescript
// Preload all road variants
const ROAD_VARIANTS = ['straight_ns', 'straight_ew', 'corner_ne', 'corner_nw',
                       'corner_se', 'corner_sw', 'tjunction_n', 'tjunction_e',
                       'tjunction_s', 'tjunction_w', 'crossroad',
                       'deadend_n', 'deadend_e', 'deadend_s', 'deadend_w'];

preloadTextures(): void {
  // ... existing terrain preload

  // Preload road variants
  for (const variant of ROAD_VARIANTS) {
    const key = `terrain_road_${variant}`;
    const url = getTerrainUrl('road', variant);
    this.scene.load.image(key, url);
  }
}

// In render, use variant texture if available:
const textureKey = tile.terrain_variant
  ? `terrain_${tile.terrain_type}_${tile.terrain_variant}`
  : getTerrainTextureKey(tile.terrain_type);
```

## Database Changes

None - uses terrain_variant column from Stage 1.

## Test Cases

1. **Place single road tile**
   - Paint road at (5,5) with no neighbors
   - Expected: terrain_variant = 'crossroad'

2. **Place two adjacent roads**
   - Paint road at (5,5), then (5,6)
   - Expected: (5,5) = 'straight_ns', (5,6) = 'straight_ns'

3. **Create L-corner**
   - Paint road at (5,5), (5,6), (6,6)
   - Expected: (5,5) = 'deadend_s', (5,6) = 'corner_se', (6,6) = 'deadend_w'

4. **Create T-junction**
   - Paint roads: (5,5), (5,6), (5,7), (6,6)
   - Expected: (5,6) = 'tjunction_e'

5. **Remove road updates neighbors**
   - From test 2, remove road at (5,6)
   - Expected: (5,5) updates to 'crossroad'

## Acceptance Checklist

- [ ] autoTile.ts utility created and tested
- [ ] Map builder auto-updates terrain_variant on paint
- [ ] Map builder updates neighbor variants when painting
- [ ] MapGrid renders variant sprites (or fallback colors)
- [ ] Phaser preloads all road variant textures
- [ ] Phaser renders correct variant based on tile.terrain_variant
- [ ] Removing road tile updates neighbor variants

## Deployment

```bash
cd authentication-dashboard-system
npm run build
npx wrangler deploy
```

Verify:
1. Open map builder, paint roads, observe auto-tiling
2. Open Phaser test, load map, verify variant sprites render

## Handoff Notes

- Auto-tiling currently only supports roads
- Water and dirt_track can be added later using same pattern
- Variant sprites must exist in R2 before rendering works
- Until sprites uploaded, admin grid falls back to color fill
