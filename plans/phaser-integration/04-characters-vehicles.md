# Stage 4: Characters & Vehicles

## Objective
Port GIF animation loader from pogicity and implement walking characters and road-following vehicles.

## Dependencies
`[Requires: Stage 3 complete]`

## Complexity
High

## Files to Create

| Path | Purpose |
|------|---------|
| `src/components/game/phaser/GifLoader.ts` | Port from pogicity, adapt for R2 |
| `src/components/game/phaser/systems/CharacterSystem.ts` | NPC spawning, movement |
| `src/components/game/phaser/systems/VehicleSystem.ts` | Cars following roads |

## Files to Modify

| Path | Changes |
|------|---------|
| `src/components/game/phaser/MainScene.ts` | Integrate character/vehicle systems |
| `src/components/game/phaser/PhaserGame.tsx` | Expose spawn methods |

## Implementation Details

### GifLoader.ts
```typescript
// Direct port from pogicity-reference/app/components/game/phaser/GifLoader.ts
import Phaser from 'phaser';
import { parseGIF, decompressFrames } from 'gifuct-js';

export async function loadGifAsAnimation(
  scene: Phaser.Scene,
  key: string,
  url: string,
  frameRate: number = 10
): Promise<void> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const gif = parseGIF(arrayBuffer);
  const frames = decompressFrames(gif, true);

  if (frames.length === 0) return;

  const { width, height } = gif.lsd;
  const canvas = document.createElement('canvas');
  canvas.width = width * frames.length;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const compositeCanvas = document.createElement('canvas');
  compositeCanvas.width = width;
  compositeCanvas.height = height;
  const compositeCtx = compositeCanvas.getContext('2d')!;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const frameImageData = new ImageData(
      new Uint8ClampedArray(frame.patch),
      frame.dims.width,
      frame.dims.height
    );

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = frame.dims.width;
    tempCanvas.height = frame.dims.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(frameImageData, 0, 0);

    compositeCtx.drawImage(tempCanvas, frame.dims.left, frame.dims.top);
    ctx.drawImage(compositeCanvas, i * width, 0);

    if (frame.disposalType === 2) {
      compositeCtx.clearRect(frame.dims.left, frame.dims.top, frame.dims.width, frame.dims.height);
    }
  }

  const dataUrl = canvas.toDataURL();

  await new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      scene.textures.addSpriteSheet(key, img, { frameWidth: width, frameHeight: height });
      const avgDelay = frames.reduce((sum, f) => sum + (f.delay || 100), 0) / frames.length;
      scene.anims.create({
        key: `${key}_anim`,
        frames: scene.anims.generateFrameNumbers(key, { start: 0, end: frames.length - 1 }),
        frameRate: Math.round(1000 / avgDelay) || frameRate,
        repeat: -1,
      });
      resolve();
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export function playGifAnimation(sprite: Phaser.GameObjects.Sprite, animKey: string): void {
  const fullKey = `${animKey}_anim`;
  const anim = sprite.scene.anims.get(fullKey);
  if (anim?.frames?.length && sprite.anims.currentAnim?.key !== fullKey) {
    sprite.play(fullKey);
  }
}
```

