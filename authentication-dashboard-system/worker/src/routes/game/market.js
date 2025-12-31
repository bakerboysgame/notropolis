/**
 * Property Market API Routes
 * Handles selling buildings to state, listing for sale, buying properties, and demolishing collapsed buildings
 */

import { calculateSellToStateValue, calculateMinListingPrice } from '../../utils/marketPricing.js';
import { markAffectedBuildingsDirty } from '../../adjacencyCalculator.js';

/**
 * POST /api/game/market/sell-to-state
 * Sell building to state for instant cash (50% value + land)
 */
export async function sellToState(request, env, company) {
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

  return { success: true, sale_value: saleValue };
}

/**
 * POST /api/game/market/list-for-sale
 * List building for sale to other players
 */
export async function listForSale(request, env, company) {
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

  return { success: true, purchase_price: price };
}

/**
 * POST /api/game/market/demolish
 * Demolish a collapsed building (costs 10% of original building cost)
 */
export async function demolishBuilding(request, env, company) {
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
