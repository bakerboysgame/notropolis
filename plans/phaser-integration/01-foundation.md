# Stage 1: Foundation

## Objective
Create Phaser game instance with 88x44 isometric coordinate system rendering basic grass tiles.

## Dependencies
None

## Complexity
Medium

## Files to Create

All paths relative to `authentication-dashboard-system/`:

| Path | Purpose |
|------|---------|
| `src/components/game/phaser/gameConfig.ts` | Phaser config, tile constants |
| `src/components/game/phaser/utils/coordinates.ts` | gridToScreen, screenToGrid |
| `src/components/game/phaser/MainScene.ts` | Core Phaser scene |
| `src/components/game/phaser/PhaserGame.tsx` | React wrapper component |

## Files to Modify

| Path | Changes |
|------|---------|
| `authentication-dashboard-system/package.json` | Add `phaser@^3.90.0`, `gifuct-js@^2.1.2` |

## Implementation Details

### gameConfig.ts
```typescript
import Phaser from 'phaser';

export const TILE_WIDTH = 88;
export const TILE_HEIGHT = 44;
export const DEPTH_Y_MULT = 10000;

// R2 asset base URL
export const SPRITE_BASE_URL = 'https://assets.notropolis.net/sprites';

export function createGameConfig(
  parent: HTMLElement,
  scene: Phaser.Scene
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO, // WebGL with Canvas fallback
    parent,
    backgroundColor: '#1a1a2e',
    pixelArt: true,      // Crisp pixel rendering
    roundPixels: true,   // Prevent sub-pixel positioning
    antialias: false,    // Sharp edges
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene,
  };
}
```

### coordinates.ts
```typescript
import { TILE_WIDTH, TILE_HEIGHT } from '../gameConfig';

export function gridToScreen(gridX: number, gridY: number): { x: number; y: number } {
  return {
    x: (gridX - gridY) * (TILE_WIDTH / 2),
    y: (gridX + gridY) * (TILE_HEIGHT / 2),
  };
}

export function screenToGrid(screenX: number, screenY: number): { x: number; y: number } {
  const halfW = TILE_WIDTH / 2;
  const halfH = TILE_HEIGHT / 2;
  return {
    x: Math.floor((screenX / halfW + screenY / halfH) / 2),
    y: Math.floor((screenY / halfH - screenX / halfW) / 2),
  };
}
```

### MainScene.ts (minimal)
```typescript
import Phaser from 'phaser';
import { gridToScreen } from './utils/coordinates';
import { TILE_WIDTH, TILE_HEIGHT, DEPTH_Y_MULT } from './gameConfig';

export class MainScene extends Phaser.Scene {
  private tiles: Map<string, Phaser.GameObjects.Image> = new Map();

  constructor() {
    super({ key: 'MainScene' });
  }

  preload(): void {
    // Load grass tile from R2 (use grass_bg_v3.webp - current production asset)
    this.load.image('grass', 'https://assets.notropolis.net/sprites/terrain/grass_bg_v3.webp');
  }

  create(): void {
    // Render 15x15 test grid
    for (let y = 0; y < 15; y++) {
      for (let x = 0; x < 15; x++) {
        const { x: screenX, y: screenY } = gridToScreen(x, y);
        const tile = this.add.image(screenX, screenY, 'grass');
        tile.setDepth((x + y) * DEPTH_Y_MULT);
        this.tiles.set(`${x},${y}`, tile);
      }
    }

    // Center camera
    const center = gridToScreen(7, 7);
    this.cameras.main.centerOn(center.x, center.y);
  }
}
```

### PhaserGame.tsx (minimal)
```typescript
import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import Phaser from 'phaser';
import { MainScene } from './MainScene';
import { createGameConfig } from './gameConfig';

export interface PhaserGameHandle {
  // Methods exposed to parent
}

interface PhaserGameProps {
  // Will expand in Stage 2
}

export const PhaserGame = forwardRef<PhaserGameHandle, PhaserGameProps>(
  function PhaserGame(props, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const gameRef = useRef<Phaser.Game | null>(null);

    useEffect(() => {
      if (!containerRef.current || gameRef.current) return;

      const scene = new MainScene();
      const config = createGameConfig(containerRef.current, scene);
      gameRef.current = new Phaser.Game(config);

      return () => {
        gameRef.current?.destroy(true);
        gameRef.current = null;
      };
    }, []);

    return <div ref={containerRef} className="w-full h-full" />;
  }
);
```

## Database Changes
None

## Test Cases
1. **Coordinate conversion round-trip**
   - Input: `gridToScreen(5, 3)` → `screenToGrid(result.x, result.y)`
   - Expected: `{ x: 5, y: 3 }`

2. **Phaser initializes**
   - Mount `<PhaserGame />` in test page
   - Expected: Canvas renders, no console errors

3. **Grass tiles visible**
   - Expected: 15x15 grid of grass tiles in isometric layout

## Acceptance Checklist
- [ ] `npm install` succeeds with new dependencies
- [ ] `PhaserGame` component mounts without errors
- [ ] Grass tiles render in isometric diamond pattern
- [ ] DevTools shows WebGL context (or Canvas fallback)
- [ ] No memory leaks on unmount (check Phaser destroy)

## Deployment
```bash
# From repository root:
cd authentication-dashboard-system
npm install
npm run dev
# Visit http://localhost:5173 (Vite default) and test PhaserGame component
# Check DevTools Console for WebGL context initialization
```

## Test Route (Temporary)

Create a temporary test route to verify the Phaser component works:

```typescript
// src/pages/PhaserTest.tsx (temporary - delete after Stage 3)
import { PhaserGame } from '../components/game/phaser/PhaserGame';

export function PhaserTest() {
  return (
    <div className="w-screen h-screen bg-gray-900">
      <PhaserGame />
    </div>
  );
}
```

Add route in your router config to test at `/phaser-test`.

## Handoff Notes
- `sceneRef` stored in PhaserGame for Stage 2 to call scene methods (updateGrid, etc.)
- Coordinate utils ready for click detection in Stage 3
- Camera centering will need dynamic viewport in Stage 3
