import Phaser from 'phaser';

export const TILE_WIDTH = 88;
export const TILE_HEIGHT = 44;
export const DEPTH_Y_MULT = 10000;

// R2 asset base URL
export const SPRITE_BASE_URL = 'https://assets.notropolis.net/sprites';

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
