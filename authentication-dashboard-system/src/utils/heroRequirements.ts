/**
 * Hero System Requirements and Calculations
 *
 * Players can "hero out" when they meet one of three conditions:
 * 1. Net worth threshold (cash + 50% building value)
 * 2. Cash only threshold
 * 3. Land ownership streak (maintain X% of land for Y ticks)
 */

export interface HeroRequirements {
  netWorth: number;
  cash: number;
  landPercentage: number;
  landStreakTicks: number;
  unlocks: 'city' | 'capital' | null;
}

export interface HeroProgress {
  location: 'town' | 'city' | 'capital';
  requirements: HeroRequirements;

  // Path 1: Net Worth
  currentNetWorth: number;
  netWorthProgress: number; // 0-100
  canHeroNetWorth: boolean;

  // Path 2: Cash Only
  currentCash: number;
  cashProgress: number; // 0-100
  canHeroCash: boolean;

  // Path 3: Land Ownership
  currentLandPercentage: number;
  landPercentageProgress: number; // 0-100
  currentStreak: number;
  streakProgress: number; // 0-100
  canHeroLand: boolean;

  // Overall
  canHero: boolean;
  bestPath: 'netWorth' | 'cash' | 'land' | null;
}

export interface BuildingSummary {
  id: string;
  name: string;
  cost: number;
}

export interface HeroSummary {
  buildings: BuildingSummary[];
  totalBuildingValue: number;
  currentCash: number;
  totalToOffshore: number;
  newLocation: 'city' | 'capital' | null;
}

/**
 * Hero requirements by location type
 */
export const HERO_REQUIREMENTS: Record<'town' | 'city' | 'capital', HeroRequirements> = {
  town: {
    netWorth: 5_500_000,
    cash: 4_000_000,
    landPercentage: 6,
    landStreakTicks: 6, // 1 hour (6 ticks * 10 min)
    unlocks: 'city',
  },
  city: {
    netWorth: 50_000_000,
    cash: 40_000_000,
    landPercentage: 4,
    landStreakTicks: 6,
    unlocks: 'capital',
  },
  capital: {
    netWorth: 500_000_000,
    cash: 400_000_000,
    landPercentage: 3,
    landStreakTicks: 6,
    unlocks: null, // End game
  },
};

/**
 * Starting cash when joining a new location
 */
export const STARTING_CASH: Record<'town' | 'city' | 'capital', number> = {
  town: 50_000,
  city: 1_000_000,
  capital: 5_000_000,
};

/**
 * Calculate hero progress for a company
 */
export function getHeroProgress(
  locationType: 'town' | 'city' | 'capital',
  cash: number,
  buildingsTotalValue: number,
  landPercentage: number,
  landOwnershipStreak: number
): HeroProgress {
  const requirements = HERO_REQUIREMENTS[locationType];
  // Buildings sell at full value for hero
  const netWorth = cash + buildingsTotalValue;

  // Path 1: Net Worth
  const netWorthProgress = Math.min(100, (netWorth / requirements.netWorth) * 100);
  const canHeroNetWorth = netWorth >= requirements.netWorth;

  // Path 2: Cash Only
  const cashProgress = Math.min(100, (cash / requirements.cash) * 100);
  const canHeroCash = cash >= requirements.cash;

  // Path 3: Land Ownership
  const landPercentageProgress = Math.min(100, (landPercentage / requirements.landPercentage) * 100);
  const streakProgress = Math.min(100, (landOwnershipStreak / requirements.landStreakTicks) * 100);
  const canHeroLand =
    landPercentage >= requirements.landPercentage &&
    landOwnershipStreak >= requirements.landStreakTicks;

  const canHero = canHeroNetWorth || canHeroCash || canHeroLand;

  // Determine best path (highest progress)
  let bestPath: 'netWorth' | 'cash' | 'land' | null = null;
  if (canHero) {
    if (canHeroNetWorth) bestPath = 'netWorth';
    else if (canHeroCash) bestPath = 'cash';
    else if (canHeroLand) bestPath = 'land';
  } else {
    // Show which path is closest
    const landCombinedProgress = (landPercentageProgress + streakProgress) / 2;
    if (netWorthProgress >= cashProgress && netWorthProgress >= landCombinedProgress) {
      bestPath = 'netWorth';
    } else if (cashProgress >= landCombinedProgress) {
      bestPath = 'cash';
    } else {
      bestPath = 'land';
    }
  }

  return {
    location: locationType,
    requirements,
    currentNetWorth: netWorth,
    netWorthProgress,
    canHeroNetWorth,
    currentCash: cash,
    cashProgress,
    canHeroCash,
    currentLandPercentage: landPercentage,
    landPercentageProgress,
    currentStreak: landOwnershipStreak,
    streakProgress,
    canHeroLand,
    canHero,
    bestPath,
  };
}

/**
 * Format large numbers for display
 */
export function formatHeroAmount(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  }
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(0)}K`;
  }
  return `$${amount.toLocaleString()}`;
}

/**
 * Get display name for location type
 */
export function getLocationDisplayName(location: 'town' | 'city' | 'capital'): string {
  switch (location) {
    case 'town':
      return 'Town';
    case 'city':
      return 'City';
    case 'capital':
      return 'Capital';
  }
}

/**
 * Calculate hero summary for confirmation modal
 */
export function calculateHeroSummary(
  buildings: Array<{ id: string; name: string; cost: number }>,
  currentCash: number,
  unlocksLocation: 'city' | 'capital' | null
): HeroSummary {
  const buildingSummaries: BuildingSummary[] = buildings.map((b) => ({
    id: b.id,
    name: b.name,
    cost: b.cost,
  }));

  const totalBuildingValue = buildings.reduce((sum, b) => sum + b.cost, 0);
  // Buildings sell at full value (net worth = offshore)
  const totalToOffshore = currentCash + totalBuildingValue;

  return {
    buildings: buildingSummaries,
    totalBuildingValue,
    currentCash,
    totalToOffshore,
    newLocation: unlocksLocation,
  };
}
