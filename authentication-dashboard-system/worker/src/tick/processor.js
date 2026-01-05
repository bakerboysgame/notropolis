/**
 * Main Tick Processor for Notropolis Game
 * Runs every 10 minutes via Cloudflare Workers cron trigger
 */

import { processMapProfits, updateIdleCompanies } from './profitCalculator.js';
import { processMapFires } from './fireSpread.js';
import { HERO_REQUIREMENTS, executeHeroOut } from '../routes/game/hero.js';

// Default number of ticks a company can be hero-eligible before forced hero-out
const DEFAULT_FORCED_HERO_TICKS = 6;

/**
 * Process a single game tick across all active maps
 * 1. Get all active maps
 * 2. For each map:
 *    - Process fire mechanics (damage, spread, extinguish)
 *    - Process profits (recalculate dirty buildings, distribute profits)
 * 3. Update idle companies (no buildings)
 * 4. Log tick history
 *
 * @param {Object} env - Worker environment with DB binding
 * @returns {Object} Tick processing statistics
 */
export async function processTick(env) {
  const startTime = Date.now();
  const tickId = crypto.randomUUID();

  console.log(`Starting tick processing: ${tickId}`);

  try {
    // Step 1: Get all active maps
    const activeMaps = await env.DB.prepare(
      'SELECT id FROM maps WHERE is_active = 1'
    ).all();

    if (activeMaps.results.length === 0) {
      console.log('No active maps found');
      return {
        tickId,
        mapsProcessed: 0,
        companiesUpdated: 0,
        buildingsRecalculated: 0,
        executionTimeMs: Date.now() - startTime
      };
    }

    // Aggregate statistics
    let totalCompaniesUpdated = 0;
    let totalBuildingsRecalculated = 0;
    let totalGrossProfit = 0;
    let totalTaxAmount = 0;
    let totalNetProfit = 0;
    let totalFiresStarted = 0;
    let totalFiresExtinguished = 0;
    let totalBuildingsDamaged = 0;
    let totalBuildingsCollapsed = 0;
    let totalLandStreaksUpdated = 0;
    let totalForcedHeroOuts = 0;

    // Step 2: Process each map
    for (const map of activeMaps.results) {
      try {
        // Process fires first (affects building status before profit calculation)
        const fireStats = await processMapFires(env, map.id);
        totalFiresStarted += fireStats.firesStarted;
        totalFiresExtinguished += fireStats.firesExtinguished;
        totalBuildingsDamaged += fireStats.buildingsDamaged;
        totalBuildingsCollapsed += fireStats.buildingsCollapsed;

        // Process profits (recalculate dirty buildings, distribute profits)
        const profitStats = await processMapProfits(env, map.id);
        totalCompaniesUpdated += profitStats.companiesUpdated;
        totalBuildingsRecalculated += profitStats.buildingsRecalculated;
        totalGrossProfit += profitStats.grossProfit;
        totalTaxAmount += profitStats.taxAmount;
        totalNetProfit += profitStats.netProfit;

        // Process forced hero-outs (after profits so cash is up-to-date)
        const forcedHeroStats = await processForcedHeroOuts(env, map.id);
        totalForcedHeroOuts += forcedHeroStats.forcedCount;

        // Update land ownership streaks for hero system
        const landStreaksUpdated = await updateLandOwnershipStreaks(env, map.id);
        totalLandStreaksUpdated += landStreaksUpdated;
      } catch (err) {
        console.error(`Error processing map ${map.id}:`, err);
        // Continue processing other maps even if one fails
      }
    }

    // Step 3: Update idle companies (those with no buildings)
    const idleCompaniesUpdated = await updateIdleCompanies(env);
    totalCompaniesUpdated += idleCompaniesUpdated;

    // Step 4: Log tick history
    const executionTimeMs = Date.now() - startTime;
    await logTickHistory(env, {
      id: tickId,
      executionTimeMs,
      mapsProcessed: activeMaps.results.length,
      companiesUpdated: totalCompaniesUpdated,
      buildingsRecalculated: totalBuildingsRecalculated,
      grossProfit: totalGrossProfit,
      taxAmount: totalTaxAmount,
      netProfit: totalNetProfit,
      firesStarted: totalFiresStarted,
      firesExtinguished: totalFiresExtinguished,
      buildingsDamaged: totalBuildingsDamaged,
      buildingsCollapsed: totalBuildingsCollapsed
    });

    const result = {
      tickId,
      mapsProcessed: activeMaps.results.length,
      companiesUpdated: totalCompaniesUpdated,
      buildingsRecalculated: totalBuildingsRecalculated,
      grossProfit: totalGrossProfit,
      taxAmount: totalTaxAmount,
      netProfit: totalNetProfit,
      firesStarted: totalFiresStarted,
      firesExtinguished: totalFiresExtinguished,
      buildingsDamaged: totalBuildingsDamaged,
      buildingsCollapsed: totalBuildingsCollapsed,
      landStreaksUpdated: totalLandStreaksUpdated,
      forcedHeroOuts: totalForcedHeroOuts,
      executionTimeMs
    };

    console.log(`Tick ${tickId} complete in ${executionTimeMs}ms:`, result);
    return result;

  } catch (err) {
    console.error('Critical error in tick processing:', err);

    // Log failed tick
    const executionTimeMs = Date.now() - startTime;
    await logTickHistory(env, {
      id: tickId,
      executionTimeMs,
      mapsProcessed: 0,
      companiesUpdated: 0,
      buildingsRecalculated: 0,
      grossProfit: 0,
      taxAmount: 0,
      netProfit: 0,
      firesStarted: 0,
      firesExtinguished: 0,
      buildingsDamaged: 0,
      buildingsCollapsed: 0,
      errors: JSON.stringify([{
        message: err.message,
        stack: err.stack
      }])
    });

    throw err;
  }
}

