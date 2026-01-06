import Phaser from 'phaser';
import { Tile, TerrainType } from '../../../../types/game';
import { gridToScreen } from '../utils/coordinates';
import { DEPTH_Y_MULT } from '../gameConfig';
import { getTerrainUrl, getTerrainTextureKey, getTerrainVariantUrl } from '../utils/assetLoader';

export class TerrainRenderer {
  private scene: Phaser.Scene;
  private sprites: Map<string, Phaser.GameObjects.Image> = new Map();
  private loadedTerrainTypes: Set<TerrainType> = new Set();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Preload all terrain textures. Call this from scene.preload().
   */
  preloadTextures(): void {
    const terrainTypes: TerrainType[] = ['free_land', 'water', 'road', 'dirt_track', 'trees', 'snow', 'sand', 'mountain'];

    for (const terrainType of terrainTypes) {
      const key = getTerrainTextureKey(terrainType);
      const url = getTerrainUrl(terrainType);

      if (!this.scene.textures.exists(key)) {
        this.scene.load.image(key, url);
        this.loadedTerrainTypes.add(terrainType);
      }
    }

    // Preload road variants from R2
    const roadVariants = [
      'straight_ns', 'straight_ew',
      'corner_ne', 'corner_nw', 'corner_se', 'corner_sw',
      'tjunction_n', 'tjunction_e', 'tjunction_s', 'tjunction_w',
      'crossroad',
      'deadend_n', 'deadend_e', 'deadend_s', 'deadend_w'
    ];

    for (const variant of roadVariants) {
      const key = getTerrainTextureKey('road', variant);
      const url = getTerrainVariantUrl('road', variant);

      if (!this.scene.textures.exists(key)) {
        this.scene.load.image(key, url);
      }
    }
  }

  /**
   * Update terrain tiles. Creates new sprites, updates existing, removes old ones.
   */
  updateTiles(tiles: Tile[]): void {
    const currentKeys = new Set<string>();

    for (const tile of tiles) {
      const key = `${tile.x},${tile.y}`;
      currentKeys.add(key);

      // Determine texture key - use variant if available for roads
      const textureKey = tile.terrain_variant && tile.terrain_type === 'road'
        ? getTerrainTextureKey(tile.terrain_type, tile.terrain_variant)
        : getTerrainTextureKey(tile.terrain_type);

      const existingSprite = this.sprites.get(key);

      // Check if texture exists, fallback to base terrain if variant missing
      let finalTextureKey = textureKey;
      if (!this.scene.textures.exists(textureKey)) {
        finalTextureKey = getTerrainTextureKey(tile.terrain_type);
        if (!this.scene.textures.exists(finalTextureKey)) {
          continue; // Skip if no texture available
        }
      }

      if (!existingSprite) {
        // Create new sprite
        const { x, y } = gridToScreen(tile.x, tile.y);
        const sprite = this.scene.add.image(x, y, finalTextureKey);
        sprite.setDepth((tile.x + tile.y) * DEPTH_Y_MULT);
        this.sprites.set(key, sprite);
      } else {
        // Update existing sprite if texture changed
        if (existingSprite.texture.key !== finalTextureKey) {
          existingSprite.setTexture(finalTextureKey);
        }
      }
    }

    // Remove sprites for tiles no longer in the data
    for (const [key, sprite] of this.sprites) {
      if (!currentKeys.has(key)) {
        sprite.destroy();
        this.sprites.delete(key);
      }
    }
  }

  /**
   * Clear all terrain sprites
   */
  clear(): void {
    for (const sprite of this.sprites.values()) {
      sprite.destroy();
    }
    this.sprites.clear();
  }

  /**
   * Get tile sprite by grid coordinates
   */
  getTileSprite(x: number, y: number): Phaser.GameObjects.Image | undefined {
    return this.sprites.get(`${x},${y}`);
  }
}
