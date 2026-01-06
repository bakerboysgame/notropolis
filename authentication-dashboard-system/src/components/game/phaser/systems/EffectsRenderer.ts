import Phaser from 'phaser';
import { BuildingInstance } from '../../../../types/game';
import { gridToScreen } from '../utils/coordinates';
import { DEPTH_Y_MULT } from '../gameConfig';

export class EffectsRenderer {
  private scene: Phaser.Scene;
  private fireSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private forSaleSprites: Map<string, Phaser.GameObjects.Image> = new Map();
  private glowSprites: Map<string, Phaser.GameObjects.Image> = new Map();
  private glowTextureCreated = false;
  private selectionGraphics: Phaser.GameObjects.Graphics | null = null;

  // Building types that emit glow effects
  private readonly BUILDING_GLOW_CONFIG: Record<string, {
    offsetY: number;
    scale?: number;
    color?: number;
  }> = {
    restaurant: { offsetY: -25, color: 0xff9966, scale: 1.2 },  // Warm bar glow
  };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.selectionGraphics = scene.add.graphics();
    this.selectionGraphics.setDepth(999999);
  }

  /**
   * Create procedural glow texture (called once)
   */
  private createGlowTexture(): void {
    if (this.glowTextureCreated) return;

    const graphics = this.scene.add.graphics();
    const size = 96;
    const center = size / 2;

    // Concentric circles with alpha falloff
    const rings = [
      { radius: 40, alpha: 0.15 },
      { radius: 32, alpha: 0.10 },
      { radius: 24, alpha: 0.06 },
      { radius: 16, alpha: 0.03 },
      { radius: 8, alpha: 0.015 },
    ];

    for (const ring of rings) {
      graphics.fillStyle(0xffcc66, ring.alpha);
      graphics.fillCircle(center, center, ring.radius);
    }

    graphics.generateTexture('lamp_glow', size, size);
    graphics.destroy();
    this.glowTextureCreated = true;
  }

  /**
   * Add glow effect to a building
   */
  private addGlowEffect(
    buildingId: string,
    buildingTypeId: string,
    screenX: number,
    screenY: number,
    depth: number
  ): void {
    const config = this.BUILDING_GLOW_CONFIG[buildingTypeId];
    if (!config) return;

    this.createGlowTexture();

    const glow = this.scene.add.image(screenX, screenY + config.offsetY, 'lamp_glow');
    glow.setBlendMode(Phaser.BlendModes.ADD);
    glow.setScale(config.scale || 1.0);
    glow.setDepth(depth); // Use DEPTH_LAYERS.LAMP_GLOW from building's depth

    if (config.color) {
      glow.setTint(config.color);
    }

    // Pulsing animation
    this.scene.tweens.add({
      targets: glow,
      alpha: { from: 0.7, to: 1.0 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.glowSprites.set(buildingId, glow);
  }

  updateEffects(
    buildings: BuildingInstance[],
    tileMap: Map<string, { x: number; y: number }>
  ): void {
    const activeFireIds = new Set<string>();
    const activeForSaleIds = new Set<string>();
    const activeGlowIds = new Set<string>();

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

      // Glow effect - only show if not collapsed and not on fire
      if (!building.is_collapsed && !building.is_on_fire) {
        if (this.BUILDING_GLOW_CONFIG[building.building_type_id]) {
          activeGlowIds.add(building.id);
          if (!this.glowSprites.has(building.id)) {
            // Calculate proper depth for glow (should be behind building)
            const glowDepth = depth - 100; // Render behind building
            this.addGlowEffect(building.id, building.building_type_id, x, y, glowDepth);
          }
        }
      }
    }

    // Cleanup removed effects
    this.cleanupMap(this.fireSprites, activeFireIds);
    this.cleanupMap(this.forSaleSprites, activeForSaleIds);
    this.cleanupMap(this.glowSprites, activeGlowIds);
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

    for (const sprite of this.glowSprites.values()) {
      sprite.destroy();
    }
    this.glowSprites.clear();

    if (this.selectionGraphics) {
      this.selectionGraphics.clear();
    }
  }
}
