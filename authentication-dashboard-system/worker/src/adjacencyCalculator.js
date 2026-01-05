/**
 * Adjacency Calculator for Building Profit and Value
 * Calculates profit and value based on surrounding terrain and buildings
 */

const ADJACENCY_RANGE = 2; // Check 2 tiles in each direction

// Value modifiers (similar to profit but affect building worth)
const VALUE_MODIFIERS = {
  collapsed_neighbor: -0.15,    // 15% value loss per collapsed neighbor
  damaged_neighbor_max: -0.08,  // Up to 8% value loss per damaged neighbor (scales with damage)
  commercial_synergy: 0.03,     // 3% value increase per adjacent building
  premium_terrain: {            // Premium terrain bonuses
    trees: 0.05,                // 5% value increase for trees
    water: 0.08,                // 8% value increase for water views
  },
  penalty_terrain: {
    dirt_track: -0.02,          // 2% value decrease for dirt tracks
  }
};

// Competition penalty - same-type/variant buildings nearby reduce profit and value
const COMPETITION_PENALTY = -0.08; // 8% penalty per competing neighbor

/**
 * Calculate competition penalty based on same-type/variant neighbors
 * - Buildings WITH variants: only same variant competes
 * - Buildings WITHOUT variants: same building type competes
 * @param {Object} building - The building being calculated (needs building_type_id, variant)
 * @param {Map} buildingByCoord - Map of coord -> building
 * @param {number} x - Building X coordinate
 * @param {number} y - Building Y coordinate
 * @returns {Object} { penalty, breakdown }
 */
