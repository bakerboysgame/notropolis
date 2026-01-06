/**
 * Building Metadata - Footprint and visual configuration
 *
 * NOTE: Sprite URLs are NOT stored here - they come from the Asset Manager API.
 * This file only contains footprint/render size data for vertical slice rendering.
 */

export interface BuildingMetadata {
  buildingTypeId: string;
  footprint: { width: number; height: number };
  renderSize?: { width: number; height: number };
  offset?: { x: number; y: number };
  scale?: number;
}

export const BUILDING_METADATA: Record<string, BuildingMetadata> = {
  // Level 1 buildings (1×1)
  market_stall: {
    buildingTypeId: 'market_stall',
    footprint: { width: 1, height: 1 },
  },
  hot_dog_stand: {
    buildingTypeId: 'hot_dog_stand',
    footprint: { width: 1, height: 1 },
  },
  campsite: {
    buildingTypeId: 'campsite',
    footprint: { width: 1, height: 1 },
  },
  shop: {
    buildingTypeId: 'shop',
    footprint: { width: 1, height: 1 },
  },

  // Level 2 buildings
  burger_bar: {
    buildingTypeId: 'burger_bar',
    footprint: { width: 1, height: 1 },
  },
  motel: {
    buildingTypeId: 'motel',
    footprint: { width: 2, height: 1 },
  },

  // Level 3 buildings (2×2)
  high_street_store: {
    buildingTypeId: 'high_street_store',
    footprint: { width: 2, height: 2 },
  },
  restaurant: {
    buildingTypeId: 'restaurant',
    footprint: { width: 2, height: 2 },
  },

  // Level 4 buildings
  manor: {
    buildingTypeId: 'manor',
    footprint: { width: 2, height: 3 },
  },

  // Level 5 buildings (3×3)
  casino: {
    buildingTypeId: 'casino',
    footprint: { width: 3, height: 3 },
  },

  // Special buildings (3×3 or 3×2)
  bank: {
    buildingTypeId: 'bank',
    footprint: { width: 3, height: 3 },
  },
  temple: {
    buildingTypeId: 'temple',
    footprint: { width: 3, height: 3 },
  },
  police_station: {
    buildingTypeId: 'police_station',
    footprint: { width: 3, height: 2 },
  },

  // State buildings (1×1)
  demolished: {
    buildingTypeId: 'demolished',
    footprint: { width: 1, height: 1 },
  },
  claim_stake: {
    buildingTypeId: 'claim_stake',
    footprint: { width: 1, height: 1 },
  },
};

export function getBuildingMetadata(buildingTypeId: string): BuildingMetadata | undefined {
  return BUILDING_METADATA[buildingTypeId];
}

export function getBuildingFootprint(buildingTypeId: string): { width: number; height: number } {
  const metadata = BUILDING_METADATA[buildingTypeId];
  return metadata?.footprint || { width: 1, height: 1 };
}

export function getBuildingRenderSize(buildingTypeId: string): { width: number; height: number } {
  const metadata = BUILDING_METADATA[buildingTypeId];
  return metadata?.renderSize || metadata?.footprint || { width: 1, height: 1 };
}