### CharacterSystem.ts
```typescript
import Phaser from 'phaser';
import { loadGifAsAnimation, playGifAnimation } from '../GifLoader';
import { gridToScreen } from '../utils/coordinates';
import { DEPTH_Y_MULT, TILE_WIDTH, TILE_HEIGHT } from '../gameConfig';

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

export class CharacterSystem {
  private scene: Phaser.Scene;
  private characters: Map<string, Character> = new Map();
  private gifsLoaded = false;

  // Use pogicity placeholder GIFs initially
  private readonly GIF_URLS: Record<string, string> = {
    banana_up: '/Characters/banana_walk_up.gif',
    banana_down: '/Characters/banana_walk_down.gif',
    banana_left: '/Characters/banana_walk_left.gif',
    banana_right: '/Characters/banana_walk_right.gif',
  };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  async loadAssets(): Promise<void> {
    if (this.gifsLoaded) return;

    await Promise.all(
      Object.entries(this.GIF_URLS).map(([key, url]) =>
        loadGifAsAnimation(this.scene, key, url)
      )
    );
    this.gifsLoaded = true;
  }

  spawnCharacter(): boolean {
    if (!this.gifsLoaded) return false;

    const id = Math.random().toString(36).substring(2, 9);
    const gridX = Math.floor(Math.random() * 20) + 5;
    const gridY = Math.floor(Math.random() * 20) + 5;
    const { x, y } = gridToScreen(gridX, gridY);

    const sprite = this.scene.add.sprite(x, y, 'banana_down');
    sprite.setOrigin(0.5, 1);
    sprite.setScale(0.5);
    playGifAnimation(sprite, 'banana_down');

    this.characters.set(id, {
      id,
      sprite,
      gridX,
      gridY,
      targetX: gridX,
      targetY: gridY,
      direction: 'down',
      speed: 0.02,
    });

    return true;
  }

  update(delta: number): void {
    for (const char of this.characters.values()) {
      this.updateCharacter(char, delta);
    }
  }

  private updateCharacter(char: Character, delta: number): void {
    // Move toward target
    const dx = char.targetX - char.gridX;
    const dy = char.targetY - char.gridY;

    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
      // Pick new random target
      char.targetX = char.gridX + (Math.random() - 0.5) * 4;
      char.targetY = char.gridY + (Math.random() - 0.5) * 4;
      return;
    }

    const step = char.speed * delta;
    if (Math.abs(dx) > Math.abs(dy)) {
      char.gridX += Math.sign(dx) * Math.min(step, Math.abs(dx));
      char.direction = dx > 0 ? 'right' : 'left';
    } else {
      char.gridY += Math.sign(dy) * Math.min(step, Math.abs(dy));
      char.direction = dy > 0 ? 'down' : 'up';
    }

    // Update sprite
    const { x, y } = gridToScreen(char.gridX, char.gridY);
    char.sprite.setPosition(x, y);
    char.sprite.setDepth((char.gridX + char.gridY) * DEPTH_Y_MULT + 150);
    playGifAnimation(char.sprite, `banana_${char.direction}`);
  }

  getCount(): number {
    return this.characters.size;
  }

  clear(): void {
    for (const char of this.characters.values()) {
      char.sprite.destroy();
    }
    this.characters.clear();
  }
}
```

### VehicleSystem.ts
```typescript
import Phaser from 'phaser';
import { Tile } from '../../../../types/game';
import { gridToScreen } from '../utils/coordinates';
import { DEPTH_Y_MULT } from '../gameConfig';

type Direction = 'up' | 'down' | 'left' | 'right';

interface Vehicle {
  id: string;
  sprite: Phaser.GameObjects.Sprite;
  gridX: number;
  gridY: number;
  direction: Direction;
  speed: number;
}

export class VehicleSystem {
  private scene: Phaser.Scene;
  private vehicles: Map<string, Vehicle> = new Map();
  private roadTiles: Set<string> = new Set();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  setRoadTiles(tiles: Tile[]): void {
    this.roadTiles.clear();
    for (const tile of tiles) {
      if (tile.terrain_type === 'road') {
        this.roadTiles.set(`${tile.x},${tile.y}`);
      }
    }
  }

  spawnCar(): boolean {
    // Find random road tile
    const roadArray = Array.from(this.roadTiles);
    if (roadArray.length === 0) return false;

    const randomRoad = roadArray[Math.floor(Math.random() * roadArray.length)];
    const [gridX, gridY] = randomRoad.split(',').map(Number);

    const id = Math.random().toString(36).substring(2, 9);
    const { x, y } = gridToScreen(gridX, gridY);

    // Use placeholder car texture (will need to load from pogicity)
    const sprite = this.scene.add.sprite(x, y, 'car_down');
    sprite.setOrigin(0.5, 0.5);
    sprite.setScale(0.4);

    this.vehicles.set(id, {
      id,
      sprite,
      gridX,
      gridY,
      direction: 'down',
      speed: 0.05,
    });

    return true;
  }

  update(delta: number): void {
    for (const vehicle of this.vehicles.values()) {
      this.updateVehicle(vehicle, delta);
    }
  }

  private updateVehicle(vehicle: Vehicle, delta: number): void {
    // Simple road following - move in current direction if road exists
    const dirVec: Record<Direction, { dx: number; dy: number }> = {
      up: { dx: 0, dy: -1 },
      down: { dx: 0, dy: 1 },
      left: { dx: -1, dy: 0 },
      right: { dx: 1, dy: 0 },
    };

    const { dx, dy } = dirVec[vehicle.direction];
    const nextX = Math.round(vehicle.gridX + dx);
    const nextY = Math.round(vehicle.gridY + dy);

    if (this.roadTiles.has(`${nextX},${nextY}`)) {
      vehicle.gridX += dx * vehicle.speed * delta;
      vehicle.gridY += dy * vehicle.speed * delta;
    } else {
      // Try to turn
      const turns: Direction[] = ['up', 'down', 'left', 'right'];
      for (const turn of turns.sort(() => Math.random() - 0.5)) {
        const { dx: tdx, dy: tdy } = dirVec[turn];
        const turnX = Math.round(vehicle.gridX + tdx);
        const turnY = Math.round(vehicle.gridY + tdy);
        if (this.roadTiles.has(`${turnX},${turnY}`)) {
          vehicle.direction = turn;
          break;
        }
      }
    }

    const { x, y } = gridToScreen(vehicle.gridX, vehicle.gridY);
    vehicle.sprite.setPosition(x, y);
    vehicle.sprite.setDepth((vehicle.gridX + vehicle.gridY) * DEPTH_Y_MULT + 160);
  }

  getCount(): number {
    return this.vehicles.size;
  }

  clear(): void {
    for (const v of this.vehicles.values()) {
      v.sprite.destroy();
    }
    this.vehicles.clear();
  }
}
```

