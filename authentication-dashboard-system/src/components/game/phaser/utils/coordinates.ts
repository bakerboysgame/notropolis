import { TILE_WIDTH, TILE_HEIGHT, GRID_OFFSET_X, GRID_OFFSET_Y } from '../gameConfig';

// Pogocity approach - EXACT MATCH
export function gridToScreen(gridX: number, gridY: number): { x: number; y: number } {
  return {
    x: GRID_OFFSET_X + (gridX - gridY) * (TILE_WIDTH / 2),
    y: GRID_OFFSET_Y + (gridX + gridY) * (TILE_HEIGHT / 2),
  };
}

export function screenToGrid(screenX: number, screenY: number): { x: number; y: number } {
  const relX = screenX - GRID_OFFSET_X;
  const relY = screenY - GRID_OFFSET_Y;
  const halfW = TILE_WIDTH / 2;
  const halfH = TILE_HEIGHT / 2;
  return {
    x: Math.round((relX / halfW + relY / halfH) / 2),
    y: Math.round((relY / halfH - relX / halfW) / 2),
  };
}
