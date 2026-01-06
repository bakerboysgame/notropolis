import Phaser from 'phaser';
import { BuildingInstance } from '../../../../types/game';
import { gridToScreen } from '../utils/coordinates';
import { DEPTH_Y_MULT, TILE_HEIGHT } from '../gameConfig';
import {
  getBuildingUrl,
  getBuildingTextureKey,
  getDemolishedUrl,
  DEMOLISHED_TEXTURE_KEY,
  getBuildingMetadata,
} from '../utils/assetLoader';
import {
  createVerticalSlices,
  destroyVerticalSlices,
  SliceSprites,
} from '../utils/verticalSliceRenderer';

export class BuildingRenderer {
  private scene: Phaser.Scene;
  private sprites: Map<string, SliceSprites> = new Map();
  // private activeCompanyId: string = ''; // Disabled - ownership tint removed
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
   * Set the active company ID for ownership display (disabled - ownership tint removed)
   */
  setActiveCompany(_companyId: string): void {
    // this.activeCompanyId = _companyId;
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

      // Determine texture key based on collapsed state
      const textureKey = building.is_collapsed
        ? DEMOLISHED_TEXTURE_KEY
        : getBuildingTextureKey(building.building_type_id);

      // Skip if texture not loaded
      if (!this.scene.textures.exists(textureKey)) {
        continue;
      }

      // Get building metadata
      const metadata = getBuildingMetadata(building.building_type_id);
      if (!metadata) {
        console.warn(`No metadata for building type: ${building.building_type_id}`);
        continue;
      }

      const footprint = metadata.footprint;
      const renderSize = metadata.renderSize || footprint;

      // Buildings are placed on single tiles in Notropolis (multi-tile placement deferred)
      // Render at the tile position directly, not offset by footprint
      const { x: screenX, y: screenY } = gridToScreen(tilePos.x, tilePos.y);
      const bottomY = screenY + TILE_HEIGHT;

      // Calculate tint based on damage and ownership
      const tint = this.calculateTint(building);

      // Check if we need to recreate slices (texture changed or doesn't exist)
      const existingSlices = this.sprites.get(building.id);
      const needsRecreate = !existingSlices || existingSlices.slices[0]?.texture.key !== textureKey;

      if (needsRecreate) {
        // Remove old slices if they exist
        if (existingSlices) {
          destroyVerticalSlices(existingSlices.slices);
        }

        // Calculate scale based on actual sprite dimensions vs expected 512x512
        const texture = this.scene.textures.get(textureKey);
        const actualWidth = texture.getSourceImage().width;
        const expectedWidth = 512; // Standard sprite size
        const scale = expectedWidth / actualWidth;

        // Create new slices
        const sliceSprites = createVerticalSlices({
          scene: this.scene,
          textureKey,
          screenX,
          screenY: bottomY,
          footprint,
          renderSize,
          baseDepth: (tilePos.x + tilePos.y) * DEPTH_Y_MULT,
          tint,
          scale,
        });

        this.sprites.set(building.id, sliceSprites);
      } else {
        // Update existing slices (position and tint)
        for (const slice of existingSlices.slices) {
          slice.setPosition(screenX, bottomY);
          if (tint !== undefined) {
            slice.setTint(tint);
          } else {
            slice.clearTint();
          }
        }
      }
    }

    // Cleanup removed buildings
    for (const [id, sliceSprites] of this.sprites) {
      if (!currentIds.has(id)) {
        destroyVerticalSlices(sliceSprites.slices);
        this.sprites.delete(id);
      }
    }
  }

  /**
   * Calculate tint for a building based on damage and ownership.
   * Returns undefined if no tint should be applied.
   *
   * Priority:
   * 1. Damage tint (if damage > 0)
   * 2. Ownership tint (if owned and no damage and not collapsed)
   * 3. No tint
   *
   * @param building - Building instance
   * @returns Tint color or undefined
   */
  private calculateTint(building: BuildingInstance): number | undefined {
    // Apply damage tint (highest priority)
    if (building.damage_percent > 0) {
      const darkness = 1 - building.damage_percent / 200;
      const colorValue = Math.floor(255 * darkness);
      return Phaser.Display.Color.GetColor(colorValue, colorValue, colorValue);
    }

    // Ownership tint disabled - buildings render with original colors
    // const isOwned = building.company_id === this.activeCompanyId;
    // if (isOwned && !building.is_collapsed && building.damage_percent === 0) {
    //   return 0x8888ff; // Light blue tint for ownership
    // }

    // No tint
    return undefined;
  }

  /**
   * Clear all building sprites
   */
  clear(): void {
    for (const sliceSprites of this.sprites.values()) {
      destroyVerticalSlices(sliceSprites.slices);
    }
    this.sprites.clear();
  }

  /**
   * Get building sprite slices by ID
   */
  getBuildingSprite(buildingId: string): SliceSprites | undefined {
    return this.sprites.get(buildingId);
  }
}
