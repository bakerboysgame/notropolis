/**
 * Vertical Slice Renderer - Pogocity's proven algorithm for isometric building depth
 *
 * Buildings are rendered as vertical slices to allow characters and vehicles to
 * interleave properly based on isometric depth. Each slice has its own depth value
 * calculated from its position in isometric space.
 *
 * Key Concept:
 * - Buildings are positioned by their FRONT CORNER (southeast corner)
 * - Left slices move WEST (toward top-left in isometric view)
 * - Right slices move NORTH (toward top-right in isometric view)
 * - Each slice's depth is based on its grid sum (x + y)
 */

import Phaser from 'phaser';
import { TILE_HEIGHT, DEPTH_Y_MULT, depthFromSortPoint, DEPTH_LAYERS, GRID_OFFSET_Y } from '../gameConfig';

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

/**
 * Create vertical slices for a building sprite using pogocity's algorithm.
 *
 * Algorithm:
 * 1. Calculate front corner grid position from baseDepth
 * 2. Create LEFT slices (WEST direction) - moving from center leftward
 *    - Each slice to the left is further back in isometric space
 * 3. Create RIGHT slices (NORTH direction) - moving from center rightward
 *    - Each slice to the right is further back in isometric space
 * 4. Each slice gets its own depth based on its grid sum (x + y)
 *
 * @param config - Configuration for slice creation
 * @returns SliceSprites object containing all slices and bounds
 */
export function createVerticalSlices(config: SliceConfig): SliceSprites {
  const { scene, textureKey, screenX, screenY, renderSize, baseDepth, tint } = config;
  const slices: Phaser.GameObjects.Image[] = [];

  // Get actual texture dimensions from Phaser
  const texture = scene.textures.get(textureKey);
  const textureWidth = texture.source[0].width;
  const textureHeight = texture.source[0].height;
  const spriteCenter = textureWidth / 2;
  const spriteHeight = textureHeight;

  // Calculate scale factor to normalize high-res sprites to 512px standard
  // 2560×2560 sprite gets scale = 512/2560 = 0.2 (displays same size as 512×512)
  const spriteScale = 512 / textureWidth;

  // Slice width in texture pixels - each slice covers a portion of one half
  // Left slices cover left half (0 to spriteCenter), right slices cover right half (spriteCenter to textureWidth)
  // For renderSize.width=4: each slice is spriteCenter/4 = 256/4 = 64px (for 512px sprite)
  const sliceWidthInTexture = spriteCenter / renderSize.width;

  // Number of slices is always based on renderSize (tile count)
  // renderSize.width=1 means 1 left slice, renderSize.height=1 means 1 right slice

  // Calculate front corner grid position (reverse engineer from baseDepth)
  // baseDepth is encoded as (x + y) * DEPTH_Y_MULT
  const gridSum = Math.floor(baseDepth / DEPTH_Y_MULT);

  // For depth calculation, we need to know the front corner position
  // frontX and frontY are the coordinates of the front (southeast) corner
  // We'll extract them from the gridSum and footprint
  // gridSum = frontX + frontY
  // We can derive the individual x and y from the context, but for depth calculation
  // we primarily need the grid sum for each slice

  // LEFT SLICES (WEST direction - moving left from center)
  for (let i = 0; i < renderSize.width; i++) {
    const srcX = spriteCenter - (i + 1) * sliceWidthInTexture;
    // Pogocity algorithm: all slices at same position, crop determines visual offset
    const slice = scene.add.image(screenX, screenY, textureKey);
    slice.setOrigin(0.5, 1);
    slice.setCrop(srcX, 0, sliceWidthInTexture, spriteHeight);
    slice.setScale(spriteScale); // Scale down high-res sprites to 512px standard size

    // Depth calculation: each slice to the left is further back
    // Moving WEST means moving toward top-left, which decreases the grid sum
    const sliceGridSum = gridSum - i;
    const sliceScreenY = GRID_OFFSET_Y + (sliceGridSum * TILE_HEIGHT) / 2;
    slice.setDepth(depthFromSortPoint(screenX, sliceScreenY + TILE_HEIGHT / 2, DEPTH_LAYERS.BUILDINGS));

    if (tint !== undefined) slice.setTint(tint);
    slices.push(slice);
  }

  // RIGHT SLICES (NORTH direction - moving right from center)
  for (let i = 0; i < renderSize.height; i++) {
    const srcX = spriteCenter + i * sliceWidthInTexture;
    // Pogocity algorithm: all slices at same position, crop determines visual offset
    const slice = scene.add.image(screenX, screenY, textureKey);
    slice.setOrigin(0.5, 1);
    slice.setCrop(srcX, 0, sliceWidthInTexture, spriteHeight);
    slice.setScale(spriteScale); // Scale down high-res sprites to 512px standard size

    // Depth calculation: each slice to the right is further back
    // Moving NORTH means moving toward top-right, which also decreases the grid sum
    const sliceGridSum = gridSum - i;
    const sliceScreenY = GRID_OFFSET_Y + (sliceGridSum * TILE_HEIGHT) / 2;
    slice.setDepth(depthFromSortPoint(screenX, sliceScreenY + TILE_HEIGHT / 2, DEPTH_LAYERS.BUILDINGS));

    if (tint !== undefined) slice.setTint(tint);
    slices.push(slice);
  }

  // Calculate scaled bounds (high-res sprites are scaled down to 512px standard)
  const scaledWidth = spriteCenter * spriteScale;
  const scaledHeight = spriteHeight * spriteScale;

  return {
    slices,
    bounds: {
      minX: screenX - scaledWidth,
      maxX: screenX + scaledWidth,
      minY: screenY - scaledHeight,
      maxY: screenY,
    },
  };
}

/**
 * Destroy all slices in a slice array.
 *
 * @param slices - Array of slice sprites to destroy
 */
export function destroyVerticalSlices(slices: Phaser.GameObjects.Image[]): void {
  for (const slice of slices) {
    slice.destroy();
  }
}
