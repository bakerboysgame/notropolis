/**
 * Statistics Routes
 * Returns leaderboard data for companies in a map
 * Uses company_statistics table populated during tick processing
 */

/**
 * Get map statistics - monthly profit/loss and net worth rankings
 * @param {Object} env - Worker environment with DB binding
 * @param {string} mapId - Map ID to get statistics for
 * @returns {Object} { mapName, profitLeaderboard, netWorthLeaderboard }
 */
export async function getMapStatistics(env, mapId) {
  // Get map info
  const map = await env.DB.prepare(
    'SELECT id, name, location_type FROM maps WHERE id = ?'
  ).bind(mapId).first();

  if (!map) {
    throw new Error('Map not found');
  }

  // Get profit leaderboard from company_statistics table
  // Includes all companies with buildings on this map
  const profitResult = await env.DB.prepare(`
    SELECT
      gc.id,
      gc.name,
      gc.cash,
      COALESCE(cs.net_profit, 0) as monthly_profit,
      COALESCE(cs.gross_profit, 0) as gross_profit,
      COALESCE(cs.tax_amount, 0) as tax_amount,
      COALESCE(cs.security_cost, 0) as security_cost,
      COALESCE(cs.building_count, 0) as building_count,
      COALESCE(cs.average_damage_percent, 0) as average_damage,
      COALESCE(cs.is_earning, 1) as is_earning,
      cs.last_tick_at
    FROM game_companies gc
    LEFT JOIN company_statistics cs ON cs.company_id = gc.id AND cs.map_id = ?
    WHERE gc.current_map_id = ?
    ORDER BY monthly_profit DESC
  `).bind(mapId, mapId).all();

  // Get net worth leaderboard from company_statistics table
  const netWorthResult = await env.DB.prepare(`
    SELECT
      gc.id,
      gc.name,
      gc.cash,
      COALESCE(cs.damaged_building_value, 0) as buildings_value,
      gc.cash + COALESCE(cs.damaged_building_value, 0) as net_worth,
      COALESCE(cs.building_count, 0) as building_count,
      COALESCE(cs.collapsed_count, 0) as collapsed_count
    FROM game_companies gc
    LEFT JOIN company_statistics cs ON cs.company_id = gc.id AND cs.map_id = ?
    WHERE gc.current_map_id = ?
    ORDER BY net_worth DESC
  `).bind(mapId, mapId).all();

  return {
    mapId: map.id,
    mapName: map.name,
    locationType: map.location_type,
    profitLeaderboard: profitResult.results.map((company, index) => ({
      rank: index + 1,
      companyId: company.id,
      companyName: company.name,
      monthlyProfit: Math.round(company.monthly_profit || 0),
      grossProfit: Math.round(company.gross_profit || 0),
      taxAmount: Math.round(company.tax_amount || 0),
      securityCost: Math.round(company.security_cost || 0),
      buildingCount: company.building_count || 0,
      averageDamage: Math.round(company.average_damage || 0),
      isEarning: company.is_earning === 1,
      lastTickAt: company.last_tick_at
    })),
    netWorthLeaderboard: netWorthResult.results.map((company, index) => ({
      rank: index + 1,
      companyId: company.id,
      companyName: company.name,
      cash: Math.round(company.cash || 0),
      buildingsValue: Math.round(company.buildings_value || 0),
      netWorth: Math.round(company.net_worth || 0),
      buildingCount: company.building_count || 0,
      collapsedCount: company.collapsed_count || 0
    }))
  };
}

/**
 * Get statistics for a specific company
 * @param {Object} env - Worker environment with DB binding
 * @param {string} companyId - Company ID to get statistics for
 * @returns {Object} Company statistics including buildings, profit, net worth
 */