function calculateCompetitionPenalty(building, buildingByCoord, x, y) {
  let competitorCount = 0;
  const breakdown = [];

  for (let dx = -ADJACENCY_RANGE; dx <= ADJACENCY_RANGE; dx++) {
    for (let dy = -ADJACENCY_RANGE; dy <= ADJACENCY_RANGE; dy++) {
      if (dx === 0 && dy === 0) continue;

      const neighbor = buildingByCoord.get(`${x + dx},${y + dy}`);
      if (!neighbor || neighbor.is_collapsed) continue;

      // Only check buildings of the same type
      if (neighbor.building_type_id !== building.building_type_id) continue;

      // For buildings WITH variants: only same variant competes
      if (building.variant) {
        if (neighbor.variant === building.variant) {
          competitorCount++;
          breakdown.push({
            source: `competing_${building.variant}`,
            modifier: COMPETITION_PENALTY
          });
        }
        // Different variant = no competition penalty
      } else {
        // For buildings WITHOUT variants: same type competes
        competitorCount++;
        breakdown.push({
          source: `competing_${building.building_type_id}`,
          modifier: COMPETITION_PENALTY
        });
      }
    }
  }

  return {
    penalty: COMPETITION_PENALTY * competitorCount,
    breakdown
  };
}

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

  // Collapsed and damaged building penalties
  adjacentTiles.forEach(t => {
    const adjBuilding = buildingByTile.get(`${t.x},${t.y}`);
    if (adjBuilding) {
      // Collapsed neighbor penalty - ruined buildings are an eyesore and safety hazard
      if (adjBuilding.is_collapsed) {
        const penalty = -0.12; // 12% penalty per collapsed neighbor
        totalModifier += penalty;
        breakdown.push({
          source: 'Collapsed building nearby',
          modifier: penalty
        });
      }
      // Damaged building penalty - scales with damage level (only for non-collapsed)
      // 0% damage = 0% penalty, 50% damage = -5%, 100% damage = -10%
      else if (adjBuilding.damage_percent > 0) {
        const penalty = -0.10 * (adjBuilding.damage_percent / 100);
        totalModifier += penalty;
        breakdown.push({
          source: `Damaged building (${adjBuilding.damage_percent}%)`,
          modifier: penalty
        });
      }
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
 * Calculate value for a building considering adjacency factors
 * @param {Object} tile - The tile where the building is placed
 * @param {Object} buildingType - The building type with cost
 * @param {Array} allTiles - All tiles on the map
 * @param {Array} allBuildings - All building instances on the map
 * @returns {Object} { finalValue, modifiers, breakdown }
 */
export function calculateValue(tile, buildingType, allTiles, allBuildings) {
  const baseCost = buildingType.cost;
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

  // Count terrain types in adjacent tiles
  const terrainCounts = {};
  adjacentTiles.forEach(t => {
    terrainCounts[t.terrain_type] = (terrainCounts[t.terrain_type] || 0) + 1;
  });

  // Apply terrain value bonuses (premium locations)
  for (const [terrain, count] of Object.entries(terrainCounts)) {
    if (VALUE_MODIFIERS.premium_terrain[terrain]) {
      // Diminishing returns for multiple premium tiles
      const bonus = VALUE_MODIFIERS.premium_terrain[terrain] * (1 + Math.log(count) / 3);
      totalModifier += bonus;
      breakdown.push({ source: `Premium ${terrain} (${count})`, modifier: bonus });
    }
    if (VALUE_MODIFIERS.penalty_terrain[terrain]) {
      const penalty = VALUE_MODIFIERS.penalty_terrain[terrain] * count;
      totalModifier += penalty;
      breakdown.push({ source: `Adjacent ${terrain} (${count})`, modifier: penalty });
    }
  }

  // Commercial synergy - buildings near other buildings are worth more
  let healthyBuildingCount = 0;
  adjacentTiles.forEach(t => {
    const adjBuilding = buildingByTile.get(`${t.x},${t.y}`);
    if (adjBuilding && !adjBuilding.is_collapsed) {
      healthyBuildingCount++;
    }
  });
  if (healthyBuildingCount > 0) {
    const bonus = VALUE_MODIFIERS.commercial_synergy * healthyBuildingCount;
    totalModifier += bonus;
    breakdown.push({ source: `Adjacent buildings (${healthyBuildingCount})`, modifier: bonus });
  }

  // Collapsed and damaged building penalties - reduce property value
  adjacentTiles.forEach(t => {
    const adjBuilding = buildingByTile.get(`${t.x},${t.y}`);
    if (adjBuilding) {
      if (adjBuilding.is_collapsed) {
        const penalty = VALUE_MODIFIERS.collapsed_neighbor;
        totalModifier += penalty;
        breakdown.push({
          source: 'Collapsed building nearby',
          modifier: penalty
        });
      } else if (adjBuilding.damage_percent > 0) {
        const penalty = VALUE_MODIFIERS.damaged_neighbor_max * (adjBuilding.damage_percent / 100);
        totalModifier += penalty;
        breakdown.push({
          source: `Damaged building (${adjBuilding.damage_percent}%)`,
          modifier: penalty
        });
      }
    }
  });

  // Calculate final value (minimum 50% of base cost)
  const finalValue = Math.max(
    Math.round(baseCost * 0.5),
    Math.round(baseCost * (1 + totalModifier))
  );

  return {
    finalValue,
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
 * Recalculate profits and values for dirty buildings and clear the flag
 * Called during tick processing or can be called on-demand
 */
export async function recalculateDirtyBuildings(env, mapId) {
  // Get all dirty buildings with their data (include cost for value calculation, variant for competition)
  const dirtyBuildings = await env.DB.prepare(`
    SELECT bi.*, bi.variant, t.x, t.y, bt.base_profit, bt.cost, bt.adjacency_bonuses, bt.adjacency_penalties
    FROM building_instances bi
    JOIN tiles t ON bi.tile_id = t.id
    JOIN building_types bt ON bi.building_type_id = bt.id
    WHERE t.map_id = ? AND bi.needs_profit_recalc = 1 AND bi.is_collapsed = 0
  `).bind(mapId).all();

  if (dirtyBuildings.results.length === 0) return 0;

  // Get all tiles and buildings for adjacency lookup
  // Include collapsed buildings so they can apply penalties to neighbors
  const [allTiles, allBuildings] = await Promise.all([
    env.DB.prepare('SELECT * FROM tiles WHERE map_id = ?').bind(mapId).all(),
    env.DB.prepare(`
      SELECT bi.*, t.x, t.y FROM building_instances bi
      JOIN tiles t ON bi.tile_id = t.id
      WHERE t.map_id = ?
    `).bind(mapId).all()
  ]);

  // Build lookup maps
  const tileByCoord = new Map();
  allTiles.results.forEach(t => tileByCoord.set(`${t.x},${t.y}`, t));
  const buildingByCoord = new Map();
  allBuildings.results.forEach(b => buildingByCoord.set(`${b.x},${b.y}`, b));

  // Calculate new profits and values, build update statements
  const statements = [];
  for (const building of dirtyBuildings.results) {
    const { finalProfit, breakdown: profitBreakdown } = calculateProfitFromMaps(
      building,
      tileByCoord,
      buildingByCoord
    );
    const { finalValue, breakdown: valueBreakdown } = calculateValueFromMaps(
      building,
      tileByCoord,
      buildingByCoord
    );

    statements.push(
      env.DB.prepare(`
        UPDATE building_instances
        SET calculated_profit = ?, profit_modifiers = ?,
            calculated_value = ?, value_modifiers = ?,
            needs_profit_recalc = 0
        WHERE id = ?
      `).bind(
        finalProfit,
        JSON.stringify(profitBreakdown),
        finalValue,
        JSON.stringify(valueBreakdown),
        building.id
      )
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

      // Collapsed neighbor penalty - ruined buildings are an eyesore and safety hazard
      if (adjBuilding && adjBuilding.is_collapsed) {
        const penalty = -0.12; // 12% penalty per collapsed neighbor
        totalModifier += penalty;
        breakdown.push({
          source: 'collapsed_neighbor',
          modifier: penalty
        });
      }
      // Damaged neighbor penalty - scales with damage (0-100% damage = 0-10% penalty)
      // Only applies to non-collapsed buildings (collapsed have their own penalty above)
      else if (adjBuilding && adjBuilding.damage_percent > 0) {
        const penalty = -0.10 * (adjBuilding.damage_percent / 100);
        totalModifier += penalty;
        breakdown.push({
          source: `damaged_neighbor_${adjBuilding.damage_percent}%`,
          modifier: penalty
        });
      }
    }
  }

  // Add competition penalty for same-type/variant neighbors
  const competition = calculateCompetitionPenalty(building, buildingByCoord, building.x, building.y);
  totalModifier += competition.penalty;
  breakdown.push(...competition.breakdown);

  const finalProfit = Math.max(0, Math.round(building.base_profit * (1 + totalModifier)));
  return { finalProfit, breakdown };
}

/**
 * Helper for value calculation using pre-built lookup maps
 */
function calculateValueFromMaps(building, tileByCoord, buildingByCoord) {
  const baseCost = building.cost;
  let totalModifier = 0;
  const breakdown = [];

  // Count terrain types and buildings in adjacent tiles
  const terrainCounts = {};
  let healthyBuildingCount = 0;

  for (let dx = -ADJACENCY_RANGE; dx <= ADJACENCY_RANGE; dx++) {
    for (let dy = -ADJACENCY_RANGE; dy <= ADJACENCY_RANGE; dy++) {
      if (dx === 0 && dy === 0) continue;

      const neighbor = tileByCoord.get(`${building.x + dx},${building.y + dy}`);
      if (!neighbor) continue;

      // Count terrain types
      terrainCounts[neighbor.terrain_type] = (terrainCounts[neighbor.terrain_type] || 0) + 1;

      // Check adjacent buildings
      const adjBuilding = buildingByCoord.get(`${building.x + dx},${building.y + dy}`);
      if (adjBuilding) {
        if (adjBuilding.is_collapsed) {
          // Collapsed neighbor reduces value
          const penalty = VALUE_MODIFIERS.collapsed_neighbor;
          totalModifier += penalty;
          breakdown.push({
            source: 'collapsed_neighbor',
            modifier: penalty
          });
        } else {
          // Healthy neighbor increases value (commercial synergy)
          healthyBuildingCount++;

          // But damaged neighbors still reduce value somewhat
          if (adjBuilding.damage_percent > 0) {
            const penalty = VALUE_MODIFIERS.damaged_neighbor_max * (adjBuilding.damage_percent / 100);
            totalModifier += penalty;
            breakdown.push({
              source: `damaged_neighbor_${adjBuilding.damage_percent}%`,
              modifier: penalty
            });
          }
        }
      }
    }
  }

  // Apply terrain bonuses/penalties
  for (const [terrain, count] of Object.entries(terrainCounts)) {
    if (VALUE_MODIFIERS.premium_terrain[terrain]) {
      const bonus = VALUE_MODIFIERS.premium_terrain[terrain] * (1 + Math.log(count) / 3);
      totalModifier += bonus;
      breakdown.push({ source: `premium_${terrain}`, modifier: bonus });
    }
    if (VALUE_MODIFIERS.penalty_terrain[terrain]) {
      const penalty = VALUE_MODIFIERS.penalty_terrain[terrain] * count;
      totalModifier += penalty;
      breakdown.push({ source: `penalty_${terrain}`, modifier: penalty });
    }
  }

  // Apply commercial synergy for healthy neighbors
  if (healthyBuildingCount > 0) {
    const bonus = VALUE_MODIFIERS.commercial_synergy * healthyBuildingCount;
    totalModifier += bonus;
    breakdown.push({ source: 'commercial_synergy', modifier: bonus });
  }

  // Add competition penalty for same-type/variant neighbors
  const competition = calculateCompetitionPenalty(building, buildingByCoord, building.x, building.y);
  totalModifier += competition.penalty;
  breakdown.push(...competition.breakdown);

  // Calculate final value (minimum 50% of base cost)
  const finalValue = Math.max(
    Math.round(baseCost * 0.5),
    Math.round(baseCost * (1 + totalModifier))
  );

  return { finalValue, breakdown };
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
