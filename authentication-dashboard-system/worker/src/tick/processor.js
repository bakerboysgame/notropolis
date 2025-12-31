/**
 * Main Tick Processor for Notropolis Game
 * Runs every 10 minutes via Cloudflare Workers cron trigger
 */

import { processMapProfits, updateIdleCompanies } from './profitCalculator.js';
import { processMapFires } from './fireSpread.js';

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
