/**
 * Property Market API Routes
 * Handles selling buildings to state, listing for sale, buying properties, and demolishing collapsed buildings
 */

import { calculateSellToStateValue, calculateMinListingPrice } from '../../utils/marketPricing.js';
import { markAffectedBuildingsDirty, calculateLandCost } from '../../adjacencyCalculator.js';
import { postActionCheck } from './levels.js';

/**
 * POST /api/game/market/sell-to-state
 * Sell building to state for instant cash (50% value + land)
 */
export async function sellToState(request, env, company) {
  // Check prison status
  if (company.is_in_prison) {
    throw new Error(`You are in prison! Pay your fine of $${company.prison_fine?.toLocaleString()} to continue.`);
  }

  const { building_id } = await request.json();

  // Get building with type and tile info
  const building = await env.DB.prepare(`
    SELECT bi.*, bt.cost as type_cost, bt.name as type_name,
           t.id as tile_id, t.x, t.y, t.map_id, t.terrain_type
    FROM building_instances bi
    JOIN building_types bt ON bi.building_type_id = bt.id
    JOIN tiles t ON bi.tile_id = t.id
    WHERE bi.id = ? AND bi.company_id = ?
  `).bind(building_id, company.id).first();

  if (!building) {
    throw new Error('Building not found or not owned by you');
  }
  if (building.is_collapsed) {
    throw new Error('Cannot sell collapsed buildings - use demolish instead');
  }

  const map = await env.DB.prepare(
    'SELECT * FROM maps WHERE id = ?'
  ).bind(building.map_id).first();

  // Calculate sale value
  const saleValue = calculateSellToStateValue(
    building,
    { cost: building.type_cost },
    building, // Has x, y, terrain_type from tile join
    map
  );

  await env.DB.batch([
    // Delete building
    env.DB.prepare('DELETE FROM building_instances WHERE id = ?').bind(building_id),

    // Delete security if exists
    env.DB.prepare('DELETE FROM building_security WHERE building_id = ?').bind(building_id),

    // Clear tile ownership
    env.DB.prepare(
      'UPDATE tiles SET owner_company_id = NULL, purchased_at = NULL WHERE id = ?'
    ).bind(building.tile_id),

    // Add cash to company and reset tick counter
    env.DB.prepare(
      'UPDATE game_companies SET cash = cash + ?, total_actions = total_actions + 1, last_action_at = ?, ticks_since_action = 0 WHERE id = ?'
    ).bind(saleValue, new Date().toISOString(), company.id),

    // Log transaction
    env.DB.prepare(`
      INSERT INTO game_transactions (id, company_id, map_id, action_type, target_building_id, amount)
      VALUES (?, ?, ?, 'sell_to_state', ?, ?)
    `).bind(crypto.randomUUID(), company.id, building.map_id, building_id, saleValue),
  ]);

  // Mark adjacent buildings dirty for profit recalc (tile is now empty)
  await markAffectedBuildingsDirty(env, building.x, building.y, building.map_id);

  // Check for level-up (selling adds cash)
  const levelUp = await postActionCheck(env, company.id, company.level, building.map_id);

  return { success: true, sale_value: saleValue, levelUp };
}

/**
 * POST /api/game/market/sell-land-to-state
 * Sell empty land (no building) back to state for land value
 */
export async function sellLandToState(request, env, company) {
  // Check prison status
  if (company.is_in_prison) {
    throw new Error(`You are in prison! Pay your fine of $${company.prison_fine?.toLocaleString()} to continue.`);
  }

  const { tile_id } = await request.json();

  // Get tile info - must be owned by company and have no building
  const tile = await env.DB.prepare(`
    SELECT t.*, m.location_type
    FROM tiles t
    JOIN maps m ON t.map_id = m.id
    WHERE t.id = ? AND t.owner_company_id = ?
  `).bind(tile_id, company.id).first();

  if (!tile) {
    throw new Error('Tile not found or not owned by you');
  }

  // Check if there's a building on this tile
  const building = await env.DB.prepare(
    'SELECT id FROM building_instances WHERE tile_id = ?'
  ).bind(tile_id).first();

  if (building) {
    throw new Error('Cannot sell land with a building - use Sell Property instead');
  }

  // Calculate land value
  const landValue = calculateLandCost(tile, { location_type: tile.location_type });

  await env.DB.batch([
    // Clear tile ownership
    env.DB.prepare(
      'UPDATE tiles SET owner_company_id = NULL, purchased_at = NULL WHERE id = ?'
    ).bind(tile_id),

    // Add cash to company and reset tick counter
    env.DB.prepare(
      'UPDATE game_companies SET cash = cash + ?, total_actions = total_actions + 1, last_action_at = ?, ticks_since_action = 0 WHERE id = ?'
    ).bind(landValue, new Date().toISOString(), company.id),

    // Log transaction
    env.DB.prepare(`
      INSERT INTO game_transactions (id, company_id, map_id, action_type, amount)
      VALUES (?, ?, ?, 'sell_land_to_state', ?)
    `).bind(crypto.randomUUID(), company.id, tile.map_id, landValue),
  ]);

  // Check for level-up
  const levelUp = await postActionCheck(env, company.id, company.level, tile.map_id);

  return { success: true, sale_value: landValue, levelUp };
}

