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
 * 2. Get all companies with buildings on this map (including idle ones for statistics)
 * 3. Calculate profits for active companies (ticks_since_action < 6)
 * 4. Apply tax based on location
 * 5. Update company cash and company_statistics table
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

  // Step 3: Get ALL companies with buildings on this map (for statistics)
  // We need comprehensive data for the statistics table
  // Collapsed buildings incur a maintenance cost of 5% of building cost per tick
  const companiesWithBuildings = await env.DB.prepare(`
    SELECT
      gc.id,
      gc.cash,
      gc.ticks_since_action,
      COUNT(bi.id) as building_count,
      SUM(CASE WHEN bi.is_collapsed = 1 THEN 1 ELSE 0 END) as collapsed_count,
      SUM(CASE WHEN bi.is_collapsed = 0 THEN COALESCE(bi.calculated_profit, 0) ELSE 0 END) as base_profit,
      SUM(CASE WHEN bi.is_collapsed = 0 THEN COALESCE(bi.calculated_profit, 0) * (100 - bi.damage_percent * 1.176) / 100 ELSE 0 END) as gross_profit,
      SUM(CASE WHEN bi.is_collapsed = 0 THEN COALESCE(bs.monthly_cost, 0) ELSE 0 END) / 144 as total_security_cost,
      SUM(CASE WHEN bi.is_collapsed = 1 THEN bt.cost * 0.05 ELSE 0 END) as collapsed_maintenance_cost,
      SUM(CASE WHEN bi.is_collapsed = 0 THEN COALESCE(bi.calculated_value, bt.cost) ELSE 0 END) as total_building_value,
      SUM(CASE WHEN bi.is_collapsed = 0 THEN COALESCE(bi.calculated_value, bt.cost) * (100 - COALESCE(bi.damage_percent, 0)) / 100 ELSE 0 END) as damaged_building_value,
      SUM(CASE WHEN bi.is_collapsed = 0 THEN bi.damage_percent ELSE 0 END) as total_damage_percent,
      SUM(CASE WHEN bi.is_collapsed = 0 AND bi.is_on_fire = 1 THEN 1 ELSE 0 END) as buildings_on_fire
    FROM game_companies gc
    JOIN building_instances bi ON bi.company_id = gc.id
    JOIN tiles t ON bi.tile_id = t.id
    JOIN building_types bt ON bi.building_type_id = bt.id
    LEFT JOIN building_security bs ON bi.id = bs.building_id
    WHERE t.map_id = ?
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
    const isEarning = company.ticks_since_action < 6;
    const activeBuildings = company.building_count - (company.collapsed_count || 0);
    const baseProfit = Math.round(company.base_profit || 0);
    const grossProfit = Math.round(company.gross_profit || 0);
    const securityCost = Math.round(company.total_security_cost || 0);
    const collapsedMaintenanceCost = Math.round(company.collapsed_maintenance_cost || 0);
    const taxAmount = Math.round(grossProfit * taxRate);
    // Calculate net profit for all companies (used for statistics display)
    // Collapsed buildings incur maintenance costs that reduce profit
    const netProfit = grossProfit - taxAmount - securityCost - collapsedMaintenanceCost;
    const avgDamage = activeBuildings > 0
      ? (company.total_damage_percent || 0) / activeBuildings
      : 0;

    // Only pay companies that are active (ticks_since_action < 6)
    if (isEarning) {
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

      // Record tick_income transaction for history
      statements.push(
        env.DB.prepare(`
          INSERT INTO game_transactions (id, company_id, map_id, action_type, amount, details)
          VALUES (?, ?, ?, 'tick_income', ?, ?)
        `).bind(
          crypto.randomUUID(),
          company.id,
          mapId,
          netProfit,
          JSON.stringify({
            base_profit: baseProfit,
            gross_profit: grossProfit,
            tax_rate: taxRate,
            tax_amount: taxAmount,
            security_cost: securityCost,
            collapsed_maintenance_cost: collapsedMaintenanceCost,
            net_profit: netProfit
          })
        )
      );
    }

    // Always update statistics table with calculated values (even for idle companies)
    // net_profit shows what they *would* earn - is_earning shows if they actually get paid
    statements.push(
      env.DB.prepare(`
        INSERT INTO company_statistics (
          id, company_id, map_id,
          building_count, collapsed_count,
          base_profit, gross_profit, tax_rate, tax_amount, security_cost, net_profit,
          total_building_value, damaged_building_value,
          total_damage_percent, average_damage_percent, buildings_on_fire,
          ticks_since_action, is_earning,
          last_tick_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT (company_id, map_id) DO UPDATE SET
          building_count = excluded.building_count,
          collapsed_count = excluded.collapsed_count,
          base_profit = excluded.base_profit,
          gross_profit = excluded.gross_profit,
          tax_rate = excluded.tax_rate,
          tax_amount = excluded.tax_amount,
          security_cost = excluded.security_cost,
          net_profit = excluded.net_profit,
          total_building_value = excluded.total_building_value,
          damaged_building_value = excluded.damaged_building_value,
          total_damage_percent = excluded.total_damage_percent,
          average_damage_percent = excluded.average_damage_percent,
          buildings_on_fire = excluded.buildings_on_fire,
          ticks_since_action = excluded.ticks_since_action,
          is_earning = excluded.is_earning,
          last_tick_at = CURRENT_TIMESTAMP
      `).bind(
        crypto.randomUUID(),
        company.id,
        mapId,
        company.building_count,
        company.collapsed_count || 0,
        baseProfit,
        grossProfit,
        taxRate,
        taxAmount,
        securityCost,
        netProfit,
        Math.round(company.total_building_value || 0),
        Math.round(company.damaged_building_value || 0),
        Math.round(company.total_damage_percent || 0),
        Math.round(avgDamage * 100) / 100,
        company.buildings_on_fire || 0,
        company.ticks_since_action,
        isEarning ? 1 : 0
      )
    );
  }

  // Step 5: Execute all updates in a single batch
  await env.DB.batch(statements);

  return {
    companiesUpdated: companiesWithBuildings.results.filter(c => c.ticks_since_action < 6).length,
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
