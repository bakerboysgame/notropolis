/**
 * Dirty Tricks Attack API Routes
 * Handles PvP attacks, police/security catch mechanics, and prison system
 */

import { markAffectedBuildingsDirty } from '../../adjacencyCalculator.js';
import { postActionCheck } from './levels.js';

// Dirty trick definitions (mirrors dirtyTricks.ts on frontend)
const DIRTY_TRICKS = {
  graffiti: { cost: 500, damage: 5, policeCatchRate: 0.10, securityCatchRate: 0.15, levelRequired: 1 },
  smoke_bomb: { cost: 1500, damage: 15, policeCatchRate: 0.20, securityCatchRate: 0.25, levelRequired: 1 },
  stink_bomb: { cost: 3000, damage: 25, policeCatchRate: 0.30, securityCatchRate: 0.35, levelRequired: 2 },
  cluster_bomb: { cost: 6000, damage: 35, policeCatchRate: 0.40, securityCatchRate: 0.45, levelRequired: 3 },
  fire_bomb: { cost: 10000, damage: 40, policeCatchRate: 0.50, securityCatchRate: 0.55, levelRequired: 1 },
  destruction_bomb: { cost: 20000, damage: 60, policeCatchRate: 0.70, securityCatchRate: 0.75, levelRequired: 5 },
};

const LOCATION_MULTIPLIERS = {
  town: 1.0,
  city: 1.5,
  capital: 2.0,
};

const SECURITY_BONUSES = {
  cameras: 0.10,
  guard_dogs: 0.15,
  security_guards: 0.25,
};

/**
 * POST /api/game/attacks
 * Perform a dirty trick attack on another player's building
 */
