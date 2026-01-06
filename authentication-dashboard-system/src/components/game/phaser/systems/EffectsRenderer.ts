import Phaser from 'phaser';
import { BuildingInstance } from '../../../../types/game';
import { gridToScreen } from '../utils/coordinates';
import { DEPTH_Y_MULT } from '../gameConfig';

export class EffectsRenderer {
  private scene: Phaser.Scene;
  private fireSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private forSaleSprites: Map<string, Phaser.GameObjects.Image> = new Map();
  private selectionGraphics: Phaser.GameObjects.Graphics | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.selectionGraphics = scene.add.graphics();
    this.selectionGraphics.setDepth(999999);
  }

  updateEffects(
    buildings: BuildingInstance[],
    tileMap: Map<string, { x: number; y: number }>
  ): void {
    const activeFireIds = new Set<string>();
    const activeForSaleIds = new Set<string>();

    for (const building of buildings) {
      const pos = tileMap.get(building.tile_id);
      if (!pos) continue;

      const { x, y } = gridToScreen(pos.x, pos.y);
      const depth = (pos.x + pos.y) * DEPTH_Y_MULT + 200;

      // Fire effect
      if (building.is_on_fire && !building.is_collapsed) {
        activeFireIds.add(building.id);
        if (!this.fireSprites.has(building.id)) {
          // Use placeholder for fire sprite if texture doesn't exist
          const textureKey = this.scene.textures.exists('effect_fire') ? 'effect_fire' : '__DEFAULT';
          const fire = this.scene.add.sprite(x, y - 20, textureKey);
          // Only play animation if texture exists
          if (this.scene.textures.exists('effect_fire') && this.scene.anims.exists('fire_anim')) {
            fire.play('fire_anim');
          }
          fire.setDepth(depth);
          fire.setAlpha(0.8);
          this.fireSprites.set(building.id, fire);
        }
      }

      // For sale indicator
      if (building.is_for_sale) {
        activeForSaleIds.add(building.id);
        if (!this.forSaleSprites.has(building.id)) {
          // Use placeholder for for-sale sign if texture doesn't exist
          const textureKey = this.scene.textures.exists('overlay_for_sale') ? 'overlay_for_sale' : '__DEFAULT';
          const sign = this.scene.add.image(x, y - 40, textureKey);
          sign.setDepth(depth);
          this.forSaleSprites.set(building.id, sign);
        }
      }
    }

    // Cleanup removed effects
    this.cleanupMap(this.fireSprites, activeFireIds);
    this.cleanupMap(this.forSaleSprites, activeForSaleIds);
  }

  drawSelection(gridX: number | null, gridY: number | null): void {
    if (!this.selectionGraphics) return;

    this.selectionGraphics.clear();
    if (gridX === null || gridY === null) return;

    const { x, y } = gridToScreen(gridX, gridY);
    const hw = 31.5; // TILE_WIDTH / 2 (63/2)
    const hh = 16; // TILE_HEIGHT / 2 (32/2)

    // Golden diamond outline (Tailwind amber-400)
    this.selectionGraphics.lineStyle(3, 0xfbbf24, 1);
    this.selectionGraphics.beginPath();
    this.selectionGraphics.moveTo(x, y - hh);
    this.selectionGraphics.lineTo(x + hw, y);
    this.selectionGraphics.lineTo(x, y + hh);
    this.selectionGraphics.lineTo(x - hw, y);
    this.selectionGraphics.closePath();
    this.selectionGraphics.strokePath();
  }

  private cleanupMap(
    map: Map<string, Phaser.GameObjects.GameObject>,
    activeIds: Set<string>
  ): void {
    for (const [id, obj] of map) {
      if (!activeIds.has(id)) {
        obj.destroy();
        map.delete(id);
      }
    }
  }

  clear(): void {
    for (const sprite of this.fireSprites.values()) {
      sprite.destroy();
    }
    this.fireSprites.clear();

    for (const sprite of this.forSaleSprites.values()) {
      sprite.destroy();
    }
    this.forSaleSprites.clear();

    if (this.selectionGraphics) {
      this.selectionGraphics.clear();
    }
  }
}
