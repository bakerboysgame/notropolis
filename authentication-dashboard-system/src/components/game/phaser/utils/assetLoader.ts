import { TerrainType } from '../../../../types/game';

const R2_BASE = 'https://assets.notropolis.net';

// R2 terrain asset mapping - using available sprites from R2 bucket
// Available: grass_bg_v6, road_straight_v5, road_corner_v8, trees_v5
const R2_TERRAIN_MAPPING: Record<TerrainType, string> = {
  free_land: 'grass_bg_v6',
  road: 'road_straight_v5',
  water: 'grass_bg_v6', // fallback to grass until water sprite available
  dirt_track: 'grass_bg_v6', // fallback to grass until dirt sprite available
  trees: 'trees_v5',
};

export function getTerrainUrl(terrainType: TerrainType): string {
  const spriteKey = R2_TERRAIN_MAPPING[terrainType] || R2_TERRAIN_MAPPING.free_land;
  return `${R2_BASE}/sprites/terrain/${spriteKey}.webp`;
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
