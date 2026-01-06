import Phaser from 'phaser';
import { Tile } from '../../../../types/game';
import { gridToScreen } from '../utils/coordinates';
import { DEPTH_Y_MULT } from '../gameConfig';

type Direction = 'up' | 'down' | 'left' | 'right';
type VehicleType = 'taxi' | 'jeep';

interface Vehicle {
  id: string;
  sprite: Phaser.GameObjects.Sprite;
  gridX: number;
  gridY: number;
  direction: Direction;
  speed: number;
  vehicleType: VehicleType;
}

// Direction vectors for movement
const DIR_VECTORS: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

/**
 * VehicleSystem manages cars that drive along road tiles.
 * Vehicles spawn only on roads and follow road paths with basic turning logic.
 */
export class VehicleSystem {
  private scene: Phaser.Scene;
  private vehicles: Map<string, Vehicle> = new Map();
  private roadTiles: Set<string> = new Set();
  private roadArray: string[] = [];
  private texturesLoaded = false;

  // Texture keys for vehicles
  private readonly VEHICLE_TEXTURES: Record<VehicleType, Record<Direction, string>> = {
    taxi: {
      up: 'taxi_n',
      down: 'taxi_s',
      left: 'taxi_w',
      right: 'taxi_e',
    },
    jeep: {
      up: 'jeep_n',
      down: 'jeep_s',
      left: 'jeep_w',
      right: 'jeep_e',
    },
  };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Load vehicle sprites
   */
  loadAssets(): void {
    if (this.texturesLoaded) return;

    // Load taxi sprites
    this.scene.load.image('taxi_n', '/cars/taxin.png');
    this.scene.load.image('taxi_s', '/cars/taxis.png');
    this.scene.load.image('taxi_e', '/cars/taxie.png');
    this.scene.load.image('taxi_w', '/cars/taxiw.png');

    // Load jeep sprites
    this.scene.load.image('jeep_n', '/cars/jeepn.png');
    this.scene.load.image('jeep_s', '/cars/jeeps.png');
    this.scene.load.image('jeep_e', '/cars/jeepe.png');
    this.scene.load.image('jeep_w', '/cars/jeepw.png');

    // Start loading
    this.scene.load.once('complete', () => {
      this.texturesLoaded = true;
      console.log('VehicleSystem: Vehicle sprites loaded');
    });

    this.scene.load.start();
  }

  /**
   * Update road tile data (call when tiles change)
   */
  setRoadTiles(tiles: Tile[]): void {
    this.roadTiles.clear();
    for (const tile of tiles) {
      if (tile.terrain_type === 'road') {
        this.roadTiles.add(`${tile.x},${tile.y}`);
      }
    }
    this.roadArray = Array.from(this.roadTiles);
    console.log(`VehicleSystem: ${this.roadArray.length} road tiles indexed`);
  }

  /**
   * Check if a grid position is a road tile
   */
  private isRoad(x: number, y: number): boolean {
    return this.roadTiles.has(`${Math.round(x)},${Math.round(y)}`);
  }

  /**
   * Spawn a car on a random road tile
   */
  spawnCar(vehicleType?: VehicleType): boolean {
    if (this.roadArray.length === 0) {
      console.warn('VehicleSystem: No road tiles available');
      return false;
    }

    // Pick random road tile
    const randomRoad = this.roadArray[Math.floor(Math.random() * this.roadArray.length)];
    const [gridX, gridY] = randomRoad.split(',').map(Number);

    const id = Math.random().toString(36).substring(2, 9);
    const { x, y } = gridToScreen(gridX, gridY);

    // Random vehicle type if not specified
    const type: VehicleType = vehicleType || (Math.random() > 0.5 ? 'taxi' : 'jeep');

    // Pick initial direction based on available roads
    const direction = this.findValidDirection(gridX, gridY) || 'down';
    const textureKey = this.VEHICLE_TEXTURES[type][direction];

    // Check if texture is loaded
    if (!this.scene.textures.exists(textureKey)) {
      // Load textures if not already loaded
      this.loadAssets();
      console.warn(`VehicleSystem: Texture ${textureKey} not loaded yet`);
      return false;
    }

    const sprite = this.scene.add.sprite(x, y, textureKey);
    sprite.setOrigin(0.5, 0.5);
    sprite.setScale(0.4);
    sprite.setDepth((gridX + gridY) * DEPTH_Y_MULT + 6000); // High offset to render above terrain/buildings/characters

    const vehicle: Vehicle = {
      id,
      sprite,
      gridX,
      gridY,
      direction,
      speed: 0.0075, // 15% of original speed
      vehicleType: type,
    };

    this.vehicles.set(id, vehicle);
    console.log(`VehicleSystem: Spawned ${type} ${id} at (${gridX}, ${gridY})`);
    return true;
  }

