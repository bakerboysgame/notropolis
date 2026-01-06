import { TILE_WIDTH, TILE_HEIGHT } from '../gameConfig';

export function gridToScreen(gridX: number, gridY: number): { x: number; y: number } {
  return {
    x: (gridX - gridY) * (TILE_WIDTH / 2),
    y: (gridX + gridY) * (TILE_HEIGHT / 2),
  };
}

export function screenToGrid(screenX: number, screenY: number): { x: number; y: number } {
  const halfW = TILE_WIDTH / 2;
  const halfH = TILE_HEIGHT / 2;
  return {
    x: Math.round((screenX / halfW + screenY / halfH) / 2),
    y: Math.round((screenY / halfH - screenX / halfW) / 2),
  };
}