export async function performAttack(request, env, company) {
  const { building_id, trick_type, map_id, x, y, message } = await request.json();

  // Validate required fields
  if (!building_id || !trick_type || !map_id || x === undefined || y === undefined) {
    throw new Error('Missing required fields: building_id, trick_type, map_id, x, y');
  }

  // Validate optional message (max 100 characters)
  const attackMessage = message ? String(message).trim().slice(0, 100) : null;

  // Validate trick type
  const trick = DIRTY_TRICKS[trick_type];
  if (!trick) {
    throw new Error('Invalid trick type');
  }

  // Check prison status
  if (company.is_in_prison) {
    throw new Error(`You are in prison! Pay your fine of $${company.prison_fine?.toLocaleString()} to continue.`);
  }

  // Check level requirement
  if (company.level < trick.levelRequired) {
    throw new Error(`Requires company level ${trick.levelRequired}`);
  }

  // Check funds
  if (company.cash < trick.cost) {
    throw new Error('Insufficient funds');
  }

  // Get target building with all needed data
  const building = await env.DB.prepare(`
    SELECT bi.*, t.x, t.y, t.map_id, m.location_type, m.police_strike_day,
           gc.name as owner_name
    FROM building_instances bi
    JOIN tiles t ON bi.tile_id = t.id
    JOIN maps m ON t.map_id = m.id
    JOIN game_companies gc ON bi.company_id = gc.id
    WHERE bi.id = ?
  `).bind(building_id).first();

  if (!building) {
    throw new Error('Building not found');
  }

  // Verify location matches - prevents blind attacks by guessing building IDs
  if (building.map_id !== map_id || building.x !== x || building.y !== y) {
    throw new Error('Location mismatch - building is not at the specified coordinates');
  }

  // Cannot attack collapsed building
  if (building.is_collapsed) {
    throw new Error('Building is already collapsed');
  }

  // Get security systems for this building
  const security = await env.DB.prepare(
    'SELECT * FROM building_security WHERE building_id = ?'
  ).bind(building_id).first();

  // Calculate catch chances
  let wasCaught = false;
  let caughtBy = null;
  let securityActive = false;
  let policeActive = false;

  // Check police strike day (0-6 for Sunday-Saturday)
  const today = new Date().getDay();
  const isStrikeDay = building.police_strike_day !== null && building.police_strike_day === today;

  // Security check FIRST (if building has security)
  if (security) {
    securityActive = true;
    let securityCatchRate = trick.securityCatchRate;

    // Add security bonuses
    if (security.has_cameras) securityCatchRate += SECURITY_BONUSES.cameras;
    if (security.has_guard_dogs) securityCatchRate += SECURITY_BONUSES.guard_dogs;
    if (security.has_security_guards) securityCatchRate += SECURITY_BONUSES.security_guards;

    // Cap at 100%
    securityCatchRate = Math.min(securityCatchRate, 1.0);

    // Random roll for security catch
    if (Math.random() < securityCatchRate) {
      wasCaught = true;
      caughtBy = 'security';
    }
  }

  // Police check SECOND (only if not caught by security and not strike day)
  if (!wasCaught && !isStrikeDay) {
    policeActive = true;
    const policeCatchRate = trick.policeCatchRate;

    // Random roll for police catch
    if (Math.random() < policeCatchRate) {
      wasCaught = true;
      caughtBy = 'police';
    }
  }

  // Calculate damage (always applied, even if caught)
  const damageDealt = trick.damage;
  const newDamage = Math.min(building.damage_percent + damageDealt, 100);
  const collapsed = newDamage >= 100;

  // Calculate fine if caught
  let fineAmount = 0;
  if (wasCaught) {
    const locationMultiplier = LOCATION_MULTIPLIERS[building.location_type] || 1.0;
    fineAmount = Math.floor(trick.cost * 3 * locationMultiplier);
  }

  // Set fire flag for fire bomb
  const setsFire = trick_type === 'fire_bomb';

  // Build batch statements
  const statements = [];

  // Update building damage and fire status
  statements.push(
    env.DB.prepare(`
      UPDATE building_instances
      SET damage_percent = ?,
          is_collapsed = ?,
          is_on_fire = CASE WHEN ? = 1 THEN 1 ELSE is_on_fire END
      WHERE id = ?
    `).bind(newDamage, collapsed ? 1 : 0, setsFire ? 1 : 0, building_id)
  );

  // Update attacker company - deduct cost, reset tick counter, set prison if caught
  if (wasCaught) {
    statements.push(
      env.DB.prepare(`
        UPDATE game_companies
        SET cash = cash - ?,
            is_in_prison = 1,
            prison_fine = ?,
            total_actions = total_actions + 1,
            last_action_at = ?,
            ticks_since_action = 0
        WHERE id = ?
      `).bind(trick.cost, fineAmount, new Date().toISOString(), company.id)
    );
  } else {
    statements.push(
      env.DB.prepare(`
        UPDATE game_companies
        SET cash = cash - ?,
            total_actions = total_actions + 1,
            last_action_at = ?,
            ticks_since_action = 0
        WHERE id = ?
      `).bind(trick.cost, new Date().toISOString(), company.id)
    );
  }

  // Log attack to attacks table (with optional message for moderation)
  statements.push(
    env.DB.prepare(`
      INSERT INTO attacks (
        attacker_company_id, target_building_id, trick_type,
        damage_dealt, was_caught, caught_by, fine_amount,
        security_active, police_active, message, message_status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      company.id,
      building_id,
      trick_type,
      damageDealt,
      wasCaught ? 1 : 0,
      caughtBy,
      fineAmount,
      securityActive ? 1 : 0,
      policeActive ? 1 : 0,
      attackMessage,
      attackMessage ? 'pending' : null
    )
  );

  // Log transaction
  statements.push(
    env.DB.prepare(`
      INSERT INTO game_transactions (
        id, company_id, map_id, action_type,
        target_building_id, target_company_id, amount
      )
      VALUES (?, ?, ?, 'attack', ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      company.id,
      building.map_id,
      building_id,
      building.company_id,
      -trick.cost
    )
  );

  // Execute all statements
  await env.DB.batch(statements);

  // Mark affected buildings dirty for profit recalculation (damage changed)
  await markAffectedBuildingsDirty(env, building.x, building.y, building.map_id);

  // Check for level-up (attacks don't level up when caught and sent to prison, only successful ones)
  let levelUp = null;
  if (!wasCaught) {
    levelUp = await postActionCheck(env, company.id, company.level, building.map_id);
  }

  return {
    success: true,
    damage_dealt: damageDealt,
    total_damage: newDamage,
    was_caught: wasCaught,
    caught_by: caughtBy,
    fine_amount: fineAmount,
    building_collapsed: collapsed,
    set_fire: setsFire,
    security_active: securityActive,
    police_active: policeActive,
    police_strike: isStrikeDay,
    levelUp,
    message_submitted: !!attackMessage,
    target: {
      building_id,
      owner_name: building.owner_name,
      owner_company_id: building.company_id,
      map_id: building.map_id,
      x: building.x,
      y: building.y,
      location_type: building.location_type,
    },
  };
}

/**
 * POST /api/game/attacks/pay-fine
 * Pay prison fine to be released
 */
export async function payFine(request, env, company) {
  // Check if in prison
  if (!company.is_in_prison) {
    throw new Error('You are not in prison');
  }

  const fine = company.prison_fine || 0;

  if (company.cash < fine) {
    throw new Error('Insufficient funds to pay fine');
  }

  await env.DB.batch([
    // Deduct fine and release from prison, reset tick counter
    env.DB.prepare(`
      UPDATE game_companies
      SET cash = cash - ?,
          is_in_prison = 0,
          prison_fine = 0,
          ticks_since_action = 0,
          total_actions = total_actions + 1,
          last_action_at = ?
      WHERE id = ?
    `).bind(fine, new Date().toISOString(), company.id),

    // Log transaction
    env.DB.prepare(`
      INSERT INTO game_transactions (
        id, company_id, map_id, action_type, amount
      )
      VALUES (?, ?, NULL, 'pay_fine', ?)
    `).bind(crypto.randomUUID(), company.id, -fine),
  ]);

  return { success: true, fine_paid: fine };
}

/**
 * GET /api/game/attacks/history?limit=50
 * Get attack history for current company (both attacks made and received)
 */
export async function getAttackHistory(request, env, company) {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);

  // Get attacks made by this company
  const attacksMade = await env.DB.prepare(`
    SELECT a.*,
           bi.building_type_id, bt.name as building_type_name,
           t.x, t.y, m.name as map_name,
           gc.name as target_company_name
    FROM attacks a
    JOIN building_instances bi ON a.target_building_id = bi.id
    JOIN building_types bt ON bi.building_type_id = bt.id
    JOIN tiles t ON bi.tile_id = t.id
    JOIN maps m ON t.map_id = m.id
    JOIN game_companies gc ON bi.company_id = gc.id
    WHERE a.attacker_company_id = ?
    ORDER BY a.created_at DESC
    LIMIT ?
  `).bind(company.id, limit).all();

  // Get attacks received by this company's buildings
  const attacksReceived = await env.DB.prepare(`
    SELECT a.*,
           bi.building_type_id, bt.name as building_type_name,
           t.x, t.y, m.name as map_name,
           gc.name as attacker_company_name
    FROM attacks a
    JOIN building_instances bi ON a.target_building_id = bi.id
    JOIN building_types bt ON bi.building_type_id = bt.id
    JOIN tiles t ON bi.tile_id = t.id
    JOIN maps m ON t.map_id = m.id
    JOIN game_companies gc ON a.attacker_company_id = gc.id
    WHERE bi.company_id = ?
    ORDER BY a.created_at DESC
    LIMIT ?
  `).bind(company.id, limit).all();

  return {
    success: true,
    attacks_made: attacksMade.results,
    attacks_received: attacksReceived.results,
  };
}

