import Phaser from 'phaser';

// Pogocity tile dimensions (44x22 isometric diamonds) - EXACT MATCH
export const TILE_WIDTH = 44;
export const TILE_HEIGHT = 22;
export const DEPTH_Y_MULT = 10000;

// Pogocity sprite constants - EXACT MATCH (used as defaults)
export const SPRITE_CENTER = 256; // Center X of 512x512 sprite
export const SPRITE_HEIGHT = 512; // Height of standard sprite

// Grid dimensions (pogocity uses 48x48)
export const GRID_WIDTH = 48;
export const GRID_HEIGHT = 48;

// Calculate canvas size for isometric grid (pogocity approach)
const isoWidth = (GRID_WIDTH + GRID_HEIGHT) * (TILE_WIDTH / 2);
const isoHeight = (GRID_WIDTH + GRID_HEIGHT) * (TILE_HEIGHT / 2);

// Add padding for buildings that extend above their footprint
const CANVAS_PADDING_TOP = 300;
const CANVAS_PADDING_BOTTOM = 100;

export const GAME_WIDTH = Math.ceil(isoWidth) + TILE_WIDTH * 4;
export const GAME_HEIGHT = Math.ceil(isoHeight) + CANVAS_PADDING_TOP + CANVAS_PADDING_BOTTOM;

// Grid offsets to center the grid in the canvas (pogocity approach)
export const GRID_OFFSET_X = GAME_WIDTH / 2;
export const GRID_OFFSET_Y = CANVAS_PADDING_TOP;

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
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#1a1a2e',
    pixelArt: true,      // Crisp pixel rendering
    roundPixels: true,   // Prevent sub-pixel positioning
    antialias: false,    // Sharp edges
    scale: {
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.NO_CENTER,
    },
    scene,
  };
}
