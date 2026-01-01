/**
 * Hero System API Routes
 *
 * Handles hero-out (cashing out to offshore) and joining new locations.
 * Players can hero when they meet one of three conditions:
 * 1. Net worth threshold (cash + 50% building value)
 * 2. Cash only threshold
 * 3. Land ownership streak (maintain X% of land for Y ticks)
 */

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

  // Get total building value
  const buildingsResult = await env.DB.prepare(`
    SELECT SUM(bt.cost) as total_value
    FROM building_instances bi
    JOIN building_types bt ON bi.building_type_id = bt.id
    JOIN tiles t ON bi.tile_id = t.id
    WHERE bi.company_id = ? AND t.map_id = ?
  `).bind(company.id, company.current_map_id).first();

  const totalBuildingValue = buildingsResult?.total_value || 0;
  const buildingSellValue = Math.floor(totalBuildingValue * 0.5);
  const netWorth = company.cash + buildingSellValue;

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
      buildingSellValue,
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
      SELECT bi.id, bt.name, bt.cost
      FROM building_instances bi
      JOIN building_types bt ON bi.building_type_id = bt.id
      JOIN tiles t ON bi.tile_id = t.id
      WHERE bi.company_id = ? AND t.map_id = ?
      ORDER BY bt.cost DESC
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
 * POST /api/game/hero/hero-out
 * Execute hero - sell all buildings, add to offshore, reset company
 */
export async function heroOut(request, env, company) {
  // Check prison status
  if (company.is_in_prison) {
    throw new Error(`You are in prison! Pay your fine of $${company.prison_fine?.toLocaleString()} to continue.`);
  }

  // Calculate hero eligibility
  const status = await calculateHeroStatus(env, company);

  if (!status.eligible) {
    throw new Error(status.reason || 'You do not meet the requirements to hero out');
  }

  // Get all buildings to sell
  const buildingsResult = await env.DB.prepare(`
    SELECT bi.id, bi.tile_id, bt.name, bt.cost
    FROM building_instances bi
    JOIN building_types bt ON bi.building_type_id = bt.id
    JOIN tiles t ON bi.tile_id = t.id
    WHERE bi.company_id = ? AND t.map_id = ?
  `).bind(company.id, company.current_map_id).all();

  const buildings = buildingsResult.results || [];
  const totalBuildingValue = buildings.reduce((sum, b) => sum + b.cost, 0);
  const buildingSellValue = Math.floor(totalBuildingValue * 0.5);
  const totalToOffshore = company.cash + buildingSellValue;

  const buildingIds = buildings.map((b) => b.id);
  const tileIds = buildings.map((b) => b.tile_id);

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

  // Update company: add to offshore, reset everything
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
          last_action_at = ?,
          ticks_since_action = 0
      WHERE id = ?
    `).bind(totalToOffshore, new Date().toISOString(), company.id)
  );

  // Log hero transaction
  statements.push(
    env.DB.prepare(`
      INSERT INTO game_transactions (id, company_id, map_id, action_type, amount, details)
      VALUES (?, ?, ?, 'hero_out', ?, ?)
    `).bind(
      crypto.randomUUID(),
      company.id,
      company.current_map_id,
      totalToOffshore,
      JSON.stringify({
        path: status.qualifiedPath,
        buildings_sold: buildings.length,
        building_value: totalBuildingValue,
        building_sell_value: buildingSellValue,
        cash: company.cash,
        unlocks: status.unlocks,
      })
    )
  );

  await env.DB.batch(statements);

  return {
    success: true,
    path: status.qualifiedPath,
    buildings_sold: buildings.length,
    building_value: totalBuildingValue,
    building_sell_value: buildingSellValue,
    cash_added: company.cash,
    total_to_offshore: totalToOffshore,
    new_offshore: company.offshore + totalToOffshore,
    unlocks: status.unlocks,
  };
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
