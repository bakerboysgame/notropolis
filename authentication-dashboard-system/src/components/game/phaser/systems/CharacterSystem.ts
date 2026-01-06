import Phaser from 'phaser';
import { loadGifAsAnimation, playGifAnimation } from '../GifLoader';
import { gridToScreen } from '../utils/coordinates';
import { DEPTH_Y_MULT } from '../gameConfig';

type Direction = 'up' | 'down' | 'left' | 'right';

interface Character {
  id: string;
  sprite: Phaser.GameObjects.Sprite;
  gridX: number;
  gridY: number;
  targetX: number;
  targetY: number;
  direction: Direction;
  speed: number;
}

/**
 * CharacterSystem manages NPC characters that walk around the map.
 * Characters use 4-direction GIF animations and move between grid positions.
 */
export class CharacterSystem {
  private scene: Phaser.Scene;
  private characters: Map<string, Character> = new Map();
  private gifsLoaded = false;
  private loadingPromise: Promise<void> | null = null;

  // Map bounds (set from tiles when available)
  private mapBounds = { minX: 0, maxX: 20, minY: 0, maxY: 20 };

  // GIF animation keys and their URLs
  private readonly GIF_URLS: Record<string, string> = {
    banana_up: '/Characters/banana_walk_up.gif',
    banana_down: '/Characters/banana_walk_down.gif',
    banana_left: '/Characters/banana_walk_left.gif',
    banana_right: '/Characters/banana_walk_right.gif',
  };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Set map bounds for character movement limits
   */
  setMapBounds(minX: number, maxX: number, minY: number, maxY: number): void {
    this.mapBounds = { minX, maxX, minY, maxY };
  }

  /**
   * Load all character GIF assets
   */
  async loadAssets(): Promise<void> {
    if (this.gifsLoaded) return;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = (async () => {
      try {
        await Promise.all(
          Object.entries(this.GIF_URLS).map(([key, url]) =>
            loadGifAsAnimation(this.scene, key, url).catch((err) => {
              console.warn(`Failed to load GIF ${key}:`, err);
            })
          )
        );
        this.gifsLoaded = true;
        console.log('CharacterSystem: GIF assets loaded');
      } catch (err) {
        console.error('CharacterSystem: Failed to load assets:', err);
      }
    })();

    return this.loadingPromise;
  }

  /**
   * Spawn a new character at a random position
   */
  spawnCharacter(characterType: 'banana' | 'apple' = 'banana'): boolean {
    if (!this.gifsLoaded) {
      console.warn('CharacterSystem: GIFs not yet loaded, cannot spawn');
      return false;
    }

    const id = Math.random().toString(36).substring(2, 9);

    // Random position within map bounds (with some margin)
    const gridX =
      Math.floor(Math.random() * (this.mapBounds.maxX - this.mapBounds.minX - 4)) +
      this.mapBounds.minX + 2;
    const gridY =
      Math.floor(Math.random() * (this.mapBounds.maxY - this.mapBounds.minY - 4)) +
      this.mapBounds.minY + 2;

    const { x, y } = gridToScreen(gridX, gridY);
    const textureKey = `${characterType}_down`;

    // Check if texture exists
    if (!this.scene.textures.exists(textureKey)) {
      console.warn(`CharacterSystem: Texture ${textureKey} not found`);
      return false;
    }

    const sprite = this.scene.add.sprite(x, y, textureKey);
    sprite.setOrigin(0.5, 1); // Anchor at bottom center for proper positioning
    sprite.setScale(0.5); // Scale down the sprites
    sprite.setDepth((gridX + gridY) * DEPTH_Y_MULT + 5000); // High offset to render above terrain/buildings

    // Start animation
    playGifAnimation(sprite, textureKey);

    const character: Character = {
      id,
      sprite,
      gridX,
      gridY,
      targetX: gridX,
      targetY: gridY,
      direction: 'down',
      speed: 0.002, // Grid units per millisecond delta (10% of original speed)
    };

    this.characters.set(id, character);
    console.log(`CharacterSystem: Spawned ${characterType} character ${id} at (${gridX}, ${gridY})`);
    return true;
  }

  /**
   * Update all characters (call from Phaser update loop)
   */
  update(delta: number): void {
    for (const char of this.characters.values()) {
      this.updateCharacter(char, delta);
    }
  }

  /**
   * Update a single character's position and animation
   */
  private updateCharacter(char: Character, delta: number): void {
    // Calculate distance to target
    const dx = char.targetX - char.gridX;
    const dy = char.targetY - char.gridY;

    // If we've reached the target, pick a new one
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
      this.pickNewTarget(char);
      return;
    }

    // Move toward target
    const step = char.speed * delta;

    // Move in the dominant direction (to get crisp 4-direction animation)
    if (Math.abs(dx) > Math.abs(dy)) {
      char.gridX += Math.sign(dx) * Math.min(step, Math.abs(dx));
      char.direction = dx > 0 ? 'right' : 'left';
    } else {
      char.gridY += Math.sign(dy) * Math.min(step, Math.abs(dy));
      char.direction = dy > 0 ? 'down' : 'up';
    }

    // Update sprite position
    const { x, y } = gridToScreen(char.gridX, char.gridY);
    char.sprite.setPosition(x, y);

    // Update depth for correct draw order
    char.sprite.setDepth((char.gridX + char.gridY) * DEPTH_Y_MULT + 5000);

    // Update animation to match direction
    const animKey = `banana_${char.direction}`;
    playGifAnimation(char.sprite, animKey);
  }

  /**
   * Pick a new random target for the character to walk toward
   */
  private pickNewTarget(char: Character): void {
    // Random offset from current position
    const offsetX = (Math.random() - 0.5) * 6;
    const offsetY = (Math.random() - 0.5) * 6;

    // Clamp to map bounds
    char.targetX = Math.max(
      this.mapBounds.minX + 1,
      Math.min(this.mapBounds.maxX - 1, char.gridX + offsetX)
    );
    char.targetY = Math.max(
      this.mapBounds.minY + 1,
      Math.min(this.mapBounds.maxY - 1, char.gridY + offsetY)
    );
  }

  /**
   * Get total number of characters
   */
  getCount(): number {
    return this.characters.size;
  }

  /**
   * Remove all characters
   */
  clear(): void {
    for (const char of this.characters.values()) {
      char.sprite.destroy();
    }
    this.characters.clear();
    console.log('CharacterSystem: Cleared all characters');
  }

  /**
   * Remove a specific character by ID
   */
  removeCharacter(id: string): boolean {
    const char = this.characters.get(id);
    if (!char) return false;

    char.sprite.destroy();
    this.characters.delete(id);
    return true;
  }

  /**
   * Check if assets are loaded
   */
  isReady(): boolean {
    return this.gifsLoaded;
  }
}
