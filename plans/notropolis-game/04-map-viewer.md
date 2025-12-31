# Stage 04: Map Viewer

## Objective

Create a player-facing map view showing the game grid with terrain, ownership, and buildings.

## Dependencies

`[Requires: Stage 01 complete]` - Needs maps and tiles tables.
`[Requires: Stage 02 complete]` - Needs maps to exist.
`[Requires: Stage 03 complete]` - Needs active company context.

## Complexity

**High** - Performance-critical rendering, ownership colors, interaction handling.

## Files to Modify

| File | Changes |
|------|---------|
| `authentication-dashboard-system/src/App.tsx` | Add map route |
| `authentication-dashboard-system/src/pages/CompanyDashboard.tsx` | Link to map view |

## Files to Create

| File | Purpose |
|------|---------|
| `authentication-dashboard-system/src/pages/GameMap.tsx` | Main map page |
| `authentication-dashboard-system/src/components/game/MapCanvas.tsx` | Canvas-based map renderer |
| `authentication-dashboard-system/src/components/game/TileInfo.tsx` | Selected tile details panel |
| `authentication-dashboard-system/src/components/game/MapLegend.tsx` | Color legend |
| `authentication-dashboard-system/src/components/game/MapControls.tsx` | Zoom/pan controls |
| `authentication-dashboard-system/src/hooks/useGameMap.ts` | Map data fetching/caching |
| `authentication-dashboard-system/src/api/game/maps.ts` | Map API client |
| `authentication-dashboard-system/src/utils/mapRenderer.ts` | Canvas rendering utilities |

## Implementation Details

### API Endpoints

```typescript
// GET /api/game/maps/:id - Get map with all tiles
interface MapResponse {
  map: GameMap;
  tiles: Tile[];
  buildings: BuildingInstance[]; // All buildings on this map
  playerTileCount: number; // Tiles owned by active company
  totalFreeLand: number;
}

// GET /api/game/maps/:id/tile/:x/:y - Get single tile details
interface TileDetailResponse {
  tile: Tile;
  building?: BuildingInstance & { type: BuildingType };
  owner?: { name: string }; // Company name only (anonymous)
  security?: BuildingSecurity;
}
```

### Map Page Layout

```tsx
// GameMap.tsx
export function GameMap() {
  const { activeCompany } = useCompany();
  const { mapId } = useParams();
  const { map, tiles, buildings, isLoading } = useGameMap(mapId);
  const [selectedTile, setSelectedTile] = useState<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  if (!activeCompany?.current_map_id) {
    return <Navigate to="/companies" />;
  }

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="flex h-full">
      {/* Main map area */}
      <div className="flex-1 relative overflow-hidden bg-gray-900">
        <MapCanvas
          map={map}
          tiles={tiles}
          buildings={buildings}
          activeCompanyId={activeCompany.id}
          zoom={zoom}
          offset={offset}
          onTileClick={setSelectedTile}
          onPan={setOffset}
          onZoom={setZoom}
        />

        <MapControls
          zoom={zoom}
          onZoomIn={() => setZoom(z => Math.min(4, z + 0.5))}
          onZoomOut={() => setZoom(z => Math.max(0.5, z - 0.5))}
          onReset={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}
        />

        <MapLegend />
      </div>

      {/* Side panel */}
      <div className="w-80 bg-gray-800 border-l border-gray-700 overflow-y-auto">
        {selectedTile ? (
          <TileInfo
            mapId={mapId}
            x={selectedTile.x}
            y={selectedTile.y}
            onClose={() => setSelectedTile(null)}
          />
        ) : (
          <MapOverview
            map={map}
            totalTiles={tiles.length}
            ownedTiles={tiles.filter(t => t.owner_company_id === activeCompany.id).length}
          />
        )}
      </div>
    </div>
  );
}
```

### Canvas Renderer