### MainScene.ts additions
```typescript
// Add to class properties:
private characterSystem!: CharacterSystem;
private vehicleSystem!: VehicleSystem;

// In create():
this.characterSystem = new CharacterSystem(this);
this.vehicleSystem = new VehicleSystem(this);

// Add async asset loading call
this.characterSystem.loadAssets();

// In update(time, delta):
this.characterSystem.update(delta);
this.vehicleSystem.update(delta);

// When tiles update:
this.vehicleSystem.setRoadTiles(data.tiles);

// Exposed methods:
spawnCharacter(): boolean { return this.characterSystem.spawnCharacter(); }
spawnCar(): boolean { return this.vehicleSystem.spawnCar(); }
getCharacterCount(): number { return this.characterSystem.getCount(); }
getCarCount(): number { return this.vehicleSystem.getCount(); }
clearCharacters(): void { this.characterSystem.clear(); }
clearCars(): void { this.vehicleSystem.clear(); }
```

## Database Changes
None

## Test Cases
1. **GIF loading**
   - Load banana_walk_down.gif
   - Expected: Animation plays smoothly, no console errors

2. **Character spawning**
   - Call `spawnCharacter()` 5 times
   - Expected: 5 animated characters visible, `getCharacterCount()` returns 5

3. **Character movement**
   - Watch spawned character for 10 seconds
   - Expected: Character moves around grid, changes direction animation

4. **Vehicle on road**
   - Spawn car on map with roads
   - Expected: Car moves along road tiles, turns at intersections

5. **Clear entities**
   - Spawn 10 characters, call `clearCharacters()`
   - Expected: All sprites removed, count returns 0

## Acceptance Checklist
- [ ] GIFs load from pogicity-reference/public/Characters
- [ ] Characters animate with 4-direction walking
- [ ] Characters move smoothly between grid positions
- [ ] Vehicles spawn only on road tiles
- [ ] Vehicles follow road paths
- [ ] `spawnCharacter()` and `spawnCar()` work from parent component
- [ ] `clearCharacters()` and `clearCars()` clean up properly
- [ ] Performance acceptable with 20+ entities

## Deployment
```bash
# Copy character GIFs from pogicity-reference to public/Characters
cp -r pogicity-reference/public/Characters authentication-dashboard-system/public/

# Copy car sprites
cp -r pogicity-reference/public/cars authentication-dashboard-system/public/

npm run dev
# Test spawning via browser console or add UI buttons
```

## Handoff Notes
- Pogicity placeholders (banana, apple) used initially
- Replace GIF_URLS with R2 paths when custom characters ready
- Vehicle pathfinding is basic - enhance with lane rules from pogicity roadUtils later
- Consider object pooling if spawning many entities
