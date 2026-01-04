import { useRef, useEffect, useMemo } from 'react';
import { GameMap, Tile, BuildingInstance } from '../../types/game';

const TERRAIN_COLORS: Record<string, string> = {
  free_land: '#3d5c3d',
  water: '#2563eb',
  road: '#4b5563',
  dirt_track: '#92400e',
  trees: '#166534',
};

const VIEWPORT_TILES = 15; // Matches IsometricView

interface MiniMapProps {
  map: GameMap;
  tiles: Tile[];
  buildings: BuildingInstance[];
  activeCompanyId: string;
  centerTile: { x: number; y: number };
  onNavigate?: (coords: { x: number; y: number }) => void;
}

/**
 * Small mini-map overlay showing the full map with viewport indicator
 */
export function MiniMap({
  map,
  tiles,
  buildings,
  activeCompanyId,
  centerTile,
  onNavigate,
}: MiniMapProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Build lookup maps
  const tileMap = useMemo(() => {
    const m = new Map<string, Tile>();
    tiles.forEach((t) => m.set(`${t.x},${t.y}`, t));
    return m;
  }, [tiles]);

  const buildingMap = useMemo(() => {
    const m = new Map<string, BuildingInstance>();
    buildings.forEach((b) => m.set(b.tile_id, b));
    return m;
  }, [buildings]);

  // Render mini-map
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate tile size to fit map in canvas
    const tileSize = Math.min(
      canvas.width / map.width,
      canvas.height / map.height
    );

    // Center the map if it doesn't fill the canvas
    const offsetX = (canvas.width - map.width * tileSize) / 2;
    const offsetY = (canvas.height - map.height * tileSize) / 2;

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw all tiles
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tile = tileMap.get(`${x},${y}`);
        if (!tile) continue;

        const px = offsetX + x * tileSize;
        const py = offsetY + y * tileSize;

        // Base terrain color
        let color = TERRAIN_COLORS[tile.terrain_type] || TERRAIN_COLORS.free_land;

        // Check for building
        const building = buildingMap.get(tile.id);

        // Ownership coloring
        if (tile.owner_company_id) {
          if (tile.owner_company_id === activeCompanyId) {
            // Player's tiles - bright blue
            color = building ? '#60a5fa' : '#3b82f6';
          } else {
            // Other players - red tint
            color = building ? '#f87171' : '#ef4444';
          }
        } else if (building) {
          // Unowned building (shouldn't happen but fallback)
          color = '#9ca3af';
        }

        // Special buildings
        if (tile.special_building === 'temple') color = '#fbbf24';
        if (tile.special_building === 'bank') color = '#94a3b8';
        if (tile.special_building === 'police_station') color = '#3b82f6';

        ctx.fillStyle = color;
        ctx.fillRect(px, py, tileSize, tileSize);
      }
    }

    // Draw viewport rectangle (white outline)
    const viewportHalf = Math.floor(VIEWPORT_TILES / 2);
    const vpX = offsetX + Math.max(0, centerTile.x - viewportHalf) * tileSize;
    const vpY = offsetY + Math.max(0, centerTile.y - viewportHalf) * tileSize;
    const vpWidth = Math.min(VIEWPORT_TILES, map.width) * tileSize;
    const vpHeight = Math.min(VIEWPORT_TILES, map.height) * tileSize;

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(vpX, vpY, vpWidth, vpHeight);

    // Semi-transparent fill for viewport
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(vpX, vpY, vpWidth, vpHeight);
  }, [map, tileMap, buildingMap, activeCompanyId, centerTile]);

  // Handle click to navigate
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onNavigate) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const tileSize = Math.min(
      canvas.width / map.width,
      canvas.height / map.height
    );
    const offsetX = (canvas.width - map.width * tileSize) / 2;
    const offsetY = (canvas.height - map.height * tileSize) / 2;

    const x = Math.floor((clickX - offsetX) / tileSize);
    const y = Math.floor((clickY - offsetY) / tileSize);

    if (x >= 0 && x < map.width && y >= 0 && y < map.height) {
      onNavigate({ x, y });
    }
  };

  return (
    <div className="bg-gray-800/90 rounded-lg p-1 shadow-lg">
      <canvas
        ref={canvasRef}
        width={120}
        height={120}
        className="cursor-pointer"
        onClick={handleClick}
        title="Click to navigate"
      />
    </div>
  );
}
