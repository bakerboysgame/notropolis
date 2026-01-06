/**
 * Market Pricing Utilities - Frontend Mirror
 * These functions mirror the backend pricing calculations for preview purposes
 */

interface Building {
  damage_percent: number;
  calculated_value?: number;
}

interface BuildingType {
  cost: number;
}

interface Tile {
  terrain_type: string;
}

interface Map {
  location_type: string;
}

/**
 * Calculate land cost based on terrain and location
 */
export function calculateLandCost(tile: Tile, map: Map): number {
  let baseCost = 500; // Base cost for free land

  // Terrain multipliers
  const terrainMultipliers: Record<string, number> = {
    free_land: 1.0,
    road: 0, // Can't buy road tiles
    water: 0, // Can't buy water tiles
    dirt_track: 0.8,
    trees: 1.2,
  };

  if (terrainMultipliers[tile.terrain_type] === 0) {
    throw new Error('Cannot purchase this tile type');
  }

  baseCost *= terrainMultipliers[tile.terrain_type] || 1.0;

  // Location type modifier
  const locationMultipliers: Record<string, number> = {
    town: 1.0,
    city: 5.0,
    capital: 20.0,
  };
  baseCost *= locationMultipliers[map.location_type] || 1.0;

  return Math.round(baseCost);
}

/**
 * Calculate the value when selling a building to the state
 * Uses dynamic calculated_value if available, falls back to building type cost
 */
export function calculateSellToStateValue(
  building: Building,
  buildingType: BuildingType,
  tile: Tile,
  map: Map
): number {
  // Use dynamic value if available, otherwise fall back to cost
  const baseValue = building.calculated_value || buildingType.cost;
  // Base: 50% of building value
  const buildingValue = Math.round(baseValue * 0.5);

  // Damage reduces value (using same formula as profit: 85% damage = 15% health = worthless)
  const healthMultiplier = Math.max(0, (100 - building.damage_percent * 1.176) / 100);
  const adjustedBuildingValue = Math.round(buildingValue * healthMultiplier);

  // Land value
  const landValue = calculateLandCost(tile, map);

  return adjustedBuildingValue + landValue;
}

/**
 * Calculate minimum listing price for selling to other players
 * Uses dynamic calculated_value if available, falls back to building type cost
 */
export function calculateMinListingPrice(building: Building, buildingType: BuildingType): number {
  // Use dynamic value if available, otherwise fall back to cost
  const baseValue = building.calculated_value || buildingType.cost;
  // Minimum listing: 80% of building value
  return Math.round(baseValue * 0.8);
}
