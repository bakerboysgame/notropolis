# Stage 05: Land & Building Core

## Objective

Implement land purchasing, building construction, and the adjacency-based profit calculation system.

## Dependencies

`[Requires: Stage 01 complete]` - Needs database tables.
`[Requires: Stage 03 complete]` - Needs company with cash.
`[Requires: Stage 04 complete]` - Needs map viewer for interaction.
`[Reference: REFERENCE-d1-optimization.md]` - Critical D1 batch patterns for performance.

## Complexity

**High** - Core game mechanic with complex adjacency calculations.

## Files to Modify

| File | Changes |
|------|---------|
| `authentication-dashboard-system/src/components/game/TileInfo.tsx` | Add buy/build buttons |
| `authentication-dashboard-system/src/hooks/useGameMap.ts` | Add mutation methods |

## Files to Create

| File | Purpose |
|------|---------|
| `authentication-dashboard-system/src/components/game/BuyLandModal.tsx` | Land purchase confirmation |
| `authentication-dashboard-system/src/components/game/BuildModal.tsx` | Building selection modal |
| `authentication-dashboard-system/src/components/game/BuildingList.tsx` | Available buildings list |
| `authentication-dashboard-system/src/components/game/DemolishModal.tsx` | Demolish confirmation |
| `authentication-dashboard-system/src/api/game/buildings.ts` | Building API client |
| `authentication-dashboard-system/src/utils/adjacencyCalculator.ts` | Profit calculation logic |
| `authentication-dashboard-system/src/worker/routes/game/land.ts` | Land purchase API |
| `authentication-dashboard-system/src/worker/routes/game/buildings.ts` | Building API |
| `authentication-dashboard-system/migrations/0014_seed_building_types.sql` | Building types data |

## Implementation Details

### Building Types Seed Data

```sql
-- 0014_seed_building_types.sql
INSERT INTO building_types (id, name, cost, base_profit, level_required, requires_license, adjacency_bonuses, adjacency_penalties, max_per_map) VALUES
-- Level 1 buildings
('market_stall', 'Market Stall', 1000, 100, 1, 0, '{"road": 0.15, "trees": 0.05}', '{"water": -0.1}', NULL),
('hot_dog_stand', 'Hot Dog Stand', 1500, 150, 1, 0, '{"road": 0.2}', '{"water": -0.1}', NULL),
('campsite', 'Campsite', 3000, 300, 1, 0, '{"water": 0.25, "trees": 0.15}', '{"road": -0.1, "dirt_track": -0.05}', NULL),
('shop', 'Shop', 4000, 400, 1, 0, '{"road": 0.15, "commercial": 0.1}', '{}', NULL),

-- Level 2 buildings
('burger_bar', 'Burger Bar', 8000, 800, 2, 0, '{"road": 0.2, "commercial": 0.1}', '{"water": -0.05}', NULL),
('motel', 'Motel', 12000, 1200, 2, 0, '{"road": 0.15, "water": 0.1}', '{}', NULL),

-- Level 3 buildings
('high_street_store', 'High Street Store', 20000, 2000, 3, 0, '{"road": 0.25, "commercial": 0.15}', '{"dirt_track": -0.1}', NULL),
('restaurant', 'Restaurant', 40000, 4000, 3, 1, '{"road": 0.2, "water": 0.15, "commercial": 0.1}', '{}', 5),

-- Level 4 buildings
('manor', 'Manor', 60000, 6000, 4, 1, '{"water": 0.2, "trees": 0.2}', '{"road": -0.1, "commercial": -0.15}', 3),

-- Level 5 buildings
('casino', 'Casino', 80000, 8000, 5, 1, '{"road": 0.3, "commercial": 0.2}', '{"trees": -0.1}', 2);
```

### API Endpoints

