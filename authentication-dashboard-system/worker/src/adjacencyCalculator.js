/**
 * Adjacency Calculator for Building Profit
 * Calculates profit based on surrounding terrain and buildings
 */

const ADJACENCY_RANGE = 2; // Check 2 tiles in each direction

/**
 * Calculate profit for a building considering adjacency bonuses
 * @param {Object} tile - The tile where the building will be placed
 * @param {Object} buildingType - The building type with base_profit and adjacency rules
 * @param {Array} allTiles - All tiles on the map
 * @param {Array} allBuildings - All building instances on the map
 * @param {Object} map - The map object
 * @returns {Object} { finalProfit, modifiers, breakdown }
 */
export function calculateProfit(tile, buildingType, allTiles, allBuildings, map) {
  const baseProfit = buildingType.base_profit;
  const breakdown = [];

  // Create lookup maps for efficient adjacency checking
  const tileMap = new Map();
  allTiles.forEach(t => tileMap.set(`${t.x},${t.y}`, t));

  const buildingByTile = new Map();
  allBuildings.forEach(b => {
    const t = allTiles.find(t => t.id === b.tile_id);
    if (t) buildingByTile.set(`${t.x},${t.y}`, b);
  });

  // Get adjacent tiles within ADJACENCY_RANGE
  const adjacentTiles = [];
  for (let dx = -ADJACENCY_RANGE; dx <= ADJACENCY_RANGE; dx++) {
    for (let dy = -ADJACENCY_RANGE; dy <= ADJACENCY_RANGE; dy++) {
      if (dx === 0 && dy === 0) continue;
      const adjTile = tileMap.get(`${tile.x + dx},${tile.y + dy}`);
      if (adjTile) adjacentTiles.push(adjTile);
    }
  }

  let totalModifier = 0;

  // Parse adjacency bonuses and penalties
  const bonuses = typeof buildingType.adjacency_bonuses === 'string'
    ? JSON.parse(buildingType.adjacency_bonuses)
    : (buildingType.adjacency_bonuses || {});
  const penalties = typeof buildingType.adjacency_penalties === 'string'
    ? JSON.parse(buildingType.adjacency_penalties)
    : (buildingType.adjacency_penalties || {});

  // Count terrain types in adjacent tiles
  const terrainCounts = {};
  adjacentTiles.forEach(t => {
    terrainCounts[t.terrain_type] = (terrainCounts[t.terrain_type] || 0) + 1;
  });

  // Apply terrain bonuses with diminishing returns
  for (const [terrain, count] of Object.entries(terrainCounts)) {
    if (bonuses[terrain]) {
      // Diminishing returns - first tile full bonus, subsequent tiles reduced
      const bonus = bonuses[terrain] * (1 + Math.log(count) / 2);
      totalModifier += bonus;
      breakdown.push({ source: `Adjacent ${terrain} (${count})`, modifier: bonus });
    }
    if (penalties[terrain]) {
      const penalty = penalties[terrain] * count;
      totalModifier += penalty;
      breakdown.push({ source: `Adjacent ${terrain} (${count})`, modifier: penalty });
    }
  }

  // Commercial synergy bonus (adjacent buildings)
  if (bonuses['commercial']) {
    let commercialCount = 0;
    adjacentTiles.forEach(t => {
      if (buildingByTile.has(`${t.x},${t.y}`)) {
        commercialCount++;
      }
    });
    if (commercialCount > 0) {
      const bonus = bonuses['commercial'] * commercialCount * 0.5;
      totalModifier += bonus;
      breakdown.push({ source: `Adjacent buildings (${commercialCount})`, modifier: bonus });
    }
  }

  // Damaged building penalty - scales with damage level
  // 0% damage = 0% penalty, 50% damage = -5%, 100% damage = -10%
  adjacentTiles.forEach(t => {
    const adjBuilding = buildingByTile.get(`${t.x},${t.y}`);
    if (adjBuilding && adjBuilding.damage_percent > 0) {
      const penalty = -0.10 * (adjBuilding.damage_percent / 100);
      totalModifier += penalty;
      breakdown.push({
        source: `Damaged building (${adjBuilding.damage_percent}%)`,
        modifier: penalty
      });
    }
  });

  // Calculate final profit (can't go negative)
  const finalProfit = Math.max(0, Math.round(baseProfit * (1 + totalModifier)));

  return {
    finalProfit,
    modifiers: { total: totalModifier },
    breakdown,
  };
}

/**
 * Mark buildings as needing profit recalculation (dirty tracking)
 * Called when: building placed, demolished, damaged, or terrain changes
 */
export async function markAffectedBuildingsDirty(env, tileX, tileY, mapId) {
  // Mark all buildings within ADJACENCY_RANGE as needing recalculation
  const result = await env.DB.prepare(`
    UPDATE building_instances
    SET needs_profit_recalc = 1
    WHERE id IN (
      SELECT bi.id FROM building_instances bi
      JOIN tiles t ON bi.tile_id = t.id
      WHERE t.map_id = ?
        AND ABS(t.x - ?) <= ?
        AND ABS(t.y - ?) <= ?
        AND bi.is_collapsed = 0
    )
  `).bind(mapId, tileX, ADJACENCY_RANGE, tileY, ADJACENCY_RANGE).run();

  return result.meta.changes || 0;
}

