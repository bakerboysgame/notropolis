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
import { TILE_WIDTH, TILE_HEIGHT, DEPTH_Y_MULT, depthFromSortPoint, DEPTH_LAYERS } from '../gameConfig';

// Constants for slice rendering
const SLICE_WIDTH = TILE_WIDTH / 2; // 31.5px (half of 63px tile width)

export interface SliceConfig {
  scene: Phaser.Scene;
  textureKey: string;
  screenX: number;
  screenY: number;
  footprint: { width: number; height: number };
  renderSize: { width: number; height: number };
  baseDepth: number;
  tint?: number;
  scale?: number; // Scale multiplier for sprite rendering (default: 1.0)
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
  const { scene, textureKey, screenX, screenY, renderSize, baseDepth, tint, scale = 1.0 } = config;
  const slices: Phaser.GameObjects.Image[] = [];

  // Get actual texture dimensions from loaded texture
  const texture = scene.textures.get(textureKey);
  const spriteWidth = texture.getSourceImage().width;
  const spriteHeight = texture.getSourceImage().height;
  const spriteCenter = spriteWidth / 2;

  // Calculate slice width in source texture proportional to sprite size
  // For 512px sprite: SLICE_WIDTH = 31.5px
  // For 5120px sprite: sliceWidthInTexture = 315px (10x larger)
  const sliceWidthInTexture = SLICE_WIDTH * (spriteWidth / 512);

  // Scale number of slices based on sprite resolution
  // For 512px sprite: use renderSize as-is
  // For 5120px sprite (10x): multiply renderSize by 10
  const scaleFactor = spriteWidth / 512;
  const scaledWidth = Math.round(renderSize.width * scaleFactor);
  const scaledHeight = Math.round(renderSize.height * scaleFactor);

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
  for (let i = 0; i < scaledWidth; i++) {
    const srcX = spriteCenter - (i + 1) * sliceWidthInTexture;
    // Each slice is offset horizontally on screen
    const sliceScreenX = screenX - (i + 0.5) * SLICE_WIDTH;
    const slice = scene.add.image(sliceScreenX, screenY, textureKey);
    slice.setOrigin(0.5, 1);
    slice.setCrop(srcX, 0, sliceWidthInTexture, spriteHeight);
    slice.setScale(scale); // Apply scale multiplier

    // Depth calculation: each slice to the left is further back
    // Moving WEST means moving toward top-left, which decreases the grid sum
    const sliceGridSum = gridSum - i;
    const sliceScreenY = (sliceGridSum * TILE_HEIGHT) / 2;
    slice.setDepth(depthFromSortPoint(sliceScreenX, sliceScreenY, DEPTH_LAYERS.BUILDINGS));

    if (tint !== undefined) slice.setTint(tint);
    slices.push(slice);
  }

  // RIGHT SLICES (NORTH direction - moving right from center)
  for (let i = 0; i < scaledHeight; i++) {
    const srcX = spriteCenter + i * sliceWidthInTexture;
    // Each slice is offset horizontally on screen
    const sliceScreenX = screenX + (i + 0.5) * SLICE_WIDTH;
    const slice = scene.add.image(sliceScreenX, screenY, textureKey);
    slice.setOrigin(0.5, 1);
    slice.setCrop(srcX, 0, sliceWidthInTexture, spriteHeight);
    slice.setScale(scale); // Apply scale multiplier

    // Depth calculation: each slice to the right is further back
    // Moving NORTH means moving toward top-right, which also decreases the grid sum
    const sliceGridSum = gridSum - i;
    const sliceScreenY = (sliceGridSum * TILE_HEIGHT) / 2;
    slice.setDepth(depthFromSortPoint(sliceScreenX, sliceScreenY, DEPTH_LAYERS.BUILDINGS));

    if (tint !== undefined) slice.setTint(tint);
    slices.push(slice);
  }

  return {
    slices,
    bounds: {
      minX: screenX - spriteCenter * scale,
      maxX: screenX + spriteCenter * scale,
      minY: screenY - spriteHeight * scale,
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
