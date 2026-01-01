# Stage 16: Visual Polish - Isometric Zoomed View

## Objective

Implement the zoomed-in SimCity-style isometric building view with a two-mode interaction model:
- **Overview Mode:** Colored grid view (existing) - read-only, click to enter zoomed mode
- **Zoomed Mode:** Isometric view - where all property actions happen

## Dependencies

`[Requires: Stage 04 complete]` - Needs map viewer to extend.
`[Requires: Stage 16a complete]` - Asset requirements documented.
`[Requires: Stage 17 complete]` - Asset generation pipeline, assets generated and in R2.

## Asset Sources

All visual assets are generated via the **Stage 17 Asset Pipeline** and stored in R2:

**Pipeline:** [plans/notropolis-game/17-asset-pipeline/00-master-plan.md](17-asset-pipeline/00-master-plan.md)

**Two-Bucket Architecture:**

| Bucket | URL | Purpose |
|--------|-----|---------|
| Private | `notropolis-assets-private` | High-res originals (PNG), reference sheets |
| Public | `https://pub-874867b18f8b4b4882277d8a2b7dfe80.r2.dev/` | Game-ready WebP assets |

**Game loads from public bucket (WebP format):**

| Category | Path | Example Files |
|----------|------|---------------|
| Terrain | `/sprites/terrain/` | `terrain_grass.webp` (64×32) |
| Buildings | `/sprites/buildings/` | `building_restaurant.webp` (128-320px) |
| Effects | `/sprites/effects/` | `status_fire.webp`, `dirty_trick_arson.webp` |
| Overlays | `/sprites/overlays/` | `overlay_owned_self.webp` (64×32) |
| UI | `/sprites/ui/` | `ui_minimap_player.webp` (8×8) |
| NPCs | `/sprites/npc/` | `ped_walk_n.webp` (64×32 strip) |
| Scenes | `/scenes/` | `scene_prison.webp` (1280×720) |

**Private bucket stores:**
- Reference sheets at 3840×2160 PNG (4K, Nano Banana Pro max resolution)
- Raw sprites before background removal

## Complexity

**High** - Isometric rendering, two-mode interaction, map wrapping, asset management.

---

## Interaction Model

### Overview Mode (Existing MapCanvas)
- Shows entire map as colored grid (current implementation)
- **READ-ONLY** - no actions available
- Clicking a tile → transitions to Zoomed Mode centered on that tile
- Shows ownership colors, terrain types
- Mini-map style navigation

### Zoomed Mode (New IsometricView)
- Shows ~15x15 tile area in isometric perspective
- Isometric building sprites rendered on tiles
- **ALL ACTIONS AVAILABLE** - buy land, build, attack, etc.
- Pan/scroll to move around the map
- **Map wraps** at edges (continuous scrolling)
- "Back to Overview" button to return

### Navigation Flow
```
┌─────────────────────────────────────────────────────────────┐
│                     OVERVIEW MODE                            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                                                      │    │
│  │         Colored Grid Map (100x100)                  │    │
│  │         Click any tile to zoom in                   │    │
│  │                                                      │    │
│  │              [Click Tile at 45,30]                  │    │
│  │                       ↓                              │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                      ZOOMED MODE                             │
│  ┌───────────────────────────────────┐ ┌──────────────────┐ │
│  │                                    │ │   Tile Info      │ │
│  │    Isometric View (~15x15)        │ │   - Buy Land     │ │
│  │    Centered on (45,30)            │ │   - Build        │ │
│  │                                    │ │   - Attack       │ │
│  │    [Pan/Scroll - Wraps at edges]  │ │   - Sell         │ │
│  │                                    │ │                  │ │
│  │    [Click tile for actions]       │ │   [Back to       │ │
│  │                                    │ │    Overview]     │ │
│  └───────────────────────────────────┘ └──────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/GameMap.tsx` | Add view mode state, handle transitions |
| `src/components/game/MapCanvas.tsx` | Disable actions, add "click to zoom" behavior |
| `src/components/game/TileInfo.tsx` | Only show actions in zoomed mode |

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/game/IsometricView.tsx` | Zoomed isometric canvas renderer |
| `src/components/game/IsometricTile.tsx` | Individual tile/building render |
| `src/utils/isometricRenderer.ts` | Isometric math utilities |
| `src/hooks/useIsometricAssets.ts` | Asset preloading hook |
| `migrations/0023_add_building_sprites.sql` | Sprite references in DB |

---

## Database Migration

```sql
-- 0023_add_building_sprites.sql