/**
 * Recalculate profits for dirty buildings and clear the flag
 * Called during tick processing or can be called on-demand
 */
export async function recalculateDirtyBuildings(env, mapId) {
  // Get all dirty buildings with their data
  const dirtyBuildings = await env.DB.prepare(`
    SELECT bi.*, t.x, t.y, bt.base_profit, bt.adjacency_bonuses, bt.adjacency_penalties
    FROM building_instances bi
    JOIN tiles t ON bi.tile_id = t.id
    JOIN building_types bt ON bi.building_type_id = bt.id
    WHERE t.map_id = ? AND bi.needs_profit_recalc = 1 AND bi.is_collapsed = 0
  `).bind(mapId).all();

  if (dirtyBuildings.results.length === 0) return 0;

  // Get all tiles and buildings for adjacency lookup
  const [allTiles, allBuildings] = await Promise.all([
    env.DB.prepare('SELECT * FROM tiles WHERE map_id = ?').bind(mapId).all(),
    env.DB.prepare(`
      SELECT bi.*, t.x, t.y FROM building_instances bi
      JOIN tiles t ON bi.tile_id = t.id
      WHERE t.map_id = ? AND bi.is_collapsed = 0
    `).bind(mapId).all()
  ]);

  // Build lookup maps
  const tileByCoord = new Map();
  allTiles.results.forEach(t => tileByCoord.set(`${t.x},${t.y}`, t));
  const buildingByCoord = new Map();
  allBuildings.results.forEach(b => buildingByCoord.set(`${b.x},${b.y}`, b));

  // Calculate new profits and build update statements
  const statements = [];
  for (const building of dirtyBuildings.results) {
    const { finalProfit, breakdown } = calculateProfitFromMaps(
      building,
      tileByCoord,
      buildingByCoord
    );

    statements.push(
      env.DB.prepare(`
        UPDATE building_instances
        SET calculated_profit = ?, profit_modifiers = ?, needs_profit_recalc = 0
        WHERE id = ?
      `).bind(finalProfit, JSON.stringify(breakdown), building.id)
    );
  }

  // Batch update all dirty buildings
  await env.DB.batch(statements);
  return statements.length;
}

/**
 * Helper for profit calculation using pre-built lookup maps
 */
function calculateProfitFromMaps(building, tileByCoord, buildingByCoord) {
  const bonuses = JSON.parse(building.adjacency_bonuses || '{}');
  const penalties = JSON.parse(building.adjacency_penalties || '{}');
  let totalModifier = 0;
  const breakdown = [];

  // Check adjacent tiles within ADJACENCY_RANGE
  for (let dx = -ADJACENCY_RANGE; dx <= ADJACENCY_RANGE; dx++) {
    for (let dy = -ADJACENCY_RANGE; dy <= ADJACENCY_RANGE; dy++) {
      if (dx === 0 && dy === 0) continue;

      const neighbor = tileByCoord.get(`${building.x + dx},${building.y + dy}`);
      if (!neighbor) continue;

      // Terrain bonuses/penalties
      if (bonuses[neighbor.terrain_type]) {
        totalModifier += bonuses[neighbor.terrain_type];
        breakdown.push({ source: `${neighbor.terrain_type}`, modifier: bonuses[neighbor.terrain_type] });
      }
      if (penalties[neighbor.terrain_type]) {
        totalModifier += penalties[neighbor.terrain_type];
        breakdown.push({ source: `${neighbor.terrain_type}`, modifier: penalties[neighbor.terrain_type] });
      }

      // Adjacent building synergy
      const adjBuilding = buildingByCoord.get(`${building.x + dx},${building.y + dy}`);
      if (adjBuilding && bonuses['commercial']) {
        totalModifier += bonuses['commercial'] * 0.5;
        breakdown.push({ source: 'adjacent_building', modifier: bonuses['commercial'] * 0.5 });
      }

      // Damaged neighbor penalty - scales with damage (0-100% damage = 0-10% penalty)
      if (adjBuilding && adjBuilding.damage_percent > 0) {
        const penalty = -0.10 * (adjBuilding.damage_percent / 100);
        totalModifier += penalty;
        breakdown.push({
          source: `damaged_neighbor_${adjBuilding.damage_percent}%`,
          modifier: penalty
        });
      }
    }
  }

  const finalProfit = Math.max(0, Math.round(building.base_profit * (1 + totalModifier)));
  return { finalProfit, breakdown };
}

/**
 * Calculate land cost based on terrain and location
 */
export function calculateLandCost(tile, map) {
  let baseCost = 500; // Base cost for free land

  // Terrain modifiers
  const terrainMultipliers = {
    free_land: 1.0,
    road: 0, // Can't buy road tiles
    water: 0, // Can't buy water tiles
    dirt_track: 0.8,
    trees: 1.2,
  };

  if (terrainMultipliers[tile.terrain_type] === 0) {
    throw new Error('Cannot purchase this tile type');
  }

  baseCost *= terrainMultipliers[tile.terrain_type] || 1.0;

  // Location type modifier
  const locationMultipliers = {
    town: 1.0,
    city: 5.0,
    capital: 20.0,
  };
  baseCost *= locationMultipliers[map.location_type] || 1.0;

  return Math.round(baseCost);
}
