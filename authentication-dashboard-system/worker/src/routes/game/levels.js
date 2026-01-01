/**
 * Level Progression System - Backend
 *
 * Handles level-up detection after game actions
 */

/**
 * Level thresholds - both cash AND actions must be met
 * Mirrors the frontend utils/levels.ts
 */
const LEVELS = [
  { level: 1, cashRequired: 0, actionsRequired: 0 },
  { level: 2, cashRequired: 50000, actionsRequired: 50 },
  { level: 3, cashRequired: 1000000, actionsRequired: 300 },
  { level: 4, cashRequired: 5000000, actionsRequired: 1000 },
  { level: 5, cashRequired: 25000000, actionsRequired: 5000 },
];

/**
 * Building unlocks per level
 */
const BUILDING_UNLOCKS = {
  1: ['market_stall', 'hot_dog_stand', 'campsite', 'shop'],
  2: ['burger_bar', 'motel'],
  3: ['high_street_store', 'restaurant'],
  4: ['manor'],
  5: ['casino'],
};

/**
 * Trick unlocks per level
 */
const TRICK_UNLOCKS = {
  1: ['graffiti', 'smoke_bomb'],
  2: ['stink_bomb'],
  3: ['cluster_bomb'],
  4: ['fire_bomb'],
  5: ['destruction_bomb'],
};

/**
 * Calculate current level based on cash and total actions
 */
function getCurrentLevel(cash, totalActions) {
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
 * Get unlocks for a specific level
 */
function getUnlocksAtLevel(level) {
  return {
    level,
    buildings: BUILDING_UNLOCKS[level] || [],
    tricks: TRICK_UNLOCKS[level] || [],
  };
}

/**
 * Check and update level after an action.
 * Returns level-up info if level changed, null otherwise.
 *
 * @param {Object} env - Cloudflare D1 environment
 * @param {string} companyId - The company ID
 * @param {number} previousLevel - The company's level before the action
 * @param {number} newCash - The company's cash after the action
 * @param {number} newTotalActions - The company's total_actions after the action
 * @param {string|null} mapId - The map ID for transaction logging (optional)
 * @returns {Promise<{newLevel: number, unlocks: Object}|null>}
 */
export async function checkAndUpdateLevel(env, companyId, previousLevel, newCash, newTotalActions, mapId = null) {
  const newLevel = getCurrentLevel(newCash, newTotalActions);

  if (newLevel <= previousLevel) {
    return null;
  }

  // Level up detected! Update the company's level
  const statements = [
    env.DB.prepare(
      'UPDATE game_companies SET level = ? WHERE id = ?'
    ).bind(newLevel, companyId),

    // Log level-up transaction
    env.DB.prepare(`
      INSERT INTO game_transactions (id, company_id, map_id, action_type, amount)
      VALUES (?, ?, ?, 'level_up', ?)
    `).bind(crypto.randomUUID(), companyId, mapId, newLevel),
  ];

  await env.DB.batch(statements);

  return {
    newLevel,
    unlocks: getUnlocksAtLevel(newLevel),
  };
}

/**
 * Post-action check helper for routes.
 * Call this after any action that increments total_actions.
 *
 * @param {Object} env - Cloudflare D1 environment
 * @param {string} companyId - The company ID
 * @param {number} previousLevel - The company's level before the action
 * @param {string|null} mapId - The map ID for transaction logging (optional)
 * @returns {Promise<{newLevel: number, unlocks: Object}|null>}
 */
export async function postActionCheck(env, companyId, previousLevel, mapId = null) {
  // Fetch current company state after action was performed
  const company = await env.DB.prepare(
    'SELECT cash, total_actions FROM game_companies WHERE id = ?'
  ).bind(companyId).first();

  if (!company) {
    return null;
  }

  return checkAndUpdateLevel(
    env,
    companyId,
    previousLevel,
    company.cash,
    company.total_actions,
    mapId
  );
}
