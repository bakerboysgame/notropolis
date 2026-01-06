import Phaser from 'phaser';

// Pogicity tile dimensions (63x32 isometric diamonds)
export const TILE_WIDTH = 63;
export const TILE_HEIGHT = 32;
export const DEPTH_Y_MULT = 10000;

// R2 asset base URL
export const SPRITE_BASE_URL = 'https://assets.notropolis.net/sprites';

// Depth layer offsets for proper rendering order
export const DEPTH_LAYERS = {
  GROUND: 0.00,
  LAMP_GLOW: 0.04,
  BUILDINGS: 0.05,
  DECORATIONS: 0.06,
  VEHICLES: 0.10,
  CHARACTERS: 0.20,
} as const;

/**
 * Calculate depth for proper isometric sorting.
 * Uses screen Y coordinate for natural depth ordering, allowing entities
 * to render both in front of and behind buildings based on their position.
 *
 * @param sortX - Screen X coordinate
 * @param sortY - Screen Y coordinate (primary sorting factor)
 * @param layerOffset - Small decimal offset for micro-layering (e.g., 0.1 for vehicles, 0.2 for characters)
 */
export function depthFromSortPoint(
  sortX: number,
  sortY: number,
  layerOffset: number = 0
): number {
  return sortY * DEPTH_Y_MULT + sortX + layerOffset;
}

export function createGameConfig(
  parent: HTMLElement,
  scene: Phaser.Scene
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO, // WebGL with Canvas fallback
    parent,
    backgroundColor: '#1a1a2e',
    pixelArt: true,      // Crisp pixel rendering
    roundPixels: true,   // Prevent sub-pixel positioning
    antialias: false,    // Sharp edges
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene,
  };
}
