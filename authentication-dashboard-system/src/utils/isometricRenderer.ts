// Isometric rendering utilities for the zoomed view
// Uses square tiles with isometric building sprites centered on tiles

// Square tiles - sprites are centered on tile position
export const TILE_SIZE = 64; // Square tiles, same width and height
export const VIEWPORT_TILES = 15; // Show ~15x15 tiles in view

// R2 base URL for game-ready sprites
export const SPRITE_BASE_URL = 'https://assets.notropolis.net/sprites';

// Background tile (512x512, seamless grass texture)
export const GRASS_BACKGROUND = 'terrain/grass_bg_v3.webp';

// Building sprite mapping with heights
// URL: {SPRITE_BASE_URL}/building_sprite/{key}_v{variant}.webp
export interface BuildingSprite {
  key: string;
  variant: number;
  height: number; // Sprite height in pixels (width = 64)
}

export const BUILDING_SPRITES: Record<string, BuildingSprite> = {
  market_stall: { key: 'market_stall', variant: 3, height: 48 },
  hot_dog_stand: { key: 'hot_dog_stand', variant: 3, height: 48 },
  campsite: { key: 'campsite', variant: 3, height: 48 },
  shop: { key: 'shop', variant: 3, height: 64 },
  burger_bar: { key: 'burger_bar', variant: 4, height: 64 },
  motel: { key: 'motel', variant: 2, height: 80 },
  high_street_store: { key: 'high_street_store', variant: 2, height: 96 },
  restaurant: { key: 'restaurant', variant: 9, height: 96 },
  manor: { key: 'manor', variant: 3, height: 112 },
  casino: { key: 'casino', variant: 3, height: 128 },
  // Special buildings
  bank: { key: 'bank', variant: 8, height: 96 },
  temple: { key: 'temple', variant: 3, height: 96 },
  police_station: { key: 'police_station', variant: 6, height: 96 },
  // Demolished/destroyed state
  demolished: { key: 'demolished', variant: 2, height: 32 },
  claim_stake: { key: 'claim_stake', variant: 2, height: 32 },
};

// Terrain sprite mapping (trees used as placeholder for road/water/dirt for now)
export const TERRAIN_SPRITES: Record<string, string> = {
  trees: 'terrain/trees_v4.webp',
  road: 'terrain/trees_v4.webp',
  water: 'terrain/trees_v4.webp',
  dirt_track: 'terrain/trees_v4.webp',
};

// Terrain fallback colors for non-sprite terrain
export const TERRAIN_COLORS: Record<string, string> = {
  free_land: '#3d5c3d', // Muted green (grass shows through)
  water: '#2563eb', // Blue
  road: '#4b5563', // Gray
  dirt_track: '#92400e', // Brown
  trees: '#166534', // Dark green (fallback)
};

/**
 * Get the sprite URL for a building type
 */
export function getBuildingSpriteUrl(buildingTypeId: string): string | null {
  const sprite = BUILDING_SPRITES[buildingTypeId];
  if (!sprite) return null;
  return `${SPRITE_BASE_URL}/building_sprite/${sprite.key}_v${sprite.variant}.webp`;
}

/**
 * Get the sprite height for a building type
 */
export function getBuildingSpriteHeight(buildingTypeId: string): number {
  const sprite = BUILDING_SPRITES[buildingTypeId];
  return sprite?.height ?? 64;
}

/**
 * Grid (x,y) to screen position - simple square tile math
 * @param gridX Grid X coordinate relative to center
 * @param gridY Grid Y coordinate relative to center
 * @param centerX Screen center X
 * @param centerY Screen center Y
 * @param zoom Zoom factor
 */
export function gridToScreen(
  gridX: number,
  gridY: number,
  centerX: number,
  centerY: number,
  zoom: number = 1
): { screenX: number; screenY: number } {
  const tileSize = TILE_SIZE * zoom;
  const screenX = centerX + gridX * tileSize;
  const screenY = centerY + gridY * tileSize;
  return { screenX, screenY };
}

/**
 * Screen position to grid (x,y) - simple square tile math
 */
export function screenToGrid(
  screenX: number,
  screenY: number,
  centerX: number,
  centerY: number,
  zoom: number = 1
): { gridX: number; gridY: number } {
  const tileSize = TILE_SIZE * zoom;
  const relX = screenX - centerX;
  const relY = screenY - centerY;

  const gridX = Math.floor(relX / tileSize + 0.5);
  const gridY = Math.floor(relY / tileSize + 0.5);

  return { gridX, gridY };
}

/**
 * Wrap coordinates for infinite scrolling
 */
export function wrapCoordinate(coord: number, mapSize: number): number {
  return ((coord % mapSize) + mapSize) % mapSize;
}

/**
 * Sort tiles back-to-front for proper overlap rendering
 * For square tiles viewed from above, we render row by row (top to bottom)
 */
export function sortTilesForRendering(
  tiles: Array<{ x: number; y: number }>
): Array<{ x: number; y: number }> {
  return [...tiles].sort((a, b) => {
    // Render top to bottom (by y), then left to right (by x)
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });
}

/**
 * Get visible tile coordinates for the viewport
 */
export function getVisibleTiles(
  centerX: number,
  centerY: number,
  mapWidth: number,
  mapHeight: number,
  viewportRadius: number = Math.ceil(VIEWPORT_TILES / 2) + 2
): Array<{ x: number; y: number }> {
  const result: Array<{ x: number; y: number }> = [];

  for (let dy = -viewportRadius; dy <= viewportRadius; dy++) {
    for (let dx = -viewportRadius; dx <= viewportRadius; dx++) {
      const x = wrapCoordinate(centerX + dx, mapWidth);
      const y = wrapCoordinate(centerY + dy, mapHeight);
      result.push({ x, y });
    }
  }

  return sortTilesForRendering(result);
}

/**
 * Calculate relative position from center, handling map wrapping
 */
export function getRelativePosition(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  mapWidth: number,
  mapHeight: number
): { relX: number; relY: number } {
  let relX = x - centerX;
  let relY = y - centerY;

  // Handle wrapping - choose shortest path
  if (relX > mapWidth / 2) relX -= mapWidth;
  if (relX < -mapWidth / 2) relX += mapWidth;
  if (relY > mapHeight / 2) relY -= mapHeight;
  if (relY < -mapHeight / 2) relY += mapHeight;

  return { relX, relY };
}
