/**
 * Top-down coordinate transformation utilities
 * Simple grid-based system (no isometric projection)
 */

// Top-down uses square tiles
export const TILE_SIZE = 64;
export const GRID_OFFSET_X = 100;
export const GRID_OFFSET_Y = 100;

/**
 * Convert grid coordinates to screen coordinates (top-down)
 */
export function gridToScreen(gridX: number, gridY: number) {
  return {
    x: GRID_OFFSET_X + gridX * TILE_SIZE,
    y: GRID_OFFSET_Y + gridY * TILE_SIZE,
  };
}

/**
 * Convert screen coordinates to grid coordinates (top-down)
 */
export function screenToGrid(screenX: number, screenY: number) {
  const relX = screenX - GRID_OFFSET_X;
  const relY = screenY - GRID_OFFSET_Y;
  return {
    x: Math.floor(relX / TILE_SIZE),
    y: Math.floor(relY / TILE_SIZE),
  };
}

/**
 * Get depth value for sorting (Y-based for top-down)
 */
export function getDepth(gridX: number, gridY: number, layerOffset: number = 0): number {
  return gridY * 1000 + gridX + layerOffset;
}
