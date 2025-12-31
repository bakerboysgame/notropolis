# Stage 16: Visual Polish

## Objective

Implement the zoomed-in SimCity-style building view and event scene images.

## Dependencies

`[Requires: Stage 04 complete]` - Needs map viewer to extend.
`[Requires: R2 bucket]` - For building sprites and event images.

## Complexity

**High** - Isometric rendering, asset management, animation.

## Files to Modify

| File | Changes |
|------|---------|
| `authentication-dashboard-system/src/pages/GameMap.tsx` | Add zoom level toggle |
| `authentication-dashboard-system/src/components/game/MapCanvas.tsx` | Conditional rendering |

## Files to Create

| File | Purpose |
|------|---------|
| `authentication-dashboard-system/src/components/game/IsometricView.tsx` | Zoomed-in building view |
| `authentication-dashboard-system/src/components/game/BuildingSprite.tsx` | Individual building render |
| `authentication-dashboard-system/src/components/game/EventScene.tsx` | Event animation overlay |
| `authentication-dashboard-system/src/utils/isometricRenderer.ts` | Isometric calculation utils |
| `authentication-dashboard-system/src/hooks/useEventScene.ts` | Event scene state |
| `authentication-dashboard-system/migrations/0020_add_building_sprites.sql` | Sprite references |

## Implementation Details

### Database Migration

```sql
-- 0020_add_building_sprites.sql

-- Add sprite reference to building types
ALTER TABLE building_types ADD COLUMN sprite_r2_key TEXT;
ALTER TABLE building_types ADD COLUMN sprite_width INTEGER DEFAULT 64;
ALTER TABLE building_types ADD COLUMN sprite_height INTEGER DEFAULT 64;

-- Event scenes
CREATE TABLE event_scenes (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  -- Types: hero_out, attack_success, attack_caught, building_collapse, fire_spread, level_up
  r2_key TEXT NOT NULL,
  duration_ms INTEGER DEFAULT 3000,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Update building types with sprites
UPDATE building_types SET sprite_r2_key = 'sprites/buildings/market_stall.png' WHERE id = 'market_stall';
UPDATE building_types SET sprite_r2_key = 'sprites/buildings/hot_dog_stand.png' WHERE id = 'hot_dog_stand';
UPDATE building_types SET sprite_r2_key = 'sprites/buildings/campsite.png' WHERE id = 'campsite';
UPDATE building_types SET sprite_r2_key = 'sprites/buildings/shop.png' WHERE id = 'shop';
UPDATE building_types SET sprite_r2_key = 'sprites/buildings/burger_bar.png' WHERE id = 'burger_bar';
UPDATE building_types SET sprite_r2_key = 'sprites/buildings/motel.png' WHERE id = 'motel';
UPDATE building_types SET sprite_r2_key = 'sprites/buildings/high_street_store.png' WHERE id = 'high_street_store';
UPDATE building_types SET sprite_r2_key = 'sprites/buildings/restaurant.png' WHERE id = 'restaurant';
UPDATE building_types SET sprite_r2_key = 'sprites/buildings/manor.png' WHERE id = 'manor';
UPDATE building_types SET sprite_r2_key = 'sprites/buildings/casino.png' WHERE id = 'casino';
```

### Isometric Utilities

```typescript
// utils/isometricRenderer.ts
export const ISO_TILE_WIDTH = 64;
export const ISO_TILE_HEIGHT = 32;

// Convert grid coordinates to screen position
export function gridToScreen(x: number, y: number): { screenX: number; screenY: number } {
  return {
    screenX: (x - y) * (ISO_TILE_WIDTH / 2),
    screenY: (x + y) * (ISO_TILE_HEIGHT / 2),
  };
}

// Convert screen position to grid coordinates
export function screenToGrid(screenX: number, screenY: number): { x: number; y: number } {
  return {
    x: Math.floor((screenX / (ISO_TILE_WIDTH / 2) + screenY / (ISO_TILE_HEIGHT / 2)) / 2),
    y: Math.floor((screenY / (ISO_TILE_HEIGHT / 2) - screenX / (ISO_TILE_WIDTH / 2)) / 2),
  };
}

// Get terrain sprite based on type
export function getTerrainSprite(terrain: string): string {
  const sprites = {
    free_land: 'sprites/terrain/grass.png',
    water: 'sprites/terrain/water.png',
    road: 'sprites/terrain/road.png',
    dirt_track: 'sprites/terrain/dirt.png',
    trees: 'sprites/terrain/trees.png',
  };
  return `https://r2.notropolis.net/${sprites[terrain] || sprites.free_land}`;
}

