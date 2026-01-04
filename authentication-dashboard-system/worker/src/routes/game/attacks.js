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
  fire_bomb: { cost: 10000, damage: 40, policeCatchRate: 0.50, securityCatchRate: 0.55, levelRequired: 4 },
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
  const { building_id, trick_type, map_id, x, y } = await request.json();

  // Validate required fields
  if (!building_id || !trick_type || !map_id || x === undefined || y === undefined) {
    throw new Error('Missing required fields: building_id, trick_type, map_id, x, y');
  }

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

  // Cannot attack own building
  if (building.company_id === company.id) {
    throw new Error('Cannot attack your own building');
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

  // Log attack to attacks table
  statements.push(
    env.DB.prepare(`
      INSERT INTO attacks (
        attacker_company_id, target_building_id, trick_type,
        damage_dealt, was_caught, caught_by, fine_amount,
        security_active, police_active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      company.id,
      building_id,
      trick_type,
      damageDealt,
      wasCaught ? 1 : 0,
      caughtBy,
      fineAmount,
      securityActive ? 1 : 0,
      policeActive ? 1 : 0
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