/**
 * Update land ownership streak for companies on a map
 * Used for the hero system's land ownership path
 *
 * @param {Object} env - Worker environment with DB binding
 * @param {string} mapId - Map ID to process
 * @returns {number} Number of companies updated
 */
async function updateLandOwnershipStreaks(env, mapId) {
  // Get map details for requirements
  const map = await env.DB.prepare(
    'SELECT location_type FROM maps WHERE id = ?'
  ).bind(mapId).first();

  if (!map || !map.location_type) {
    return 0;
  }

  const requirements = HERO_REQUIREMENTS[map.location_type];
  if (!requirements) {
    return 0;
  }

  // Get total free land tiles on this map
  const totalLandResult = await env.DB.prepare(`
    SELECT COUNT(*) as total
    FROM tiles
    WHERE map_id = ? AND terrain_type = 'free_land'
  `).bind(mapId).first();

  const totalLand = totalLandResult?.total || 0;
  if (totalLand === 0) {
    return 0;
  }

  // Get all companies on this map with their land ownership
  const companiesResult = await env.DB.prepare(`
    SELECT
      gc.id,
      gc.land_ownership_streak,
      COUNT(t.id) as owned_land
    FROM game_companies gc
    LEFT JOIN tiles t ON t.owner_company_id = gc.id AND t.map_id = ?
    WHERE gc.current_map_id = ?
    GROUP BY gc.id
  `).bind(mapId, mapId).all();

  if (companiesResult.results.length === 0) {
    return 0;
  }

  const statements = [];

  for (const company of companiesResult.results) {
    const ownedLand = company.owned_land || 0;
    const percentage = (ownedLand / totalLand) * 100;
    const meetsThreshold = percentage >= requirements.landPercentage;

    // If meets threshold, increment streak; otherwise reset to 0
    const newStreak = meetsThreshold ? (company.land_ownership_streak || 0) + 1 : 0;

    statements.push(
      env.DB.prepare(`
        UPDATE game_companies
        SET land_ownership_streak = ?,
            land_percentage = ?
        WHERE id = ?
      `).bind(newStreak, percentage, company.id)
    );
  }

  if (statements.length > 0) {
    await env.DB.batch(statements);
  }

  return statements.length;
}

/**
 * Process forced hero-outs for companies on a map
 * Companies that meet hero eligibility for 6+ consecutive ticks are forced to hero out
 *
 * @param {Object} env - Worker environment with DB binding
 * @param {string} mapId - Map ID to process
 * @returns {Object} { forcedCount, streaksUpdated }
 */
