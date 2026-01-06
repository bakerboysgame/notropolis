# Stage 2: Vertical Slice Rendering

## Objective

Implement pogocity's vertical slice rendering algorithm so characters and vehicles properly interleave with buildings based on isometric depth.

## Dependencies

**Requires**: Stage 1 complete (building metadata system)

## Complexity

**High** — Core rendering refactor with depth sorting algorithm

---

## Files to Modify

### 1. `src/components/game/phaser/systems/BuildingRenderer.ts`
**Major refactor**:
- Change sprite storage from `Map<string, Image>` to `Map<string, SliceSprites>`
- Update `updateBuildings()` to create slices instead of single sprite
- Apply tints to all slices
- Update `clear()` to destroy slice arrays

---

## Files to Create

### 1. `src/components/game/phaser/utils/verticalSliceRenderer.ts` (NEW)

**Purpose**: Reusable vertical slice rendering utility

**Exports**:
```typescript
export interface SliceConfig {
  scene: Phaser.Scene;
  textureKey: string;
  screenX: number;
  screenY: number;
  footprint: { width: number; height: number };
  renderSize: { width: number; height: number };
  baseDepth: number;
  tint?: number;
}

export interface SliceSprites {
  slices: Phaser.GameObjects.Image[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

export function createVerticalSlices(config: SliceConfig): SliceSprites;
export function destroyVerticalSlices(slices: Image[]): void;
```

---

## Implementation Details

### Vertical Slice Algorithm (from pogocity)

**Key Constants**:
```typescript
const SLICE_WIDTH = 22;  // Half of TILE_WIDTH (44px / 2)
const SPRITE_CENTER = 256; // Center X of 512x512 sprite
const SPRITE_HEIGHT = 512;
```

**Algorithm**:
```typescript
export function createVerticalSlices(config: SliceConfig): SliceSprites {
  const { scene, textureKey, screenX, screenY, footprint, renderSize, baseDepth, tint } = config;
  const slices: Phaser.GameObjects.Image[] = [];

  // Calculate front corner (origin + footprint - 1)
  const frontX = Math.floor(baseDepth / (2 * DEPTH_Y_MULT)); // Reverse engineer from depth
  const frontY = Math.floor(baseDepth / (2 * DEPTH_Y_MULT));

  // LEFT SLICES (WEST direction)
  for (let i = 0; i < renderSize.width; i++) {
    const srcX = SPRITE_CENTER - (i + 1) * SLICE_WIDTH;
    const slice = scene.add.image(screenX, screenY, textureKey);
    slice.setOrigin(0.5, 1);
    slice.setCrop(srcX, 0, SLICE_WIDTH, SPRITE_HEIGHT);

    // Depth calculation
    const sliceGridSum = frontX - i + frontY;
    const sliceScreenY = (sliceGridSum * TILE_HEIGHT) / 2;
    slice.setDepth(depthFromSortPoint(screenX, sliceScreenY, DEPTH_LAYERS.BUILDINGS));

    if (tint) slice.setTint(tint);
    slices.push(slice);
  }

  // RIGHT SLICES (NORTH direction)
  for (let i = 0; i < renderSize.height; i++) {
    const srcX = SPRITE_CENTER + i * SLICE_WIDTH;
    const slice = scene.add.image(screenX, screenY, textureKey);
    slice.setOrigin(0.5, 1);
    slice.setCrop(srcX, 0, SLICE_WIDTH, SPRITE_HEIGHT);

    // Depth calculation
    const sliceGridSum = frontX + frontY - i;
    const sliceScreenY = (sliceGridSum * TILE_HEIGHT) / 2;
    slice.setDepth(depthFromSortPoint(screenX, sliceScreenY, DEPTH_LAYERS.BUILDINGS));

    if (tint) slice.setTint(tint);
    slices.push(slice);
  }

  return { slices, bounds: { minX: screenX - 256, maxX: screenX + 256, minY: screenY - 512, maxY: screenY } };
}

export function destroyVerticalSlices(slices: Image[]): void {
  for (const slice of slices) {
    slice.destroy();
  }
}
```

### BuildingRenderer.ts Refactor

