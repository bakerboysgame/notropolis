import Phaser from 'phaser';
import { BuildingInstance } from '../../../../types/game';
import { gridToScreen } from '../utils/coordinates';
import { DEPTH_Y_MULT } from '../gameConfig';
import {
  getBuildingUrl,
  getBuildingTextureKey,
  getOutlineUrl,
  getOutlineTextureKey,
  getDemolishedUrl,
  DEMOLISHED_TEXTURE_KEY,
} from '../utils/assetLoader';

// Building depth offset over terrain
const BUILDING_DEPTH_OFFSET = 100;
// Outline depth offset (behind building sprite)
const OUTLINE_DEPTH_OFFSET = -1;
// Ownership outline tint color (Tailwind blue-500)
const OWNERSHIP_TINT = 0x3b82f6;

export class BuildingRenderer {
  private scene: Phaser.Scene;
  private sprites: Map<string, Phaser.GameObjects.Image> = new Map();
  private outlines: Map<string, Phaser.GameObjects.Image> = new Map();
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

    // Load building and outline textures
    for (const typeId of buildingTypeIds) {
      if (this.loadedBuildingTypes.has(typeId)) continue;

      const buildingKey = getBuildingTextureKey(typeId);
      const outlineKey = getOutlineTextureKey(typeId);

      if (!this.scene.textures.exists(buildingKey)) {
        this.scene.load.image(buildingKey, getBuildingUrl(typeId));
        loadStarted = true;
      }

      if (!this.scene.textures.exists(outlineKey)) {
        this.scene.load.image(outlineKey, getOutlineUrl(typeId));
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
   * Set the active company ID for ownership outline display
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
        this.sprites.set(building.id, sprite);
      }

      // Update sprite properties
      sprite.setPosition(screenX, screenY);
      sprite.setDepth(depth);
      sprite.setTexture(textureKey);

      // Apply damage tint
      this.applyDamageTint(sprite, building.damage_percent);

      // Handle ownership outline
      const isOwned = building.company_id === this.activeCompanyId;
      if (isOwned && !building.is_collapsed) {
        this.updateOutline(
          building.id,
          building.building_type_id,
          screenX,
          screenY,
          depth + OUTLINE_DEPTH_OFFSET
        );
      } else {
        this.removeOutline(building.id);
      }
    }

    // Cleanup removed buildings
    for (const [id, sprite] of this.sprites) {
      if (!currentIds.has(id)) {
        sprite.destroy();
        this.sprites.delete(id);
        this.removeOutline(id);
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
   * Update or create ownership outline for a building
   */
  private updateOutline(
    buildingId: string,
    buildingTypeId: string,
    x: number,
    y: number,
    depth: number
  ): void {
    const outlineKey = getOutlineTextureKey(buildingTypeId);

    // Skip if outline texture not loaded
    if (!this.scene.textures.exists(outlineKey)) {
      return;
    }

    let outline = this.outlines.get(buildingId);
    if (!outline) {
      outline = this.scene.add.image(x, y, outlineKey);
      outline.setOrigin(0.5, 1); // Match building anchor
      this.outlines.set(buildingId, outline);
    }

    outline.setPosition(x, y);
    outline.setDepth(depth);
    outline.setTint(OWNERSHIP_TINT);
    outline.setVisible(true);
  }

  /**
   * Remove ownership outline for a building
   */
  private removeOutline(buildingId: string): void {
    const outline = this.outlines.get(buildingId);
    if (outline) {
      outline.destroy();
      this.outlines.delete(buildingId);
    }
  }

  /**
   * Clear all building sprites and outlines
   */
  clear(): void {
    for (const sprite of this.sprites.values()) {
      sprite.destroy();
    }
    this.sprites.clear();

    for (const outline of this.outlines.values()) {
      outline.destroy();
    }
    this.outlines.clear();
  }

  /**
   * Get building sprite by ID
   */
  getBuildingSprite(buildingId: string): Phaser.GameObjects.Image | undefined {
    return this.sprites.get(buildingId);
  }
}