export async function getCompanyStatistics(env, companyId) {
  // Get company with map info and statistics
  const company = await env.DB.prepare(`
    SELECT
      gc.*,
      m.name as map_name,
      m.location_type,
      cs.building_count,
      cs.collapsed_count,
      cs.base_profit,
      cs.gross_profit,
      cs.tax_rate,
      cs.tax_amount,
      cs.security_cost,
      cs.net_profit,
      cs.total_building_value,
      cs.damaged_building_value,
      cs.total_damage_percent,
      cs.average_damage_percent,
      cs.buildings_on_fire,
      cs.is_earning,
      cs.last_tick_at
    FROM game_companies gc
    LEFT JOIN maps m ON gc.current_map_id = m.id
    LEFT JOIN company_statistics cs ON cs.company_id = gc.id AND cs.map_id = gc.current_map_id
    WHERE gc.id = ?
  `).bind(companyId).first();

  if (!company) {
    throw new Error('Company not found');
  }

  // If company is not in a location, return basic stats
  if (!company.current_map_id) {
    return {
      companyId: company.id,
      companyName: company.name,
      mapId: null,
      mapName: null,
      locationType: null,
      buildingsOwned: 0,
      collapsedBuildings: 0,
      monthlyProfit: 0,
      grossProfit: 0,
      taxRate: 0,
      taxAmount: 0,
      securityCost: 0,
      netWorth: company.cash,
      buildingsValue: 0,
      cash: company.cash,
      offshore: company.offshore,
      averageDamage: 0,
      buildingsOnFire: 0,
      isEarning: true,
      lastTickAt: null,
      joinedLocationAt: null
    };
  }

  // Get when company joined the location (first transaction on this map)
  const joinedAt = await env.DB.prepare(`
    SELECT MIN(created_at) as joined_at
    FROM game_transactions
    WHERE company_id = ?
      AND map_id = ?
  `).bind(companyId, company.current_map_id).first();

  // If company_statistics has no data, calculate stats from actual building data
  // This provides a fallback when tick hasn't run yet or data is missing
  let buildingCount = company.building_count;
  let collapsedCount = company.collapsed_count;
  let baseProfit = company.base_profit;
  let grossProfit = company.gross_profit;
  let taxRate = company.tax_rate;
  let taxAmount = company.tax_amount;
  let securityCost = company.security_cost;
  let netProfit = company.net_profit;
  let totalBuildingValue = company.total_building_value;
  let damagedBuildingValue = company.damaged_building_value;
  let avgDamage = company.average_damage_percent;
  let buildingsOnFire = company.buildings_on_fire;

  // Check if we need to calculate stats on-the-fly
  // Run fallback if:
  // 1. No company_statistics row exists (buildingCount is null/undefined)
  // 2. OR row exists but has zero values (may be stale from join-location initialization)
  const needsRecalculation =
    buildingCount === null ||
    buildingCount === undefined ||
    (buildingCount === 0 && (damagedBuildingValue === null || damagedBuildingValue === 0));

  if (needsRecalculation) {
    // Calculate from actual building_instances data
    const buildingStats = await env.DB.prepare(`
      SELECT
        COUNT(bi.id) as building_count,
        SUM(CASE WHEN bi.is_collapsed = 1 THEN 1 ELSE 0 END) as collapsed_count,
        SUM(CASE WHEN bi.is_collapsed = 0 THEN COALESCE(bi.calculated_profit, 0) ELSE 0 END) as base_profit,
        SUM(CASE WHEN bi.is_collapsed = 0 THEN COALESCE(bi.calculated_profit, 0) * (100 - bi.damage_percent * 1.176) / 100 ELSE 0 END) as gross_profit,
        SUM(CASE WHEN bi.is_collapsed = 0 THEN COALESCE(bs.monthly_cost, 0) ELSE 0 END) / 144 as total_security_cost,
        SUM(CASE WHEN bi.is_collapsed = 0 THEN bt.cost ELSE 0 END) as total_building_value,
        SUM(CASE WHEN bi.is_collapsed = 0 THEN bt.cost * (100 - COALESCE(bi.damage_percent, 0)) / 100 ELSE 0 END) as damaged_building_value,
        SUM(CASE WHEN bi.is_collapsed = 0 THEN bi.damage_percent ELSE 0 END) as total_damage_percent,
        SUM(CASE WHEN bi.is_collapsed = 0 AND bi.is_on_fire = 1 THEN 1 ELSE 0 END) as buildings_on_fire
      FROM building_instances bi
      JOIN tiles t ON bi.tile_id = t.id
      JOIN building_types bt ON bi.building_type_id = bt.id
      LEFT JOIN building_security bs ON bi.id = bs.building_id
      WHERE bi.company_id = ? AND t.map_id = ?
    `).bind(companyId, company.current_map_id).first();

    if (buildingStats) {
      buildingCount = buildingStats.building_count || 0;
      collapsedCount = buildingStats.collapsed_count || 0;
      baseProfit = Math.round(buildingStats.base_profit || 0);
      grossProfit = Math.round(buildingStats.gross_profit || 0);

      // Calculate tax rate based on location type
      taxRate = company.location_type === 'capital' ? 0.20 :
                company.location_type === 'city' ? 0.15 : 0.10;
      taxAmount = Math.round(grossProfit * taxRate);
      securityCost = Math.round(buildingStats.total_security_cost || 0);
      netProfit = grossProfit - taxAmount - securityCost;

      totalBuildingValue = Math.round(buildingStats.total_building_value || 0);
      damagedBuildingValue = Math.round(buildingStats.damaged_building_value || 0);

      const activeBuildings = buildingCount - collapsedCount;
      avgDamage = activeBuildings > 0
        ? (buildingStats.total_damage_percent || 0) / activeBuildings
        : 0;
      buildingsOnFire = buildingStats.buildings_on_fire || 0;
    }
  }

  const buildingsVal = Math.round(damagedBuildingValue || 0);

  return {
    companyId: company.id,
    companyName: company.name,
    mapId: company.current_map_id,
    mapName: company.map_name,
    locationType: company.location_type,
    buildingsOwned: buildingCount || 0,
    collapsedBuildings: collapsedCount || 0,
    monthlyProfit: Math.round(netProfit || 0),
    grossProfit: Math.round(grossProfit || 0),
    baseProfit: Math.round(baseProfit || 0),
    taxRate: taxRate || 0,
    taxAmount: Math.round(taxAmount || 0),
    securityCost: Math.round(securityCost || 0),
    netWorth: Math.round(company.cash + buildingsVal),
    buildingsValue: buildingsVal,
    totalBuildingsValue: Math.round(totalBuildingValue || 0),
    cash: company.cash,
    offshore: company.offshore,
    averageDamage: Math.round(avgDamage || 0),
    buildingsOnFire: buildingsOnFire || 0,
    isEarning: company.is_earning === 1 || company.ticks_since_action < 6,
    lastTickAt: company.last_tick_at,
    joinedLocationAt: joinedAt?.joined_at || null
  };
}

