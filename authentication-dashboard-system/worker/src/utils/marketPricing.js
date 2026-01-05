/**
 * Market Pricing Utilities
 * Calculates pricing for property sales in the market system
 */

import { calculateLandCost } from '../adjacencyCalculator.js';

/**
 * Calculate the value when selling a building to the state
 * Base: 50% of building value + land value
 * Uses dynamic calculated_value if available, falls back to building type cost
 * Adjusted by damage (using same formula as profit calculation)
 *
 * @param {Object} building - Building instance with damage_percent and optional calculated_value
 * @param {Object} buildingType - Building type with cost
 * @param {Object} tile - Tile with x, y, terrain_type
 * @param {Object} map - Map with location_type
 * @returns {number} Final sale value
 */
export function calculateSellToStateValue(building, buildingType, tile, map) {
  // Use dynamic value if available, otherwise fall back to cost
  const baseValue = building.calculated_value || buildingType.cost;
  // Base: 50% of building value
  const buildingValue = Math.round(baseValue * 0.5);

  // Damage reduces value (using same formula as profit: 85% damage = 15% health = worthless)
  // At 85% damage (100% health loss), health multiplier = (100 - 85 * 1.176) / 100 = 0
  const healthMultiplier = Math.max(0, (100 - building.damage_percent * 1.176) / 100);
  const adjustedBuildingValue = Math.round(buildingValue * healthMultiplier);

  // Land value (original purchase price)
  const landValue = calculateLandCost(tile, map);

  return adjustedBuildingValue + landValue;
}

/**
 * Calculate minimum listing price for selling to other players
 * Minimum: 80% of building value (uses dynamic value if available)
 *
 * @param {Object} building - Building instance with optional calculated_value
 * @param {Object} buildingType - Building type with cost
 * @returns {number} Minimum listing price
 */
export function calculateMinListingPrice(building, buildingType) {
  // Use dynamic value if available, otherwise fall back to cost
  const baseValue = building.calculated_value || buildingType.cost;
  // Minimum listing: 80% of building value
  return Math.round(baseValue * 0.8);
}

/**
 * Calculate inflated price for buying from other players (not listed)
 * Used for future offer system
 * 200% of building value + land value + profit premium
 *
 * @param {Object} building - Building instance with calculated_profit and optional calculated_value
 * @param {Object} buildingType - Building type with cost
 * @param {Object} tile - Tile with x, y, terrain_type
 * @param {Object} map - Map with location_type
 * @returns {number} Inflated buy price
 */
export function calculateBuyFromPlayerPrice(building, buildingType, tile, map) {
  // Use dynamic value if available, otherwise fall back to cost
  const baseValue = building.calculated_value || buildingType.cost;
  // If not for sale, calculate inflated price
  // 200% of building value + land value + profit premium
  const buildingValue = baseValue * 2;
  const landValue = calculateLandCost(tile, map);
  const profitPremium = building.calculated_profit * 10; // 10 ticks worth

  return Math.round(buildingValue + landValue + profitPremium);
}