async function processForcedHeroOuts(env, mapId) {
  // Get map details including location_type and forced_hero_after_ticks setting
  const map = await env.DB.prepare(
    'SELECT location_type, forced_hero_after_ticks FROM maps WHERE id = ?'
  ).bind(mapId).first();

  if (!map || !map.location_type) {
    return { forcedCount: 0, streaksUpdated: 0 };
  }

  const requirements = HERO_REQUIREMENTS[map.location_type];
  if (!requirements) {
    return { forcedCount: 0, streaksUpdated: 0 };
  }

  // Use map-specific threshold or default
  const forcedHeroThreshold = map.forced_hero_after_ticks ?? DEFAULT_FORCED_HERO_TICKS;

  // Get all companies on this map with their financial data
  const companiesResult = await env.DB.prepare(`
    SELECT
      gc.id,
      gc.user_id,
      gc.cash,
      gc.offshore,
      gc.current_map_id,
      gc.location_type,
      gc.land_percentage,
      gc.land_ownership_streak,
      gc.hero_eligible_streak,
      COALESCE(SUM(bt.cost), 0) as total_building_value
    FROM game_companies gc
    LEFT JOIN building_instances bi ON bi.company_id = gc.id
    LEFT JOIN tiles t ON bi.tile_id = t.id AND t.map_id = ?
    LEFT JOIN building_types bt ON bi.building_type_id = bt.id
    WHERE gc.current_map_id = ?
    GROUP BY gc.id
  `).bind(mapId, mapId).all();

  if (companiesResult.results.length === 0) {
    return { forcedCount: 0, streaksUpdated: 0 };
  }

  const forcedHeroCompanies = [];
  const streakUpdates = [];

  for (const company of companiesResult.results) {
    // Calculate hero eligibility via any path (buildings at full value)
    const totalBuildingValue = company.total_building_value || 0;
    const netWorth = company.cash + totalBuildingValue;

    const canHeroNetWorth = netWorth >= requirements.netWorth;
    const canHeroCash = company.cash >= requirements.cash;
    const canHeroLand =
      (company.land_percentage || 0) >= requirements.landPercentage &&
      (company.land_ownership_streak || 0) >= requirements.landStreakTicks;

    const isEligible = canHeroNetWorth || canHeroCash || canHeroLand;
    const currentStreak = company.hero_eligible_streak || 0;

    if (isEligible) {
      const newStreak = currentStreak + 1;

      // Check if this tick should force the hero-out (streak >= threshold means force NOW)
      if (newStreak > forcedHeroThreshold) {
        // Determine which path qualified
        let qualifiedPath = 'netWorth';
        if (canHeroCash) qualifiedPath = 'cash';
        else if (canHeroLand) qualifiedPath = 'land';

        forcedHeroCompanies.push({
          company,
          qualifiedPath,
          unlocks: requirements.unlocks,
        });
      } else {
        // Just increment the streak
        streakUpdates.push(
          env.DB.prepare(`
            UPDATE game_companies SET hero_eligible_streak = ? WHERE id = ?
          `).bind(newStreak, company.id)
        );
      }
    } else {
      // Not eligible - reset streak if it was > 0
      if (currentStreak > 0) {
        streakUpdates.push(
          env.DB.prepare(`
            UPDATE game_companies SET hero_eligible_streak = 0 WHERE id = ?
          `).bind(company.id)
        );
      }
    }
  }

  // Execute streak updates
  if (streakUpdates.length > 0) {
    await env.DB.batch(streakUpdates);
  }

  // Execute forced hero-outs
  let forcedCount = 0;
  for (const { company, qualifiedPath, unlocks } of forcedHeroCompanies) {
    try {
      await executeHeroOut(env, company, qualifiedPath, {
        isForced: true,
        unlocks,
      });
      forcedCount++;
      console.log(`Forced hero-out for company ${company.id} via ${qualifiedPath} path`);
    } catch (err) {
      console.error(`Failed to force hero-out for company ${company.id}:`, err);
    }
  }

  return {
    forcedCount,
    streaksUpdated: streakUpdates.length,
  };
}

/**
 * Log tick execution to history table
 * @param {Object} env - Worker environment
 * @param {Object} stats - Tick statistics
 */
async function logTickHistory(env, stats) {
  await env.DB.prepare(`
    INSERT INTO tick_history (
      id,
      execution_time_ms,
      maps_processed,
      companies_updated,
      buildings_recalculated,
      gross_profit,
      tax_amount,
      net_profit,
      fires_started,
      fires_extinguished,
      buildings_damaged,
      buildings_collapsed,
      errors
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    stats.id,
    stats.executionTimeMs,
    stats.mapsProcessed,
    stats.companiesUpdated,
    stats.buildingsRecalculated,
    stats.grossProfit,
    stats.taxAmount,
    stats.netProfit,
    stats.firesStarted || 0,
    stats.firesExtinguished || 0,
    stats.buildingsDamaged || 0,
    stats.buildingsCollapsed || 0,
    stats.errors || null
  ).run();
}