/**
 * POST /api/game/buildings/cleanup
 * Clean up all trick effects on a building (owner only)
 * - Marks all uncleaned attacks as cleaned
 * - Removes visual effects (graffiti, smoke, stink)
 * - Does NOT reduce damage_percent (use repair for that)
 * - Does NOT extinguish fire (use extinguish for that)
 */
export async function cleanupTrick(request, env, company) {
  const { building_id } = await request.json();

  if (!building_id) {
    throw new Error('Missing required field: building_id');
  }

  // Validate prison status
  if (company.is_in_prison) {
    throw new Error(`You are in prison! Pay your fine of $${company.prison_fine?.toLocaleString()} to continue.`);
  }

  // Get building with type info
  const building = await env.DB.prepare(`
    SELECT bi.*, bt.cost as type_cost, bt.name as type_name,
           t.x, t.y, t.map_id
    FROM building_instances bi
    JOIN building_types bt ON bi.building_type_id = bt.id
    JOIN tiles t ON bi.tile_id = t.id
    WHERE bi.id = ? AND bi.company_id = ?
  `).bind(building_id, company.id).first();

  if (!building) {
    throw new Error('Building not found or not owned by you');
  }

  if (building.is_collapsed) {
    throw new Error('Cannot cleanup collapsed buildings');
  }

  // Get uncleaned attacks on this building (excluding fire_bomb - handled separately)
  const uncleanedAttacks = await env.DB.prepare(`
    SELECT id, trick_type FROM attacks
    WHERE target_building_id = ? AND is_cleaned = 0
    AND trick_type != 'fire_bomb'
  `).bind(building_id).all();

  if (uncleanedAttacks.results.length === 0) {
    throw new Error('No trick effects to clean up');
  }

  // Calculate cleanup cost: 5% of building base cost per uncleaned attack
  const CLEANUP_COST_PERCENT = 0.05;
  const cleanupCost = Math.round(building.type_cost * CLEANUP_COST_PERCENT * uncleanedAttacks.results.length);

  if (company.cash < cleanupCost) {
    throw new Error(`Insufficient funds. Cleanup costs $${cleanupCost.toLocaleString()}`);
  }

  // Execute cleanup
  await env.DB.batch([
    // Mark attacks as cleaned
    env.DB.prepare(`
      UPDATE attacks SET is_cleaned = 1
      WHERE target_building_id = ? AND is_cleaned = 0 AND trick_type != 'fire_bomb'
    `).bind(building_id),

    // Deduct cost from company
    env.DB.prepare(`
      UPDATE game_companies
      SET cash = cash - ?, total_actions = total_actions + 1,
          last_action_at = ?, ticks_since_action = 0
      WHERE id = ?
    `).bind(cleanupCost, new Date().toISOString(), company.id),

    // Log transaction
    env.DB.prepare(`
      INSERT INTO game_transactions (id, company_id, map_id, action_type, target_building_id, amount, details)
      VALUES (?, ?, ?, 'cleanup', ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      company.id,
      building.map_id,
      building_id,
      -cleanupCost,
      JSON.stringify({ attacks_cleaned: uncleanedAttacks.results.length })
    ),
  ]);

  // Mark adjacent buildings dirty for profit recalculation
  await markAffectedBuildingsDirty(env, building.x, building.y, building.map_id);

  return {
    success: true,
    attacks_cleaned: uncleanedAttacks.results.length,
    cleanup_cost: cleanupCost
  };
}

/**
 * POST /api/game/buildings/extinguish
 * Put out fire on any building (any player can do this - community action)
 * - Sets is_on_fire = 0
 * - Marks fire_bomb attacks as cleaned
 * - FREE action (no cost)
 */
export async function extinguishFire(request, env, company) {
  const { building_id, map_id, x, y } = await request.json();

  // Validate required fields
  if (!building_id || !map_id || x === undefined || y === undefined) {
    throw new Error('Missing required fields: building_id, map_id, x, y');
  }

  // Validate prison status
  if (company.is_in_prison) {
    throw new Error(`You are in prison! Pay your fine of $${company.prison_fine?.toLocaleString()} to continue.`);
  }

  // Get building with location verification
  const building = await env.DB.prepare(`
    SELECT bi.*, t.x, t.y, t.map_id, gc.name as owner_name
    FROM building_instances bi
    JOIN tiles t ON bi.tile_id = t.id
    JOIN game_companies gc ON bi.company_id = gc.id
    WHERE bi.id = ?
  `).bind(building_id).first();

  if (!building) {
    throw new Error('Building not found');
  }

  // Verify location (prevent blind extinguishing by guessing IDs)
  if (building.map_id !== map_id || building.x !== x || building.y !== y) {
    throw new Error('Location mismatch');
  }

  if (!building.is_on_fire) {
    throw new Error('Building is not on fire');
  }

  if (building.is_collapsed) {
    throw new Error('Building has collapsed');
  }

  // Execute extinguish
  await env.DB.batch([
    // Put out fire
    env.DB.prepare(`
      UPDATE building_instances SET is_on_fire = 0 WHERE id = ?
    `).bind(building_id),

    // Mark fire_bomb attacks as cleaned
    env.DB.prepare(`
      UPDATE attacks SET is_cleaned = 1
      WHERE target_building_id = ? AND trick_type = 'fire_bomb' AND is_cleaned = 0
    `).bind(building_id),

    // Update company action tracking
    env.DB.prepare(`
      UPDATE game_companies
      SET total_actions = total_actions + 1, last_action_at = ?, ticks_since_action = 0
      WHERE id = ?
    `).bind(new Date().toISOString(), company.id),

    // Log transaction
    env.DB.prepare(`
      INSERT INTO game_transactions (id, company_id, map_id, action_type, target_building_id, target_company_id, amount)
      VALUES (?, ?, ?, 'extinguish', ?, ?, 0)
    `).bind(
      crypto.randomUUID(),
      company.id,
      building.map_id,
      building_id,
      building.company_id
    ),
  ]);

  // Mark adjacent buildings dirty (fire status affects adjacency)
  await markAffectedBuildingsDirty(env, building.x, building.y, building.map_id);

  return {
    success: true,
    building_id,
    owner_name: building.owner_name,
    message: 'Fire extinguished'
  };
}

/**
 * POST /api/game/buildings/repair
 * Fully repair building damage (owner only)
 * - Resets damage_percent to 0
 * - Cost = damage_percent% of building base cost
 * - Cannot repair collapsed buildings (must demolish)
 */
export async function repairBuilding(request, env, company) {
  const { building_id } = await request.json();

  if (!building_id) {
    throw new Error('Missing required field: building_id');
  }

  // Validate prison status
  if (company.is_in_prison) {
    throw new Error(`You are in prison! Pay your fine of $${company.prison_fine?.toLocaleString()} to continue.`);
  }

  // Get building with type info
  const building = await env.DB.prepare(`
    SELECT bi.*, bt.cost as type_cost, bt.name as type_name,
           t.x, t.y, t.map_id
    FROM building_instances bi
    JOIN building_types bt ON bi.building_type_id = bt.id
    JOIN tiles t ON bi.tile_id = t.id
    WHERE bi.id = ? AND bi.company_id = ?
  `).bind(building_id, company.id).first();

  if (!building) {
    throw new Error('Building not found or not owned by you');
  }

  if (building.is_collapsed) {
    throw new Error('Cannot repair collapsed buildings - use demolish instead');
  }

  if (building.damage_percent === 0) {
    throw new Error('Building is not damaged');
  }

  if (building.is_on_fire) {
    throw new Error('Put out the fire before repairing');
  }

  // Calculate repair cost: damage% of building base cost
  // e.g., 75% damage on $100,000 building = $75,000 to repair
  const repairCost = Math.round(building.type_cost * (building.damage_percent / 100));

  if (company.cash < repairCost) {
    throw new Error(`Insufficient funds. Repair costs $${repairCost.toLocaleString()}`);
  }

  const oldDamage = building.damage_percent;

  // Execute repair
  await env.DB.batch([
    // Reset damage to 0
    env.DB.prepare(`
      UPDATE building_instances
      SET damage_percent = 0, needs_profit_recalc = 1
      WHERE id = ?
    `).bind(building_id),

    // Deduct cost from company
    env.DB.prepare(`
      UPDATE game_companies
      SET cash = cash - ?, total_actions = total_actions + 1,
          last_action_at = ?, ticks_since_action = 0
      WHERE id = ?
    `).bind(repairCost, new Date().toISOString(), company.id),

    // Log transaction
    env.DB.prepare(`
      INSERT INTO game_transactions (id, company_id, map_id, action_type, target_building_id, amount, details)
      VALUES (?, ?, ?, 'repair', ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      company.id,
      building.map_id,
      building_id,
      -repairCost,
      JSON.stringify({ damage_repaired: oldDamage })
    ),
  ]);

  // Mark adjacent buildings dirty (damage affects adjacency penalties)
  await markAffectedBuildingsDirty(env, building.x, building.y, building.map_id);

  return {
    success: true,
    damage_repaired: oldDamage,
    repair_cost: repairCost
  };
}
