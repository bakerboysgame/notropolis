# Stage 02: Admin Map Builder

## Objective

Create an admin interface for creating and editing game maps up to 100x100 tiles with terrain, special buildings, and location metadata.

## Dependencies

`[Requires: Stage 01 complete]` - Needs maps and tiles tables.

## Complexity

**High** - Large grid UI, drag-to-paint functionality, real-time preview.

## Files to Modify

| File | Changes |
|------|---------|
| `authentication-dashboard-system/src/App.tsx` | Add admin route |
| `authentication-dashboard-system/src/components/Sidebar.tsx` | Add admin menu item (for admin users) |

## Files to Create

| File | Purpose |
|------|---------|
| `authentication-dashboard-system/src/pages/admin/MapBuilder.tsx` | Main map builder page |
| `authentication-dashboard-system/src/components/admin/MapGrid.tsx` | Grid canvas component |
| `authentication-dashboard-system/src/components/admin/TerrainPalette.tsx` | Terrain/building selector |
| `authentication-dashboard-system/src/components/admin/MapSettings.tsx` | Map metadata form |
| `authentication-dashboard-system/src/api/admin/maps.ts` | API routes for map CRUD |
| `authentication-dashboard-system/src/hooks/useMapBuilder.ts` | Map builder state management |

## Implementation Details

### API Endpoints

```typescript
// POST /api/admin/maps - Create new map
interface CreateMapRequest {
  name: string;
  country: string;
  location_type: 'town' | 'city' | 'capital';
  width: number;  // 1-100
  height: number; // 1-100
  hero_net_worth: number;
  hero_cash: number;
  hero_land_percentage: number;
  police_strike_day: number; // 0-6
}

// GET /api/admin/maps - List all maps
// GET /api/admin/maps/:id - Get map with tiles
// PUT /api/admin/maps/:id - Update map metadata
// DELETE /api/admin/maps/:id - Delete map (only if no players)

// PUT /api/admin/maps/:id/tiles - Bulk update tiles
interface UpdateTilesRequest {
  tiles: Array<{
    x: number;
    y: number;
    terrain_type: TerrainType;
    special_building?: SpecialBuilding;
  }>;
}
```

### Map Builder UI

```tsx
// MapBuilder.tsx - Main layout
export function MapBuilder() {
  const { mapId } = useParams();
  const {
    map, tiles, selectedTool, brushSize,
    setTool, paint, save, isLoading
  } = useMapBuilder(mapId);

  return (
    <div className="flex h-full">
      {/* Left: Tool palette */}
      <TerrainPalette
        selectedTool={selectedTool}
        onSelectTool={setTool}
        brushSize={brushSize}
      />

      {/* Center: Grid canvas */}
      <MapGrid
        width={map.width}
        height={map.height}
        tiles={tiles}
        selectedTool={selectedTool}
        brushSize={brushSize}
        onPaint={paint}
      />

      {/* Right: Settings */}
      <MapSettings
        map={map}
        onSave={save}
      />
    </div>
  );
}
```

### Grid Rendering (Canvas-based for performance)

```tsx
// MapGrid.tsx - Canvas-based grid for large maps
const TILE_SIZE = 16; // pixels per tile at 1x zoom
const COLORS = {
  free_land: '#90EE90',
  water: '#4169E1',
  road: '#696969',
  dirt_track: '#8B4513',
  trees: '#228B22',
  temple: '#FFD700',
  bank: '#C0C0C0',
  police_station: '#0000FF',
};

export function MapGrid({ width, height, tiles, onPaint, selectedTool }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPainting, setIsPainting] = useState(false);

  // Convert tiles array to 2D lookup for O(1) access
  const tileMap = useMemo(() => {
    const map = new Map<string, Tile>();
    tiles.forEach(t => map.set(`${t.x},${t.y}`, t));
    return map;
  }, [tiles]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Clear
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw tiles
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const tile = tileMap.get(`${x},${y}`);
        const color = tile?.special_building
          ? COLORS[tile.special_building]
          : COLORS[tile?.terrain_type || 'free_land'];

        ctx.fillStyle = color;
        ctx.fillRect(
          (x * TILE_SIZE + offset.x) * zoom,
          (y * TILE_SIZE + offset.y) * zoom,
          TILE_SIZE * zoom - 1,
          TILE_SIZE * zoom - 1
        );
      }
    }
  }, [tiles, zoom, offset, width, height]);

  // Mouse handlers for painting
  const handleMouseDown = (e) => {
    setIsPainting(true);
    paintAt(e);
  };

  const handleMouseMove = (e) => {
    if (isPainting) paintAt(e);
  };

  const paintAt = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / (TILE_SIZE * zoom) - offset.x);
    const y = Math.floor((e.clientY - rect.top) / (TILE_SIZE * zoom) - offset.y);

    if (x >= 0 && x < width && y >= 0 && y < height) {
      onPaint(x, y, selectedTool);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={width * TILE_SIZE}
      height={height * TILE_SIZE}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={() => setIsPainting(false)}
      onMouseLeave={() => setIsPainting(false)}
      onWheel={(e) => setZoom(z => Math.max(0.5, Math.min(4, z - e.deltaY * 0.001)))}
    />
  );
}
```

