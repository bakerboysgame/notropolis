/**
 * Profit Calculator for Tick System
 * Handles profit distribution and tax calculation
 */

import { recalculateDirtyBuildings } from '../adjacencyCalculator.js';

/**
 * Tax rates by location type
 */
const TAX_RATES = {
  town: 0.10,    // 10%
  city: 0.15,    // 15%
  capital: 0.20  // 20%
};

/**
 * Process profits for a single map
 * 1. Recalculate dirty buildings
 * 2. Get all companies with buildings on this map
 * 3. Calculate profits for active companies (ticks_since_action < 6)
 * 4. Apply tax based on location
 * 5. Update company cash
 *
 * @param {Object} env - Worker environment with DB binding
 * @param {string} mapId - Map ID to process
 * @returns {Object} { companiesUpdated, buildingsRecalculated, grossProfit, taxAmount, netProfit }
 */
export async function processMapProfits(env, mapId) {
  // Step 1: Recalculate dirty buildings first
  const buildingsRecalculated = await recalculateDirtyBuildings(env, mapId);

  // Step 2: Get map details for tax rate
  const map = await env.DB.prepare(
    'SELECT location_type FROM maps WHERE id = ?'
  ).bind(mapId).first();

  if (!map) {
    throw new Error(`Map not found: ${mapId}`);
  }

  const taxRate = TAX_RATES[map.location_type] || 0.10;

  // Step 3: Get all companies with buildings on this map
  // Only companies with ticks_since_action < 6 earn profit
  // Health-based profit: profit * (100 - damage_percent * 1.176) / 100
  // 85% damage (15% health) = $0 profit, then goes NEGATIVE
  // Note: Trick debuffs (graffiti, smoke, stink) are separate and will stack on top (Stage 08)
  // Deduct security costs: monthly_cost / 144 (10 min ticks in a month)
  const companiesWithBuildings = await env.DB.prepare(`
    SELECT
      gc.id,
      gc.cash,
      gc.ticks_since_action,
      SUM(COALESCE(bi.calculated_profit, 0) * (100 - bi.damage_percent * 1.176) / 100) as total_profit,
      SUM(COALESCE(bs.monthly_cost, 0)) / 144 as total_security_cost
    FROM game_companies gc
    JOIN building_instances bi ON bi.company_id = gc.id
    JOIN tiles t ON bi.tile_id = t.id
    LEFT JOIN building_security bs ON bi.id = bs.building_id
    WHERE t.map_id = ?
      AND bi.is_collapsed = 0
      AND gc.ticks_since_action < 6
    GROUP BY gc.id
  `).bind(mapId).all();

  if (companiesWithBuildings.results.length === 0) {
    return {
      companiesUpdated: 0,
      buildingsRecalculated,
      grossProfit: 0,
      taxAmount: 0,
      netProfit: 0
    };
  }

  // Step 4: Calculate profits and prepare batch updates
  const statements = [];
  let totalGrossProfit = 0;
  let totalTaxAmount = 0;
  let totalNetProfit = 0;

  for (const company of companiesWithBuildings.results) {
    const grossProfit = Math.round(company.total_profit || 0);
    const securityCost = Math.round(company.total_security_cost || 0);
    const taxAmount = Math.round(grossProfit * taxRate);
    const netProfit = grossProfit - taxAmount - securityCost;
    const newCash = company.cash + netProfit;

    totalGrossProfit += grossProfit;
    totalTaxAmount += taxAmount;
    totalNetProfit += netProfit;

    // Update company cash and increment ticks_since_action
    statements.push(
      env.DB.prepare(`
        UPDATE game_companies
        SET cash = ?, ticks_since_action = ticks_since_action + 1
        WHERE id = ?
      `).bind(newCash, company.id)
    );

    // Record tick_income transaction for statistics tracking (only if there's actual profit/loss)
    if (netProfit !== 0) {
      statements.push(
        env.DB.prepare(`
          INSERT INTO game_transactions (id, company_id, map_id, action_type, amount, description)
          VALUES (?, ?, ?, 'tick_income', ?, ?)
        `).bind(
          crypto.randomUUID(),
          company.id,
          mapId,
          netProfit,
          `Tick income: £${grossProfit} gross - £${taxAmount} tax - £${securityCost} security = £${netProfit} net`
        )
      );
    }
  }

  // Step 5: Execute all updates in a single batch
  await env.DB.batch(statements);

  return {
    companiesUpdated: statements.length,
    buildingsRecalculated,
    grossProfit: totalGrossProfit,
    taxAmount: totalTaxAmount,
    netProfit: totalNetProfit
  };
}

/**
 * Update idle companies (those with no buildings on any map)
 * Increments their ticks_since_action counter
 *
 * @param {Object} env - Worker environment with DB binding
 * @returns {number} Number of idle companies updated
 */
export async function updateIdleCompanies(env) {
  // Get all companies that have no buildings
  const idleCompanies = await env.DB.prepare(`
    SELECT id FROM game_companies
    WHERE id NOT IN (SELECT DISTINCT company_id FROM building_instances)
  `).all();

  if (idleCompanies.results.length === 0) {
    return 0;
  }

  // Increment ticks_since_action for idle companies
  const statements = idleCompanies.results.map(company =>
    env.DB.prepare(`
      UPDATE game_companies
      SET ticks_since_action = ticks_since_action + 1
      WHERE id = ?
    `).bind(company.id)
  );

  await env.DB.batch(statements);
  return statements.length;
}
