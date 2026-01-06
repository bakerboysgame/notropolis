import Phaser from 'phaser';
import { BuildingInstance } from '../../../../types/game';
import { gridToScreen } from '../utils/coordinates';
import { DEPTH_Y_MULT } from '../gameConfig';
import {
  getBuildingUrl,
  getBuildingTextureKey,
  getDemolishedUrl,
  DEMOLISHED_TEXTURE_KEY,
} from '../utils/assetLoader';

// Building depth offset over terrain
const BUILDING_DEPTH_OFFSET = 100;
// Scale 512px sprites to fit 2x2 tile footprint (~126px width at 2x zoom = 252px visible)
const BUILDING_SPRITE_SCALE = 0.5;

export class BuildingRenderer {
  private scene: Phaser.Scene;
  private sprites: Map<string, Phaser.GameObjects.Image> = new Map();
  private activeCompanyId: string = '';
  private loadedBuildingTypes: Set<string> = new Set();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Preload building textures. Call dynamically when buildings array changes.
   */
  preloadTextures(buildingTypeIds: string[]): void {
    let loadStarted = false;

    // Load demolished texture
    if (!this.scene.textures.exists(DEMOLISHED_TEXTURE_KEY)) {
      this.scene.load.image(DEMOLISHED_TEXTURE_KEY, getDemolishedUrl());
      loadStarted = true;
    }

    // Load building textures
    for (const typeId of buildingTypeIds) {
      if (this.loadedBuildingTypes.has(typeId)) continue;

      const buildingKey = getBuildingTextureKey(typeId);

      if (!this.scene.textures.exists(buildingKey)) {
        this.scene.load.image(buildingKey, getBuildingUrl(typeId));
        loadStarted = true;
      }

      this.loadedBuildingTypes.add(typeId);
    }

    // Start loading if new assets were queued
    if (loadStarted) {
      this.scene.load.start();
    }
  }

  /**
   * Set the active company ID for ownership display
   */
  setActiveCompany(companyId: string): void {
    this.activeCompanyId = companyId;
  }

  /**
   * Update buildings. Creates, updates, and removes building sprites.
   * @param buildings Array of building instances
   * @param tileMap Map of tile_id to {x, y} coordinates
   */
  updateBuildings(
    buildings: BuildingInstance[],
    tileMap: Map<string, { x: number; y: number }>
  ): void {
    const currentIds = new Set<string>();

    for (const building of buildings) {
      currentIds.add(building.id);

      const tilePos = tileMap.get(building.tile_id);
      if (!tilePos) continue;

      const { x: screenX, y: screenY } = gridToScreen(tilePos.x, tilePos.y);
      const depth = (tilePos.x + tilePos.y) * DEPTH_Y_MULT + BUILDING_DEPTH_OFFSET;

      // Determine texture key based on collapsed state
      const textureKey = building.is_collapsed
        ? DEMOLISHED_TEXTURE_KEY
        : getBuildingTextureKey(building.building_type_id);

      // Skip if texture not loaded
      if (!this.scene.textures.exists(textureKey)) {
        continue;
      }

      // Get or create sprite
      let sprite = this.sprites.get(building.id);
      if (!sprite) {
        sprite = this.scene.add.image(screenX, screenY, textureKey);
        sprite.setOrigin(0.5, 1); // Bottom center anchor
        sprite.setScale(BUILDING_SPRITE_SCALE);
        this.sprites.set(building.id, sprite);
      }

      // Update sprite properties
      sprite.setPosition(screenX, screenY);
      sprite.setDepth(depth);
      sprite.setTexture(textureKey);

      // Apply damage tint
      this.applyDamageTint(sprite, building.damage_percent);

      // Apply ownership tint (blue tint for owned buildings)
      const isOwned = building.company_id === this.activeCompanyId;
      if (isOwned && !building.is_collapsed && building.damage_percent === 0) {
        sprite.setTint(0x8888ff); // Light blue tint for ownership
      }
    }

    // Cleanup removed buildings
    for (const [id, sprite] of this.sprites) {
      if (!currentIds.has(id)) {
        sprite.destroy();
        this.sprites.delete(id);
      }
    }
  }

  /**
   * Apply damage tint to a building sprite
   * darkness = 1 - (damage_percent / 200)
   * So 0% damage = full brightness, 100% damage = 50% brightness
   */
  private applyDamageTint(sprite: Phaser.GameObjects.Image, damagePercent: number): void {
    if (damagePercent > 0) {
      const darkness = 1 - damagePercent / 200;
      const colorValue = Math.floor(255 * darkness);
      const tint = Phaser.Display.Color.GetColor(colorValue, colorValue, colorValue);
      sprite.setTint(tint);
    } else {
      sprite.clearTint();
    }
  }

  /**
   * Clear all building sprites
   */
  clear(): void {
    for (const sprite of this.sprites.values()) {
      sprite.destroy();
    }
    this.sprites.clear();
  }

  /**
   * Get building sprite by ID
   */
  getBuildingSprite(buildingId: string): Phaser.GameObjects.Image | undefined {
    return this.sprites.get(buildingId);
  }
}
