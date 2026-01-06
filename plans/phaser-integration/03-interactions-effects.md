# Stage 3: Interactions & Effects

## Objective
Implement click/pan/zoom controls, fire/for-sale overlays, selection highlight, and connect to React state.

## Dependencies
`[Requires: Stage 2 complete]`

## Complexity
Medium

## Files to Modify

| Path | Changes |
|------|---------|
| `src/components/game/phaser/MainScene.ts` | Add input handling, effects |
| `src/components/game/phaser/PhaserGame.tsx` | Full props sync, expose methods |
| `src/pages/GameMap.tsx` | Replace IsometricView with PhaserGame |

## Files to Create

| Path | Purpose |
|------|---------|
| `src/components/game/phaser/systems/EffectsRenderer.ts` | Fire, for-sale overlays |
| `src/components/game/phaser/systems/InputHandler.ts` | Click, pan, zoom |

## Implementation Details

### InputHandler.ts
```typescript
import Phaser from 'phaser';
import { screenToGrid } from '../utils/coordinates';
import { TILE_WIDTH, TILE_HEIGHT } from '../gameConfig';

interface InputCallbacks {
  onTileClick: (x: number, y: number) => void;
  onCenterChange: (x: number, y: number) => void;
}

export class InputHandler {
  private scene: Phaser.Scene;
  private callbacks: InputCallbacks;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private cameraStartX = 0;
  private cameraStartY = 0;
  private dragDistance = 0;
  private centerTile = { x: 0, y: 0 };

  constructor(scene: Phaser.Scene, callbacks: InputCallbacks) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.setupInput();
  }

  setCenterTile(x: number, y: number): void {
    this.centerTile = { x, y };
  }

  private setupInput(): void {
    const pointer = this.scene.input;

    pointer.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.isDragging = true;
      this.dragStartX = p.x;
      this.dragStartY = p.y;
      this.cameraStartX = this.scene.cameras.main.scrollX;
      this.cameraStartY = this.scene.cameras.main.scrollY;
      this.dragDistance = 0;
    });

    pointer.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.isDragging) return;
      const dx = p.x - this.dragStartX;
      const dy = p.y - this.dragStartY;
      this.dragDistance += Math.abs(dx) + Math.abs(dy);

      this.scene.cameras.main.scrollX = this.cameraStartX - dx;
      this.scene.cameras.main.scrollY = this.cameraStartY - dy;
    });

    pointer.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.dragDistance < 10) {
        // Click, not drag
        const worldPoint = this.scene.cameras.main.getWorldPoint(p.x, p.y);
        const { x, y } = screenToGrid(worldPoint.x, worldPoint.y);
        this.callbacks.onTileClick(x, y);
      } else {
        // Drag ended - report new center
        const center = this.scene.cameras.main.getWorldPoint(
          this.scene.cameras.main.width / 2,
          this.scene.cameras.main.height / 2
        );
        const { x, y } = screenToGrid(center.x, center.y);
        this.callbacks.onCenterChange(x, y);
      }
      this.isDragging = false;
    });

    // Zoom with wheel
    pointer.on('wheel', (p: Phaser.Input.Pointer, _: unknown, __: unknown, deltaY: number) => {
      const camera = this.scene.cameras.main;
      const newZoom = Phaser.Math.Clamp(
        camera.zoom + (deltaY > 0 ? -0.1 : 0.1),
        0.5,
        2
      );
      camera.setZoom(newZoom);
    });
  }
}
```

### EffectsRenderer.ts
```typescript
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
          const fire = this.scene.add.sprite(x, y - 20, 'effect_fire');
          fire.play('fire_anim');
          fire.setDepth(depth);
          fire.setAlpha(0.8);
          this.fireSprites.set(building.id, fire);
        }
      }

      // For sale indicator
      if (building.is_for_sale) {
        activeForSaleIds.add(building.id);
        if (!this.forSaleSprites.has(building.id)) {
          const sign = this.scene.add.image(x, y - 40, 'overlay_for_sale');
          sign.setDepth(depth);
          this.forSaleSprites.set(building.id, sign);
        }
      }
    }

    // Cleanup
    this.cleanupMap(this.fireSprites, activeFireIds);
    this.cleanupMap(this.forSaleSprites, activeForSaleIds);
  }

  drawSelection(gridX: number | null, gridY: number | null): void {
    this.selectionGraphics!.clear();
    if (gridX === null || gridY === null) return;

    const { x, y } = gridToScreen(gridX, gridY);
    const hw = 44; // TILE_WIDTH / 2
    const hh = 22; // TILE_HEIGHT / 2

    this.selectionGraphics!.lineStyle(3, 0xfbbf24, 1);
    this.selectionGraphics!.beginPath();
    this.selectionGraphics!.moveTo(x, y - hh);
    this.selectionGraphics!.lineTo(x + hw, y);
    this.selectionGraphics!.lineTo(x, y + hh);
    this.selectionGraphics!.lineTo(x - hw, y);
    this.selectionGraphics!.closePath();
    this.selectionGraphics!.strokePath();
  }

  private cleanupMap(map: Map<string, Phaser.GameObjects.GameObject>, activeIds: Set<string>): void {
    for (const [id, obj] of map) {
      if (!activeIds.has(id)) {
        obj.destroy();
        map.delete(id);
      }
    }
  }
}
```