```typescript
// utils/mapRenderer.ts
export const TILE_SIZE = 12;

export const TERRAIN_COLORS = {
  free_land: '#3d5c3d',      // Muted green
  water: '#2563eb',          // Blue
  road: '#4b5563',           // Gray
  dirt_track: '#92400e',     // Brown
  trees: '#166534',          // Dark green
};

export const SPECIAL_COLORS = {
  temple: '#fbbf24',         // Gold
  bank: '#94a3b8',           // Silver
  police_station: '#3b82f6', // Blue
};

export function renderMap(
  ctx: CanvasRenderingContext2D,
  map: GameMap,
  tiles: Map<string, Tile>,
  buildings: Map<string, BuildingInstance>,
  activeCompanyId: string,
  zoom: number,
  offset: { x: number; y: number }
) {
  const tileSize = TILE_SIZE * zoom;

  // Clear
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // Calculate visible range
  const startX = Math.max(0, Math.floor(-offset.x / tileSize));
  const startY = Math.max(0, Math.floor(-offset.y / tileSize));
  const endX = Math.min(map.width, Math.ceil((ctx.canvas.width - offset.x) / tileSize));
  const endY = Math.min(map.height, Math.ceil((ctx.canvas.height - offset.y) / tileSize));

  // Render visible tiles
  for (let x = startX; x < endX; x++) {
    for (let y = startY; y < endY; y++) {
      const tile = tiles.get(`${x},${y}`);
      if (!tile) continue;

      const px = x * tileSize + offset.x;
      const py = y * tileSize + offset.y;

      // Base terrain color
      let color = tile.special_building
        ? SPECIAL_COLORS[tile.special_building]
        : TERRAIN_COLORS[tile.terrain_type];

      // Ownership overlay
      if (tile.owner_company_id) {
        if (tile.owner_company_id === activeCompanyId) {
          color = blendColors(color, '#22c55e', 0.4); // Green tint for own
        } else {
          color = blendColors(color, '#ef4444', 0.3); // Red tint for others
        }
      }

      // Draw tile
      ctx.fillStyle = color;
      ctx.fillRect(px, py, tileSize - 1, tileSize - 1);

      // Building indicator (small dot)
      const building = buildings.get(tile.id);
      if (building) {
        ctx.fillStyle = building.is_on_fire ? '#ef4444' : '#ffffff';
        ctx.beginPath();
        ctx.arc(px + tileSize / 2, py + tileSize / 2, tileSize / 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function blendColors(base: string, overlay: string, amount: number): string {
  // Simple color blending
  const b = hexToRgb(base);
  const o = hexToRgb(overlay);
  const r = Math.round(b.r * (1 - amount) + o.r * amount);
  const g = Math.round(b.g * (1 - amount) + o.g * amount);
  const bl = Math.round(b.b * (1 - amount) + o.b * amount);
  return `rgb(${r},${g},${bl})`;
}
```

### Map Canvas Component

```tsx
// MapCanvas.tsx
export function MapCanvas({
  map, tiles, buildings, activeCompanyId,
  zoom, offset, onTileClick, onPan, onZoom
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });

  // Convert arrays to maps for O(1) lookup
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

  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    renderMap(ctx, map, tileMap, buildingMap, activeCompanyId, zoom, offset);
  }, [map, tileMap, buildingMap, activeCompanyId, zoom, offset]);

  // Resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // Left click
      setIsDragging(true);
      setLastMouse({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const dx = e.clientX - lastMouse.x;
      const dy = e.clientY - lastMouse.y;
      onPan({ x: offset.x + dx, y: offset.y + dy });
      setLastMouse({ x: e.clientX, y: e.clientY });
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const tileSize = TILE_SIZE * zoom;
    const x = Math.floor((e.clientX - rect.left - offset.x) / tileSize);
    const y = Math.floor((e.clientY - rect.top - offset.y) / tileSize);

    if (x >= 0 && x < map.width && y >= 0 && y < map.height) {
      onTileClick({ x, y });
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    onZoom(Math.max(0.5, Math.min(4, zoom + delta)));
  };

  return (
    <canvas
      ref={canvasRef}
      className="cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={() => setIsDragging(false)}
      onMouseLeave={() => setIsDragging(false)}
      onClick={handleClick}
      onWheel={handleWheel}
    />
  );
}
```

### Tile Info Panel

