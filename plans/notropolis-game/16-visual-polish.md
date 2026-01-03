# Stage 16: Visual Polish - Isometric Zoomed View

## Objective

Implement the zoomed-in SimCity-style isometric building view with a two-mode interaction model:
- **Overview Mode:** Colored grid view (existing) - read-only, click to enter zoomed mode
- **Zoomed Mode:** Isometric view - where all property actions happen

## Dependencies

`[Requires: Stage 04 complete]` - Needs map viewer to extend.
`[Requires: Stage 16a complete]` - Asset requirements documented.
`[Requires: 17-asset-pipeline complete]` - Asset generation pipeline (in `/plans/notropolis-game/17-asset-pipeline/`), assets generated and in R2.

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
- **Clicking a tile opens a Property Modal** with all available actions
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
│  ┌─────────────────────────────────────────────────────────┐│
│  │                                                          ││
│  │              Isometric View (FULL SCREEN)               ││
│  │              Centered on (45,30)                        ││
│  │                                                          ││
│  │    [Back to Overview]     [Pan/Scroll - Wraps at edges] ││
│  │                                                          ││
│  │                    [Click any tile]                      ││
│  │                           ↓                              ││
│  │                ┌─────────────────────┐                   ││
│  │                │ PROPERTY MODAL  [X] │                   ││
│  │                │                     │                   ││
│  │                │  🏪 Building Name   │                   ││
│  │                │  Owner: CompanyName │                   ││
│  │                │  Health: 85%        │                   ││
│  │                │                     │                   ││
│  │                │  ┌───────────────┐  │                   ││
│  │                │  │   Action 1    │  │                   ││
│  │                │  └───────────────┘  │                   ││
│  │                │  ┌───────────────┐  │                   ││
│  │                │  │   Action 2    │  │                   ││
│  │                │  └───────────────┘  │                   ││
│  │                └─────────────────────┘                   ││
│  │                                                          ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Property Modal - Context-Dependent Actions

| Tile State | Modal Shows |
|------------|-------------|
| Unclaimed land | Terrain info, Buy Land button with price |
| Your property (empty) | Build options (list of available buildings) |
| Your property (building) | Building stats, Upgrade, Repair, Sell buttons |
| Enemy property | Building stats (if visible), Attack options, Spy |
| Special building (Bank) | Deposit/Withdraw interface |
| Special building (Temple) | Donate interface |
| Special building (Police) | Info only |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/GameMap.tsx` | Add view mode state, handle transitions, remove side panel |
| `src/components/game/MapCanvas.tsx` | Disable actions, add "click to zoom" behavior |

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/game/IsometricView.tsx` | Zoomed isometric canvas renderer |
| `src/components/game/IsometricTile.tsx` | Individual tile/building render |
| `src/components/game/PropertyModal.tsx` | Modal for tile actions (replaces side panel) |
| `src/utils/isometricRenderer.ts` | Isometric math utilities |
| `src/hooks/useIsometricAssets.ts` | Asset preloading hook |
| `migrations/0026_add_building_sprites.sql` | Sprite references in DB |

---

## Database Migration

