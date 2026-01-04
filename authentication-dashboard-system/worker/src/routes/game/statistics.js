/**
 * Statistics Routes
 * Returns leaderboard data for companies in a map
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

  // Get all companies on this map with their monthly profit/loss
  // Monthly profit = sum of tick_income transactions in the last 30 days
  // Note: We're looking at the last 30 days of transactions
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const profitResult = await env.DB.prepare(`
    SELECT
      gc.id,
      gc.name,
      gc.cash,
      COALESCE(SUM(
        CASE WHEN gt.action_type = 'tick_income' THEN gt.amount ELSE 0 END
      ), 0) as monthly_profit
    FROM game_companies gc
    LEFT JOIN game_transactions gt ON gt.company_id = gc.id
      AND gt.map_id = ?
      AND gt.created_at >= ?
    WHERE gc.current_map_id = ?
    GROUP BY gc.id
    ORDER BY monthly_profit DESC
  `).bind(mapId, thirtyDaysAgo, mapId).all();

  // Get net worth for all companies on this map
  // Net worth = cash + sum of (building_cost * health_factor)
  // health_factor = (100 - damage_percent) / 100
  const netWorthResult = await env.DB.prepare(`
    SELECT
      gc.id,
      gc.name,
      gc.cash,
      COALESCE(SUM(
        bt.cost * (100 - COALESCE(bi.damage_percent, 0)) / 100
      ), 0) as buildings_value,
      gc.cash + COALESCE(SUM(
        bt.cost * (100 - COALESCE(bi.damage_percent, 0)) / 100
      ), 0) as net_worth
    FROM game_companies gc
    LEFT JOIN building_instances bi ON bi.company_id = gc.id AND bi.is_collapsed = 0
    LEFT JOIN tiles t ON bi.tile_id = t.id AND t.map_id = ?
    LEFT JOIN building_types bt ON bi.building_type_id = bt.id
    WHERE gc.current_map_id = ?
    GROUP BY gc.id
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
      monthlyProfit: Math.round(company.monthly_profit || 0)
    })),
    netWorthLeaderboard: netWorthResult.results.map((company, index) => ({
      rank: index + 1,
      companyId: company.id,
      companyName: company.name,
      cash: Math.round(company.cash || 0),
      buildingsValue: Math.round(company.buildings_value || 0),
      netWorth: Math.round(company.net_worth || 0)
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
  // Get company with map info
  const company = await env.DB.prepare(`
    SELECT
      gc.*,
      m.name as map_name,
      m.location_type
    FROM game_companies gc
    LEFT JOIN maps m ON gc.current_map_id = m.id
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
      monthlyProfit: 0,
      netWorth: company.cash,
      buildingsValue: 0,
      cash: company.cash,
      offshore: company.offshore,
      joinedLocationAt: null
    };
  }

  // Get building count for this company on current map
  const buildingCount = await env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM building_instances bi
    JOIN tiles t ON bi.tile_id = t.id
    WHERE bi.company_id = ?
      AND t.map_id = ?
      AND bi.is_collapsed = 0
  `).bind(companyId, company.current_map_id).first();

  // Get monthly profit (tick_income transactions in last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const profitResult = await env.DB.prepare(`
    SELECT COALESCE(SUM(amount), 0) as monthly_profit
    FROM game_transactions
    WHERE company_id = ?
      AND map_id = ?
      AND action_type = 'tick_income'
      AND created_at >= ?
  `).bind(companyId, company.current_map_id, thirtyDaysAgo).first();

  // Get buildings value (cost * health factor)
  const buildingsValue = await env.DB.prepare(`
    SELECT COALESCE(SUM(
      bt.cost * (100 - COALESCE(bi.damage_percent, 0)) / 100
    ), 0) as total_value
    FROM building_instances bi
    JOIN tiles t ON bi.tile_id = t.id
    JOIN building_types bt ON bi.building_type_id = bt.id
    WHERE bi.company_id = ?
      AND t.map_id = ?
      AND bi.is_collapsed = 0
  `).bind(companyId, company.current_map_id).first();

  // Get when company joined the location (first transaction on this map or location join)
  const joinedAt = await env.DB.prepare(`
    SELECT MIN(created_at) as joined_at
    FROM game_transactions
    WHERE company_id = ?
      AND map_id = ?
  `).bind(companyId, company.current_map_id).first();

  const buildingsVal = Math.round(buildingsValue?.total_value || 0);

  return {
    companyId: company.id,
    companyName: company.name,
    mapId: company.current_map_id,
    mapName: company.map_name,
    locationType: company.location_type,
    buildingsOwned: buildingCount?.count || 0,
    monthlyProfit: Math.round(profitResult?.monthly_profit || 0),
    netWorth: Math.round(company.cash + buildingsVal),
    buildingsValue: buildingsVal,
    cash: company.cash,
    offshore: company.offshore,
    joinedLocationAt: joinedAt?.joined_at || null
  };
}