-- Add sprite reference to building types
ALTER TABLE building_types ADD COLUMN sprite_key TEXT;
ALTER TABLE building_types ADD COLUMN sprite_height INTEGER DEFAULT 64;

-- Update building types with sprite keys
UPDATE building_types SET sprite_key = 'buildings/building_market_stall.png', sprite_height = 48 WHERE id = 'market_stall';
UPDATE building_types SET sprite_key = 'buildings/building_hot_dog_stand.png', sprite_height = 48 WHERE id = 'hot_dog_stand';
UPDATE building_types SET sprite_key = 'buildings/building_campsite.png', sprite_height = 48 WHERE id = 'campsite';
UPDATE building_types SET sprite_key = 'buildings/building_shop.png', sprite_height = 64 WHERE id = 'shop';
UPDATE building_types SET sprite_key = 'buildings/building_burger_bar.png', sprite_height = 64 WHERE id = 'burger_bar';
UPDATE building_types SET sprite_key = 'buildings/building_motel.png', sprite_height = 80 WHERE id = 'motel';
UPDATE building_types SET sprite_key = 'buildings/building_high_street_store.png', sprite_height = 96 WHERE id = 'high_street_store';
UPDATE building_types SET sprite_key = 'buildings/building_restaurant.png', sprite_height = 96 WHERE id = 'restaurant';
UPDATE building_types SET sprite_key = 'buildings/building_manor.png', sprite_height = 112 WHERE id = 'manor';
UPDATE building_types SET sprite_key = 'buildings/building_casino.png', sprite_height = 128 WHERE id = 'casino';

-- Terrain sprite mapping (stored in code, not DB)
-- Special buildings sprite mapping (temple, bank, police - stored in code)
```

---

## Implementation Details

### Isometric Constants

```typescript
// utils/isometricRenderer.ts

export const ISO_TILE_WIDTH = 64;
export const ISO_TILE_HEIGHT = 32;
export const VIEWPORT_TILES = 15; // Show ~15x15 tiles in view

// R2 base URL for game-ready sprites
// Originals stored in /originals/, game loads from /sprites/
export const SPRITE_BASE_URL = 'https://pub-874867b18f8b4b4882277d8a2b7dfe80.r2.dev/sprites';

// Terrain sprite mapping
export const TERRAIN_SPRITES: Record<string, string> = {
  free_land: 'terrain/terrain_grass.png',
  water: 'terrain/terrain_water.png',
  road: 'terrain/terrain_road.png',
  dirt_track: 'terrain/terrain_dirt.png',
  trees: 'terrain/terrain_trees.png',
  mountain: 'terrain/terrain_mountain.png',
  sand: 'terrain/terrain_sand.png',
};

// Special building sprites
export const SPECIAL_SPRITES: Record<string, string> = {
  temple: 'special/special_temple.png',
  bank: 'special/special_bank.png',
  police_station: 'special/special_police.png',
};
```

### Coordinate Conversion

```typescript
// Grid (x,y) to screen position
export function gridToScreen(
  gridX: number,
  gridY: number,
  centerX: number,
  centerY: number,
  zoom: number = 1
): { screenX: number; screenY: number } {
  const isoX = (gridX - gridY) * (ISO_TILE_WIDTH / 2) * zoom;
  const isoY = (gridX + gridY) * (ISO_TILE_HEIGHT / 2) * zoom;

  return {
    screenX: centerX + isoX,
    screenY: centerY + isoY,
  };
}

// Screen position to grid (x,y)
export function screenToGrid(
  screenX: number,
  screenY: number,
  centerX: number,
  centerY: number,
  zoom: number = 1
): { gridX: number; gridY: number } {
  const relX = (screenX - centerX) / zoom;
  const relY = (screenY - centerY) / zoom;

  const gridX = Math.floor((relX / (ISO_TILE_WIDTH / 2) + relY / (ISO_TILE_HEIGHT / 2)) / 2);
  const gridY = Math.floor((relY / (ISO_TILE_HEIGHT / 2) - relX / (ISO_TILE_WIDTH / 2)) / 2);

  return { gridX, gridY };
}