/**
 * POST /api/game/market/list-for-sale
 * List building for sale to other players
 */
export async function listForSale(request, env, company) {
  // Check prison status
  if (company.is_in_prison) {
    throw new Error(`You are in prison! Pay your fine of $${company.prison_fine?.toLocaleString()} to continue.`);
  }

  const { building_id, price } = await request.json();

  const building = await env.DB.prepare(`
    SELECT bi.*, bt.cost as type_cost
    FROM building_instances bi
    JOIN building_types bt ON bi.building_type_id = bt.id
    WHERE bi.id = ? AND bi.company_id = ?
  `).bind(building_id, company.id).first();

  if (!building) {
    throw new Error('Building not found or not owned');
  }
  if (building.is_collapsed) {
    throw new Error('Cannot sell collapsed buildings');
  }
  if (building.is_for_sale) {
    throw new Error('Already listed for sale');
  }

  // Validate price (minimum 80% of building cost)
  const minPrice = calculateMinListingPrice(building, { cost: building.type_cost });
  if (price < minPrice) {
    throw new Error(`Minimum listing price is $${minPrice.toLocaleString()}`);
  }

  await env.DB.batch([
    // Mark building for sale
    env.DB.prepare(`
      UPDATE building_instances SET is_for_sale = 1, sale_price = ? WHERE id = ?
    `).bind(price, building_id),

    // Reset tick counter for strategic action
    env.DB.prepare(
      'UPDATE game_companies SET total_actions = total_actions + 1, last_action_at = ?, ticks_since_action = 0 WHERE id = ?'
    ).bind(new Date().toISOString(), company.id)
  ]);

  return { success: true, listing_price: price };
}

/**
 * POST /api/game/market/cancel-listing
 * Remove building from market
 */
export async function cancelListing(request, env, company) {
  // Check prison status
  if (company.is_in_prison) {
    throw new Error(`You are in prison! Pay your fine of $${company.prison_fine?.toLocaleString()} to continue.`);
  }

  const { building_id } = await request.json();

  await env.DB.batch([
    // Remove listing
    env.DB.prepare(`
      UPDATE building_instances
      SET is_for_sale = 0, sale_price = NULL
      WHERE id = ? AND company_id = ?
    `).bind(building_id, company.id),

    // Reset tick counter for strategic action
    env.DB.prepare(
      'UPDATE game_companies SET total_actions = total_actions + 1, last_action_at = ?, ticks_since_action = 0 WHERE id = ?'
    ).bind(new Date().toISOString(), company.id)
  ]);

  return { success: true };
}

/**
 * POST /api/game/market/buy-property
 * Buy a listed property from another player
 */
export async function buyProperty(request, env, company) {
  // Check prison status
  if (company.is_in_prison) {
    throw new Error(`You are in prison! Pay your fine of $${company.prison_fine?.toLocaleString()} to continue.`);
  }

  const { building_id } = await request.json();

  const building = await env.DB.prepare(`
    SELECT bi.*, bt.cost as type_cost, bt.name as type_name,
           t.id as tile_id, t.map_id
    FROM building_instances bi
    JOIN building_types bt ON bi.building_type_id = bt.id
    JOIN tiles t ON bi.tile_id = t.id
    WHERE bi.id = ?
  `).bind(building_id).first();

  if (!building) {
    throw new Error('Building not found');
  }
  if (building.company_id === company.id) {
    throw new Error('You already own this building');
  }
  if (!building.is_for_sale) {
    throw new Error('This building is not for sale');
  }

  const price = building.sale_price;
  if (company.cash < price) {
    throw new Error('Insufficient funds');
  }

  const sellerId = building.company_id;

  await env.DB.batch([
    // Deduct cash from buyer and reset tick counter
    env.DB.prepare(
      'UPDATE game_companies SET cash = cash - ?, total_actions = total_actions + 1, last_action_at = ?, ticks_since_action = 0 WHERE id = ?'
    ).bind(price, new Date().toISOString(), company.id),

    // Add cash to seller
    env.DB.prepare(
      'UPDATE game_companies SET cash = cash + ? WHERE id = ?'
    ).bind(price, sellerId),

    // Transfer building ownership
    env.DB.prepare(`
      UPDATE building_instances
      SET company_id = ?, is_for_sale = 0, sale_price = NULL
      WHERE id = ?
    `).bind(company.id, building_id),

    // Transfer tile ownership
    env.DB.prepare(
      'UPDATE tiles SET owner_company_id = ?, purchased_at = ? WHERE id = ?'
    ).bind(company.id, new Date().toISOString(), building.tile_id),

    // Log buyer transaction
    env.DB.prepare(`
      INSERT INTO game_transactions (id, company_id, map_id, action_type, target_building_id, target_company_id, amount)
      VALUES (?, ?, ?, 'buy_property', ?, ?, ?)
    `).bind(crypto.randomUUID(), company.id, building.map_id, building_id, sellerId, -price),

    // Log seller transaction
    env.DB.prepare(`
      INSERT INTO game_transactions (id, company_id, map_id, action_type, target_building_id, target_company_id, amount)
      VALUES (?, ?, ?, 'sell_property', ?, ?, ?)
    `).bind(crypto.randomUUID(), sellerId, building.map_id, building_id, company.id, price),
  ]);

  // Check for level-up (buying property is a major action)
  const levelUp = await postActionCheck(env, company.id, company.level, building.map_id);

  return { success: true, purchase_price: price, levelUp };
}