```sql
-- 0026_add_building_sprites.sql

-- Add sprite reference to building types
ALTER TABLE building_types ADD COLUMN sprite_key TEXT;
ALTER TABLE building_types ADD COLUMN sprite_height INTEGER DEFAULT 64;

-- Update building types with sprite keys (WebP format from public R2 bucket)
UPDATE building_types SET sprite_key = 'buildings/building_market_stall.webp', sprite_height = 48 WHERE id = 'market_stall';
UPDATE building_types SET sprite_key = 'buildings/building_hot_dog_stand.webp', sprite_height = 48 WHERE id = 'hot_dog_stand';
UPDATE building_types SET sprite_key = 'buildings/building_campsite.webp', sprite_height = 48 WHERE id = 'campsite';
UPDATE building_types SET sprite_key = 'buildings/building_shop.webp', sprite_height = 64 WHERE id = 'shop';
UPDATE building_types SET sprite_key = 'buildings/building_burger_bar.webp', sprite_height = 64 WHERE id = 'burger_bar';
UPDATE building_types SET sprite_key = 'buildings/building_motel.webp', sprite_height = 80 WHERE id = 'motel';
UPDATE building_types SET sprite_key = 'buildings/building_high_street_store.webp', sprite_height = 96 WHERE id = 'high_street_store';
UPDATE building_types SET sprite_key = 'buildings/building_restaurant.webp', sprite_height = 96 WHERE id = 'restaurant';
UPDATE building_types SET sprite_key = 'buildings/building_manor.webp', sprite_height = 112 WHERE id = 'manor';
UPDATE building_types SET sprite_key = 'buildings/building_casino.webp', sprite_height = 128 WHERE id = 'casino';

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

// Background tile (large, sits behind everything)
export const GRASS_BACKGROUND = 'terrain/terrain_grass_bg.webp';

// Terrain sprite mapping (WebP format from public R2 bucket)
// Note: Road/dirt tiles are rotated in code based on connections
export const TERRAIN_SPRITES: Record<string, string> = {
  trees: 'terrain/terrain_trees.webp',
  water: 'terrain/terrain_water.webp',
  // Road tiles (rotated in code)
  road_straight: 'terrain/terrain_road_straight.webp',
  road_corner: 'terrain/terrain_road_corner.webp',
  road_tjunction: 'terrain/terrain_road_tjunction.webp',
  road_crossroad: 'terrain/terrain_road_crossroad.webp',
  road_end: 'terrain/terrain_road_end.webp',
  // Dirt tiles (rotated in code)
  dirt_straight: 'terrain/terrain_dirt_straight.webp',
  dirt_corner: 'terrain/terrain_dirt_corner.webp',
  dirt_tjunction: 'terrain/terrain_dirt_tjunction.webp',
  dirt_crossroad: 'terrain/terrain_dirt_crossroad.webp',
  dirt_end: 'terrain/terrain_dirt_end.webp',
};

// Special building sprites (WebP format from public R2 bucket)
export const SPECIAL_SPRITES: Record<string, string> = {
  temple: 'special/special_temple.webp',
  bank: 'special/special_bank.webp',
  police_station: 'special/special_police.webp',
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

  // Modal state - tile coordinates when modal is open, null when closed
  const [modalTile, setModalTile] = useState<{ x: number; y: number } | null>(null);

  // Handle click in overview mode - transition to zoomed
  const handleOverviewClick = (coords: { x: number; y: number }) => {
    setZoomCenter(coords);
    setViewMode('zoomed');
  };

  // Handle click in zoomed mode - open property modal
  const handleZoomedClick = (coords: { x: number; y: number }) => {
    setModalTile(coords);
  };

  // Close modal
  const handleCloseModal = () => {
    setModalTile(null);
  };

  // Return to overview
  const handleBackToOverview = () => {
    setViewMode('overview');
    setModalTile(null);
  };

  // ... loading/error handling ...

  const { map, tiles, buildings, playerTileCount, totalFreeLand } = mapData;

  return (
    <div className="h-screen bg-gray-900 relative">
      {/* Prison status banner */}
      {activeCompany.is_in_prison && (
        <div className="absolute top-0 left-0 right-0 z-50 p-4">
          <PrisonStatus ... />
        </div>
      )}

      {/* Full-screen map area */}
      <div className="h-full w-full relative overflow-hidden">
        {viewMode === 'overview' ? (
          <>
            <MapCanvas
              map={map}
              tiles={tiles}
              buildings={buildings}
              activeCompanyId={activeCompany.id}
              onTileClick={handleOverviewClick}
              readOnly={true}
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
              selectedTile={modalTile}
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

      {/* Property Modal - opens when tile is clicked in zoomed mode */}
      {modalTile && (
        <PropertyModal
          mapId={map.id}
          x={modalTile.x}
          y={modalTile.y}
          map={map}
          tiles={tiles}
          buildings={buildings}
          activeCompany={activeCompany}
          onClose={handleCloseModal}
          onRefresh={refetch}
        />
      )}
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

## PropertyModal Component

```tsx
// components/game/PropertyModal.tsx
interface PropertyModalProps {
  mapId: string;
  x: number;
  y: number;
  map: GameMap;
  tiles: Tile[];
  buildings: BuildingInstance[];
  activeCompany: Company;
  onClose: () => void;
  onRefresh: () => void;
}

