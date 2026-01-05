/**
 * Hero System API Routes
 *
 * Handles hero-out (cashing out to offshore) and joining new locations.
 * Players can hero when they meet one of three conditions:
 * 1. Net worth threshold (cash + 50% building value)
 * 2. Cash only threshold
 * 3. Land ownership streak (maintain X% of land for Y ticks)
 */

import { checkAvatarUnlocks } from './avatar.js';

/**
 * Hero requirements by location type
 */
export const HERO_REQUIREMENTS = {
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
export const STARTING_CASH = {
  town: 50_000,
  city: 1_000_000,
  capital: 5_000_000,
};

/**
 * Calculate company's net worth and hero eligibility
 */
async function calculateHeroStatus(env, company) {
  if (!company.current_map_id || !company.location_type) {
    return {
      eligible: false,
      reason: 'Company is not in a location',
    };
  }

  const requirements = HERO_REQUIREMENTS[company.location_type];
  if (!requirements) {
    return {
      eligible: false,
      reason: 'Invalid location type',
    };
  }

  // Get total building value (uses dynamic calculated_value if available, falls back to cost)
  const buildingsResult = await env.DB.prepare(`
    SELECT SUM(COALESCE(bi.calculated_value, bt.cost)) as total_value
    FROM building_instances bi
    JOIN building_types bt ON bi.building_type_id = bt.id
    JOIN tiles t ON bi.tile_id = t.id
    WHERE bi.company_id = ? AND t.map_id = ?
  `).bind(company.id, company.current_map_id).first();

  const totalBuildingValue = buildingsResult?.total_value || 0;
  // Buildings sell at full value for hero
  const netWorth = company.cash + totalBuildingValue;

  // Check each path
  const canHeroNetWorth = netWorth >= requirements.netWorth;
  const canHeroCash = company.cash >= requirements.cash;
  const canHeroLand =
    company.land_percentage >= requirements.landPercentage &&
    company.land_ownership_streak >= requirements.landStreakTicks;

  const canHero = canHeroNetWorth || canHeroCash || canHeroLand;

  // Determine which path qualified
  let qualifiedPath = null;
  if (canHeroNetWorth) qualifiedPath = 'netWorth';
  else if (canHeroCash) qualifiedPath = 'cash';
  else if (canHeroLand) qualifiedPath = 'land';

  return {
    eligible: canHero,
    qualifiedPath,
    requirements,
    current: {
      cash: company.cash,
      buildingValue: totalBuildingValue,
      netWorth,
      landPercentage: company.land_percentage || 0,
      landOwnershipStreak: company.land_ownership_streak || 0,
    },
    progress: {
      netWorth: {
        current: netWorth,
        required: requirements.netWorth,
        percentage: Math.min(100, (netWorth / requirements.netWorth) * 100),
        met: canHeroNetWorth,
      },
      cash: {
        current: company.cash,
        required: requirements.cash,
        percentage: Math.min(100, (company.cash / requirements.cash) * 100),
        met: canHeroCash,
      },
      land: {
        currentPercentage: company.land_percentage || 0,
        requiredPercentage: requirements.landPercentage,
        percentageMet: (company.land_percentage || 0) >= requirements.landPercentage,
        currentStreak: company.land_ownership_streak || 0,
        requiredStreak: requirements.landStreakTicks,
        streakMet: (company.land_ownership_streak || 0) >= requirements.landStreakTicks,
        met: canHeroLand,
      },
    },
    unlocks: requirements.unlocks,
  };
}

/**
 * GET /api/game/hero/status?company_id=xxx
 * Get hero progress and eligibility for a company
 */
export async function getHeroStatus(request, env, company) {
  const status = await calculateHeroStatus(env, company);

  // Get building details for the modal
  let buildings = [];
  if (company.current_map_id) {
    const buildingsResult = await env.DB.prepare(`
      SELECT bi.id, bt.name, bt.cost as base_cost, COALESCE(bi.calculated_value, bt.cost) as value
      FROM building_instances bi
      JOIN building_types bt ON bi.building_type_id = bt.id
      JOIN tiles t ON bi.tile_id = t.id
      WHERE bi.company_id = ? AND t.map_id = ?
      ORDER BY COALESCE(bi.calculated_value, bt.cost) DESC
    `).bind(company.id, company.current_map_id).all();
    buildings = buildingsResult.results || [];
  }

  return {
    success: true,
    company_id: company.id,
    location_type: company.location_type,
    ...status,
    buildings,
  };
}

/**
 * Execute hero-out for a company (core logic)
 * Used by both voluntary hero-out API and forced hero-out in tick processor
 * @param {Object} env - Worker environment with DB binding
 * @param {Object} company - Company object with id, current_map_id, cash, offshore, user_id
 * @param {string} qualifiedPath - Which path qualified ('netWorth', 'cash', or 'land')
 * @param {Object} options - Additional options
 * @param {boolean} options.isForced - Whether this is a forced hero-out (clears prison, different action_type)
 * @param {string} options.unlocks - What location type this unlocks ('city', 'capital', or null)
 * @returns {Object} Hero-out result with details
 */
export async function executeHeroOut(env, company, qualifiedPath, options = {}) {
  const { isForced = false, unlocks = null } = options;

  // Get map details for celebration page
  const mapDetails = await env.DB.prepare(
    'SELECT name, location_type FROM maps WHERE id = ?'
  ).bind(company.current_map_id).first();

  // Get all buildings to sell (use dynamic value if available)
  const buildingsResult = await env.DB.prepare(`
    SELECT bi.id, bi.tile_id, bt.name, bt.cost as base_cost, COALESCE(bi.calculated_value, bt.cost) as value
    FROM building_instances bi
    JOIN building_types bt ON bi.building_type_id = bt.id
    JOIN tiles t ON bi.tile_id = t.id
    WHERE bi.company_id = ? AND t.map_id = ?
  `).bind(company.id, company.current_map_id).all();

  const buildings = buildingsResult.results || [];
  const totalBuildingValue = buildings.reduce((sum, b) => sum + b.value, 0);
  // Buildings sell at full value for hero (net worth = offshore)
  const totalToOffshore = company.cash + totalBuildingValue;

  const buildingIds = buildings.map((b) => b.id);

  // Build batch statements
  const statements = [];

  // Delete all buildings
  if (buildingIds.length > 0) {
    for (const buildingId of buildingIds) {
      statements.push(
        env.DB.prepare('DELETE FROM building_instances WHERE id = ?').bind(buildingId)
      );
      statements.push(
        env.DB.prepare('DELETE FROM building_security WHERE building_id = ?').bind(buildingId)
      );
    }
  }

  // Clear tile ownership for all owned tiles
  statements.push(
    env.DB.prepare(`
      UPDATE tiles SET owner_company_id = NULL, purchased_at = NULL
      WHERE owner_company_id = ? AND map_id = ?
    `).bind(company.id, company.current_map_id)
  );

  // Update company: add to offshore, reset everything, set celebration pending
  // For forced hero-out, also clear prison status
  if (isForced) {
    statements.push(
      env.DB.prepare(`
        UPDATE game_companies
        SET offshore = offshore + ?,
            cash = 0,
            level = 1,
            total_actions = 0,
            current_map_id = NULL,
            location_type = NULL,
            land_ownership_streak = 0,
            land_percentage = 0,
            hero_eligible_streak = 0,
            is_in_prison = 0,
            prison_fine = 0,
            hero_celebration_pending = 1,
            hero_from_map_id = ?,
            hero_from_location_type = ?,
            last_action_at = ?,
            ticks_since_action = 0
        WHERE id = ?
      `).bind(totalToOffshore, company.current_map_id, mapDetails?.location_type, new Date().toISOString(), company.id)
    );
  } else {
    statements.push(
      env.DB.prepare(`
        UPDATE game_companies
        SET offshore = offshore + ?,
            cash = 0,
            level = 1,
            total_actions = 0,
            current_map_id = NULL,
            location_type = NULL,
            land_ownership_streak = 0,
            land_percentage = 0,
            hero_eligible_streak = 0,
            hero_celebration_pending = 1,
            hero_from_map_id = ?,
            hero_from_location_type = ?,
            last_action_at = ?,
            ticks_since_action = 0
        WHERE id = ?
      `).bind(totalToOffshore, company.current_map_id, mapDetails?.location_type, new Date().toISOString(), company.id)
    );
  }

  // Log hero transaction
  const actionType = isForced ? 'forced_hero_out' : 'hero_out';
  statements.push(
    env.DB.prepare(`
      INSERT INTO game_transactions (id, company_id, map_id, action_type, amount, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      company.id,
      company.current_map_id,
      actionType,
      totalToOffshore,
      JSON.stringify({
        path: qualifiedPath,
        buildings_sold: buildings.length,
        building_value: totalBuildingValue,
        cash: company.cash,
        unlocks: unlocks,
        forced: isForced,
      })
    )
  );

  await env.DB.batch(statements);

  // Check for avatar unlocks after hero out
  const { newlyUnlocked } = await checkAvatarUnlocks(env, company.user_id);

  return {
    success: true,
    path: qualifiedPath,
    buildings_sold: buildings.length,
    building_value: totalBuildingValue,
    cash_added: company.cash,
    total_to_offshore: totalToOffshore,
    new_offshore: company.offshore + totalToOffshore,
    unlocks: unlocks,
    unlocked_items: newlyUnlocked,
    forced: isForced,
  };
}

/**
 * POST /api/game/hero/hero-out
 * Voluntary hero-out is disabled - hero only happens automatically via forced hero-out
 */
export async function heroOut(request, env, company) {
  throw new Error('Voluntary hero-out is disabled. You will be automatically hero\'d out after meeting requirements for 6 consecutive ticks.');
}

/**
 * POST /api/game/hero/join-location
 * Join a new map after hero-ing out
 */
export async function joinLocation(request, env, company) {
  const { map_id } = await request.json();

  if (!map_id) {
    throw new Error('map_id is required');
  }

  // Verify company has no current map
  if (company.current_map_id) {
    throw new Error('Company is already in a location. Hero out first to change locations.');
  }

  // Get map details
  const map = await env.DB.prepare(
    'SELECT * FROM maps WHERE id = ? AND is_active = 1'
  ).bind(map_id).first();

  if (!map) {
    throw new Error('Map not found or not active');
  }

  // Check unlock requirements based on location type
  const locationType = map.location_type;

  if (locationType === 'city') {
    // Check if player has ever hero'd a town
    const townHero = await env.DB.prepare(`
      SELECT id FROM game_transactions
      WHERE company_id = ? AND action_type = 'hero_out'
      AND details LIKE '%"unlocks":"city"%'
      LIMIT 1
    `).bind(company.id).first();

    if (!townHero) {
      throw new Error('You must hero out of a Town before joining a City');
    }
  } else if (locationType === 'capital') {
    // Check if player has ever hero'd a city
    const cityHero = await env.DB.prepare(`
      SELECT id FROM game_transactions
      WHERE company_id = ? AND action_type = 'hero_out'
      AND details LIKE '%"unlocks":"capital"%'
      LIMIT 1
    `).bind(company.id).first();

    if (!cityHero) {
      throw new Error('You must hero out of a City before joining the Capital');
    }
  }

  // Get starting cash for this location type
  const startingCash = STARTING_CASH[locationType] || STARTING_CASH.town;

  // Update company
  await env.DB.prepare(`
    UPDATE game_companies
    SET current_map_id = ?,
        location_type = ?,
        cash = ?,
        level = 1,
        total_actions = 0,
        land_ownership_streak = 0,
        land_percentage = 0,
        hero_eligible_streak = 0,
        last_action_at = ?,
        ticks_since_action = 0
    WHERE id = ?
  `).bind(
    map_id,
    locationType,
    startingCash,
    new Date().toISOString(),
    company.id
  ).run();

  // Log transaction
  await env.DB.prepare(`
    INSERT INTO game_transactions (id, company_id, map_id, action_type, amount, details)
    VALUES (?, ?, ?, 'join_location', ?, ?)
  `).bind(
    crypto.randomUUID(),
    company.id,
    map_id,
    startingCash,
    JSON.stringify({ location_type: locationType })
  ).run();

  // Initialize company_statistics row with zeroes so stats display immediately
  const taxRate = locationType === 'capital' ? 0.20 : locationType === 'city' ? 0.15 : 0.10;
  await env.DB.prepare(`
    INSERT INTO company_statistics (
      id, company_id, map_id,
      building_count, collapsed_count,
      base_profit, gross_profit, tax_rate, tax_amount, security_cost, net_profit,
      total_building_value, damaged_building_value,
      total_damage_percent, average_damage_percent, buildings_on_fire,
      ticks_since_action, is_earning,
      last_tick_at
    ) VALUES (?, ?, ?, 0, 0, 0, 0, ?, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, CURRENT_TIMESTAMP)
    ON CONFLICT (company_id, map_id) DO UPDATE SET
      building_count = 0,
      collapsed_count = 0,
      base_profit = 0,
      gross_profit = 0,
      tax_amount = 0,
      security_cost = 0,
      net_profit = 0,
      total_building_value = 0,
      damaged_building_value = 0,
      total_damage_percent = 0,
      average_damage_percent = 0,
      buildings_on_fire = 0,
      ticks_since_action = 0,
      is_earning = 1,
      last_tick_at = CURRENT_TIMESTAMP
  `).bind(
    crypto.randomUUID(),
    company.id,
    map_id,
    taxRate
  ).run();

  // Initialize message_read_status so company only sees messages from after they joined
  // joined_at tracks when they joined (for filtering messages)
  // last_read_at tracks when they last viewed messages (for unread count)
  await env.DB.prepare(`
    INSERT INTO message_read_status (company_id, map_id, joined_at, last_read_at)
    VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (company_id, map_id) DO UPDATE SET joined_at = CURRENT_TIMESTAMP, last_read_at = CURRENT_TIMESTAMP
  `).bind(company.id, map_id).run();

  return {
    success: true,
    map_id,
    location_type: locationType,
    starting_cash: startingCash,
  };
}

/**
 * GET /api/game/hero/available-locations
 * Get locations available for the company to join
 */
export async function getAvailableLocations(request, env, company) {
  // Get all active maps
  const mapsResult = await env.DB.prepare(`
    SELECT m.id, m.name, m.location_type, m.width, m.height,
           (SELECT COUNT(*) FROM tiles t WHERE t.map_id = m.id AND t.terrain_type = 'free_land') as total_land,
           (SELECT COUNT(*) FROM tiles t WHERE t.map_id = m.id AND t.owner_company_id IS NOT NULL) as owned_land,
           (SELECT COUNT(DISTINCT bi.company_id) FROM building_instances bi
            JOIN tiles t ON bi.tile_id = t.id WHERE t.map_id = m.id) as active_companies
    FROM maps m
    WHERE m.is_active = 1
    ORDER BY m.location_type, m.name
  `).all();

  const maps = mapsResult.results || [];

  // Check unlock status for each location type
  const townHero = await env.DB.prepare(`
    SELECT id FROM game_transactions
    WHERE company_id = ? AND action_type = 'hero_out'
    AND details LIKE '%"unlocks":"city"%'
    LIMIT 1
  `).bind(company.id).first();

  const cityHero = await env.DB.prepare(`
    SELECT id FROM game_transactions
    WHERE company_id = ? AND action_type = 'hero_out'
    AND details LIKE '%"unlocks":"capital"%'
    LIMIT 1
  `).bind(company.id).first();

  const unlockedLocations = ['town'];
  if (townHero) unlockedLocations.push('city');
  if (cityHero) unlockedLocations.push('capital');

  return {
    success: true,
    unlocked_locations: unlockedLocations,
    maps: maps.map((m) => ({
      ...m,
      unlocked: unlockedLocations.includes(m.location_type),
      starting_cash: STARTING_CASH[m.location_type] || STARTING_CASH.town,
    })),
  };
}

/**
 * GET /api/game/hero/celebration-status
 * Check if company has a pending hero celebration
 */
export async function getCelebrationStatus(request, env, company) {
  // Check if there's a pending celebration
  if (!company.hero_celebration_pending) {
    return {
      success: true,
      hasPendingCelebration: false,
    };
  }

  // Get details about the map they hero'd from
  const mapDetails = await env.DB.prepare(
    'SELECT id, name, location_type FROM maps WHERE id = ?'
  ).bind(company.hero_from_map_id).first();

  // Get the transaction details for the hero-out
  const heroTransaction = await env.DB.prepare(`
    SELECT amount, details, created_at
    FROM game_transactions
    WHERE company_id = ? AND action_type IN ('hero_out', 'forced_hero_out')
    ORDER BY created_at DESC
    LIMIT 1
  `).bind(company.id).first();

  const details = heroTransaction?.details ? JSON.parse(heroTransaction.details) : {};

  return {
    success: true,
    hasPendingCelebration: true,
    celebration: {
      mapId: company.hero_from_map_id,
      mapName: mapDetails?.name || 'Unknown Location',
      locationType: company.hero_from_location_type,
      offshoreAmount: heroTransaction?.amount || 0,
      heroPath: details.path || 'netWorth',
      unlocks: details.unlocks,
      heroedAt: heroTransaction?.created_at,
    },
  };
}

/**
 * POST /api/game/hero/leave-message
 * Leave a message in the town hall book after hero-ing out
 */
export async function leaveHeroMessage(request, env, company) {
  // Check if there's a pending celebration
  if (!company.hero_celebration_pending) {
    throw new Error('No pending hero celebration');
  }

  const { message } = await request.json();

  if (!message || typeof message !== 'string') {
    throw new Error('Message is required');
  }

  const trimmedMessage = message.trim();
  if (trimmedMessage.length === 0) {
    throw new Error('Message cannot be empty');
  }

  if (trimmedMessage.length > 500) {
    throw new Error('Message must be 500 characters or less');
  }

  // Get map details
  const mapDetails = await env.DB.prepare(
    'SELECT id, name, location_type FROM maps WHERE id = ?'
  ).bind(company.hero_from_map_id).first();

  if (!mapDetails) {
    throw new Error('Map not found');
  }

  // Get the transaction details for the hero-out amount
  const heroTransaction = await env.DB.prepare(`
    SELECT amount, details
    FROM game_transactions
    WHERE company_id = ? AND action_type IN ('hero_out', 'forced_hero_out')
    ORDER BY created_at DESC
    LIMIT 1
  `).bind(company.id).first();

  const details = heroTransaction?.details ? JSON.parse(heroTransaction.details) : {};

  // Insert the hero message
  await env.DB.prepare(`
    INSERT INTO hero_messages (id, company_id, company_name, boss_name, map_id, map_name, location_type, message, offshore_amount, hero_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    company.id,
    company.name,
    company.boss_name,
    company.hero_from_map_id,
    mapDetails.name,
    mapDetails.location_type,
    trimmedMessage,
    heroTransaction?.amount || 0,
    details.path || 'netWorth'
  ).run();

  // Clear the celebration pending flag
  await env.DB.prepare(`
    UPDATE game_companies
    SET hero_celebration_pending = 0,
        hero_from_map_id = NULL,
        hero_from_location_type = NULL
    WHERE id = ?
  `).bind(company.id).run();

  return {
    success: true,
    message: 'Message saved to the town hall book',
  };
}

/**
 * GET /api/game/hero/messages
 * Get hero messages for a specific map (town hall book)
 */
export async function getHeroMessages(request, env, company) {
  const url = new URL(request.url);
  const mapId = url.searchParams.get('map_id');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0');

  let query;
  let bindings;

  if (mapId) {
    query = `
      SELECT id, company_name, boss_name, map_name, location_type, message, offshore_amount, hero_path, created_at
      FROM hero_messages
      WHERE map_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    bindings = [mapId, limit, offset];
  } else {
    // Get all messages for the location type the company has access to
    query = `
      SELECT id, company_name, boss_name, map_name, location_type, message, offshore_amount, hero_path, created_at
      FROM hero_messages
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    bindings = [limit, offset];
  }

  const messagesResult = await env.DB.prepare(query).bind(...bindings).all();

  return {
    success: true,
    messages: messagesResult.results || [],
  };
}