  /**
   * Find a valid direction that has a road tile
   */
  private findValidDirection(x: number, y: number): Direction | null {
    const directions: Direction[] = ['up', 'down', 'left', 'right'];
    // Shuffle for variety
    directions.sort(() => Math.random() - 0.5);

    for (const dir of directions) {
      const { dx, dy } = DIR_VECTORS[dir];
      if (this.isRoad(x + dx, y + dy)) {
        return dir;
      }
    }
    return null;
  }

  /**
   * Update all vehicles (call from Phaser update loop)
   */
  update(delta: number): void {
    for (const vehicle of this.vehicles.values()) {
      this.updateVehicle(vehicle, delta);
    }
  }

  /**
   * Update a single vehicle's position
   */
  private updateVehicle(vehicle: Vehicle, delta: number): void {
    const { dx, dy } = DIR_VECTORS[vehicle.direction];
    const nextX = Math.round(vehicle.gridX + dx);
    const nextY = Math.round(vehicle.gridY + dy);

    // Check if we can continue in current direction
    if (this.isRoad(nextX, nextY)) {
      // Move forward
      vehicle.gridX += dx * vehicle.speed * delta;
      vehicle.gridY += dy * vehicle.speed * delta;
    } else {
      // Try to turn
      const newDir = this.findValidDirection(
        Math.round(vehicle.gridX),
        Math.round(vehicle.gridY)
      );

      if (newDir && newDir !== vehicle.direction) {
        vehicle.direction = newDir;
        // Update sprite texture for new direction
        const textureKey = this.VEHICLE_TEXTURES[vehicle.vehicleType][newDir];
        if (this.scene.textures.exists(textureKey)) {
          vehicle.sprite.setTexture(textureKey);
        }
      } else if (!newDir) {
        // Dead end - pick any road we can get to
        const currentRoadKey = `${Math.round(vehicle.gridX)},${Math.round(vehicle.gridY)}`;
        if (this.roadArray.length > 1) {
          // Teleport to random road (respawn)
          const newRoad = this.roadArray.find((r) => r !== currentRoadKey) || this.roadArray[0];
          const [newX, newY] = newRoad.split(',').map(Number);
          vehicle.gridX = newX;
          vehicle.gridY = newY;
          vehicle.direction = this.findValidDirection(newX, newY) || 'down';
        }
      }
    }

    // Update sprite position
    const { x, y } = gridToScreen(vehicle.gridX, vehicle.gridY);
    vehicle.sprite.setPosition(x, y);

    // Update depth for correct draw order
    vehicle.sprite.setDepth((vehicle.gridX + vehicle.gridY) * DEPTH_Y_MULT + 6000);
  }

  /**
   * Get total number of vehicles
   */
  getCount(): number {
    return this.vehicles.size;
  }

  /**
   * Remove all vehicles
   */
  clear(): void {
    for (const vehicle of this.vehicles.values()) {
      vehicle.sprite.destroy();
    }
    this.vehicles.clear();
    console.log('VehicleSystem: Cleared all vehicles');
  }

  /**
   * Remove a specific vehicle by ID
   */
  removeVehicle(id: string): boolean {
    const vehicle = this.vehicles.get(id);
    if (!vehicle) return false;

    vehicle.sprite.destroy();
    this.vehicles.delete(id);
    return true;
  }

  /**
   * Check if assets are loaded
   */
  isReady(): boolean {
    return this.texturesLoaded;
  }
}