**Key Changes**:
```typescript
import { createVerticalSlices, destroyVerticalSlices, SliceSprites } from '../utils/verticalSliceRenderer';
import { getBuildingMetadata, getBuildingFootprint, getBuildingRenderSize } from '../utils/assetLoader';
import { depthFromSortPoint, DEPTH_LAYERS } from '../gameConfig';

// Change sprite storage
private sprites: Map<string, SliceSprites> = new Map();

// In updateBuildings()
const metadata = getBuildingMetadata(building.building_type_id);
if (!metadata) continue;

const footprint = metadata.footprint;
const renderSize = metadata.renderSize || footprint;

// Calculate front corner position
const frontX = tilePos.x + footprint.width - 1;
const frontY = tilePos.y + footprint.height - 1;
const { x: screenX, y: screenY } = gridToScreen(frontX, frontY);
const bottomY = screenY + TILE_HEIGHT;

// Create slices
const sliceSprites = createVerticalSlices({
  scene: this.scene,
  textureKey,
  screenX,
  screenY: bottomY,
  footprint,
  renderSize,
  baseDepth: (frontX + frontY) * DEPTH_Y_MULT,
  tint: this.calculateTint(building),
});

this.sprites.set(building.id, sliceSprites);

// In clear()
for (const sliceSprites of this.sprites.values()) {
  destroyVerticalSlices(sliceSprites.slices);
}
this.sprites.clear();
```

---

## Database Changes

**None** — Visual rendering only

---

## Test Cases

### Test 1: Single 2×2 Building
```
Input: market_stall at (10, 10)
Expected:
- 4 vertical slices created (2 left + 2 right)
- Front corner at (11, 11)
- Each slice has independent depth
- Character at (11, 10) renders behind rightmost slices, in front of leftmost slices
```

### Test 2: Large 6×6 Building
```
Input: bank at (5, 5)
Expected:
- 12 vertical slices created (6 left + 6 right)
- Front corner at (10, 10)
- Character walking from (5,5) to (10,10) smoothly transitions from front to back
```

### Test 3: Damage Tint
```
Input: Building with 50% damage
Expected:
- All slices have same damage tint applied
- Tint value: 0x808080 (50% darkness)
```

### Test 4: Ownership Tint
```
Input: Player-owned building (0% damage)
Expected:
- All slices have blue ownership tint (0x8888ff)
```

---

## Acceptance Checklist

- [ ] verticalSliceRenderer.ts created with createVerticalSlices() and destroyVerticalSlices()
- [ ] BuildingRenderer.ts refactored to use slice system
- [ ] All 15 building types render with slices
- [ ] Character walks "through" 6×6 bank - depth sorting correct
- [ ] Vehicle drives "through" 4×4 casino - depth sorting correct
- [ ] Damage tint applies to all slices uniformly
- [ ] Ownership tint applies to all slices uniformly
- [ ] Demolished buildings show dark tint on all slices
- [ ] No visual artifacts or clipping
- [ ] Performance: 60 FPS with 50+ buildings
- [ ] No memory leaks after placing/demolishing 100 buildings

---

## Deployment

```bash
# Build
cd /Users/riki/notropolis/authentication-dashboard-system
npm run build

# Deploy
CLOUDFLARE_API_TOKEN="RQeVAceZ3VT-McbFF9DnYem0ZDc8YXbnHPH8wbg_" \
CLOUDFLARE_ACCOUNT_ID="329dc0e016dd5cd512d6566d64d8aa0c" \
npx wrangler pages deploy dist --project-name=notropolis-dashboard
```

**Verification**:
1. Visit https://boss.notropolis.net
2. Enter zoomed view on a map with buildings
3. Spawn character with UI button
4. Walk character around large building (bank/temple)
5. Verify character appears behind some building parts, in front of others
6. Check browser console - no errors
7. Monitor FPS - should remain 60fps

---

## Handoff Notes

**For Stage 3**:
- Vertical slice system complete and tested
- DEPTH_LAYERS.LAMP_GLOW (0.04) available for glow effects (renders behind buildings at 0.05)
- All buildings now render as slice arrays, not single sprites
- EffectsRenderer needs to position glows relative to building front corner, not origin
- depthFromSortPoint() established as standard depth calculation method
