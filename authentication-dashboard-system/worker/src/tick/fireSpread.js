/**
 * Fire Spread Mechanics for Tick System
 * Handles fire damage, spreading, and sprinkler logic
 */

import { markAffectedBuildingsDirty } from '../adjacencyCalculator.js';

/**
 * Fire damage per tick
 */
const FIRE_DAMAGE_BASE = 10;           // 10% damage per tick without sprinklers
const FIRE_DAMAGE_WITH_SPRINKLERS = 5; // 5% damage per tick with sprinklers
const FIRE_SPREAD_CHANCE = 0.20;       // 20% chance to spread to adjacent building
const FIRE_SPREAD_CHANCE_TREES = 0.35; // 35% chance to spread through trees
const SPRINKLER_EXTINGUISH_CHANCE = 0.60; // 60% chance to extinguish fire per tick
const COLLAPSE_THRESHOLD = 100;        // Building collapses at 100% damage

/**
 * Process fire mechanics for a single map
 * 1. Get all buildings on fire
 * 2. Apply damage to burning buildings
 * 3. Attempt to extinguish fires (if has sprinklers)
 * 4. Spread fire to adjacent buildings
 * 5. Collapse buildings at 100% damage
 *
 * @param {Object} env - Worker environment with DB binding
 * @param {string} mapId - Map ID to process
 * @returns {Object} { firesStarted, firesExtinguished, buildingsDamaged, buildingsCollapsed }
 */
export async function processMapFires(env, mapId) {
  const stats = {
    firesStarted: 0,
    firesExtinguished: 0,
    buildingsDamaged: 0,
    buildingsCollapsed: 0
  };

  // Step 1: Get all buildings on fire with their coordinates
  const burningBuildings = await env.DB.prepare(`
    SELECT bi.*, t.x, t.y, t.map_id
    FROM building_instances bi
    JOIN tiles t ON bi.tile_id = t.id
    WHERE t.map_id = ? AND bi.is_on_fire = 1 AND bi.is_collapsed = 0
  `).bind(mapId).all();

  if (burningBuildings.results.length === 0) {
    return stats;
  }

  // Step 2: Get all tiles on the map for adjacency lookup
  const allTiles = await env.DB.prepare(
    'SELECT * FROM tiles WHERE map_id = ?'
  ).bind(mapId).all();

  const tileMap = new Map();
  allTiles.results.forEach(t => tileMap.set(`${t.x},${t.y}`, t));

  // Step 3: Get all buildings on the map for fire spread
  const allBuildings = await env.DB.prepare(`
    SELECT bi.*, t.x, t.y
    FROM building_instances bi
    JOIN tiles t ON bi.tile_id = t.id
    WHERE t.map_id = ? AND bi.is_collapsed = 0
  `).bind(mapId).all();

  const buildingByTile = new Map();
  allBuildings.results.forEach(b => buildingByTile.set(`${b.x},${b.y}`, b));

  // Track updates and fire spread
  const buildingUpdates = [];
  const newFires = new Set();
  const tilesToMarkDirty = []; // Track buildings that crossed 50% damage threshold

  // Step 4: Process each burning building
  for (const building of burningBuildings.results) {
    // Check if building has sprinklers (default to 0 if column doesn't exist)
    const hasSprinklers = building.has_sprinklers || 0;

    // Apply fire damage
    const damageAmount = hasSprinklers ? FIRE_DAMAGE_WITH_SPRINKLERS : FIRE_DAMAGE_BASE;
    const oldDamage = building.damage_percent;
    let newDamage = Math.min(100, building.damage_percent + damageAmount);
    let stillOnFire = building.is_on_fire;
    let collapsed = building.is_collapsed;

    stats.buildingsDamaged++;

    // If damage changed, mark adjacent buildings dirty (damage penalty is gradual)
    if (newDamage !== oldDamage) {
      tilesToMarkDirty.push({ x: building.x, y: building.y, mapId: building.map_id });
    }

    // Try to extinguish fire if has sprinklers
    if (hasSprinklers && Math.random() < SPRINKLER_EXTINGUISH_CHANCE) {
      stillOnFire = 0;
      stats.firesExtinguished++;
    }

    // Check for collapse
    if (newDamage >= COLLAPSE_THRESHOLD) {
      collapsed = 1;
      stillOnFire = 0; // Fire goes out when building collapses
      stats.buildingsCollapsed++;
    }

    // Record building update
    buildingUpdates.push({
      id: building.id,
      damage: newDamage,
      onFire: stillOnFire,
      collapsed: collapsed
    });

    // Step 5: Fire spread to adjacent buildings (only if still on fire)
    if (stillOnFire === 1) {
      const adjacentCoords = [
        { x: building.x - 1, y: building.y },
        { x: building.x + 1, y: building.y },
        { x: building.x, y: building.y - 1 },
        { x: building.x, y: building.y + 1 }
      ];

      for (const coord of adjacentCoords) {
        const tile = tileMap.get(`${coord.x},${coord.y}`);
        if (!tile) continue;

        // Check if there's a building on this tile
        const adjacentBuilding = buildingByTile.get(`${coord.x},${coord.y}`);
        if (adjacentBuilding && !adjacentBuilding.is_on_fire && !adjacentBuilding.is_collapsed) {
          // Sprinklers protect buildings from catching fire
          const adjacentHasSprinklers = adjacentBuilding.has_sprinklers || 0;
          if (adjacentHasSprinklers) {
            continue; // Sprinklers prevent fire spread
          }

          // Base spread chance
          if (Math.random() < FIRE_SPREAD_CHANCE) {
            newFires.add(adjacentBuilding.id);
            stats.firesStarted++;
          }
        }

        // Fire can also spread through trees to buildings beyond
        if (tile.terrain_type === 'trees') {
          // Check for building one tile beyond the trees
          const beyondCoords = {
            x: coord.x + (coord.x - building.x),
            y: coord.y + (coord.y - building.y)
          };
          const beyondBuilding = buildingByTile.get(`${beyondCoords.x},${beyondCoords.y}`);

          if (beyondBuilding && !beyondBuilding.is_on_fire && !beyondBuilding.is_collapsed) {
            const beyondHasSprinklers = beyondBuilding.has_sprinklers || 0;
            if (!beyondHasSprinklers && Math.random() < FIRE_SPREAD_CHANCE_TREES) {
              newFires.add(beyondBuilding.id);
              stats.firesStarted++;
            }
          }
        }
      }
    }
  }

  // Step 6: Batch update all buildings
  const statements = [];

  // Update existing burning buildings
  for (const update of buildingUpdates) {
    statements.push(
      env.DB.prepare(`
        UPDATE building_instances
        SET damage_percent = ?, is_on_fire = ?, is_collapsed = ?
        WHERE id = ?
      `).bind(update.damage, update.onFire, update.collapsed, update.id)
    );
  }

  // Set new buildings on fire
  for (const buildingId of newFires) {
    statements.push(
      env.DB.prepare(`
        UPDATE building_instances
        SET is_on_fire = 1
        WHERE id = ?
      `).bind(buildingId)
    );
  }

  if (statements.length > 0) {
    await env.DB.batch(statements);
  }

  // Step 7: Mark adjacent buildings dirty when damage crosses 50% threshold
  for (const tile of tilesToMarkDirty) {
    await markAffectedBuildingsDirty(env, tile.x, tile.y, tile.mapId);
  }

  return stats;
}
