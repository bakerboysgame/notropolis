// Canvas-based map rendering utilities for Notropolis game

export const TILE_SIZE = 12; // Base tile size in pixels

export const TERRAIN_COLORS: Record<string, string> = {
  free_land: '#3d5c3d',    // Muted green
  water: '#2563eb',        // Blue
  road: '#4b5563',         // Gray
  dirt_track: '#92400e',   // Brown
  trees: '#166534',        // Dark green
};

export const SPECIAL_COLORS: Record<string, string> = {
  temple: '#fbbf24',       // Gold
  bank: '#94a3b8',         // Silver
  police_station: '#3b82f6' // Blue
};

interface Tile {
  id: string;
  x: number;
  y: number;
  terrain_type: string;
  special_building: string | null;
  owner_company_id: string | null;
}

interface Building {
  id: string;
  tile_id: string;
  is_on_fire: boolean;
  is_for_sale?: boolean;
  is_collapsed?: boolean;
}

interface GameMap {
  width: number;
  height: number;
}

/**
 * Convert hex color to RGB object
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

/**
 * Blend two colors together
 */
function blendColors(base: string, overlay: string, amount: number): string {
  const b = hexToRgb(base);
  const o = hexToRgb(overlay);
  const r = Math.round(b.r * (1 - amount) + o.r * amount);
  const g = Math.round(b.g * (1 - amount) + o.g * amount);
  const bl = Math.round(b.b * (1 - amount) + o.b * amount);
  return `rgb(${r},${g},${bl})`;
}

/**
 * Render the game map on a canvas
 * Uses viewport culling to only render visible tiles for performance
 */
export function renderMap(
  ctx: CanvasRenderingContext2D,
  map: GameMap,
  tiles: Map<string, Tile>,
  buildings: Map<string, Building>,
  activeCompanyId: string,
  zoom: number,
  offset: { x: number; y: number }
): void {
  const tileSize = TILE_SIZE * zoom;

  // Clear canvas with dark background
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // Calculate visible range (viewport culling)
  const startX = Math.max(0, Math.floor(-offset.x / tileSize));
  const startY = Math.max(0, Math.floor(-offset.y / tileSize));
  const endX = Math.min(map.width, Math.ceil((ctx.canvas.width - offset.x) / tileSize));
  const endY = Math.min(map.height, Math.ceil((ctx.canvas.height - offset.y) / tileSize));

  // Render only visible tiles
  for (let x = startX; x < endX; x++) {
    for (let y = startY; y < endY; y++) {
      const tile = tiles.get(`${x},${y}`);
      if (!tile) continue;

      const px = x * tileSize + offset.x;
      const py = y * tileSize + offset.y;

      // Get base terrain color
      let color = tile.special_building
        ? SPECIAL_COLORS[tile.special_building] || TERRAIN_COLORS.free_land
        : TERRAIN_COLORS[tile.terrain_type] || TERRAIN_COLORS.free_land;

      // Check if this is the user's owned property
      const isOwnedByUser = tile.owner_company_id === activeCompanyId;

      // Apply ownership overlay
      if (tile.owner_company_id) {
        if (isOwnedByUser) {
          // Solid royal blue for owned tiles (matches halo in zoomed view)
          color = '#3b82f6';
        } else {
          // Red tint for rival tiles
          color = blendColors(color, '#ef4444', 0.3);
        }
      }

      // Draw tile
      ctx.fillStyle = color;
      ctx.fillRect(px, py, tileSize - 1, tileSize - 1);

      // Draw building indicator (small dot) - but not for user-owned properties
      const building = buildings.get(tile.id);
      if (building && tileSize >= 8 && !isOwnedByUser) {
        // Draw for-sale highlight (yellow border)
        if (building.is_for_sale && !building.is_collapsed) {
          ctx.strokeStyle = '#fbbf24'; // Yellow/gold color
          ctx.lineWidth = Math.max(1, tileSize / 6);
          ctx.strokeRect(px + 1, py + 1, tileSize - 3, tileSize - 3);
        }

        // Draw building icon
        ctx.fillStyle = building.is_on_fire ? '#ef4444' : '#ffffff';
        ctx.beginPath();
        ctx.arc(px + tileSize / 2, py + tileSize / 2, tileSize / 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

/**
 * Convert screen coordinates to tile coordinates
 */
export function screenToTile(
  screenX: number,
  screenY: number,
  zoom: number,
  offset: { x: number; y: number }
): { x: number; y: number } {
  const tileSize = TILE_SIZE * zoom;
  const x = Math.floor((screenX - offset.x) / tileSize);
  const y = Math.floor((screenY - offset.y) / tileSize);
  return { x, y };
}

/**
 * Convert tile coordinates to screen coordinates (top-left corner)
 */
export function tileToScreen(
  tileX: number,
  tileY: number,
  zoom: number,
  offset: { x: number; y: number }
): { x: number; y: number } {
  const tileSize = TILE_SIZE * zoom;
  const x = tileX * tileSize + offset.x;
  const y = tileY * tileSize + offset.y;
  return { x, y };
}
