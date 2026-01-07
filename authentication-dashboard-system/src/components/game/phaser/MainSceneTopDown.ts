import Phaser from 'phaser';
import { gridToScreen, TILE_SIZE } from './utils/coordinatesTopDown';
import { InputCallbacks } from './systems/InputHandler';
import { InputHandler } from './systems/InputHandlerTopDown';
import { CharacterSystem } from './systems/CharacterSystemTopDown';
import { VehicleSystem } from './systems/VehicleSystemTopDown';
import { SceneData } from './types';

/**
 * Top-down view variant of MainScene
 * Simplified for testing NPCs and vehicles with top-down perspective
 */
export class MainSceneTopDown extends Phaser.Scene {
  private inputHandler!: InputHandler;
  private characterSystem!: CharacterSystem;
  private vehicleSystem!: VehicleSystem;
  private sceneData: SceneData | null = null;
  private tileMap: Map<string, { x: number; y: number }> = new Map();
  private pendingCallbacks: InputCallbacks | null = null;
  private selectedTile: { x: number; y: number } | null = null;
  private pendingCenterTile: { x: number; y: number } | null = null;
  private sceneReady = false;

  // Graphics for simple tile rendering
  private tileGraphics!: Phaser.GameObjects.Graphics;
  private selectionGraphics!: Phaser.GameObjects.Graphics;
  private tileSprites: Phaser.GameObjects.Sprite[] = [];

  constructor() {
    super({ key: 'MainSceneTopDown' });
  }

  preload(): void {
    // Load burger bar sprite for tiles from local public folder
    this.load.image('burger_bar', '/Tiles/bbar.webp');
    // Load grass tile for background
    this.load.image('grass_tile', '/Tiles/1x1grass.png');
  }

  async create(): Promise<void> {
    // Start with zoom 0.5 to see more of the map
    this.cameras.main.setZoom(0.5);

    // Create graphics objects for tiles and selection
    this.tileGraphics = this.add.graphics();
    this.tileGraphics.setDepth(-1000); // Behind everything

    this.selectionGraphics = this.add.graphics();
    this.selectionGraphics.setDepth(10000); // In front of everything

    // Initialize input handler with default no-op callbacks
    const defaultCallbacks: InputCallbacks = {
      onTileClick: () => {},
      onCenterChange: () => {},
    };
    this.inputHandler = new InputHandler(this, this.pendingCallbacks ?? defaultCallbacks);

    // Initialize character and vehicle systems
    this.characterSystem = new CharacterSystem(this);
    this.vehicleSystem = new VehicleSystem(this);

    // Load all assets and wait for them to complete
    await Promise.all([
      this.characterSystem.loadAssets(),
      this.vehicleSystem.loadAssets(),
    ]);

    // Scene is ready - if we have pending data, apply it
    if (this.sceneData) {
      await this.applySceneData();
    }

    // Apply any pending selection
    if (this.selectedTile) {
      this.drawSelection(this.selectedTile.x, this.selectedTile.y);
    }

    // Apply any pending center tile
    if (this.pendingCenterTile) {
      const center = gridToScreen(this.pendingCenterTile.x, this.pendingCenterTile.y);
      this.cameras.main.centerOn(center.x, center.y);
      this.pendingCenterTile = null;
    }

    // Mark scene as ready
    this.sceneReady = true;
  }

  /**
   * Phaser update loop - called every frame
   */
  update(_time: number, delta: number): void {
    // Update character and vehicle systems
    if (this.characterSystem) {
      this.characterSystem.update(delta);
    }
    if (this.vehicleSystem) {
      this.vehicleSystem.update(delta);
    }
  }

  /**
   * Set callbacks for input events
   */
  setCallbacks(callbacks: InputCallbacks): void {
    if (this.inputHandler) {
      this.inputHandler.setCallbacks(callbacks);
    } else {
      this.pendingCallbacks = callbacks;
    }
  }

  /**
   * Set selected tile to draw selection square
   */
  setSelection(x: number | null, y: number | null): void {
    this.selectedTile = x !== null && y !== null ? { x, y } : null;
    if (this.selectionGraphics) {
      this.drawSelection(x, y);
    }
  }

