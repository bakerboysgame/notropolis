/**
 * Security Purchase/Remove API Routes
 * Handles adding and removing security systems from buildings
 */

import {
  SECURITY_OPTIONS,
  SECURITY_COLUMNS,
  calculateSecurityCost,
  calculateMonthlyCost,
} from './securityConstants.js';

/**
 * POST /api/game/security/purchase
 * Purchase a security system for a building
 */
export async function purchaseSecurity(request, env, company) {
  // Check prison status
  if (company.is_in_prison) {
    throw new Error(`You are in prison! Pay your fine of $${company.prison_fine?.toLocaleString()} to continue.`);
  }

  const { building_id, security_type } = await request.json();

  const option = SECURITY_OPTIONS[security_type];
  if (!option) {
    throw new Error('Invalid security type');
  }

  // Get building with its type info for cost calculation
  const building = await env.DB.prepare(`
    SELECT bi.*, bt.cost as building_cost
    FROM building_instances bi
    JOIN building_types bt ON bi.building_type_id = bt.id
    WHERE bi.id = ? AND bi.company_id = ?
  `).bind(building_id, company.id).first();

  if (!building) {
    throw new Error('Building not found or not owned');
  }
  if (building.is_collapsed) {
    throw new Error('Cannot add security to collapsed building');
  }

  // Calculate costs based on building value
  const purchaseCost = calculateSecurityCost(option, building.building_cost);
  const monthlyCost = calculateMonthlyCost(purchaseCost);

  // Check funds
  if (company.cash < purchaseCost) {
    throw new Error('Insufficient funds');
  }

  // Get or create security record
  const security = await env.DB.prepare(
    'SELECT * FROM building_security WHERE building_id = ?'
  ).bind(building_id).first();

  const column = SECURITY_COLUMNS[security_type];

  if (security) {
    // Check if already has this security
    if (security[column]) {
      throw new Error(`Building already has ${option.name.toLowerCase()}`);
    }

    // Calculate new monthly cost
    const currentCost = security.monthly_cost || 0;
    const newTotalMonthlyCost = currentCost + monthlyCost;

    await env.DB.batch([
      // Update security
      env.DB.prepare(`
        UPDATE building_security
        SET ${column} = 1, monthly_cost = ?
        WHERE building_id = ?
      `).bind(newTotalMonthlyCost, building_id),

      // Deduct cost and reset tick counter
      env.DB.prepare(
        'UPDATE game_companies SET cash = cash - ?, total_actions = total_actions + 1, last_action_at = ?, ticks_since_action = 0 WHERE id = ?'
      ).bind(purchaseCost, new Date().toISOString(), company.id),

      // Log transaction
      env.DB.prepare(`
        INSERT INTO game_transactions (id, company_id, action_type, target_building_id, amount, details)
        VALUES (?, ?, 'security_purchase', ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        company.id,
        building_id,
        purchaseCost,
        JSON.stringify({ type: security_type, monthly_cost: monthlyCost })
      ),
    ]);
  } else {
    // Create new security record
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO building_security (id, building_id, ${column}, monthly_cost)
        VALUES (?, ?, 1, ?)
      `).bind(crypto.randomUUID(), building_id, monthlyCost),

      env.DB.prepare(
        'UPDATE game_companies SET cash = cash - ?, total_actions = total_actions + 1, last_action_at = ?, ticks_since_action = 0 WHERE id = ?'
      ).bind(purchaseCost, new Date().toISOString(), company.id),

      env.DB.prepare(`
        INSERT INTO game_transactions (id, company_id, action_type, target_building_id, amount, details)
        VALUES (?, ?, 'security_purchase', ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        company.id,
        building_id,
        purchaseCost,
        JSON.stringify({ type: security_type, monthly_cost: monthlyCost })
      ),
    ]);
  }

  return {
    success: true,
    security_type,
    purchase_cost: purchaseCost,
    monthly_cost: monthlyCost,
    building_cost: building.building_cost,
  };
}

/**
 * POST /api/game/security/remove
 * Remove a security system from a building
 */
export async function removeSecurity(request, env, company) {
  const { building_id, security_type } = await request.json();

  const option = SECURITY_OPTIONS[security_type];
  if (!option) {
    throw new Error('Invalid security type');
  }

  // Get building with cost info to calculate monthly cost reduction
  const building = await env.DB.prepare(`
    SELECT bi.*, bt.cost as building_cost
    FROM building_instances bi
    JOIN building_types bt ON bi.building_type_id = bt.id
    WHERE bi.id = ? AND bi.company_id = ?
  `).bind(building_id, company.id).first();

  if (!building) {
    throw new Error('Building not found or not owned');
  }

  const column = SECURITY_COLUMNS[security_type];

  const security = await env.DB.prepare(
    'SELECT * FROM building_security WHERE building_id = ?'
  ).bind(building_id).first();

  if (!security || !security[column]) {
    throw new Error(`Building doesn't have ${option.name.toLowerCase()}`);
  }

  // Calculate the monthly cost that was added for this security type
  const purchaseCost = calculateSecurityCost(option, building.building_cost);
  const monthlyCostToRemove = calculateMonthlyCost(purchaseCost);
  const newCost = Math.max(0, (security.monthly_cost || 0) - monthlyCostToRemove);

  await env.DB.prepare(`
    UPDATE building_security
    SET ${column} = 0, monthly_cost = ?
    WHERE building_id = ?
  `).bind(newCost, building_id).run();

  return {
    success: true,
    security_type,
    monthly_cost_removed: monthlyCostToRemove,
  };
}