### Terrain Palette

```tsx
// TerrainPalette.tsx
const TOOLS = [
  { id: 'free_land', label: 'Free Land', color: '#90EE90', icon: '🟩' },
  { id: 'water', label: 'Water', color: '#4169E1', icon: '🟦' },
  { id: 'road', label: 'Road', color: '#696969', icon: '⬛' },
  { id: 'dirt_track', label: 'Dirt Track', color: '#8B4513', icon: '🟫' },
  { id: 'trees', label: 'Trees', color: '#228B22', icon: '🌲' },
  { id: 'temple', label: 'Temple', color: '#FFD700', icon: '🛕', special: true },
  { id: 'bank', label: 'Bank', color: '#C0C0C0', icon: '🏦', special: true },
  { id: 'police_station', label: 'Police', color: '#0000FF', icon: '🚔', special: true },
];

export function TerrainPalette({ selectedTool, onSelectTool, brushSize, onBrushSize }) {
  return (
    <div className="w-48 bg-gray-800 p-4 flex flex-col gap-2">
      <h3 className="text-white font-bold">Terrain</h3>
      {TOOLS.filter(t => !t.special).map(tool => (
        <button
          key={tool.id}
          onClick={() => onSelectTool(tool.id)}
          className={`p-2 rounded flex items-center gap-2 ${
            selectedTool === tool.id ? 'ring-2 ring-white' : ''
          }`}
          style={{ backgroundColor: tool.color }}
        >
          {tool.icon} {tool.label}
        </button>
      ))}

      <h3 className="text-white font-bold mt-4">Special Buildings</h3>
      {TOOLS.filter(t => t.special).map(tool => (
        <button
          key={tool.id}
          onClick={() => onSelectTool(tool.id)}
          className={`p-2 rounded flex items-center gap-2 ${
            selectedTool === tool.id ? 'ring-2 ring-white' : ''
          }`}
          style={{ backgroundColor: tool.color }}
        >
          {tool.icon} {tool.label}
        </button>
      ))}

      <h3 className="text-white font-bold mt-4">Brush Size</h3>
      <input
        type="range"
        min={1}
        max={5}
        value={brushSize}
        onChange={(e) => onBrushSize(Number(e.target.value))}
      />
    </div>
  );
}
```

### Map Settings Form

