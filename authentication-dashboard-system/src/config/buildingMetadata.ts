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
  // Using 4×4 renderSize (8 slices: 4 left + 4 right)
  // Shows 176px of 512px sprite (34.4% coverage)

  // Level 1 buildings
  market_stall: {
    buildingTypeId: 'market_stall',
    footprint: { width: 1, height: 1 },
    renderSize: { width: 4, height: 4 },
  },
  hot_dog_stand: {
    buildingTypeId: 'hot_dog_stand',
    footprint: { width: 1, height: 1 },
    renderSize: { width: 4, height: 4 },
  },
  campsite: {
    buildingTypeId: 'campsite',
    footprint: { width: 1, height: 1 },
    renderSize: { width: 4, height: 4 },
  },
  shop: {
    buildingTypeId: 'shop',
    footprint: { width: 1, height: 1 },
    renderSize: { width: 4, height: 4 },
  },

  // Level 2 buildings
  burger_bar: {
    buildingTypeId: 'burger_bar',
    footprint: { width: 1, height: 1 },
    renderSize: { width: 4, height: 4 },
  },
  motel: {
    buildingTypeId: 'motel',
    footprint: { width: 4, height: 4 }, // 4×4 phaser tiles
    renderSize: { width: 4, height: 4 }, // 4×4 renderSize for slicing
  },

  // Level 3 buildings
  high_street_store: {
    buildingTypeId: 'high_street_store',
    footprint: { width: 1, height: 1 },
    renderSize: { width: 4, height: 4 },
  },
  restaurant: {
    buildingTypeId: 'restaurant',
    footprint: { width: 1, height: 1 },
    renderSize: { width: 4, height: 4 },
  },

  // Level 4 buildings
  manor: {
    buildingTypeId: 'manor',
    footprint: { width: 1, height: 1 },
    renderSize: { width: 4, height: 4 },
  },

  // Level 5 buildings
  casino: {
    buildingTypeId: 'casino',
    footprint: { width: 1, height: 1 },
    renderSize: { width: 4, height: 4 },
  },

  // Special buildings
  bank: {
    buildingTypeId: 'bank',
    footprint: { width: 4, height: 4 }, // 4×4 phaser tiles (pogocity sprite)
    renderSize: { width: 4, height: 4 },
  },
  temple: {
    buildingTypeId: 'temple',
    footprint: { width: 4, height: 4 }, // 4×4 phaser tiles (pogocity sprite)
    renderSize: { width: 4, height: 4 },
  },
  police_station: {
    buildingTypeId: 'police_station',
    footprint: { width: 4, height: 4 }, // 4×4 phaser tiles (pogocity sprite)
    renderSize: { width: 4, height: 4 },
  },

  // State buildings
  demolished: {
    buildingTypeId: 'demolished',
    footprint: { width: 1, height: 1 },
    renderSize: { width: 4, height: 4 },
  },
  claim_stake: {
    buildingTypeId: 'claim_stake',
    footprint: { width: 1, height: 1 },
    renderSize: { width: 4, height: 4 },
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
