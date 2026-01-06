import { TerrainType } from '../../../../types/game';

// Local terrain tiles (pogicity-style isometric diamonds)
const LOCAL_TERRAIN_MAPPING: Record<TerrainType, string> = {
  free_land: '/Tiles/1x1grass.png',
  road: '/Tiles/1x1asphalt.png',
  water: '/Tiles/1x1snow_tile_1.png', // use snow as water placeholder
  dirt_track: '/Tiles/1x1tile.png',
  trees: '/Tiles/1x1grass.png', // trees render on grass base
  snow: '/Tiles/1x1snow_tile_1.png',
  sand: '/Tiles/1x1tile.png', // placeholder
  mountain: '/Tiles/1x1grass.png', // placeholder
};

// Local pogicity building mapping (building_type_id -> local path)
// Using south-facing variants as default view
const LOCAL_BUILDING_MAPPING: Record<string, string> = {
  // Commercial
  checkers: '/Building/commercial/2x2checkers_south.png',
  dunkin: '/Building/commercial/2x2dunkin_south.png',
  martini_bar: '/Building/commercial/2x2martini_bar_south.png',
  popeyes: '/Building/commercial/2x2popeyes_south.png',
  // Residential
  english_townhouse: '/Building/residential/2x2english_townhouse_south.png',
  limestone: '/Building/residential/2x2limestone_south.png',
  romanesque: '/Building/residential/2x2romanesque_2_south.png',
  sf_apartments: '/Building/residential/2x2sf_green_apartments_south.png',
  marina_house: '/Building/residential/2x2sf_marina_house_south.png',
  yellow_apartments: '/Building/residential/2x2yellow_apartments_south.png',
  // Civic
  city_hall: '/Building/civic/3x3city_hall_south.png',
  fire_station: '/Building/civic/2x2fire_station_south.png',
  // Landmark
  empire_state: '/Building/landmark/3x3empire_state_south.png',
  flatiron: '/Building/landmark/2x2flatiron_south.png',
};

// Default fallback building
const DEFAULT_BUILDING = '/Building/commercial/2x2checkers_south.png';

export function getTerrainUrl(terrainType: TerrainType): string {
  return LOCAL_TERRAIN_MAPPING[terrainType] || LOCAL_TERRAIN_MAPPING.free_land;
}

export function getTerrainTextureKey(terrainType: TerrainType, variant?: string | null): string {
  if (variant && terrainType === 'road') {
    return `terrain_${terrainType}_${variant}`;
  }
  return `terrain_${terrainType}`;
}

// Get terrain variant URL from R2 storage
export function getTerrainVariantUrl(terrainType: TerrainType, variant?: string | null): string {
  const R2_BASE = 'https://assets.notropolis.net';

  // If variant specified and terrain type is road, return variant-specific URL
  if (variant && terrainType === 'road') {
    return `${R2_BASE}/sprites/terrain/road_${variant}.webp`;
  }

  // Otherwise return base terrain URL from R2
  const r2Mapping: Record<TerrainType, string> = {
    free_land: `${R2_BASE}/sprites/terrain/grass_bg.webp`,
    road: `${R2_BASE}/sprites/terrain/road.webp`,
    water: `${R2_BASE}/sprites/terrain/water.webp`,
    dirt_track: `${R2_BASE}/sprites/terrain/dirt.webp`,
    trees: `${R2_BASE}/sprites/terrain/trees.webp`,
    snow: `${R2_BASE}/sprites/terrain/snow.webp`,
    sand: `${R2_BASE}/sprites/terrain/sand.webp`,
    mountain: `${R2_BASE}/sprites/terrain/mountain.webp`,
  };

  return r2Mapping[terrainType] || r2Mapping.free_land;
}

export function getBuildingUrl(buildingTypeId: string): string {
  return LOCAL_BUILDING_MAPPING[buildingTypeId] || DEFAULT_BUILDING;
}

export function getBuildingTextureKey(buildingTypeId: string): string {
  return `building_${buildingTypeId}`;
}

// Outlines not available for pogicity buildings - return empty
export function getOutlineUrl(_buildingTypeId: string): string {
  return '';
}

export function getOutlineTextureKey(buildingTypeId: string): string {
  return `outline_${buildingTypeId}`;
}

// Demolished building - use a placeholder for now
export function getDemolishedUrl(): string {
  return '/Building/residential/2x2limestone_south.png'; // placeholder
}

export const DEMOLISHED_TEXTURE_KEY = 'building_demolished';

// Export available building types for UI
export const AVAILABLE_BUILDING_TYPES = Object.keys(LOCAL_BUILDING_MAPPING);