```typescript
// POST /api/game/land/buy
interface BuyLandRequest {
  company_id: string;
  tile_x: number;
  tile_y: number;
}

// POST /api/game/buildings/build
interface BuildRequest {
  company_id: string;
  tile_id: string;
  building_type_id: string;
}

// POST /api/game/buildings/demolish
interface DemolishRequest {
  company_id: string;
  building_id: string;
}

// GET /api/game/buildings/types
// Returns all building types with level/license requirements

// GET /api/game/buildings/preview-profit
interface PreviewProfitRequest {
  tile_id: string;
  building_type_id: string;
}
// Returns calculated profit for a hypothetical building
```

### Land Pricing

```typescript
// Land cost based on terrain and location
function calculateLandCost(tile: Tile, map: GameMap): number {
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

  baseCost *= terrainMultipliers[tile.terrain_type];

  // Location type modifier
  const locationMultipliers = {
    town: 1.0,
    city: 5.0,
    capital: 20.0,
  };
  baseCost *= locationMultipliers[map.location_type];

  return Math.round(baseCost);
}
```

### Adjacency Calculator

```typescript
// utils/adjacencyCalculator.ts
const ADJACENCY_RANGE = 2; // Check 2 tiles in each direction

interface AdjacencyResult {
  finalProfit: number;
  modifiers: Record<string, number>;
  breakdown: Array<{ source: string; modifier: number }>;
}

export function calculateProfit(
  tile: Tile,
  buildingType: BuildingType,
  allTiles: Tile[],
  allBuildings: BuildingInstance[],
  map: GameMap
): AdjacencyResult {
  const baseProfit = buildingType.base_profit;
  const breakdown: Array<{ source: string; modifier: number }> = [];

  // Create lookup maps
  const tileMap = new Map<string, Tile>();
  allTiles.forEach(t => tileMap.set(`${t.x},${t.y}`, t));

  const buildingByTile = new Map<string, BuildingInstance>();
  allBuildings.forEach(b => {
    const t = allTiles.find(t => t.id === b.tile_id);
    if (t) buildingByTile.set(`${t.x},${t.y}`, b);
  });

  // Get adjacent tiles
  const adjacentTiles: Tile[] = [];
  for (let dx = -ADJACENCY_RANGE; dx <= ADJACENCY_RANGE; dx++) {
    for (let dy = -ADJACENCY_RANGE; dy <= ADJACENCY_RANGE; dy++) {
      if (dx === 0 && dy === 0) continue;
      const adjTile = tileMap.get(`${tile.x + dx},${tile.y + dy}`);
      if (adjTile) adjacentTiles.push(adjTile);
    }
  }

  let totalModifier = 0;

  // Terrain bonuses/penalties
  const bonuses = buildingType.adjacency_bonuses || {};
  const penalties = buildingType.adjacency_penalties || {};

  const terrainCounts: Record<string, number> = {};
  adjacentTiles.forEach(t => {
    terrainCounts[t.terrain_type] = (terrainCounts[t.terrain_type] || 0) + 1;
  });

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

  // Commercial synergy bonus
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

  // Damaged building penalty
  adjacentTiles.forEach(t => {
    const adjBuilding = buildingByTile.get(`${t.x},${t.y}`);
    if (adjBuilding && adjBuilding.damage_percent > 50) {
      const penalty = -0.05;
      totalModifier += penalty;
      breakdown.push({ source: 'Nearby damaged building', modifier: penalty });
    }
  });

  // Calculate final profit
  const finalProfit = Math.round(baseProfit * (1 + totalModifier));

  return {
    finalProfit: Math.max(0, finalProfit), // Can't go negative
    modifiers: { total: totalModifier },
    breakdown,
  };
}

// Mark buildings as needing profit recalculation (dirty tracking)
// Called when: building placed, demolished, damaged, or terrain changes
export async function markAffectedBuildingsDirty(
  env: Env,
  tileX: number,
  tileY: number,
  mapId: string
): Promise<number> {
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

// Recalculate profits for dirty buildings and clear the flag
// Called during tick processing or can be called on-demand
export async function recalculateDirtyBuildings(
  env: Env,
  mapId: string
): Promise<number> {
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

// Helper for profit calculation using pre-built lookup maps
function calculateProfitFromMaps(
  building: any,
  tileByCoord: Map<string, Tile>,
  buildingByCoord: Map<string, any>
): { finalProfit: number; breakdown: Array<{ source: string; modifier: number }> } {
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

      // Damaged neighbor penalty
      if (adjBuilding && adjBuilding.damage_percent > 50) {
        totalModifier -= 0.05;
        breakdown.push({ source: 'damaged_neighbor', modifier: -0.05 });
      }
    }
  }

  const finalProfit = Math.max(0, Math.round(building.base_profit * (1 + totalModifier)));
  return { finalProfit, breakdown };
}
```

