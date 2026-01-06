import { TerrainType } from '../../../../types/game';

const R2_BASE = 'https://assets.notropolis.net';

// Local terrain tiles (pogicity-style isometric diamonds)
const LOCAL_TERRAIN_MAPPING: Record<TerrainType, string> = {
  free_land: '/Tiles/1x1grass.png',
  road: '/Tiles/1x1asphalt.png',
  water: '/Tiles/1x1snow_tile_1.png', // use snow as water placeholder
  dirt_track: '/Tiles/1x1tile.png',
  trees: '/Tiles/1x1grass.png', // trees render on grass base
};

export function getTerrainUrl(terrainType: TerrainType): string {
  return LOCAL_TERRAIN_MAPPING[terrainType] || LOCAL_TERRAIN_MAPPING.free_land;
}

export function getTerrainTextureKey(terrainType: TerrainType): string {
  return `terrain_${terrainType}`;
}

export function getBuildingUrl(buildingTypeId: string): string {
  return `${R2_BASE}/sprites/building_sprite/${buildingTypeId}.webp`;
}

export function getBuildingTextureKey(buildingTypeId: string): string {
  return `building_${buildingTypeId}`;
}

export function getOutlineUrl(buildingTypeId: string): string {
  return `${R2_BASE}/sprites/building_sprite/${buildingTypeId}_outline.webp`;
}

export function getOutlineTextureKey(buildingTypeId: string): string {
  return `outline_${buildingTypeId}`;
}

export function getDemolishedUrl(): string {
  return `${R2_BASE}/sprites/building_sprite/demolished.webp`;
}

export const DEMOLISHED_TEXTURE_KEY = 'building_demolished';