/**
 * POST /api/game/market/demolish
 * Demolish a collapsed building (costs 10% of original building cost)
 */
export async function demolishBuilding(request, env, company) {
  // Check prison status
  if (company.is_in_prison) {
    throw new Error(`You are in prison! Pay your fine of $${company.prison_fine?.toLocaleString()} to continue.`);
  }

  const { building_id } = await request.json();

  const building = await env.DB.prepare(`
    SELECT bi.*, t.id as tile_id, t.x, t.y, t.map_id
    FROM building_instances bi
    JOIN tiles t ON bi.tile_id = t.id
    WHERE bi.id = ? AND bi.company_id = ?
  `).bind(building_id, company.id).first();

  if (!building) {
    throw new Error('Building not found or not owned');
  }
  if (!building.is_collapsed) {
    throw new Error('Can only demolish collapsed buildings');
  }

  // Demolition cost (10% of original building cost)
  const buildingType = await env.DB.prepare(
    'SELECT cost FROM building_types WHERE id = ?'
  ).bind(building.building_type_id).first();

  const demolitionCost = Math.round(buildingType.cost * 0.10);

  if (company.cash < demolitionCost) {
    throw new Error('Insufficient funds for demolition');
  }

  await env.DB.batch([
    // Delete building
    env.DB.prepare('DELETE FROM building_instances WHERE id = ?').bind(building_id),

    // Delete security
    env.DB.prepare('DELETE FROM building_security WHERE building_id = ?').bind(building_id),

    // Deduct demolition cost (keep tile ownership) and reset tick counter
    env.DB.prepare(
      'UPDATE game_companies SET cash = cash - ?, total_actions = total_actions + 1, last_action_at = ?, ticks_since_action = 0 WHERE id = ?'
    ).bind(demolitionCost, new Date().toISOString(), company.id),

    // Log transaction
    env.DB.prepare(`
      INSERT INTO game_transactions (id, company_id, map_id, action_type, target_building_id, amount)
      VALUES (?, ?, ?, 'demolish', ?, ?)
    `).bind(crypto.randomUUID(), company.id, building.map_id, building_id, -demolitionCost),
  ]);

  // Mark adjacent buildings dirty for profit recalc (tile is now empty)
  await markAffectedBuildingsDirty(env, building.x, building.y, building.map_id);

  return { success: true, demolition_cost: demolitionCost };
}

/**
 * POST /api/game/market/takeover
 * Take over any building from another player. Cost scales with damage.
 * Building value = 10x original cost. Owner gets payout if building has health > 0.
 */