export function PropertyModal({
  mapId,
  x,
  y,
  map,
  tiles,
  buildings,
  activeCompany,
  onClose,
  onRefresh,
}: PropertyModalProps): JSX.Element {
  // Find tile and building at this location
  const tile = tiles.find(t => t.x === x && t.y === y);
  const building = buildings.find(b => b.tile_id === tile?.id);

  // Determine ownership state
  const isOwned = tile?.owner_company_id === activeCompany.id;
  const isEnemyOwned = tile?.owner_company_id && tile.owner_company_id !== activeCompany.id;
  const isUnclaimed = !tile?.owner_company_id;
  const isSpecialBuilding = building?.building_type_id &&
    ['temple', 'bank', 'police_station'].includes(building.building_type_id);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div>
            <h2 className="text-lg font-bold text-white">
              {building ? building.name : tile?.terrain_type || 'Unknown'}
            </h2>
            <p className="text-sm text-gray-400">
              Position: ({x}, {y})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-3 -mr-2 hover:bg-gray-700 rounded-full transition-colors"
            aria-label="Close modal"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Tile/Building Info */}
          <div className="space-y-2">
            {tile?.owner_company_id && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Owner:</span>
                <span className={isOwned ? 'text-green-400' : 'text-red-400'}>
                  {isOwned ? 'You' : 'Enemy'}
                </span>
              </div>
            )}
            {building && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Health:</span>
                  <span className="text-white">{100 - (building.damage_percent || 0)}%</span>
                </div>
                {building.income_per_tick && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Income:</span>
                    <span className="text-green-400">${building.income_per_tick}/tick</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Actions - Context Dependent */}
          <div className="space-y-2 pt-2 border-t border-gray-700">
            {/* Unclaimed Land */}
            {isUnclaimed && (
              <button className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors">
                Buy Land - ${map.land_price}
              </button>
            )}

            {/* Your Empty Property */}
            {isOwned && !building && (
              <button className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                Build...
              </button>
            )}

            {/* Your Property with Building */}
            {isOwned && building && !isSpecialBuilding && (
              <>
                {building.damage_percent > 0 && (
                  <button className="w-full py-3 px-4 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors">
                    Repair - ${Math.ceil(building.damage_percent * 10)}
                  </button>
                )}
                <button className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors">
                  Upgrade
                </button>
                <button className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors">
                  Sell
                </button>
              </>
            )}

            {/* Enemy Property */}
            {isEnemyOwned && (
              <>
                <button className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors">
                  Attack...
                </button>
                <button className="w-full py-3 px-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors">
                  Spy
                </button>
              </>
            )}

            {/* Special Buildings */}
            {isSpecialBuilding && building?.building_type_id === 'bank' && (
              <>
                <button className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors">
                  Deposit
                </button>
                <button className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                  Withdraw
                </button>
              </>
            )}

            {isSpecialBuilding && building?.building_type_id === 'temple' && (
              <button className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors">
                Donate
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Modal Benefits

- **Mobile-first**: Large touch targets (44px+), no side panel eating screen space
- **Prominent X button**: Visible white icon in header, easy to tap
- **Focused interaction**: User attention on the selected property
- **Full map visible**: Map remains full-screen behind the modal
- **Easy dismiss**: Tap X, tap backdrop, or press Escape key
- **Context-aware**: Shows only relevant actions based on tile state

---

## Test Cases

| Test | Input | Expected Output |
|------|-------|-----------------|
| Overview click | Click tile at (45,30) | Transitions to zoomed mode centered on (45,30) |
| Zoomed tile click | Click tile in zoomed mode | Property modal opens with tile info |
| Modal backdrop click | Click outside modal | Modal closes |
| Modal escape key | Press Escape while modal open | Modal closes |
| Modal X button | Tap X button in header | Modal closes |
| Unclaimed land modal | Open modal on unclaimed tile | Shows "Buy Land" button |
| Own property modal | Open modal on your building | Shows Upgrade, Repair, Sell buttons |
| Enemy property modal | Open modal on enemy building | Shows Attack, Spy buttons |
| Special building modal | Open modal on Bank | Shows Deposit, Withdraw buttons |
| Pan right | Drag right | View shifts left, center updates |
| Pan wrap | Pan past edge | Map wraps seamlessly |
| Zoom in | Scroll up | Tiles get larger |
| Back button | Click "Back to Overview" | Returns to grid view, closes any open modal |
| Building sprite | Tile has building | Isometric building rendered |
| Ownership color | Owned tile | Green (self) or red (enemy) tint |

---

## Acceptance Checklist

- [ ] Overview mode shows colored grid (existing)
- [ ] Overview mode is read-only (no actions)
- [ ] Click in overview transitions to zoomed mode
- [ ] Zoomed mode shows isometric tiles (full-screen, no side panel)
- [ ] Buildings render as sprites on tiles
- [ ] Tiles sorted back-to-front correctly
- [ ] Ownership tint visible
- [ ] Damage/fire effects visible
- [ ] Selection highlight works on clicked tile
- [ ] Pan/scroll works with wrapping
- [ ] Click detection works in isometric view
- [ ] **Property modal opens on tile click**
- [ ] **Modal shows correct context-dependent actions**
- [ ] **Modal closes on X button tap, backdrop click, or Escape key**
- [ ] **Modal shows building stats (health, income, owner)**
- [ ] "Back to Overview" button works (and closes modal if open)
- [ ] Sprites preload with loading indicator
- [ ] Zoom in/out works

---

## Deployment

```bash
# 1. Upload sprites to R2 (see Stage 16a for structure)
# Use wrangler r2 or Cloudflare dashboard

# 2. Run migration
CLOUDFLARE_API_TOKEN="..." npx wrangler d1 execute notropolis-database --file=migrations/0026_add_building_sprites.sql --remote

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
| Pedestrian Walk N | `npc/ped_walk_n.webp` | 64x32 | 2 | Walking north - left foot, right foot |
| Pedestrian Walk S | `npc/ped_walk_s.webp` | 64x32 | 2 | Walking south - left foot, right foot |
| Pedestrian Walk E | `npc/ped_walk_e.webp` | 64x32 | 2 | Walking east - left foot, right foot |
| Pedestrian Walk W | `npc/ped_walk_w.webp` | 64x32 | 2 | Walking west - left foot, right foot |
| Car Drive N | `npc/car_n.webp` | 32x32 | 1 | Car facing north (static) |
| Car Drive S | `npc/car_s.webp` | 32x32 | 1 | Car facing south |
| Car Drive E | `npc/car_e.webp` | 32x32 | 1 | Car facing east |
| Car Drive W | `npc/car_w.webp` | 32x32 | 1 | Car facing west |

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

- **Two-mode model:** Overview = read-only, Zoomed = full-screen with modal for actions
- **Property Modal:** Opens on tile click, shows context-dependent actions, dismissible via backdrop/Escape/button
- **No side panel:** Zoomed mode uses full screen, modal overlays when needed (mobile-friendly)
- **Map wrapping:** Uses modulo arithmetic for seamless edge wrapping
- **Tile sorting:** Critical for proper isometric depth - back-to-front render order
- **Asset loading:** Async with loading state - don't render until sprites loaded
- **Performance:** Only render visible tiles (~15x15 viewport + buffer)
- **Fallback:** If sprite fails to load, skip it (don't crash)
- **Touch support:** Modal works well on touch; consider adding touch pan/pinch-zoom (future)
- **Event scenes:** Removed from this stage - can add later as Stage 16b
- **Ambient NPCs:** Optional enhancement - adds visual life but not required for MVP