```tsx
// MapSettings.tsx
export function MapSettings({ map, onSave }) {
  const [settings, setSettings] = useState(map);

  return (
    <div className="w-64 bg-gray-800 p-4">
      <h3 className="text-white font-bold mb-4">Map Settings</h3>

      <label className="block text-white mb-2">
        Name
        <input
          type="text"
          value={settings.name}
          onChange={(e) => setSettings(s => ({ ...s, name: e.target.value }))}
          className="w-full p-2 rounded bg-gray-700 text-white"
        />
      </label>

      <label className="block text-white mb-2">
        Country
        <input
          type="text"
          value={settings.country}
          onChange={(e) => setSettings(s => ({ ...s, country: e.target.value }))}
          className="w-full p-2 rounded bg-gray-700 text-white"
        />
      </label>

      <label className="block text-white mb-2">
        Type
        <select
          value={settings.location_type}
          onChange={(e) => setSettings(s => ({ ...s, location_type: e.target.value }))}
          className="w-full p-2 rounded bg-gray-700 text-white"
        >
          <option value="town">Town</option>
          <option value="city">City</option>
          <option value="capital">Capital</option>
        </select>
      </label>

      <label className="block text-white mb-2">
        Hero Net Worth
        <input
          type="number"
          value={settings.hero_net_worth}
          onChange={(e) => setSettings(s => ({ ...s, hero_net_worth: Number(e.target.value) }))}
          className="w-full p-2 rounded bg-gray-700 text-white"
        />
      </label>

      <label className="block text-white mb-2">
        Hero Cash
        <input
          type="number"
          value={settings.hero_cash}
          onChange={(e) => setSettings(s => ({ ...s, hero_cash: Number(e.target.value) }))}
          className="w-full p-2 rounded bg-gray-700 text-white"
        />
      </label>

      <label className="block text-white mb-2">
        Hero Land %
        <input
          type="number"
          step="0.1"
          value={settings.hero_land_percentage}
          onChange={(e) => setSettings(s => ({ ...s, hero_land_percentage: Number(e.target.value) }))}
          className="w-full p-2 rounded bg-gray-700 text-white"
        />
      </label>

      <label className="block text-white mb-2">
        Police Strike Day
        <select
          value={settings.police_strike_day}
          onChange={(e) => setSettings(s => ({ ...s, police_strike_day: Number(e.target.value) }))}
          className="w-full p-2 rounded bg-gray-700 text-white"
        >
          {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, i) => (
            <option key={i} value={i}>{day}</option>
          ))}
        </select>
      </label>

      <button
        onClick={() => onSave(settings)}
        className="w-full mt-4 p-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Save Map
      </button>
    </div>
  );
}
```

### Admin Check

```typescript
// Only allow admin users to access map builder
// Add is_admin flag to users table or check specific user IDs
const ADMIN_USER_IDS = ['...'] // Or check is_admin column

async function requireAdmin(request: Request, env: Env) {
  const user = await getAuthenticatedUser(request, env);
  if (!ADMIN_USER_IDS.includes(user.id)) {
    throw new Error('Unauthorized');
  }
  return user;
}
```

## Database Changes

No new tables. Uses tables from Stage 01.

**Seeding:** When a new map is created, generate all tiles with default terrain (free_land).

```sql
-- Generate tiles for new 50x50 map (example)
-- This would be done programmatically in a loop
INSERT INTO tiles (id, map_id, x, y, terrain_type)
SELECT
  lower(hex(randomblob(16))),
  'map-id-here',
  x.value,
  y.value,
  'free_land'
FROM
  (WITH RECURSIVE cnt(value) AS (SELECT 0 UNION ALL SELECT value+1 FROM cnt WHERE value<49) SELECT value FROM cnt) x,
  (WITH RECURSIVE cnt(value) AS (SELECT 0 UNION ALL SELECT value+1 FROM cnt WHERE value<49) SELECT value FROM cnt) y;
```

## Test Cases

| Test | Input | Expected Output |
|------|-------|-----------------|
| Create small map | 10x10 town | Map created with 100 tiles |
| Create max size map | 100x100 capital | Map created with 10,000 tiles |
| Paint terrain | Click on tile with water tool | Tile terrain updates to water |
| Paint special | Click with temple tool | Tile gets special_building = temple |
| Brush size 3 | Paint with 3x3 brush | 9 tiles updated |
| Save settings | Update hero requirements | Map metadata saved |
| Non-admin access | Regular user visits /admin/maps | Redirect to home |

## Acceptance Checklist

- [ ] Admin route protected (only admin users)
- [ ] Can create new map with custom dimensions (up to 100x100)
- [ ] Grid renders correctly with zoom/pan
- [ ] Can paint all terrain types
- [ ] Can place special buildings (only one of each type per map)
- [ ] Brush size works (1-5 tiles)
- [ ] Map settings save correctly
- [ ] Can load and edit existing maps
- [ ] Performance acceptable for 100x100 grid

## Deployment

```bash
# Build and deploy frontend
npm run build
CLOUDFLARE_API_TOKEN="..." CLOUDFLARE_ACCOUNT_ID="..." npx wrangler pages deploy ./dist --project-name=notropolis-dashboard

# Verify admin access
# Log in as admin user, navigate to /admin/maps
```

## Handoff Notes

- Canvas-based rendering chosen for performance with large grids
- Tiles are created with `free_land` by default on map creation
- Special buildings limited to 1 per type per map (enforced in UI and API)
- Map editing is real-time but auto-saves on blur/interval
- Consider adding undo/redo in future iteration
