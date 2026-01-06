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
  // All buildings occupy 1 tile (database has UNIQUE constraint on tile_id)
  // Using 10×10 renderSize for maximum quality (20 slices: 10 left + 10 right)
  // Shows 85.9% of sprite (440px of 512px) vs 34.4% for 4×4

  // Level 1 buildings
  market_stall: {
    buildingTypeId: 'market_stall',
    footprint: { width: 1, height: 1 },
    renderSize: { width: 10, height: 10 },
  },
  hot_dog_stand: {
    buildingTypeId: 'hot_dog_stand',
    footprint: { width: 1, height: 1 },
    renderSize: { width: 10, height: 10 },
  },
  campsite: {
    buildingTypeId: 'campsite',
    footprint: { width: 1, height: 1 },
    renderSize: { width: 10, height: 10 },
  },
  shop: {
    buildingTypeId: 'shop',
    footprint: { width: 1, height: 1 },
    renderSize: { width: 10, height: 10 },
  },

  // Level 2 buildings
  burger_bar: {
    buildingTypeId: 'burger_bar',
    footprint: { width: 1, height: 1 },
    renderSize: { width: 10, height: 10 },
  },
  motel: {
    buildingTypeId: 'motel',
    footprint: { width: 1, height: 1 },
    renderSize: { width: 10, height: 10 },
  },

  // Level 3 buildings
  high_street_store: {
    buildingTypeId: 'high_street_store',
    footprint: { width: 1, height: 1 },
    renderSize: { width: 10, height: 10 },
  },
  restaurant: {
    buildingTypeId: 'restaurant',
    footprint: { width: 1, height: 1 },
    renderSize: { width: 10, height: 10 },
  },

  // Level 4 buildings
  manor: {
    buildingTypeId: 'manor',
    footprint: { width: 1, height: 1 },
    renderSize: { width: 10, height: 10 },
  },

  // Level 5 buildings
  casino: {
    buildingTypeId: 'casino',
    footprint: { width: 1, height: 1 },
    renderSize: { width: 10, height: 10 },
  },

  // Special buildings
  bank: {
    buildingTypeId: 'bank',
    footprint: { width: 1, height: 1 },
    renderSize: { width: 10, height: 10 },
  },
  temple: {
    buildingTypeId: 'temple',
    footprint: { width: 1, height: 1 },
    renderSize: { width: 10, height: 10 },
  },
  police_station: {
    buildingTypeId: 'police_station',
    footprint: { width: 1, height: 1 },
    renderSize: { width: 10, height: 10 },
  },

  // State buildings
  demolished: {
    buildingTypeId: 'demolished',
    footprint: { width: 1, height: 1 },
    renderSize: { width: 10, height: 10 },
  },
  claim_stake: {
    buildingTypeId: 'claim_stake',
    footprint: { width: 1, height: 1 },
    renderSize: { width: 10, height: 10 },
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
