import { TerrainType } from '../../../../types/game';
import {
  getBuildingMetadata,
  getBuildingFootprint,
  getBuildingRenderSize
} from '../../../../config/buildingMetadata';

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
  // Notropolis Level 1 (1x1 footprint)
  market_stall: '/Building/commercial/2x2dunkin_south.png',
  hot_dog_stand: '/Building/commercial/2x2popeyes_south.png',
  campsite: '/Building/residential/2x2english_townhouse_south.png',
  shop: '/Building/commercial/2x2checkers_south.png',

  // Notropolis Level 2 - use 2x2 sprites
  burger_bar: '/Building/commercial/2x2martini_bar_south.png',
  motel: '/Building/residential/2x2sf_marina_house_south.png',

  // Notropolis Level 3 (visual 2x2) - use 2x2 sprites
  high_street_store: '/Building/residential/2x2yellow_apartments_south.png',
  restaurant: '/Building/residential/2x2sf_green_apartments_south.png',

  // Notropolis Level 4 (visual 2x3) - use 3x3 sprite
  manor: '/Building/residential/3x3romanesque_duplex_south.png',

  // Notropolis Level 5 (visual 3x3) - use 3x3 sprite
  casino: '/Building/residential/3x380s_small_apartment_building_south.png',

  // Notropolis Special Buildings (visual 3x3) - use 4x4 sprites
  bank: '/Building/commercial/4x4bookstore_south.png',
  temple: '/Building/landmark/4x4hp_house_south.png',
  police_station: '/Building/residential/4x4medium_apartments_south.png',

  // State buildings (all placed on 1x1 tiles) - use 2x2 sprites
  claim_stake: '/Building/residential/2x2limestone_south.png',

  // Legacy pogocity buildings (keep for compatibility)
  checkers: '/Building/commercial/2x2checkers_south.png',
  dunkin: '/Building/commercial/2x2dunkin_south.png',
  martini_bar: '/Building/commercial/2x2martini_bar_south.png',
  popeyes: '/Building/commercial/2x2popeyes_south.png',
  english_townhouse: '/Building/residential/2x2english_townhouse_south.png',
  limestone: '/Building/residential/2x2limestone_south.png',
  romanesque: '/Building/residential/2x2romanesque_2_south.png',
  sf_apartments: '/Building/residential/2x2sf_green_apartments_south.png',
  marina_house: '/Building/residential/2x2sf_marina_house_south.png',
  yellow_apartments: '/Building/residential/2x2yellow_apartments_south.png',
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

// Get terrain variant URL - falls back to local sprites for roads
export function getTerrainVariantUrl(terrainType: TerrainType, variant?: string | null): string {
  // For road variants, use local asphalt sprite as fallback
  // TODO: Replace with actual road variant sprites (corners, junctions, etc.)
  if (variant && terrainType === 'road') {
    return LOCAL_TERRAIN_MAPPING.road; // Use local asphalt for all road variants
  }

  // For non-variant terrain, return local sprite
  return LOCAL_TERRAIN_MAPPING[terrainType] || LOCAL_TERRAIN_MAPPING.free_land;
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

// Demolished building - use small rubble sprite
export function getDemolishedUrl(): string {
  return '/Building/residential/2x2limestone_south.png'; // Small rubble-like building
}

export const DEMOLISHED_TEXTURE_KEY = 'building_demolished';

// Export available building types for UI
export const AVAILABLE_BUILDING_TYPES = Object.keys(LOCAL_BUILDING_MAPPING);

// ============================================
// SPRITE URL CACHE (populated from Asset Manager API)
// ============================================

// Cache of building sprite URLs from Asset Manager
// Key: building_type_id, Value: sprite URL (may require auth to load)
const buildingSpriteCache: Map<string, string> = new Map();

// Cache of blob URLs for Phaser (created from authenticated fetch)
// Key: building_type_id, Value: blob URL that can be used directly
const buildingBlobCache: Map<string, string> = new Map();

/**
 * Set sprite URL for a building type (called when loading from Asset Manager API)
 */
export function setBuildingSpriteUrl(buildingTypeId: string, url: string): void {
  buildingSpriteCache.set(buildingTypeId, url);
}

/**
 * Set blob URL for a building type (for Phaser loading after authenticated fetch)
 */
export function setBuildingBlobUrl(buildingTypeId: string, blobUrl: string): void {
  buildingBlobCache.set(buildingTypeId, blobUrl);
}

/**
 * Populate sprite cache from Asset Manager API response
 * Call this when game loads with data from authenticated API call
 * Format matches /api/assets/buildings/published response
 */
export function populateBuildingSpriteCache(
  sprites: Record<string, { url: string; outline_url?: string }>
): void {
  for (const [buildingTypeId, sprite] of Object.entries(sprites)) {
    if (sprite.url) {
      buildingSpriteCache.set(buildingTypeId, sprite.url);
    }
  }
}

/**
 * Get building sprite URL (with Asset Manager cache priority)
 * Priority: 1) Blob cache (ready for Phaser), 2) Asset Manager URL, 3) Local fallback, 4) Default
 *
 * NOTE: R2 URLs require authentication. For Phaser, use blob cache after
 * fetching with auth and converting to blob.
 */
export function getBuildingSpriteUrl(buildingTypeId: string): string {
  // First check blob cache (already authenticated and ready for Phaser)
  const blobUrl = buildingBlobCache.get(buildingTypeId);
  if (blobUrl) return blobUrl;

  // Check Asset Manager cache (may need auth to load)
  const cachedUrl = buildingSpriteCache.get(buildingTypeId);
  if (cachedUrl) return cachedUrl;

  // Fall back to getBuildingUrl which checks local mapping
  return getBuildingUrl(buildingTypeId);
}

/**
 * Clear blob cache (call on logout or when sprites are republished)
 */
export function clearBuildingBlobCache(): void {
  // Revoke all blob URLs to free memory
  for (const blobUrl of buildingBlobCache.values()) {
    URL.revokeObjectURL(blobUrl);
  }
  buildingBlobCache.clear();
}

// Export metadata helpers
export { getBuildingMetadata, getBuildingFootprint, getBuildingRenderSize };