### Buy Land API

```typescript
// worker/routes/game/land.ts
export async function buyLand(request: Request, env: Env, company: GameCompany) {
  const { tile_x, tile_y } = await request.json();

  // Get map and tile
  const map = await env.DB.prepare(
    'SELECT * FROM maps WHERE id = ?'
  ).bind(company.current_map_id).first();

  const tile = await env.DB.prepare(
    'SELECT * FROM tiles WHERE map_id = ? AND x = ? AND y = ?'
  ).bind(company.current_map_id, tile_x, tile_y).first();

  // Validations
  if (!tile) throw new Error('Tile not found');
  if (tile.owner_company_id) throw new Error('Tile already owned');
  if (tile.terrain_type === 'water' || tile.terrain_type === 'road') {
    throw new Error('Cannot purchase this terrain type');
  }
  if (tile.special_building) throw new Error('Cannot purchase special buildings');

  // Calculate cost
  const cost = calculateLandCost(tile, map);
  if (company.cash < cost) throw new Error('Insufficient funds');

  // Transaction
  await env.DB.batch([
    // Deduct cash and reset tick counter
    env.DB.prepare(
      'UPDATE game_companies SET cash = cash - ?, total_actions = total_actions + 1, last_action_at = ?, ticks_since_action = 0 WHERE id = ?'
    ).bind(cost, new Date().toISOString(), company.id),

    // Transfer ownership
    env.DB.prepare(
      'UPDATE tiles SET owner_company_id = ?, purchased_at = ? WHERE id = ?'
    ).bind(company.id, new Date().toISOString(), tile.id),

    // Log transaction
    env.DB.prepare(
      'INSERT INTO game_transactions (id, company_id, map_id, action_type, target_tile_id, amount) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), company.id, map.id, 'buy_land', tile.id, cost),
  ]);

  return { success: true, cost, remaining_cash: company.cash - cost };
}
```

### Build API