```tsx
// TileInfo.tsx
export function TileInfo({ mapId, x, y, onClose }) {
  const { data, isLoading } = useTileDetail(mapId, x, y);

  if (isLoading) return <div className="p-4">Loading...</div>;

  const { tile, building, owner, security } = data;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-white">Tile ({x}, {y})</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white">×</button>
      </div>

      {/* Terrain */}
      <div className="mb-4">
        <p className="text-sm text-gray-500">Terrain</p>
        <p className="text-white capitalize">{tile.terrain_type.replace('_', ' ')}</p>
      </div>

      {/* Special building */}
      {tile.special_building && (
        <div className="mb-4 p-3 bg-yellow-900/30 rounded">
          <p className="text-yellow-400 capitalize">{tile.special_building.replace('_', ' ')}</p>
        </div>
      )}

      {/* Ownership */}
      <div className="mb-4">
        <p className="text-sm text-gray-500">Owner</p>
        {owner ? (
          <p className="text-red-400">{owner.name}</p>
        ) : (
          <p className="text-green-400">Available</p>
        )}
      </div>

      {/* Building */}
      {building && (
        <div className="mb-4 p-3 bg-gray-700 rounded">
          <p className="font-bold text-white">{building.type.name}</p>
          <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
            <div>
              <p className="text-gray-500">Profit</p>
              <p className="text-green-400">${building.calculated_profit}/tick</p>
            </div>
            <div>
              <p className="text-gray-500">Damage</p>
              <p className={building.damage_percent > 0 ? 'text-red-400' : 'text-gray-400'}>
                {building.damage_percent}%
              </p>
            </div>
          </div>

          {building.is_on_fire && (
            <p className="mt-2 text-red-500">🔥 On Fire!</p>
          )}

          {building.is_for_sale && (
            <p className="mt-2 text-yellow-400">
              For Sale: ${building.sale_price.toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* Security */}
      {security && (
        <div className="mb-4">
          <p className="text-sm text-gray-500 mb-2">Security</p>
          <div className="flex gap-2 flex-wrap">
            {security.has_cameras && <span className="px-2 py-1 bg-gray-700 rounded text-xs">📷 Cameras</span>}
            {security.has_guard_dogs && <span className="px-2 py-1 bg-gray-700 rounded text-xs">🐕 Dogs</span>}
            {security.has_security_guards && <span className="px-2 py-1 bg-gray-700 rounded text-xs">👮 Guards</span>}
            {security.has_sprinklers && <span className="px-2 py-1 bg-gray-700 rounded text-xs">💦 Sprinklers</span>}
          </div>
        </div>
      )}

      {/* Actions - placeholder for Stage 05 */}
      <div className="mt-6 space-y-2">
        {!tile.owner_company_id && tile.terrain_type === 'free_land' && (
          <button className="w-full py-2 bg-green-600 text-white rounded" disabled>
            Buy Land (Coming Soon)
          </button>
        )}
      </div>
    </div>
  );
}
```

### Map Legend

```tsx
// MapLegend.tsx
export function MapLegend() {
  return (
    <div className="absolute bottom-4 left-4 bg-gray-800/90 p-3 rounded-lg text-sm">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: TERRAIN_COLORS.free_land }} />
          <span className="text-gray-300">Free Land</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: TERRAIN_COLORS.water }} />
          <span className="text-gray-300">Water</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: TERRAIN_COLORS.road }} />
          <span className="text-gray-300">Road</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#22c55e' }} />
          <span className="text-gray-300">Your Land</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#ef4444' }} />
          <span className="text-gray-300">Rival Land</span>
        </div>
      </div>
    </div>
  );
}
```

## Database Changes

No new tables. Uses existing tables.

## Test Cases

| Test | Input | Expected Output |
|------|-------|-----------------|
| Load 50x50 map | Valid map ID | 2500 tiles rendered |
| Load 100x100 map | Max size map | 10000 tiles rendered, smooth performance |
| Zoom in/out | Mouse wheel | Zoom level changes, tiles resize |
| Pan map | Click and drag | Map scrolls |
| Click tile | Click on tile | Side panel shows tile details |
| Own land highlight | Company owns tiles | Tiles show green tint |
| Rival land highlight | Other company owns tiles | Tiles show red tint |
| Building indicator | Tile has building | White dot on tile |
| Fire indicator | Building on fire | Red dot on tile |

## Acceptance Checklist

- [ ] Map loads and renders all tiles
- [ ] Zoom works (0.5x to 4x)
- [ ] Pan works (click and drag)
- [ ] Tile click selects and shows info
- [ ] Own tiles highlighted green
- [ ] Other company tiles highlighted red
- [ ] Free land shows base terrain color
- [ ] Buildings indicated on tiles
- [ ] Fire indicated with red
- [ ] Legend displays correctly
- [ ] Performance acceptable for 100x100 maps

## Deployment

```bash
npm run build
CLOUDFLARE_API_TOKEN="..." CLOUDFLARE_ACCOUNT_ID="..." npx wrangler pages deploy ./dist --project-name=notropolis-dashboard
```

## Handoff Notes

- Canvas chosen over DOM for performance with large grids
- Tile lookup converted to Map for O(1) access
- Only visible tiles rendered (viewport culling)
- Building details fetched on-demand when tile selected
- Ownership colors use alpha blending with terrain
- Consider adding minimap for large maps in future
