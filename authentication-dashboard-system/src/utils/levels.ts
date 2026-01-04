/**
 * Level Progression System
 *
 * Players level up by meeting BOTH cash AND action thresholds.
 * Each level unlocks new building types and dirty tricks.
 */

import { DIRTY_TRICKS, type TrickType } from './dirtyTricks';
import { BUILDING_TYPES, type BuildingTypeInfo } from './buildingTypes';

export interface LevelThreshold {
  level: number;
  cashRequired: number;
  actionsRequired: number;
}

export interface LevelProgress {
  currentLevel: number;
  nextLevel: number | null;
  cashProgress: number; // 0-100 percentage
  actionsProgress: number; // 0-100 percentage
  cashRequired: number;
  actionsRequired: number;
  cashCurrent: number;
  actionsCurrent: number;
  isMaxLevel: boolean;
}

export interface LevelUnlock {
  type: 'building' | 'trick';
  id: string;
  name: string;
  description?: string;
}

export interface LevelUnlocks {
  level: number;
  buildings: LevelUnlock[];
  tricks: LevelUnlock[];
}

/**
 * Level thresholds - both cash AND actions must be met
 */
export const LEVELS: LevelThreshold[] = [
  { level: 1, cashRequired: 0, actionsRequired: 0 },
  { level: 2, cashRequired: 50000, actionsRequired: 50 },
  { level: 3, cashRequired: 1000000, actionsRequired: 300 },
  { level: 4, cashRequired: 5000000, actionsRequired: 1000 },
  { level: 5, cashRequired: 25000000, actionsRequired: 5000 },
];

export const MAX_LEVEL = 5;

/**
 * Get building unlocks for a specific level from BUILDING_TYPES
 */
function getBuildingUnlocksForLevel(level: number): BuildingTypeInfo[] {
  return Object.values(BUILDING_TYPES).filter(b => b.levelRequired === level);
}

/**
 * Trick unlocks per level - from dirtyTricks.ts
 */
export const TRICK_UNLOCKS: Record<number, TrickType[]> = {
  1: ['graffiti', 'smoke_bomb', 'fire_bomb'],
  2: ['stink_bomb'],
  3: ['cluster_bomb'],
  5: ['destruction_bomb'],
};

/**
 * Calculate the current level based on cash and total actions.
 * Both thresholds must be met to achieve a level.
 */
export function getCurrentLevel(cash: number, totalActions: number): number {
  let currentLevel = 1;

  for (const threshold of LEVELS) {
    if (cash >= threshold.cashRequired && totalActions >= threshold.actionsRequired) {
      currentLevel = threshold.level;
    } else {
      break;
    }
  }

  return currentLevel;
}

/**
 * Get detailed progress towards the next level
 */
export function getLevelProgress(cash: number, totalActions: number): LevelProgress {
  const currentLevel = getCurrentLevel(cash, totalActions);
  const isMaxLevel = currentLevel >= MAX_LEVEL;

  if (isMaxLevel) {
    const lastThreshold = LEVELS[LEVELS.length - 1];
    return {
      currentLevel,
      nextLevel: null,
      cashProgress: 100,
      actionsProgress: 100,
      cashRequired: lastThreshold.cashRequired,
      actionsRequired: lastThreshold.actionsRequired,
      cashCurrent: cash,
      actionsCurrent: totalActions,
      isMaxLevel: true,
    };
  }

  const nextThreshold = LEVELS[currentLevel]; // LEVELS[1] for level 2, etc.
  const currentThreshold = LEVELS[currentLevel - 1];

  // Calculate progress as percentage between current and next threshold
  const cashRange = nextThreshold.cashRequired - currentThreshold.cashRequired;
  const actionsRange = nextThreshold.actionsRequired - currentThreshold.actionsRequired;

  const cashFromCurrent = cash - currentThreshold.cashRequired;
  const actionsFromCurrent = totalActions - currentThreshold.actionsRequired;

  const cashProgress = cashRange > 0
    ? Math.min(100, Math.max(0, (cashFromCurrent / cashRange) * 100))
    : 100;

  const actionsProgress = actionsRange > 0
    ? Math.min(100, Math.max(0, (actionsFromCurrent / actionsRange) * 100))
    : 100;

  return {
    currentLevel,
    nextLevel: currentLevel + 1,
    cashProgress,
    actionsProgress,
    cashRequired: nextThreshold.cashRequired,
    actionsRequired: nextThreshold.actionsRequired,
    cashCurrent: cash,
    actionsCurrent: totalActions,
    isMaxLevel: false,
  };
}

/**
 * Get all unlocks available at a specific level
 */
export function getUnlocksAtLevel(level: number): LevelUnlocks {
  const buildingInfos = getBuildingUnlocksForLevel(level);
  const buildings: LevelUnlock[] = buildingInfos.map(b => ({
    type: 'building' as const,
    id: b.id,
    name: b.name,
    description: b.description,
  }));

  const tricks: LevelUnlock[] = (TRICK_UNLOCKS[level] || []).map(trickId => ({
    type: 'trick' as const,
    id: trickId,
    name: DIRTY_TRICKS[trickId].name,
    description: DIRTY_TRICKS[trickId].description,
  }));

  return { level, buildings, tricks };
}

/**
 * Get unlocks for the next level (for preview in progress bar)
 */
export function getNextLevelUnlocks(currentLevel: number): LevelUnlocks | null {
  if (currentLevel >= MAX_LEVEL) {
    return null;
  }
  return getUnlocksAtLevel(currentLevel + 1);
}

/**
 * Check if a level-up occurred after an action
 * Returns new level info if level changed, null otherwise
 */
export function checkLevelUp(
  previousLevel: number,
  newCash: number,
  newTotalActions: number
): { newLevel: number; unlocks: LevelUnlocks } | null {
  const newLevel = getCurrentLevel(newCash, newTotalActions);

  if (newLevel > previousLevel) {
    return {
      newLevel,
      unlocks: getUnlocksAtLevel(newLevel),
    };
  }

  return null;
}

/**
 * Format cash amount for display
 */
export function formatCash(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toLocaleString()}`;
}

/**
 * Format action count for display
 */
export function formatActions(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toLocaleString();
}