  /**
   * Draw selection square around tile
   */
  private drawSelection(x: number | null, y: number | null): void {
    this.selectionGraphics.clear();
    if (x === null || y === null) return;

    const screen = gridToScreen(x, y);
    this.selectionGraphics.lineStyle(3, 0xffff00, 1);
    this.selectionGraphics.strokeRect(screen.x, screen.y, TILE_SIZE, TILE_SIZE);
  }

  /**
   * Set center tile and pan camera to it
   */
  setCenterTile(x: number, y: number): void {
    if (!this.sceneReady) {
      this.pendingCenterTile = { x, y };
      return;
    }
    const center = gridToScreen(x, y);
    this.cameras.main.centerOn(center.x, center.y);
  }

  /**
   * Set scene data from React props
   */
  setSceneData(data: SceneData): void {
    this.sceneData = data;

    // Build tile position lookup map
    this.tileMap.clear();
    for (const tile of data.tiles) {
      this.tileMap.set(tile.id, { x: tile.x, y: tile.y });
    }

    // Apply data if scene is ready
    if (this.sceneReady) {
      this.applySceneData();
    }
  }

  /**
   * Apply scene data to renderers
   */
  private async applySceneData(): Promise<void> {
    if (!this.sceneData) return;

    // Render simple colored tiles
    this.renderTiles(this.sceneData.tiles);

    // Update road tiles for vehicle system
    if (this.vehicleSystem) {
      this.vehicleSystem.setRoadTiles(this.sceneData.tiles);
    }

    // Update map bounds for character system
    if (this.characterSystem && this.sceneData.tiles.length > 0) {
      const bounds = this.findMapBounds();
      this.characterSystem.setMapBounds(bounds.minX, bounds.maxX, bounds.minY, bounds.maxY);
    }

    // Auto-spawn NPCs and vehicles
    this.autoSpawnEntities();

    // Center camera on map center if first load
    if (this.sceneData.tiles.length > 0 && !this.cameras.main.scrollX && !this.cameras.main.scrollY) {
      const centerTile = this.findMapCenter();
      const center = gridToScreen(centerTile.x, centerTile.y);
      this.cameras.main.centerOn(center.x, center.y);
    }
  }

  /**
   * Render tiles - burger bars for buildings, gray for roads
   */
  private renderTiles(tiles: SceneData['tiles']): void {
    // Clear existing tile sprites and graphics
    for (const sprite of this.tileSprites) {
      sprite.destroy();
    }
    this.tileSprites = [];
    this.tileGraphics.clear();

    // Check if textures are loaded
    const burgerBarLoaded = this.textures.exists('burger_bar');
    const grassTileLoaded = this.textures.exists('grass_tile');
    if (!burgerBarLoaded) {
      console.warn('Burger bar texture not loaded yet');
    }
    if (!grassTileLoaded) {
      console.warn('Grass tile texture not loaded yet');
    }

    // Render each tile
    for (const tile of tiles) {
      const screen = gridToScreen(tile.x, tile.y);

      if (tile.terrain_type === 'road') {
        // Roads: draw gray squares with graphics
        this.tileGraphics.fillStyle(0x444444, 1);
        this.tileGraphics.fillRect(screen.x, screen.y, TILE_SIZE, TILE_SIZE);
        this.tileGraphics.lineStyle(1, 0x000000, 0.2);
        this.tileGraphics.strokeRect(screen.x, screen.y, TILE_SIZE, TILE_SIZE);
      } else {
        // Non-roads: grass tile underneath, then building on top

        // 1. Render grass tile first (bottom layer)
        if (grassTileLoaded) {
          const grassSprite = this.add.sprite(screen.x + TILE_SIZE / 2, screen.y + TILE_SIZE / 2, 'grass_tile');
          grassSprite.setOrigin(0.5, 0.5);
          grassSprite.setDisplaySize(TILE_SIZE, TILE_SIZE);
          grassSprite.setDepth(-1001); // Below buildings
          this.tileSprites.push(grassSprite);
        } else {
          // Fallback: green square if grass texture not loaded
          this.tileGraphics.fillStyle(0x4a7c59, 1);
          this.tileGraphics.fillRect(screen.x, screen.y, TILE_SIZE, TILE_SIZE);
          this.tileGraphics.lineStyle(1, 0x000000, 0.2);
          this.tileGraphics.strokeRect(screen.x, screen.y, TILE_SIZE, TILE_SIZE);
        }

        // 2. Render burger bar building on top
        if (burgerBarLoaded) {
          const buildingSprite = this.add.sprite(screen.x + TILE_SIZE / 2, screen.y + TILE_SIZE / 2, 'burger_bar');
          buildingSprite.setOrigin(0.5, 0.5);
          buildingSprite.setDisplaySize(TILE_SIZE, TILE_SIZE);
          buildingSprite.setDepth(-1000); // On top of grass
          this.tileSprites.push(buildingSprite);
        }
      }
    }
  }

