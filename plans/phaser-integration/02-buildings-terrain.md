# Stage 2: Buildings & Terrain

## Objective
Render all terrain types and building sprites from R2 with ownership outlines and depth sorting.

## Dependencies
`[Requires: Stage 1 complete]`

## Complexity
High

## Files to Modify

| Path | Changes |
|------|---------|
| `src/components/game/phaser/MainScene.ts` | Add terrain/building rendering |
| `src/components/game/phaser/PhaserGame.tsx` | Accept full props, pass to scene |
| `src/components/game/phaser/types.ts` | Add Tile/Building interfaces |

## Files to Create

| Path | Purpose |
|------|---------|
| `src/components/game/phaser/systems/TerrainRenderer.ts` | Terrain tile management |
| `src/components/game/phaser/systems/BuildingRenderer.ts` | Building sprite management |
| `src/components/game/phaser/utils/assetLoader.ts` | R2 asset URL helpers |

## Implementation Details

### types.ts (expanded)
```typescript
import { GameMap, Tile, BuildingInstance } from '../../../types/game';

export interface PhaserGameProps {
  map: GameMap;
  tiles: Tile[];
  buildings: (BuildingInstance & { name?: string; building_type_id?: string })[];
  activeCompanyId: string;
  centerTile: { x: number; y: number };
  selectedTile: { x: number; y: number } | null;
  onTileClick: (coords: { x: number; y: number }) => void;
  onCenterChange: (coords: { x: number; y: number }) => void;
}

export interface SceneData {
  tiles: Tile[];
  buildings: BuildingInstance[];
  activeCompanyId: string;
}
```

### assetLoader.ts
```typescript
const R2_BASE = 'https://assets.notropolis.net';

export function getTerrainUrl(terrainType: string): string {
  const mapping: Record<string, string> = {
    free_land: `${R2_BASE}/sprites/terrain/grass_bg.webp`,
    road: `${R2_BASE}/sprites/terrain/road.webp`,
    water: `${R2_BASE}/sprites/terrain/water.webp`,
    dirt_track: `${R2_BASE}/sprites/terrain/dirt.webp`,
    trees: `${R2_BASE}/sprites/terrain/trees.webp`,
  };
  return mapping[terrainType] || mapping.free_land;
}

export function getBuildingUrl(buildingTypeId: string): string {
  return `${R2_BASE}/sprites/building_sprite/${buildingTypeId}.webp`;
}

export function getOutlineUrl(buildingTypeId: string): string {
  return `${R2_BASE}/sprites/building_sprite/${buildingTypeId}_outline.webp`;
}
```

### TerrainRenderer.ts
```typescript
import Phaser from 'phaser';
import { Tile } from '../../../../types/game';
import { gridToScreen } from '../utils/coordinates';
import { DEPTH_Y_MULT } from '../gameConfig';

export class TerrainRenderer {
  private scene: Phaser.Scene;
  private sprites: Map<string, Phaser.GameObjects.Image> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  updateTiles(tiles: Tile[]): void {
    const currentKeys = new Set<string>();

    for (const tile of tiles) {
      const key = `${tile.x},${tile.y}`;
      currentKeys.add(key);

      if (!this.sprites.has(key)) {
        const { x, y } = gridToScreen(tile.x, tile.y);
        const textureKey = `terrain_${tile.terrain_type}`;

        if (this.scene.textures.exists(textureKey)) {
          const sprite = this.scene.add.image(x, y, textureKey);
          sprite.setDepth((tile.x + tile.y) * DEPTH_Y_MULT);
          this.sprites.set(key, sprite);
        }
      }
    }

    // Remove sprites for tiles no longer visible
    for (const [key, sprite] of this.sprites) {
      if (!currentKeys.has(key)) {
        sprite.destroy();
        this.sprites.delete(key);
      }
    }
  }
}
```

