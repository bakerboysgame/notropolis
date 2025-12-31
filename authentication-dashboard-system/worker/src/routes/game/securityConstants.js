/**
 * Security System Constants and Cost Calculations
 * Security costs are proportional to building value
 */

export const SECURITY_OPTIONS = {
  cameras: {
    id: 'cameras',
    name: 'Security Cameras',
    icon: '📷',
    costMultiplier: 0.10,  // 10% of building cost
    minCost: 500,
    catchBonus: 0.10,
    description: 'Record evidence of attackers. +10% catch rate.',
  },
  guard_dogs: {
    id: 'guard_dogs',
    name: 'Guard Dogs',
    icon: '🐕',
    costMultiplier: 0.15,  // 15% of building cost
    minCost: 750,
    catchBonus: 0.15,
    description: 'Dogs patrol the perimeter. +15% catch rate.',
  },
  security_guards: {
    id: 'security_guards',
    name: 'Security Guards',
    icon: '👮',
    costMultiplier: 0.25,  // 25% of building cost
    minCost: 1500,
    catchBonus: 0.25,
    description: '24/7 human security. +25% catch rate.',
  },
  sprinklers: {
    id: 'sprinklers',
    name: 'Fire Sprinklers',
    icon: '💦',
    costMultiplier: 0.20,  // 20% of building cost
    minCost: 1000,
    catchBonus: 0, // Doesn't help catch, only fire suppression
    description: 'Automatic fire suppression. Prevents fire spread.',
  },
};

// Column names in building_security table for each security type
export const SECURITY_COLUMNS = {
  cameras: 'has_cameras',
  guard_dogs: 'has_guard_dogs',
  security_guards: 'has_security_guards',
  sprinklers: 'has_sprinklers',
};

/**
 * Calculate purchase cost based on building value
 * Formula: max(minCost, buildingCost * costMultiplier)
 */
export function calculateSecurityCost(option, buildingCost) {
  return Math.max(option.minCost, Math.round(buildingCost * option.costMultiplier));
}

/**
 * Calculate monthly cost (10% of purchase cost)
 */
export function calculateMonthlyCost(purchaseCost) {
  return Math.round(purchaseCost * 0.10);
}

/**
 * Calculate total catch bonus from all installed security
 */
export function calculateSecurityCatchBonus(security) {
  if (!security) return 0;
  let bonus = 0;
  if (security.has_cameras) bonus += SECURITY_OPTIONS.cameras.catchBonus;
  if (security.has_guard_dogs) bonus += SECURITY_OPTIONS.guard_dogs.catchBonus;
  if (security.has_security_guards) bonus += SECURITY_OPTIONS.security_guards.catchBonus;
  return bonus;
}
