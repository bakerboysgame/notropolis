import { TerrainType } from '../../../../types/game';

const R2_BASE = 'https://assets.notropolis.net';

const TERRAIN_MAPPING: Record<TerrainType, string> = {
  free_land: 'grass_bg_v3.webp',
  road: 'road.webp',
  water: 'water.webp',
  dirt_track: 'dirt.webp',
  trees: 'trees.webp',
};

export function getTerrainUrl(terrainType: TerrainType): string {
  const filename = TERRAIN_MAPPING[terrainType] || TERRAIN_MAPPING.free_land;
  return `${R2_BASE}/sprites/terrain/${filename}`;
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
