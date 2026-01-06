import Phaser from 'phaser';
import { gridToScreen } from './utils/coordinates';
import { TerrainRenderer } from './systems/TerrainRenderer';
import { BuildingRenderer } from './systems/BuildingRenderer';
import { InputHandler, InputCallbacks } from './systems/InputHandler';
import { EffectsRenderer } from './systems/EffectsRenderer';
import { CharacterSystem } from './systems/CharacterSystem';
import { VehicleSystem } from './systems/VehicleSystem';
import { SceneData } from './types';

export class MainScene extends Phaser.Scene {
  private terrainRenderer!: TerrainRenderer;
  private buildingRenderer!: BuildingRenderer;
  private inputHandler!: InputHandler;
  private effectsRenderer!: EffectsRenderer;
  private characterSystem!: CharacterSystem;
  private vehicleSystem!: VehicleSystem;
  private sceneData: SceneData | null = null;
  private tileMap: Map<string, { x: number; y: number }> = new Map();
  private pendingCallbacks: InputCallbacks | null = null;
  private selectedTile: { x: number; y: number } | null = null;
  private pendingCenterTile: { x: number; y: number } | null = null;
  private sceneReady = false;

  constructor() {
    super({ key: 'MainScene' });
  }

  preload(): void {
    // Initialize renderers for preloading
    this.terrainRenderer = new TerrainRenderer(this);
    this.buildingRenderer = new BuildingRenderer(this);

    // Preload all terrain textures
    this.terrainRenderer.preloadTextures();
  }

  create(): void {
    // Set default camera zoom for better visibility
    this.cameras.main.setZoom(2.0);

    // Initialize input handler with default no-op callbacks
    const defaultCallbacks: InputCallbacks = {
      onTileClick: () => {},
      onCenterChange: () => {},
    };
    this.inputHandler = new InputHandler(this, this.pendingCallbacks ?? defaultCallbacks);

    // Initialize effects renderer
    this.effectsRenderer = new EffectsRenderer(this);

    // Initialize character and vehicle systems
    this.characterSystem = new CharacterSystem(this);
    this.vehicleSystem = new VehicleSystem(this);

    // Load character GIF assets (async, will enable spawning when complete)
    this.characterSystem.loadAssets();

    // Load vehicle sprites
    this.vehicleSystem.loadAssets();

    // Scene is ready - if we have pending data, apply it
    if (this.sceneData) {
      this.applySceneData();
    }

    // Apply any pending selection
    if (this.selectedTile) {
      this.effectsRenderer.drawSelection(this.selectedTile.x, this.selectedTile.y);
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
   * Set callbacks for input events. Call before Phaser game starts or callbacks are stored as pending.
   */
  setCallbacks(callbacks: InputCallbacks): void {
    if (this.inputHandler) {
      this.inputHandler.setCallbacks(callbacks);
    } else {
      this.pendingCallbacks = callbacks;
    }
  }

  /**
   * Set selected tile to draw selection diamond
   */
  setSelection(x: number | null, y: number | null): void {
    this.selectedTile = x !== null && y !== null ? { x, y } : null;
    if (this.effectsRenderer) {
      this.effectsRenderer.drawSelection(x, y);
    }
  }

  /**
   * Set center tile and pan camera to it
   */
  setCenterTile(x: number, y: number): void {
    if (!this.sceneReady) {
      // Store for later if scene not ready
      this.pendingCenterTile = { x, y };
      return;
    }
    // Pan camera to center tile
    const center = gridToScreen(x, y);
    this.cameras.main.centerOn(center.x, center.y);
  }

  /**
   * Set scene data from React props. Call this whenever tiles/buildings change.
   */
  setSceneData(data: SceneData): void {
    this.sceneData = data;

    // Build tile position lookup map
    this.tileMap.clear();
    for (const tile of data.tiles) {
      this.tileMap.set(tile.id, { x: tile.x, y: tile.y });
    }

    // Only preload building textures if buildingRenderer is initialized (scene has started preloading)
    if (this.buildingRenderer) {
      // Preload building textures for any new building types
      const buildingTypeIds = [...new Set(data.buildings.map((b) => b.building_type_id))];
      this.buildingRenderer.preloadTextures(buildingTypeIds);

      // Set active company for outline display
      this.buildingRenderer.setActiveCompany(data.activeCompanyId);
    }

    // Apply data if scene is ready (create has been called)
    if (this.sceneReady) {
      this.applySceneData();
    }
  }

  /**
   * Apply scene data to renderers
   */
  private applySceneData(): void {
    if (!this.sceneData) return;

    // Ensure building textures are preloaded (in case setSceneData was called before preload)
    if (this.buildingRenderer) {
      const buildingTypeIds = [...new Set(this.sceneData.buildings.map((b) => b.building_type_id))];
      this.buildingRenderer.preloadTextures(buildingTypeIds);
      this.buildingRenderer.setActiveCompany(this.sceneData.activeCompanyId);
    }

    // Update terrain
    this.terrainRenderer.updateTiles(this.sceneData.tiles);

    // Update buildings
    this.buildingRenderer.updateBuildings(this.sceneData.buildings, this.tileMap);

    // Update effects (fire, for-sale)
    if (this.effectsRenderer) {
      this.effectsRenderer.updateEffects(this.sceneData.buildings, this.tileMap);
    }

    // Update road tiles for vehicle system
    if (this.vehicleSystem) {
      this.vehicleSystem.setRoadTiles(this.sceneData.tiles);
    }

    // Update map bounds for character system
    if (this.characterSystem && this.sceneData.tiles.length > 0) {
      const bounds = this.findMapBounds();
      this.characterSystem.setMapBounds(bounds.minX, bounds.maxX, bounds.minY, bounds.maxY);
    }

    // Auto-spawn NPCs and vehicles based on tile counts
    this.autoSpawnEntities();

    // Center camera on map center if we have tiles (only on first load)
    if (this.sceneData.tiles.length > 0 && !this.cameras.main.scrollX && !this.cameras.main.scrollY) {
      const centerTile = this.findMapCenter();
      const center = gridToScreen(centerTile.x, centerTile.y);
      this.cameras.main.centerOn(center.x, center.y);
    }

    // Force Phaser to render sprites immediately after scene setup
    // Delay slightly to ensure all sprites are fully created
    this.time.delayedCall(50, () => {
      // Force depth sorting to ensure proper rendering order
      this.sys.displayList.depthSort();
      // Force alpha update to trigger render
      this.cameras.main.setAlpha(1);
    });
  }

  /**
   * Auto-spawn NPCs and vehicles based on tile counts
   * - 1 NPC per 10 non-road tiles
   * - 1 vehicle per 10 road tiles
   */
  private autoSpawnEntities(): void {
    if (!this.sceneData) return;

    // Count road and non-road tiles
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

    // Get current counts
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

    let minX = Infinity,
      maxX = -Infinity;
    let minY = Infinity,
      maxY = -Infinity;

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

  /**
   * Get the terrain renderer for external access
   */
  getTerrainRenderer(): TerrainRenderer {
    return this.terrainRenderer;
  }

  /**
   * Get the building renderer for external access
   */
  getBuildingRenderer(): BuildingRenderer {
    return this.buildingRenderer;
  }

  // Character & Vehicle methods (Stage 4)
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
}
