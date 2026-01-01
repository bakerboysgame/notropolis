/**
 * Building Types - Mirrors database building_types table
 *
 * Used for level unlock display and building type references
 */

export interface BuildingTypeInfo {
  id: string;
  name: string;
  cost: number;
  baseProfit: number;
  levelRequired: number;
  requiresLicense: boolean;
  description: string;
  icon: string;
}

export const BUILDING_TYPES: Record<string, BuildingTypeInfo> = {
  // Level 1 buildings
  market_stall: {
    id: 'market_stall',
    name: 'Market Stall',
    cost: 1000,
    baseProfit: 100,
    levelRequired: 1,
    requiresLicense: false,
    description: 'Small outdoor selling spot',
    icon: '🏪',
  },
  hot_dog_stand: {
    id: 'hot_dog_stand',
    name: 'Hot Dog Stand',
    cost: 1500,
    baseProfit: 150,
    levelRequired: 1,
    requiresLicense: false,
    description: 'Street food vendor',
    icon: '🌭',
  },
  campsite: {
    id: 'campsite',
    name: 'Campsite',
    cost: 3000,
    baseProfit: 300,
    levelRequired: 1,
    requiresLicense: false,
    description: 'Outdoor camping facility',
    icon: '⛺',
  },
  shop: {
    id: 'shop',
    name: 'Shop',
    cost: 4000,
    baseProfit: 400,
    levelRequired: 1,
    requiresLicense: false,
    description: 'Retail storefront',
    icon: '🏬',
  },

  // Level 2 buildings
  burger_bar: {
    id: 'burger_bar',
    name: 'Burger Bar',
    cost: 8000,
    baseProfit: 800,
    levelRequired: 2,
    requiresLicense: false,
    description: 'Fast food restaurant',
    icon: '🍔',
  },
  motel: {
    id: 'motel',
    name: 'Motel',
    cost: 12000,
    baseProfit: 1200,
    levelRequired: 2,
    requiresLicense: false,
    description: 'Roadside lodging',
    icon: '🏨',
  },

  // Level 3 buildings
  high_street_store: {
    id: 'high_street_store',
    name: 'High Street Store',
    cost: 20000,
    baseProfit: 2000,
    levelRequired: 3,
    requiresLicense: false,
    description: 'Premium retail location',
    icon: '🏢',
  },
  restaurant: {
    id: 'restaurant',
    name: 'Restaurant',
    cost: 40000,
    baseProfit: 4000,
    levelRequired: 3,
    requiresLicense: true,
    description: 'Full dining establishment',
    icon: '🍽️',
  },

  // Level 4 buildings
  manor: {
    id: 'manor',
    name: 'Manor',
    cost: 60000,
    baseProfit: 6000,
    levelRequired: 4,
    requiresLicense: true,
    description: 'Luxury estate property',
    icon: '🏰',
  },

  // Level 5 buildings
  casino: {
    id: 'casino',
    name: 'Casino',
    cost: 80000,
    baseProfit: 8000,
    levelRequired: 5,
    requiresLicense: true,
    description: 'High-stakes gaming venue',
    icon: '🎰',
  },
};

/**
 * Get all building types available at a specific level
 */
export function getBuildingsAtLevel(level: number): BuildingTypeInfo[] {
  return Object.values(BUILDING_TYPES).filter(b => b.levelRequired === level);
}

/**
 * Get all building types available up to and including a level
 */
export function getBuildingsUpToLevel(level: number): BuildingTypeInfo[] {
  return Object.values(BUILDING_TYPES).filter(b => b.levelRequired <= level);
}

/**
 * Get building type by ID
 */
export function getBuildingById(id: string): BuildingTypeInfo | undefined {
  return BUILDING_TYPES[id];
}
