import Phaser from 'phaser';
import { Tile, TerrainType } from '../../../../types/game';
import { gridToScreen } from '../utils/coordinates';
import { DEPTH_Y_MULT } from '../gameConfig';
import { getTerrainUrl, getTerrainTextureKey } from '../utils/assetLoader';

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
    const terrainTypes: TerrainType[] = ['free_land', 'water', 'road', 'dirt_track', 'trees'];

    for (const terrainType of terrainTypes) {
      const key = getTerrainTextureKey(terrainType);
      const url = getTerrainUrl(terrainType);

      if (!this.scene.textures.exists(key)) {
        this.scene.load.image(key, url);
        this.loadedTerrainTypes.add(terrainType);
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

      const textureKey = getTerrainTextureKey(tile.terrain_type);
      const existingSprite = this.sprites.get(key);

      // Check if texture exists
      if (!this.scene.textures.exists(textureKey)) {
        continue;
      }

      if (!existingSprite) {
        // Create new sprite
        const { x, y } = gridToScreen(tile.x, tile.y);
        const sprite = this.scene.add.image(x, y, textureKey);
        sprite.setDepth((tile.x + tile.y) * DEPTH_Y_MULT);
        this.sprites.set(key, sprite);
      } else {
        // Update existing sprite if terrain type changed
        if (existingSprite.texture.key !== textureKey) {
          existingSprite.setTexture(textureKey);
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