### PhaserGame.tsx (full implementation)
```typescript
import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import Phaser from 'phaser';
import { MainScene } from './MainScene';
import { createGameConfig } from './gameConfig';
import { PhaserGameProps, PhaserGameHandle } from './types';

export const PhaserGame = forwardRef<PhaserGameHandle, PhaserGameProps>(
  function PhaserGame(
    { map, tiles, buildings, activeCompanyId, centerTile, selectedTile, onTileClick, onCenterChange },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const gameRef = useRef<Phaser.Game | null>(null);
    const sceneRef = useRef<MainScene | null>(null);

    useImperativeHandle(ref, () => ({
      spawnCharacter: () => sceneRef.current?.spawnCharacter() ?? false,
      spawnCar: () => sceneRef.current?.spawnCar() ?? false,
      getCharacterCount: () => sceneRef.current?.getCharacterCount() ?? 0,
      getCarCount: () => sceneRef.current?.getCarCount() ?? 0,
      clearCharacters: () => sceneRef.current?.clearCharacters(),
      clearCars: () => sceneRef.current?.clearCars(),
    }));

    // Initialize Phaser
    useEffect(() => {
      if (!containerRef.current || gameRef.current) return;

      const scene = new MainScene();
      sceneRef.current = scene;

      scene.setCallbacks({ onTileClick, onCenterChange });

      const config = createGameConfig(containerRef.current, scene);
      gameRef.current = new Phaser.Game(config);

      return () => {
        gameRef.current?.destroy(true);
        gameRef.current = null;
        sceneRef.current = null;
      };
    }, []);

    // Sync data to scene
    useEffect(() => {
      sceneRef.current?.setSceneData({ tiles, buildings, activeCompanyId });
    }, [tiles, buildings, activeCompanyId]);

    // Sync selection
    useEffect(() => {
      sceneRef.current?.setSelection(selectedTile?.x ?? null, selectedTile?.y ?? null);
    }, [selectedTile]);

    // Sync center
    useEffect(() => {
      sceneRef.current?.setCenterTile(centerTile.x, centerTile.y);
    }, [centerTile]);

    return <div ref={containerRef} className="w-full h-full" />;
  }
);
```

### GameMap.tsx changes
```typescript
// Replace:
import { IsometricView } from '../components/game/IsometricView';
// With:
import { PhaserGame } from '../components/game/phaser/PhaserGame';

// In render, replace <IsometricView ... /> with:
<PhaserGame
  map={map}
  tiles={tiles}
  buildings={buildings}
  activeCompanyId={activeCompanyId}
  centerTile={centerTile}
  selectedTile={selectedTile}
  onTileClick={handleTileClick}
  onCenterChange={handleCenterChange}
/>
```

## Database Changes
None

## Test Cases
1. **Click detection**
   - Click on tile at grid (5, 5)
   - Expected: `onTileClick` called with `{ x: 5, y: 5 }`

2. **Pan gesture**
   - Drag 200px to the right
   - Expected: Camera pans, `onCenterChange` called

3. **Zoom**
   - Scroll wheel up
   - Expected: Camera zooms in, range 0.5-2.0

4. **Selection highlight**
   - Set `selectedTile` to `{ x: 3, y: 3 }`
   - Expected: Golden diamond outline at (3, 3)

5. **Fire effect**
   - Building with `is_on_fire: true`
   - Expected: Animated fire overlay on building

## Acceptance Checklist
- [ ] Tile clicks trigger `onTileClick` callback
- [ ] Pan gesture moves camera and reports new center
- [ ] Zoom with wheel works (0.5x to 2x range)
- [ ] Selected tile shows golden diamond outline
- [ ] Fire effect animates on burning buildings
- [ ] For-sale sign shows on listed buildings
- [ ] Touch controls work on mobile (pan, tap, pinch-zoom)

## Deployment
```bash
npm run dev
# Replace IsometricView in GameMap.tsx
# Test all interactions on desktop and mobile
```

## Handoff Notes
- `spawnCharacter()` and `spawnCar()` methods stubbed for Stage 4
- InputHandler separates concern from MainScene
- Selection draws as diamond matching isometric tile shape