```typescript
// worker/routes/game/buildings.ts
export async function buildBuilding(request: Request, env: Env, company: GameCompany) {
  const { tile_id, building_type_id } = await request.json();

  // Get tile and verify ownership
  const tile = await env.DB.prepare(
    'SELECT * FROM tiles WHERE id = ?'
  ).bind(tile_id).first();

  if (!tile) throw new Error('Tile not found');
  if (tile.owner_company_id !== company.id) throw new Error('You do not own this tile');

  // Check for existing building
  const existingBuilding = await env.DB.prepare(
    'SELECT * FROM building_instances WHERE tile_id = ?'
  ).bind(tile_id).first();

  if (existingBuilding) throw new Error('Tile already has a building');

  // Get building type
  const buildingType = await env.DB.prepare(
    'SELECT * FROM building_types WHERE id = ?'
  ).bind(building_type_id).first();

  if (!buildingType) throw new Error('Invalid building type');

  // Check level requirement
  if (company.level < buildingType.level_required) {
    throw new Error(`Requires level ${buildingType.level_required}`);
  }

  // Check license limit
  if (buildingType.requires_license) {
    const count = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM building_instances bi
      JOIN tiles t ON bi.tile_id = t.id
      WHERE t.map_id = ? AND bi.building_type_id = ?
    `).bind(tile.map_id, building_type_id).first();

    if (count.count >= buildingType.max_per_map) {
      throw new Error('License limit reached for this building type');
    }
  }

  // Check funds
  if (company.cash < buildingType.cost) throw new Error('Insufficient funds');

  // Calculate profit
  const allTiles = await env.DB.prepare(
    'SELECT * FROM tiles WHERE map_id = ?'
  ).bind(tile.map_id).all();

  const allBuildings = await env.DB.prepare(`
    SELECT bi.* FROM building_instances bi
    JOIN tiles t ON bi.tile_id = t.id
    WHERE t.map_id = ?
  `).bind(tile.map_id).all();

  const map = await env.DB.prepare(
    'SELECT * FROM maps WHERE id = ?'
  ).bind(tile.map_id).first();

  const profitResult = calculateProfit(
    tile,
    buildingType,
    allTiles.results,
    allBuildings.results,
    map
  );

  // Create building
  const buildingId = crypto.randomUUID();

  await env.DB.batch([
    // Deduct cash and reset tick counter
    env.DB.prepare(
      'UPDATE game_companies SET cash = cash - ?, total_actions = total_actions + 1, last_action_at = ?, ticks_since_action = 0 WHERE id = ?'
    ).bind(buildingType.cost, new Date().toISOString(), company.id),

    // Create building
    env.DB.prepare(`
      INSERT INTO building_instances
      (id, tile_id, building_type_id, company_id, calculated_profit, profit_modifiers)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      buildingId,
      tile_id,
      building_type_id,
      company.id,
      profitResult.finalProfit,
      JSON.stringify(profitResult.breakdown)
    ),

    // Log transaction
    env.DB.prepare(`
      INSERT INTO game_transactions (id, company_id, map_id, action_type, target_tile_id, target_building_id, amount)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(crypto.randomUUID(), company.id, tile.map_id, 'build', tile_id, buildingId, buildingType.cost),
  ]);

  // Mark adjacent buildings as needing profit recalculation
  // They will be recalculated during the next tick (efficient batch processing)
  const affectedCount = await markAffectedBuildingsDirty(env, tile.x, tile.y, tile.map_id);

  return {
    success: true,
    building_id: buildingId,
    profit: profitResult.finalProfit,
    breakdown: profitResult.breakdown,
    affected_buildings: affectedCount,
  };
}
```

### UI Components

```tsx
// BuyLandModal.tsx
export function BuyLandModal({ tile, map, onBuy, onClose }) {
  const cost = calculateLandCost(tile, map);
  const { activeCompany } = useCompany();
  const canAfford = activeCompany.cash >= cost;

  return (
    <Modal onClose={onClose}>
      <h2 className="text-xl font-bold text-white mb-4">Buy Land</h2>
      <p className="text-gray-300 mb-4">
        Purchase tile at ({tile.x}, {tile.y})
      </p>

      <div className="bg-gray-700 p-4 rounded mb-4">
        <div className="flex justify-between">
          <span className="text-gray-400">Cost</span>
          <span className="text-white font-mono">${cost.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Your Cash</span>
          <span className={canAfford ? 'text-green-400' : 'text-red-400'}>
            ${activeCompany.cash.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="flex gap-4">
        <button onClick={onClose} className="flex-1 py-2 bg-gray-600 text-white rounded">
          Cancel
        </button>
        <button
          onClick={() => onBuy(tile)}
          disabled={!canAfford}
          className="flex-1 py-2 bg-green-600 text-white rounded disabled:opacity-50"
        >
          Buy Land
        </button>
      </div>
    </Modal>
  );
}
```

```tsx
// BuildModal.tsx
export function BuildModal({ tile, onBuild, onClose }) {
  const { activeCompany } = useCompany();
  const { buildingTypes } = useBuildingTypes();
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<AdjacencyResult | null>(null);

  const availableTypes = buildingTypes.filter(t => t.level_required <= activeCompany.level);

  const handleSelect = async (typeId: string) => {
    setSelected(typeId);
    const result = await previewProfit(tile.id, typeId);
    setPreview(result);
  };

  return (
    <Modal onClose={onClose} size="lg">
      <h2 className="text-xl font-bold text-white mb-4">Build on ({tile.x}, {tile.y})</h2>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Building list */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {availableTypes.map(type => (
            <div
              key={type.id}
              onClick={() => handleSelect(type.id)}
              className={`p-3 rounded cursor-pointer ${
                selected === type.id ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <div className="flex justify-between">
                <span className="font-bold text-white">{type.name}</span>
                <span className="text-yellow-400">${type.cost.toLocaleString()}</span>
              </div>
              <div className="text-sm text-gray-400">
                Base profit: ${type.base_profit}/tick
                {type.requires_license && <span className="ml-2 text-purple-400">(License)</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Preview */}
        <div className="bg-gray-700 p-4 rounded">
          {preview ? (
            <>
              <h3 className="font-bold text-white mb-2">Profit Preview</h3>
              <p className="text-2xl text-green-400 mb-4">
                ${preview.finalProfit}/tick
              </p>
              <div className="space-y-1 text-sm">
                {preview.breakdown.map((item, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-gray-400">{item.source}</span>
                    <span className={item.modifier >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {item.modifier >= 0 ? '+' : ''}{(item.modifier * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-gray-400">Select a building to see profit preview</p>
          )}
        </div>
      </div>

      <div className="flex gap-4 mt-6">
        <button onClick={onClose} className="flex-1 py-2 bg-gray-600 text-white rounded">
          Cancel
        </button>
        <button
          onClick={() => selected && onBuild(selected)}
          disabled={!selected || activeCompany.cash < buildingTypes.find(t => t.id === selected)?.cost}
          className="flex-1 py-2 bg-green-600 text-white rounded disabled:opacity-50"
        >
          Build
        </button>
      </div>
    </Modal>
  );
}
```

## Database Changes

- Seed building_types table with initial building data

## Test Cases

| Test | Input | Expected Output |
|------|-------|-----------------|
| Buy free land | Unowned tile | Ownership transferred, cash deducted |
| Buy owned land | Already owned tile | Error: already owned |
| Buy water tile | Water terrain | Error: cannot purchase |
| Build on owned land | Own tile, sufficient cash | Building created |
| Build on unowned land | Someone else's tile | Error: not owner |
| Build without funds | Cost > cash | Error: insufficient funds |
| Build locked building | Level 1, tries casino | Error: requires level 5 |
| License limit | 3rd casino when limit is 2 | Error: license limit |
| Adjacency bonus | Campsite near water | Profit > base profit |
| Adjacency penalty | Campsite near road | Profit < base profit |
| Recalculate neighbors | Build near existing building | Neighbor profit updated |

## Acceptance Checklist

- [ ] Building types seeded in database
- [ ] Can buy unowned free land tiles
- [ ] Land cost varies by terrain and location type
- [ ] Can build on owned tiles
- [ ] Building cost deducted from cash
- [ ] Level requirements enforced
- [ ] License limits enforced
- [ ] Adjacency bonuses calculated correctly
- [ ] Adjacency penalties calculated correctly
- [ ] Profit preview shows breakdown
- [ ] Neighboring buildings recalculated on change
- [ ] All actions logged to transactions table
- [ ] Action count incremented

## Deployment

```bash
# Seed building types
CLOUDFLARE_API_TOKEN="..." npx wrangler d1 execute notropolis-database --file=migrations/0014_seed_building_types.sql --remote

# Build and deploy
npm run build
CLOUDFLARE_API_TOKEN="..." CLOUDFLARE_ACCOUNT_ID="..." npx wrangler pages deploy ./dist --project-name=notropolis-dashboard
```

## Handoff Notes

- Adjacency calculation is expensive - cached in `calculated_profit` column
- **Dirty Tracking:** When any tile changes, nearby buildings are marked `needs_profit_recalc = 1`
- **Tick Optimization:** Buildings only recalculated when dirty flag is set [See: Stage 06]
- Use `markAffectedBuildingsDirty()` after any change that affects profit
- Use `recalculateDirtyBuildings()` during tick to batch-process dirty buildings
- License limits are per-map, not per-company
- Land cost multipliers: Town=1x, City=5x, Capital=20x
- Building profit ~10% of cost but varies significantly with adjacency
- See [REFERENCE-d1-optimization.md](REFERENCE-d1-optimization.md) for batch patterns