export async function takeoverBuilding(request, env, company) {
  // Check prison status
  if (company.is_in_prison) {
    throw new Error(`You are in prison! Pay your fine of $${company.prison_fine?.toLocaleString()} to continue.`);
  }

  const { building_id, map_id, x, y } = await request.json();

  if (!building_id || !map_id || x === undefined || y === undefined) {
    throw new Error('Missing required fields: building_id, map_id, x, y');
  }

  // Get building with all needed data
  const building = await env.DB.prepare(`
    SELECT bi.*, bt.cost as type_cost, bt.name as type_name,
           t.id as tile_id, t.x, t.y, t.map_id,
           gc.name as owner_name, gc.id as owner_id
    FROM building_instances bi
    JOIN building_types bt ON bi.building_type_id = bt.id
    JOIN tiles t ON bi.tile_id = t.id
    JOIN game_companies gc ON bi.company_id = gc.id
    WHERE bi.id = ?
  `).bind(building_id).first();

  // Validations
  if (!building) {
    throw new Error('Building not found');
  }
  if (building.map_id !== map_id || building.x !== x || building.y !== y) {
    throw new Error('Location mismatch');
  }
  if (building.company_id === company.id) {
    throw new Error('Cannot take over your own building');
  }

  // Calculate takeover cost: building value = 10x original cost
  // Collapsed buildings: flat $100. Otherwise scales with health.
  const buildingValue = building.type_cost * 10;
  const healthPercent = 100 - building.damage_percent;
  let takeoverCost;
  if (building.is_collapsed) {
    takeoverCost = 100;
  } else {
    const costMultiplier = 0.10 + 0.90 * (healthPercent / 100);
    takeoverCost = Math.round(buildingValue * costMultiplier);
  }

  if (company.cash < takeoverCost) {
    throw new Error(`Insufficient funds. Takeover costs $${takeoverCost.toLocaleString()}`);
  }

  // Owner payout: proportional to health, 0 if collapsed
  const ownerPayout = building.is_collapsed ? 0 : Math.round(takeoverCost * (healthPercent / 100));

  const originalOwnerId = building.owner_id;
  const originalOwnerName = building.owner_name;

  const batchOperations = [
    // Deduct cash from buyer
    env.DB.prepare(
      'UPDATE game_companies SET cash = cash - ?, total_actions = total_actions + 1, last_action_at = ?, ticks_since_action = 0 WHERE id = ?'
    ).bind(takeoverCost, new Date().toISOString(), company.id),

    // Transfer building ownership, clear any sale listing
    env.DB.prepare(`
      UPDATE building_instances
      SET company_id = ?, is_for_sale = 0, sale_price = NULL
      WHERE id = ?
    `).bind(company.id, building_id),

    // Transfer tile ownership
    env.DB.prepare(
      'UPDATE tiles SET owner_company_id = ?, purchased_at = ? WHERE id = ?'
    ).bind(company.id, new Date().toISOString(), building.tile_id),

    // Log buyer transaction
    env.DB.prepare(`
      INSERT INTO game_transactions (id, company_id, map_id, action_type, target_building_id, target_company_id, amount, details)
      VALUES (?, ?, ?, 'takeover', ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(), company.id, building.map_id, building_id,
      originalOwnerId, -takeoverCost,
      JSON.stringify({ damage_percent: building.damage_percent, owner_payout: ownerPayout })
    ),

    // Log victim transaction
    env.DB.prepare(`
      INSERT INTO game_transactions (id, company_id, map_id, action_type, target_building_id, target_company_id, amount, details)
      VALUES (?, ?, ?, 'building_taken_over', ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(), originalOwnerId, building.map_id, building_id,
      company.id, ownerPayout,
      JSON.stringify({ damage_percent: building.damage_percent, takeover_cost: takeoverCost })
    ),
  ];

  // Add owner payout if building had health
  if (ownerPayout > 0) {
    batchOperations.push(
      env.DB.prepare(
        'UPDATE game_companies SET cash = cash + ? WHERE id = ?'
      ).bind(ownerPayout, originalOwnerId)
    );
  }

  await env.DB.batch(batchOperations);

  // Mark adjacent buildings dirty for profit recalc
  await markAffectedBuildingsDirty(env, building.x, building.y, building.map_id);

  // Check for level-up
  const levelUp = await postActionCheck(env, company.id, company.level, building.map_id);

  return {
    success: true,
    takeover_cost: takeoverCost,
    owner_payout: ownerPayout,
    damage_percent: building.damage_percent,
    is_collapsed: building.is_collapsed === 1,
    previous_owner: { company_id: originalOwnerId, company_name: originalOwnerName },
    building: { id: building_id, type_name: building.type_name, x: building.x, y: building.y },
    levelUp
  };
}

/**
 * GET /api/game/market/listings?map_id=xxx
 * Get all properties for sale on a map
 */
export async function getMarketListings(request, env) {
  const url = new URL(request.url);
  const mapId = url.searchParams.get('map_id');

  if (!mapId) {
    throw new Error('map_id is required');
  }

  const listings = await env.DB.prepare(`
    SELECT bi.*, bt.name as type_name, bt.cost as type_cost,
           t.x, t.y, gc.name as company_name
    FROM building_instances bi
    JOIN building_types bt ON bi.building_type_id = bt.id
    JOIN tiles t ON bi.tile_id = t.id
    JOIN game_companies gc ON bi.company_id = gc.id
    WHERE t.map_id = ? AND bi.is_for_sale = 1
    ORDER BY bi.id DESC
  `).bind(mapId).all();

  return { success: true, listings: listings.results };
}
