/**
 * Events Routes
 * Returns consolidated event/action history for companies on a map
 */

/**
 * Get events for a map with filtering and pagination
 * Events are from game_transactions and attacks tables
 *
 * @param {Object} env - Worker environment with DB binding
 * @param {string} mapId - Map ID to get events for
 * @param {Object} options - Query options
 * @param {string} options.byCompanyId - Filter events by actor (who performed the action)
 * @param {string} options.toCompanyId - Filter events to a target (who was affected)
 * @param {number} options.limit - Number of events to return (default 25)
 * @param {number} options.offset - Offset for pagination (default 0)
 * @returns {Object} { events, hasMore, total }
 */
export async function getMapEvents(env, mapId, options = {}) {
  const { byCompanyId, toCompanyId, limit = 25, offset = 0 } = options;

  // Build WHERE conditions
  const conditions = ['gt.map_id = ?'];
  const params = [mapId];

  if (byCompanyId) {
    conditions.push('gt.company_id = ?');
    params.push(byCompanyId);
  }

  if (toCompanyId) {
    conditions.push('gt.target_company_id = ?');
    params.push(toCompanyId);
  }

  const whereClause = conditions.join(' AND ');

  // Get total count for pagination
  const countQuery = `
    SELECT COUNT(*) as total
    FROM game_transactions gt
    WHERE ${whereClause}
  `;
  const countResult = await env.DB.prepare(countQuery).bind(...params).first();
  const total = countResult?.total || 0;

  // Get events with company names and building info
  const eventsQuery = `
    SELECT
      gt.id,
      gt.company_id,
      gc.name as company_name,
      gt.action_type,
      gt.target_tile_id,
      gt.target_company_id,
      tc.name as target_company_name,
      gt.target_building_id,
      gt.amount,
      gt.details,
      gt.created_at,
      bi.building_type_id,
      t.x as tile_x,
      t.y as tile_y
    FROM game_transactions gt
    LEFT JOIN game_companies gc ON gt.company_id = gc.id
    LEFT JOIN game_companies tc ON gt.target_company_id = tc.id
    LEFT JOIN building_instances bi ON gt.target_building_id = bi.id
    LEFT JOIN tiles t ON bi.tile_id = t.id
    WHERE ${whereClause}
    ORDER BY gt.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const eventsResult = await env.DB.prepare(eventsQuery)
    .bind(...params, limit, offset)
    .all();

  // Format events for display
  const events = eventsResult.results.map(event => {
    let details = null;
    try {
      details = event.details ? JSON.parse(event.details) : null;
    } catch (e) {
      details = null;
    }

    return {
      id: event.id,
      type: event.action_type,
      actorId: event.company_id,
      actorName: event.company_name,
      targetCompanyId: event.target_company_id,
      targetCompanyName: event.target_company_name,
      targetTileId: event.target_tile_id,
      targetBuildingId: event.target_building_id,
      buildingTypeId: event.building_type_id,
      tileX: event.tile_x,
      tileY: event.tile_y,
      amount: event.amount,
      details,
      createdAt: event.created_at,
      description: formatEventDescription(event, details)
    };
  });

  return {
    events,
    hasMore: offset + events.length < total,
    total,
    limit,
    offset
  };
}

/**
 * Get list of companies on a map for filter dropdowns
 */
export async function getMapCompanies(env, mapId) {
  const result = await env.DB.prepare(`
    SELECT id, name
    FROM game_companies
    WHERE current_map_id = ?
    ORDER BY name ASC
  `).bind(mapId).all();

  return result.results.map(c => ({ id: c.id, name: c.name }));
}

/**
 * Format event description for display
 */
function formatEventDescription(event, details) {
  const actor = event.company_name || 'Unknown';
  const target = event.target_company_name;
  const amount = event.amount ? `$${Math.abs(event.amount).toLocaleString()}` : '';

  switch (event.action_type) {
    case 'buy_land':
      return `${actor} bought land for ${amount}`;

    case 'build':
      const buildingName = details?.building_name || 'a building';
      return `${actor} built ${buildingName} for ${amount}`;

    case 'demolish':
      return `${actor} demolished a building`;

    case 'sell_to_state':
      return `${actor} sold property to state for ${amount}`;

    case 'list_for_sale':
      return `${actor} listed property for sale at ${amount}`;

    case 'buy_property':
      return target
        ? `${actor} bought property from ${target} for ${amount}`
        : `${actor} bought property for ${amount}`;

    case 'dirty_trick':
      const trickType = details?.trick_type || 'a dirty trick';
      return target
        ? `${actor} used ${trickType} on ${target}`
        : `${actor} used ${trickType}`;

    case 'caught_by_police':
      return `${actor} was caught by police and fined ${amount}`;

    case 'pay_fine':
      return `${actor} paid a fine of ${amount}`;

    case 'tick_income':
      return `${actor} earned ${amount} in income`;

    case 'hero_out':
      return `${actor}'s hero went out (${amount})`;

    case 'bank_transfer':
      return target
        ? `${actor} transferred ${amount} to ${target}`
        : `${actor} transferred ${amount}`;

    case 'security_purchase':
      const securityType = details?.security_type || 'security';
      return `${actor} purchased ${securityType} for ${amount}`;

    default:
      return `${actor} performed ${event.action_type}`;
  }
}