// Sort tiles for proper isometric rendering (back to front)
export function sortTilesForRendering(tiles: Tile[]): Tile[] {
  return [...tiles].sort((a, b) => {
    // Sort by sum of x+y (depth), then by x for same depth
    const depthA = a.x + a.y;
    const depthB = b.x + b.y;
    if (depthA !== depthB) return depthA - depthB;
    return a.x - b.x;
  });
}
```

### View Mode Toggle

```tsx
// pages/GameMap.tsx - Updated
export function GameMap() {
  const [viewMode, setViewMode] = useState<'grid' | 'isometric'>('grid');
  // ... existing state

  return (
    <div className="flex h-full">
      {/* View mode toggle */}
      <div className="absolute top-4 right-4 z-10 bg-gray-800 rounded-lg p-1">
        <button
          onClick={() => setViewMode('grid')}
          className={`px-3 py-1 rounded ${viewMode === 'grid' ? 'bg-blue-600' : ''}`}
        >
          Grid
        </button>
        <button
          onClick={() => setViewMode('isometric')}
          className={`px-3 py-1 rounded ${viewMode === 'isometric' ? 'bg-blue-600' : ''}`}
        >
          City View
        </button>
      </div>

      {viewMode === 'grid' ? (
        <MapCanvas {...mapProps} />
      ) : (
        <IsometricView {...mapProps} />
      )}

      {/* ... side panel */}
    </div>
  );
}
```

### Isometric View Component

```tsx
// components/game/IsometricView.tsx
export function IsometricView({
  map, tiles, buildings, activeCompanyId,
  zoom, offset, onTileClick, onPan
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loadedSprites, setLoadedSprites] = useState<Map<string, HTMLImageElement>>(new Map());

  // Preload sprites
  useEffect(() => {
    const spriteUrls = new Set<string>();

    // Terrain sprites
    ['free_land', 'water', 'road', 'dirt_track', 'trees'].forEach(t => {
      spriteUrls.add(getTerrainSprite(t));
    });

    // Building sprites
    buildings.forEach(b => {
      if (b.sprite_url) spriteUrls.add(b.sprite_url);
    });

    // Load all sprites
    Promise.all(
      Array.from(spriteUrls).map(url => loadImage(url))
    ).then(images => {
      const map = new Map<string, HTMLImageElement>();
      Array.from(spriteUrls).forEach((url, i) => map.set(url, images[i]));
      setLoadedSprites(map);
    });
  }, [buildings]);

  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || loadedSprites.size === 0) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Center the view
    const centerX = canvas.width / 2 + offset.x;
    const centerY = 100 + offset.y;

    // Sort tiles for proper depth
    const sortedTiles = sortTilesForRendering(tiles);

    // Build lookup maps
    const buildingByTile = new Map(buildings.map(b => [b.tile_id, b]));

    // Render each tile
    for (const tile of sortedTiles) {
      const { screenX, screenY } = gridToScreen(tile.x, tile.y);
      const x = centerX + screenX * zoom;
      const y = centerY + screenY * zoom;

      // Draw terrain
      const terrainSprite = loadedSprites.get(getTerrainSprite(tile.terrain_type));
      if (terrainSprite) {
        ctx.drawImage(
          terrainSprite,
          x - (ISO_TILE_WIDTH * zoom) / 2,
          y,
          ISO_TILE_WIDTH * zoom,
          ISO_TILE_HEIGHT * zoom
        );
      }

      // Draw ownership tint
      if (tile.owner_company_id) {
        ctx.fillStyle = tile.owner_company_id === activeCompanyId
          ? 'rgba(34, 197, 94, 0.3)'  // Green
          : 'rgba(239, 68, 68, 0.3)'; // Red

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (ISO_TILE_WIDTH * zoom) / 2, y + (ISO_TILE_HEIGHT * zoom) / 2);
        ctx.lineTo(x, y + ISO_TILE_HEIGHT * zoom);
        ctx.lineTo(x - (ISO_TILE_WIDTH * zoom) / 2, y + (ISO_TILE_HEIGHT * zoom) / 2);
        ctx.closePath();
        ctx.fill();
      }

      // Draw building
      const building = buildingByTile.get(tile.id);
      if (building) {
        const buildingSprite = loadedSprites.get(building.sprite_url);
        if (buildingSprite) {
          const spriteHeight = building.sprite_height * zoom;
          const spriteWidth = building.sprite_width * zoom;

          // Draw building above tile
          ctx.drawImage(
            buildingSprite,
            x - spriteWidth / 2,
            y - spriteHeight + (ISO_TILE_HEIGHT * zoom) / 2,
            spriteWidth,
            spriteHeight
          );

          // Fire effect
          if (building.is_on_fire) {
            ctx.fillStyle = 'rgba(255, 100, 0, 0.5)';
            ctx.fillRect(
              x - spriteWidth / 2,
              y - spriteHeight + (ISO_TILE_HEIGHT * zoom) / 2,
              spriteWidth,
              spriteHeight
            );
            // Could add animated fire sprites here
          }

          // Damage overlay
          if (building.damage_percent > 0) {
            ctx.fillStyle = `rgba(0, 0, 0, ${building.damage_percent / 200})`;
            ctx.fillRect(
              x - spriteWidth / 2,
              y - spriteHeight + (ISO_TILE_HEIGHT * zoom) / 2,
              spriteWidth,
              spriteHeight
            );
          }
        }
      }
    }
  }, [tiles, buildings, loadedSprites, zoom, offset, activeCompanyId]);

  // Mouse handling for click
  const handleClick = (e: React.MouseEvent) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const centerX = rect.width / 2 + offset.x;
    const centerY = 100 + offset.y;

    const mouseX = (e.clientX - rect.left - centerX) / zoom;
    const mouseY = (e.clientY - rect.top - centerY) / zoom;

    const { x, y } = screenToGrid(mouseX, mouseY);

    if (x >= 0 && x < map.width && y >= 0 && y < map.height) {
      onTileClick({ x, y });
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={window.innerWidth}
      height={window.innerHeight}
      onClick={handleClick}
      onMouseDown={/* pan handling */}
      onMouseMove={/* pan handling */}
      className="cursor-grab active:cursor-grabbing"
    />
  );
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
```

### Event Scene Component

```tsx
// components/game/EventScene.tsx
export function EventScene({ event, onComplete }) {
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    // Fade in
    setOpacity(1);

    // Fade out after duration
    const timer = setTimeout(() => {
      setOpacity(0);
      setTimeout(onComplete, 500); // After fade out
    }, event.duration_ms);

    return () => clearTimeout(timer);
  }, [event]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 transition-opacity duration-500"
      style={{ opacity }}
    >
      <div className="max-w-2xl">
        <img
          src={`https://r2.notropolis.net/${event.r2_key}`}
          alt={event.event_type}
          className="max-w-full max-h-[80vh] object-contain"
        />

        {event.title && (
          <div className="text-center mt-4">
            <h2 className="text-3xl font-bold text-white">{event.title}</h2>
            {event.subtitle && (
              <p className="text-xl text-gray-300 mt-2">{event.subtitle}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

### Event Scene Hook

```tsx
// hooks/useEventScene.ts
export function useEventScene() {
  const [currentEvent, setCurrentEvent] = useState<EventScene | null>(null);
  const [queue, setQueue] = useState<EventScene[]>([]);

  const showEvent = useCallback((event: EventScene) => {
    setQueue(q => [...q, event]);
  }, []);

  useEffect(() => {
    if (!currentEvent && queue.length > 0) {
      setCurrentEvent(queue[0]);
      setQueue(q => q.slice(1));
    }
  }, [currentEvent, queue]);

  const handleComplete = () => {
    setCurrentEvent(null);
  };

  return {
    currentEvent,
    showEvent,
    handleComplete,
  };
}

// Usage in game components:
// After hero out:
showEvent({
  event_type: 'hero_out',
  r2_key: 'events/hero_celebration.png',
  duration_ms: 4000,
  title: 'HERO!',
  subtitle: `You earned $${amount.toLocaleString()}!`,
});

// After attack:
showEvent({
  event_type: result.was_caught ? 'attack_caught' : 'attack_success',
  r2_key: result.was_caught ? 'events/police_arrest.png' : 'events/explosion.png',
  duration_ms: 3000,
});
```

### Special Building Sprites

```typescript
// Special buildings (temple, bank, police) have unique sprites
const SPECIAL_SPRITES = {
  temple: 'sprites/special/temple.png',
  bank: 'sprites/special/bank.png',
  police_station: 'sprites/special/police.png',
};
```

## Database Changes

- Add sprite columns to `building_types`
- New `event_scenes` table

## Test Cases

| Test | Input | Expected Output |
|------|-------|-----------------|
| Toggle view | Click isometric | View switches |
| Tile click iso | Click on tile | Correct tile selected |
| Building renders | Tile has building | Sprite displayed |
| Fire overlay | Building on fire | Fire effect shown |
| Damage overlay | 50% damage | Darkened sprite |
| Event scene | Hero out | Scene displays and fades |
| Sprite loading | Many buildings | All sprites load |

## Acceptance Checklist

- [ ] View mode toggle works
- [ ] Isometric tiles render correctly
- [ ] Tiles sorted back-to-front
- [ ] Buildings render on tiles
- [ ] Ownership tint displays
- [ ] Fire effect visible
- [ ] Damage darkening works
- [ ] Click detection works in iso view
- [ ] Pan/zoom works in iso view
- [ ] Event scenes display
- [ ] Event scenes auto-dismiss
- [ ] Special buildings have sprites

## Deployment

```bash
# Upload sprites to R2
# - sprites/terrain/*.png
# - sprites/buildings/*.png
# - sprites/special/*.png
# - events/*.png

CLOUDFLARE_API_TOKEN="..." npx wrangler d1 execute notropolis-database --file=migrations/0020_add_building_sprites.sql --remote

npm run build
CLOUDFLARE_API_TOKEN="..." CLOUDFLARE_ACCOUNT_ID="..." npx wrangler pages deploy ./dist --project-name=notropolis-dashboard
```

## Handoff Notes

- Isometric rendering requires specific sprite format (see asset guide)
- Buildings should be drawn with transparent backgrounds
- Tile size: 64x32px base, buildings can be taller
- Event scenes should be ~1920x1080 or similar aspect
- Consider adding animated fire sprites
- Consider adding ambient animations (water ripples, etc.)
- Sprite loading is async - show loading state