### BuildingRenderer.ts
```typescript
import Phaser from 'phaser';
import { BuildingInstance } from '../../../../types/game';
import { gridToScreen } from '../utils/coordinates';
import { DEPTH_Y_MULT, TILE_HEIGHT } from '../gameConfig';

export class BuildingRenderer {
  private scene: Phaser.Scene;
  private sprites: Map<string, Phaser.GameObjects.Image> = new Map();
  private outlines: Map<string, Phaser.GameObjects.Image> = new Map();
  private activeCompanyId: string = '';

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  setActiveCompany(companyId: string): void {
    this.activeCompanyId = companyId;
  }

  updateBuildings(buildings: BuildingInstance[], tileMap: Map<string, { x: number; y: number }>): void {
    const currentIds = new Set<string>();

    for (const building of buildings) {
      currentIds.add(building.id);
      const tilePos = tileMap.get(building.tile_id);
      if (!tilePos) continue;

      const { x, y } = gridToScreen(tilePos.x, tilePos.y);
      const textureKey = building.is_collapsed ? 'building_demolished' : `building_${building.building_type_id}`;
      const depth = (tilePos.x + tilePos.y) * DEPTH_Y_MULT + 100;

      // Create or update sprite
      let sprite = this.sprites.get(building.id);
      if (!sprite && this.scene.textures.exists(textureKey)) {
        sprite = this.scene.add.image(x, y - TILE_HEIGHT, textureKey);
        sprite.setOrigin(0.5, 1); // Bottom center anchor
        this.sprites.set(building.id, sprite);
      }

      if (sprite) {
        sprite.setPosition(x, y);
        sprite.setDepth(depth);

        // Ownership outline
        const isOwned = building.company_id === this.activeCompanyId;
        if (isOwned && !building.is_collapsed) {
          this.addOutline(building.id, x, y, depth - 1, 0x3b82f6);
        } else {
          this.removeOutline(building.id);
        }

        // Damage tint
        if (building.damage_percent > 0) {
          const darkness = 1 - (building.damage_percent / 200);
          sprite.setTint(Phaser.Display.Color.GetColor(
            Math.floor(255 * darkness),
            Math.floor(255 * darkness),
            Math.floor(255 * darkness)
          ));
        } else {
          sprite.clearTint();
        }
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

  private addOutline(id: string, x: number, y: number, depth: number, color: number): void {
    let outline = this.outlines.get(id);
    if (!outline) {
      outline = this.scene.add.image(x, y, `outline_${id}`);
      outline.setOrigin(0.5, 1);
      this.outlines.set(id, outline);
    }
    outline.setPosition(x, y);
    outline.setDepth(depth);
    outline.setTint(color);
  }

  private removeOutline(id: string): void {
    const outline = this.outlines.get(id);
    if (outline) {
      outline.destroy();
      this.outlines.delete(id);
    }
  }
}
```

### MainScene.ts (updated)
```typescript
// Add to MainScene class:
private terrainRenderer!: TerrainRenderer;
private buildingRenderer!: BuildingRenderer;
private sceneData: SceneData | null = null;

create(): void {
  this.terrainRenderer = new TerrainRenderer(this);
  this.buildingRenderer = new BuildingRenderer(this);
}

setSceneData(data: SceneData): void {
  this.sceneData = data;
  this.buildingRenderer.setActiveCompany(data.activeCompanyId);

  // Create tile position lookup
  const tileMap = new Map<string, { x: number; y: number }>();
  data.tiles.forEach(t => tileMap.set(t.id, { x: t.x, y: t.y }));

  this.terrainRenderer.updateTiles(data.tiles);
  this.buildingRenderer.updateBuildings(data.buildings, tileMap);
}
```

## Database Changes
None

## Test Cases
1. **Terrain renders correctly**
   - Input: Tile with `terrain_type: 'water'`
   - Expected: Water sprite at correct isometric position

2. **Building depth sorting**
   - Input: Two buildings at (5,5) and (6,4)
   - Expected: Building at (5,5) renders behind (6,4)

3. **Ownership outline shows**
   - Input: Building with `company_id` matching `activeCompanyId`
   - Expected: Blue outline visible around building

4. **Damage tint applies**
   - Input: Building with `damage_percent: 50`
   - Expected: Building sprite darkened by 25%

## Acceptance Checklist
- [ ] All 5 terrain types render (free_land, water, road, dirt_track, trees)
- [ ] Buildings render at correct positions with bottom-center anchor
- [ ] Depth sorting works (back buildings behind front)
- [ ] Owned buildings show blue outline
- [ ] Damaged buildings show darkening
- [ ] Collapsed buildings show demolished sprite

## Deployment
```bash
npm run dev
# Test with existing game map data
```

## Handoff Notes
- `setSceneData()` method ready for React props sync in Stage 3
- Outline system uses simple tint (can enhance with shader later)
- Fire overlay deferred to Stage 3