/**
 * Get all properties for a company with their details, attacks, and profit/loss
 * @param {Object} env - Worker environment with DB binding
 * @param {string} companyId - Company ID to get properties for
 * @returns {Object} { properties: [...], totals: {...} }
 */
export async function getCompanyProperties(env, companyId) {
  // Get company info
  const company = await env.DB.prepare(`
    SELECT gc.*, m.name as map_name, m.location_type
    FROM game_companies gc
    LEFT JOIN maps m ON gc.current_map_id = m.id
    WHERE gc.id = ?
  `).bind(companyId).first();

  if (!company) {
    throw new Error('Company not found');
  }

  if (!company.current_map_id) {
    return { properties: [], totals: { totalValue: 0, totalProfit: 0, propertyCount: 0 } };
  }

  // Calculate tax rate based on location type
  const taxRate = company.location_type === 'capital' ? 0.20 :
                  company.location_type === 'city' ? 0.15 : 0.10;

  // Get all buildings for this company with their details
  const buildingsResult = await env.DB.prepare(`
    SELECT
      bi.id,
      bi.tile_id,
      bi.damage_percent,
      bi.is_on_fire,
      bi.is_collapsed,
      bi.is_for_sale,
      bi.sale_price,
      bi.calculated_profit,
      bi.built_at,
      bt.id as building_type_id,
      bt.name as building_type_name,
      bt.cost as building_cost,
      t.x,
      t.y,
      m.name as map_name,
      m.id as map_id,
      bs.has_cameras,
      bs.has_guard_dogs,
      bs.has_security_guards,
      bs.has_sprinklers,
      COALESCE(bs.monthly_cost, 0) as security_monthly_cost
    FROM building_instances bi
    JOIN building_types bt ON bi.building_type_id = bt.id
    JOIN tiles t ON bi.tile_id = t.id
    JOIN maps m ON t.map_id = m.id
    LEFT JOIN building_security bs ON bi.id = bs.building_id
    WHERE bi.company_id = ? AND t.map_id = ?
    ORDER BY bi.built_at DESC
  `).bind(companyId, company.current_map_id).all();

  // Get recent attacks on this company's buildings (last 7 days)
  const attacksResult = await env.DB.prepare(`
    SELECT
      a.id,
      a.target_building_id,
      a.trick_type,
      a.damage_dealt,
      a.is_cleaned,
      a.created_at,
      gc.name as attacker_name
    FROM attacks a
    JOIN building_instances bi ON a.target_building_id = bi.id
    JOIN game_companies gc ON a.attacker_company_id = gc.id
    WHERE bi.company_id = ?
      AND a.created_at > datetime('now', '-7 days')
    ORDER BY a.created_at DESC
  `).bind(companyId).all();

  // Group attacks by building
  const attacksByBuilding = {};
  for (const attack of attacksResult.results) {
    if (!attacksByBuilding[attack.target_building_id]) {
      attacksByBuilding[attack.target_building_id] = [];
    }
    attacksByBuilding[attack.target_building_id].push({
      id: attack.id,
      trickType: attack.trick_type,
      damageDealt: attack.damage_dealt,
      isCleaned: attack.is_cleaned === 1,
      attackerName: attack.attacker_name,
      createdAt: attack.created_at
    });
  }

  // Calculate totals
  let totalValue = 0;
  let totalProfit = 0;

  // Map buildings to response format
  const properties = buildingsResult.results.map(building => {
    const health = 100 - (building.damage_percent || 0);
    const isActive = !building.is_collapsed;

    // Calculate value (damaged value)
    const value = isActive
      ? Math.round(building.building_cost * (health / 100))
      : 0;

    // Calculate profit per tick (after damage, tax, and security)
    let profitPerTick = 0;
    if (isActive && building.calculated_profit > 0) {
      // Apply damage reduction (same formula as tick processing)
      const damageMultiplier = (100 - building.damage_percent * 1.176) / 100;
      const grossProfit = building.calculated_profit * damageMultiplier;
      const taxAmount = grossProfit * taxRate;
      const securityCost = (building.security_monthly_cost || 0) / 144; // Per tick
      profitPerTick = Math.round(grossProfit - taxAmount - securityCost);
    }

    totalValue += value;
    totalProfit += profitPerTick;

    return {
      id: building.id,
      tileId: building.tile_id,
      buildingType: building.building_type_name,
      buildingTypeId: building.building_type_id,
      location: {
        mapId: building.map_id,
        mapName: building.map_name,
        x: building.x,
        y: building.y
      },
      health,
      isOnFire: building.is_on_fire === 1,
      isCollapsed: building.is_collapsed === 1,
      isForSale: building.is_for_sale === 1,
      salePrice: building.sale_price,
      value,
      baseCost: building.building_cost,
      profitPerTick,
      baseProfit: building.calculated_profit || 0,
      security: {
        hasCameras: building.has_cameras === 1,
        hasGuardDogs: building.has_guard_dogs === 1,
        hasSecurityGuards: building.has_security_guards === 1,
        hasSprinklers: building.has_sprinklers === 1,
        monthlyCost: building.security_monthly_cost || 0
      },
      recentAttacks: attacksByBuilding[building.id] || [],
      builtAt: building.built_at
    };
  });

  return {
    properties,
    totals: {
      totalValue,
      totalProfit,
      propertyCount: properties.length,
      collapsedCount: properties.filter(p => p.isCollapsed).length,
      onFireCount: properties.filter(p => p.isOnFire).length,
      attackedCount: properties.filter(p => p.recentAttacks.length > 0).length
    },
    mapName: company.map_name,
    locationType: company.location_type,
    taxRate
  };
}