// Wrap coordinates for infinite scrolling
export function wrapCoordinate(coord: number, mapSize: number): number {
  return ((coord % mapSize) + mapSize) % mapSize;
}
```

### Tile Sorting for Rendering

```typescript
// Sort tiles back-to-front for proper overlap
export function sortTilesForRendering(
  tiles: Array<{ x: number; y: number }>,
  viewCenterX: number,
  viewCenterY: number,
  mapWidth: number,
  mapHeight: number
): Array<{ x: number; y: number }> {
  return [...tiles].sort((a, b) => {
    // Depth = x + y (tiles further back have lower sum)
    const depthA = a.x + a.y;
    const depthB = b.x + b.y;
    if (depthA !== depthB) return depthA - depthB;
    // Same depth: sort by x
    return a.x - b.x;
  });
}
```

---

### GameMap Page (Updated)

```tsx
// pages/GameMap.tsx
export function GameMap(): JSX.Element {
  const { mapId } = useParams<{ mapId: string }>();
  const { activeCompany, refreshCompany } = useActiveCompany();
  const { mapData, isLoading, error, refetch } = useGameMap(mapId);

  // View mode: 'overview' (grid) or 'zoomed' (isometric)
  const [viewMode, setViewMode] = useState<'overview' | 'zoomed'>('overview');
  const [zoomCenter, setZoomCenter] = useState<{ x: number; y: number } | null>(null);
  const [selectedTile, setSelectedTile] = useState<{ x: number; y: number } | null>(null);

  // Handle click in overview mode - transition to zoomed
  const handleOverviewClick = (coords: { x: number; y: number }) => {
    setZoomCenter(coords);
    setSelectedTile(coords);
    setViewMode('zoomed');
  };

  // Handle click in zoomed mode - select tile for actions
  const handleZoomedClick = (coords: { x: number; y: number }) => {
    setSelectedTile(coords);
  };

  // Return to overview
  const handleBackToOverview = () => {
    setViewMode('overview');
    setSelectedTile(null);
  };

  // ... loading/error handling ...

  const { map, tiles, buildings, playerTileCount, totalFreeLand } = mapData;

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Prison status banner */}
      {activeCompany.is_in_prison && (
        <div className="absolute top-0 left-0 right-0 z-50 p-4">
          <PrisonStatus ... />
        </div>
      )}

      {/* Main map area */}
      <div className="flex-1 relative overflow-hidden">
        {viewMode === 'overview' ? (
          <>
            <MapCanvas
              map={map}
              tiles={tiles}
              buildings={buildings}
              activeCompanyId={activeCompany.id}
              onTileClick={handleOverviewClick}
              readOnly={true} // Disable actions in overview
            />
            <div className="absolute bottom-4 left-4 bg-gray-800/90 px-4 py-2 rounded-lg">
              <p className="text-gray-300 text-sm">Click any tile to zoom in</p>
            </div>
          </>
        ) : (
          <>
            <IsometricView
              map={map}
              tiles={tiles}
              buildings={buildings}
              activeCompanyId={activeCompany.id}
              centerTile={zoomCenter!}
              selectedTile={selectedTile}
              onTileClick={handleZoomedClick}
              onCenterChange={setZoomCenter}
            />
            <button
              onClick={handleBackToOverview}
              className="absolute top-4 left-4 z-10 flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Overview
            </button>
          </>
        )}

        <MapControls ... />
        <MapLegend />
      </div>

      {/* Side panel - only show actions in zoomed mode */}
      <div className="w-80 bg-gray-800 border-l border-gray-700 overflow-y-auto">
        {viewMode === 'zoomed' && selectedTile ? (
          <TileInfo
            mapId={map.id}
            x={selectedTile.x}
            y={selectedTile.y}
            map={map}
            onClose={() => setSelectedTile(null)}
            onRefresh={refetch}
            actionsEnabled={true}
          />
        ) : viewMode === 'overview' ? (
          <MapOverview
            map={map}
            totalTiles={tiles.length}
            ownedTiles={playerTileCount}
            totalFreeLand={totalFreeLand}
          />
        ) : (
          <div className="p-4 text-gray-400">
            <p>Click a tile to see details and actions</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### Isometric View Component

```tsx
// components/game/IsometricView.tsx
interface IsometricViewProps {
  map: GameMap;
  tiles: Tile[];
  buildings: BuildingInstance[];
  activeCompanyId: string;
  centerTile: { x: number; y: number };
  selectedTile: { x: number; y: number } | null;
  onTileClick: (coords: { x: number; y: number }) => void;
  onCenterChange: (coords: { x: number; y: number }) => void;
}

export function IsometricView({
  map,
  tiles,
  buildings,
  activeCompanyId,
  centerTile,
  selectedTile,
  onTileClick,
  onCenterChange,
}: IsometricViewProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  // Preload sprites
  const { sprites, isLoading: spritesLoading } = useIsometricAssets(tiles, buildings);

  // Build lookup maps
  const tileMap = useMemo(() => {
    const m = new Map<string, Tile>();
    tiles.forEach(t => m.set(`${t.x},${t.y}`, t));
    return m;
  }, [tiles]);

  const buildingMap = useMemo(() => {
    const m = new Map<string, BuildingInstance>();
    buildings.forEach(b => m.set(b.tile_id, b));
    return m;
  }, [buildings]);

  // Get visible tiles (viewport + buffer for smooth scrolling)
  const visibleTiles = useMemo(() => {
    const result: Array<{ x: number; y: number }> = [];
    const radius = Math.ceil(VIEWPORT_TILES / 2) + 2;

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const x = wrapCoordinate(centerTile.x + dx, map.width);
        const y = wrapCoordinate(centerTile.y + dy, map.height);
        result.push({ x, y });
      }
    }

    return sortTilesForRendering(result, centerTile.x, centerTile.y, map.width, map.height);
  }, [centerTile, map.width, map.height]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || spritesLoading) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const screenCenterX = canvas.width / 2 + panOffset.x;
    const screenCenterY = canvas.height / 3 + panOffset.y; // Offset up for better view

    // Render each visible tile
    for (const { x, y } of visibleTiles) {
      const tile = tileMap.get(`${x},${y}`);
      if (!tile) continue;

      // Calculate relative position from center
      let relX = x - centerTile.x;
      let relY = y - centerTile.y;

      // Handle wrapping
      if (relX > map.width / 2) relX -= map.width;
      if (relX < -map.width / 2) relX += map.width;
      if (relY > map.height / 2) relY -= map.height;
      if (relY < -map.height / 2) relY += map.height;

      const { screenX, screenY } = gridToScreen(relX, relY, screenCenterX, screenCenterY, zoom);

      // Draw terrain
      const terrainKey = TERRAIN_SPRITES[tile.terrain_type] || TERRAIN_SPRITES.free_land;
      const terrainSprite = sprites.get(terrainKey);
      if (terrainSprite) {
        ctx.drawImage(
          terrainSprite,
          screenX - (ISO_TILE_WIDTH * zoom) / 2,
          screenY,
          ISO_TILE_WIDTH * zoom,
          ISO_TILE_HEIGHT * zoom
        );
      }

      // Draw ownership overlay
      if (tile.owner_company_id) {
        ctx.fillStyle = tile.owner_company_id === activeCompanyId
          ? 'rgba(34, 197, 94, 0.3)'
          : 'rgba(239, 68, 68, 0.3)';
        drawIsoDiamond(ctx, screenX, screenY, ISO_TILE_WIDTH * zoom, ISO_TILE_HEIGHT * zoom);
      }

      // Draw building
      const building = buildingMap.get(tile.id);
      if (building && building.sprite_key) {
        const buildingSprite = sprites.get(building.sprite_key);
        if (buildingSprite) {
          const spriteHeight = (building.sprite_height || 64) * zoom;
          const spriteWidth = ISO_TILE_WIDTH * zoom;

          ctx.drawImage(
            buildingSprite,
            screenX - spriteWidth / 2,
            screenY - spriteHeight + (ISO_TILE_HEIGHT * zoom),
            spriteWidth,
            spriteHeight
          );

          // Damage overlay
          if (building.damage_percent > 0) {
            ctx.fillStyle = `rgba(0, 0, 0, ${building.damage_percent / 200})`;
            ctx.fillRect(
              screenX - spriteWidth / 2,
              screenY - spriteHeight + (ISO_TILE_HEIGHT * zoom),
              spriteWidth,
              spriteHeight
            );
          }

          // Fire effect
          if (building.is_on_fire) {
            ctx.fillStyle = 'rgba(255, 100, 0, 0.4)';
            ctx.fillRect(
              screenX - spriteWidth / 2,
              screenY - spriteHeight + (ISO_TILE_HEIGHT * zoom),
              spriteWidth,
              spriteHeight
            );
          }
        }
      }

      // Selection highlight
      if (selectedTile && x === selectedTile.x && y === selectedTile.y) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        drawIsoDiamondOutline(ctx, screenX, screenY, ISO_TILE_WIDTH * zoom, ISO_TILE_HEIGHT * zoom);
      }
    }
  }, [visibleTiles, sprites, spritesLoading, tileMap, buildingMap, activeCompanyId, centerTile, zoom, panOffset, selectedTile, map.width, map.height]);

  // Handle canvas resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas || !canvas.parentElement) return;
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mouse handlers for pan/click
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    setDragStart({ x: e.clientX, y: e.clientY });

    // Update center tile when panned far enough
    const threshold = ISO_TILE_WIDTH * zoom;
    if (Math.abs(panOffset.x) > threshold || Math.abs(panOffset.y) > threshold) {
      const tileShiftX = Math.round(panOffset.x / threshold);
      const tileShiftY = Math.round(panOffset.y / threshold);

      if (tileShiftX !== 0 || tileShiftY !== 0) {
        const newX = wrapCoordinate(centerTile.x - tileShiftX, map.width);
        const newY = wrapCoordinate(centerTile.y - tileShiftY, map.height);
        onCenterChange({ x: newX, y: newY });
        setPanOffset({ x: 0, y: 0 });
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isDragging) {
      const dx = Math.abs(e.clientX - dragStart.x);
      const dy = Math.abs(e.clientY - dragStart.y);

      // Only trigger click if mouse didn't move much
      if (dx < 5 && dy < 5) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const screenCenterX = rect.width / 2 + panOffset.x;
          const screenCenterY = rect.height / 3 + panOffset.y;

          const { gridX, gridY } = screenToGrid(
            e.clientX - rect.left,
            e.clientY - rect.top,
            screenCenterX,
            screenCenterY,
            zoom
          );

          const x = wrapCoordinate(centerTile.x + gridX, map.width);
          const y = wrapCoordinate(centerTile.y + gridY, map.height);

          onTileClick({ x, y });
        }
      }
    }
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(z => Math.max(0.5, Math.min(2, z + delta)));
  };

  if (spritesLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white">Loading assets...</p>
        </div>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={isDragging ? 'cursor-grabbing' : 'cursor-grab'}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => setIsDragging(false)}
      onWheel={handleWheel}
    />
  );
}

// Helper: Draw filled isometric diamond
function drawIsoDiamond(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  width: number,
  height: number
) {
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(centerX + width / 2, centerY + height / 2);
  ctx.lineTo(centerX, centerY + height);
  ctx.lineTo(centerX - width / 2, centerY + height / 2);
  ctx.closePath();
  ctx.fill();
}

// Helper: Draw outlined isometric diamond
function drawIsoDiamondOutline(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  width: number,
  height: number
) {
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(centerX + width / 2, centerY + height / 2);
  ctx.lineTo(centerX, centerY + height);
  ctx.lineTo(centerX - width / 2, centerY + height / 2);
  ctx.closePath();
  ctx.stroke();
}
```

---

### Asset Preloading Hook

```typescript
// hooks/useIsometricAssets.ts
export function useIsometricAssets(
  tiles: Tile[],
  buildings: BuildingInstance[]
): { sprites: Map<string, HTMLImageElement>; isLoading: boolean } {
  const [sprites, setSprites] = useState<Map<string, HTMLImageElement>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSprites = async () => {
      setIsLoading(true);
      const spriteUrls = new Set<string>();

      // Add terrain sprites
      Object.values(TERRAIN_SPRITES).forEach(key => spriteUrls.add(key));

      // Add building sprites
      buildings.forEach(b => {
        if (b.sprite_key) spriteUrls.add(b.sprite_key);
      });

      // Add special building sprites
      Object.values(SPECIAL_SPRITES).forEach(key => spriteUrls.add(key));

      // Load all sprites
      const loaded = new Map<string, HTMLImageElement>();

      await Promise.all(
        Array.from(spriteUrls).map(async (key) => {
          try {
            const img = await loadImage(`${SPRITE_BASE_URL}/${key}`);
            loaded.set(key, img);
          } catch (err) {
            console.warn(`Failed to load sprite: ${key}`, err);
            // Continue without this sprite
          }
        })
      );

      setSprites(loaded);
      setIsLoading(false);
    };

    loadSprites();
  }, [buildings]);

  return { sprites, isLoading };
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
```

---

## TileInfo Changes

```tsx
// components/game/TileInfo.tsx - Updated
interface TileInfoProps {
  // ... existing props
  actionsEnabled?: boolean; // New prop
}

export function TileInfo({ ..., actionsEnabled = true }: TileInfoProps) {
  // ... existing code

  // Only show action buttons if actionsEnabled is true
  return (
    <div className="p-4">
      {/* Tile info display - always shown */}
      <div className="mb-4">
        <h3>{tile.terrain_type}</h3>
        <p>Owner: {tile.owner_company_id || 'Unclaimed'}</p>
        {/* etc */}
      </div>

      {/* Actions - only in zoomed mode */}
      {actionsEnabled && (
        <div className="space-y-2">
          {/* Buy Land button */}
          {/* Build button */}
          {/* Attack button */}
          {/* Sell button */}
          {/* etc */}
        </div>
      )}

      {!actionsEnabled && (
        <p className="text-gray-500 text-sm italic">
          Click tile to zoom in and access actions
        </p>
      )}
    </div>
  );
}
```

---

## Test Cases

| Test | Input | Expected Output |
|------|-------|-----------------|
| Overview click | Click tile at (45,30) | Transitions to zoomed mode centered on (45,30) |
| Zoomed select | Click different tile | Selection moves, TileInfo updates |
| Pan right | Drag right | View shifts left, center updates |
| Pan wrap | Pan past edge | Map wraps seamlessly |
| Zoom in | Scroll up | Tiles get larger |
| Back button | Click "Back to Overview" | Returns to grid view |
| Actions disabled | In overview mode | No action buttons shown |
| Actions enabled | In zoomed mode | All action buttons available |
| Building sprite | Tile has building | Isometric building rendered |
| Ownership color | Owned tile | Green (self) or red (enemy) tint |

---

## Acceptance Checklist

- [ ] Overview mode shows colored grid (existing)
- [ ] Overview mode is read-only (no actions)
- [ ] Click in overview transitions to zoomed mode
- [ ] Zoomed mode shows isometric tiles
- [ ] Buildings render as sprites on tiles
- [ ] Tiles sorted back-to-front correctly
- [ ] Ownership tint visible
- [ ] Damage/fire effects visible
- [ ] Selection highlight works
- [ ] Pan/scroll works with wrapping
- [ ] Click detection works in isometric view
- [ ] Actions available in zoomed mode
- [ ] "Back to Overview" button works
- [ ] Sprites preload with loading indicator
- [ ] Zoom in/out works

---

## Deployment

```bash
# 1. Upload sprites to R2 (see Stage 16a for structure)
# Use wrangler r2 or Cloudflare dashboard

# 2. Run migration
CLOUDFLARE_API_TOKEN="..." npx wrangler d1 execute notropolis-database --file=migrations/0023_add_building_sprites.sql --remote

# 3. Deploy worker (if any API changes)
cd worker && CLOUDFLARE_API_TOKEN="..." npx wrangler deploy && cd ..

# 4. Build and deploy frontend
npm run build
CLOUDFLARE_API_TOKEN="..." CLOUDFLARE_ACCOUNT_ID="..." npx wrangler pages deploy ./dist --project-name=notropolis-dashboard
```

---

## Optional Enhancement: Ambient NPCs & Vehicles

Animated pedestrians and cars moving along roads to bring the city to life.

### Asset Requirements

| Asset | Filename | Dimensions | Frames | Description |
|-------|----------|------------|--------|-------------|
| Pedestrian Walk N | `npc/ped_walk_n.png` | 64x32 | 2 | Walking north - left foot, right foot |
| Pedestrian Walk S | `npc/ped_walk_s.png` | 64x32 | 2 | Walking south - left foot, right foot |
| Pedestrian Walk E | `npc/ped_walk_e.png` | 64x32 | 2 | Walking east - left foot, right foot |
| Pedestrian Walk W | `npc/ped_walk_w.png` | 64x32 | 2 | Walking west - left foot, right foot |
| Car Drive N | `npc/car_n.png` | 32x32 | 1 | Car facing north (static) |
| Car Drive S | `npc/car_s.png` | 32x32 | 1 | Car facing south |
| Car Drive E | `npc/car_e.png` | 32x32 | 1 | Car facing east |
| Car Drive W | `npc/car_w.png` | 32x32 | 1 | Car facing west |

**Sprite sheet format:**
- Pedestrians: 2-frame horizontal strip (64x32 total), each frame 32x32px
- Frame 1: Left foot forward, right arm forward
- Frame 2: Right foot forward, left arm forward
- Toggle between frames every 200ms for natural walk cycle
- PNG with transparency, isometric perspective

### Implementation Approach

```typescript
// Ambient entity types
interface AmbientEntity {
  id: string;
  type: 'pedestrian' | 'car';
  x: number;           // Current tile X (float for smooth movement)
  y: number;           // Current tile Y (float for smooth movement)
  direction: 'n' | 's' | 'e' | 'w';
  frame: number;       // Animation frame (0-1 for pedestrians, toggles)
  speed: number;       // Tiles per second (0.5 for peds, 2 for cars)
}

// Configuration
const MAX_PEDESTRIANS = 15;
const MAX_CARS = 8;
const SPAWN_INTERVAL_MS = 2000;
const FRAME_DURATION_MS = 200;  // Toggle walk frame every 200ms
```

### Movement Rules

Road tiles include both road (center) and sidewalks (edges) - see Stage 16a asset spec.

**Cars:**
- Move on `road` tiles, rendered on the center (asphalt) portion
- Follow connected road tiles in their direction
- Despawn when they reach a road dead-end or leave viewport

**Pedestrians:**
- Move on `road` tiles, rendered on the sidewalk (edge) portion
- Offset ~8px from tile center toward the edge to stay on sidewalk
- Never walk through buildings
- Can also walk on `free_land` tiles (grass areas between buildings)
- Despawn when leaving viewport

```typescript
// Check if tile is valid for entity type
function canEntityMoveTo(tile: Tile, entityType: 'pedestrian' | 'car', buildings: Map<string, Building>): boolean {
  // Neither can walk through buildings
  if (buildings.has(tile.id)) return false;

  if (entityType === 'car') {
    return tile.terrain_type === 'road';
  }

  // Pedestrians: can walk on roads (sidewalk) or free_land
  return tile.terrain_type === 'road' || tile.terrain_type === 'free_land';
}

// Offset pedestrian position to sidewalk edge of road tile
function getPedestrianOffset(direction: 'n' | 's' | 'e' | 'w'): { x: number; y: number } {
  const SIDEWALK_OFFSET = 8; // pixels from center
  switch (direction) {
    case 'n': case 's': return { x: SIDEWALK_OFFSET, y: 0 };  // Walk on right sidewalk
    case 'e': case 'w': return { x: 0, y: SIDEWALK_OFFSET };  // Walk on bottom sidewalk
  }
}
```

### Spawn Logic

**Cars:**
1. Find road tiles at viewport edges
2. Spawn car moving inward along the road center
3. Follow road tiles until reaching dead end or leaving viewport

**Pedestrians:**
1. Find road tiles at viewport edges
2. Spawn pedestrian on the sidewalk (offset from center)
3. Follow road tiles, staying on sidewalk
4. Can detour through free_land to walk between buildings

### Render Order

Entities render with proper depth sorting so they appear behind/in front of buildings correctly:
```
1. Terrain tiles (back to front by Y)
2. For each Y row (back to front):
   - Ambient entities at this Y
   - Buildings at this Y
3. Selection highlight (on top)
```

This ensures pedestrians walking between two buildings render correctly - behind the front building, in front of the back building.

### Performance Budget

- Max 20-25 entities visible at once
- Only animate entities in viewport
- Use `requestAnimationFrame` for smooth 60fps
- Pool entity objects to avoid GC pressure

---

## Handoff Notes

- **Two-mode model:** Overview = read-only, Zoomed = actions
- **Map wrapping:** Uses modulo arithmetic for seamless edge wrapping
- **Tile sorting:** Critical for proper isometric depth - back-to-front render order
- **Asset loading:** Async with loading state - don't render until sprites loaded
- **Performance:** Only render visible tiles (~15x15 viewport + buffer)
- **Fallback:** If sprite fails to load, skip it (don't crash)
- **Touch support:** Consider adding touch pan/pinch-zoom for mobile (future)
- **Event scenes:** Removed from this stage - can add later as Stage 16b
- **Ambient NPCs:** Optional enhancement - adds visual life but not required for MVP