  /**
   * Auto-spawn NPCs and vehicles based on tile counts
   */
  private autoSpawnEntities(): void {
    if (!this.sceneData) return;

    let roadTileCount = 0;
    let nonRoadTileCount = 0;

    for (const tile of this.sceneData.tiles) {
      if (tile.terrain_type === 'road') {
        roadTileCount++;
      } else {
        nonRoadTileCount++;
      }
    }

    // Calculate target counts (1 per 10 tiles)
    const targetNPCs = Math.floor(nonRoadTileCount / 10);
    const targetVehicles = Math.floor(roadTileCount / 10);

    const currentNPCs = this.characterSystem?.getCount() ?? 0;
    const currentVehicles = this.vehicleSystem?.getCount() ?? 0;

    // Spawn NPCs if needed
    if (this.characterSystem?.isReady() && currentNPCs < targetNPCs) {
      const toSpawn = targetNPCs - currentNPCs;
      for (let i = 0; i < toSpawn; i++) {
        this.characterSystem.spawnCharacter();
      }
      console.log(`Auto-spawned ${toSpawn} NPCs (${currentNPCs} → ${targetNPCs})`);
    }

    // Spawn vehicles if needed
    if (this.vehicleSystem?.isReady() && currentVehicles < targetVehicles) {
      const toSpawn = targetVehicles - currentVehicles;
      for (let i = 0; i < toSpawn; i++) {
        this.vehicleSystem.spawnCar();
      }
      console.log(`Auto-spawned ${toSpawn} vehicles (${currentVehicles} → ${targetVehicles})`);
    }
  }

  /**
   * Find the bounds of the current map
   */
  private findMapBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
    if (!this.sceneData || this.sceneData.tiles.length === 0) {
      return { minX: 0, maxX: 20, minY: 0, maxY: 20 };
    }

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const tile of this.sceneData.tiles) {
      minX = Math.min(minX, tile.x);
      maxX = Math.max(maxX, tile.x);
      minY = Math.min(minY, tile.y);
      maxY = Math.max(maxY, tile.y);
    }

    return { minX, maxX, minY, maxY };
  }

  /**
   * Find the center tile of the current map
   */
  private findMapCenter(): { x: number; y: number } {
    const bounds = this.findMapBounds();
    return {
      x: Math.floor((bounds.minX + bounds.maxX) / 2),
      y: Math.floor((bounds.minY + bounds.maxY) / 2),
    };
  }

  // Character & Vehicle methods
  spawnCharacter(): boolean {
    if (!this.characterSystem) return false;
    return this.characterSystem.spawnCharacter();
  }

  spawnCar(): boolean {
    if (!this.vehicleSystem) return false;
    return this.vehicleSystem.spawnCar();
  }

  getCharacterCount(): number {
    return this.characterSystem?.getCount() ?? 0;
  }

  getCarCount(): number {
    return this.vehicleSystem?.getCount() ?? 0;
  }

  clearCharacters(): void {
    this.characterSystem?.clear();
  }

  clearCars(): void {
    this.vehicleSystem?.clear();
  }

  setZoom(zoom: number): void {
    this.cameras.main.setZoom(zoom);
  }

  getZoom(): number {
    return this.cameras.main.zoom;
  }
}
