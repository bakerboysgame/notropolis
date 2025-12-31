# Stage 01: Game Database Foundation

## Objective

Add game tables to the existing `notropolis-database` D1 database for game companies, maps, tiles, buildings, and transactions.

## Dependencies

`[Requires: None]` - This is the foundation stage. Uses existing auth database.
`[Reference: REFERENCE-d1-optimization.md]` - Critical D1 batch patterns for tile insertion.

## Complexity

**Medium** - Multiple tables with relationships, but straightforward schema design.

## Files to Create

| File | Purpose |
|------|---------|
| `authentication-dashboard-system/migrations/0009_create_game_companies.sql` | Game companies table |
| `authentication-dashboard-system/migrations/0010_create_maps.sql` | Maps and tiles tables |
| `authentication-dashboard-system/migrations/0011_create_buildings.sql` | Building types and instances |
| `authentication-dashboard-system/migrations/0012_create_game_transactions.sql` | Game action log table |
| `authentication-dashboard-system/migrations/0013_create_security.sql` | Security systems table |
| `authentication-dashboard-system/src/types/game.ts` | TypeScript types for game entities |

## Implementation Details

### Database Schema

> **Note:** The table is named `game_companies` (not `companies`) to avoid conflict with the existing SaaS `companies` table used for multi-tenant organizations.

```sql
-- 0009_create_game_companies.sql
CREATE TABLE game_companies (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  -- Location
  current_map_id TEXT,
  location_type TEXT CHECK(location_type IN ('town', 'city', 'capital')),

  -- Financials
  cash INTEGER DEFAULT 50000,
  offshore INTEGER DEFAULT 0,

  -- Progression
  level INTEGER DEFAULT 1,
  total_actions INTEGER DEFAULT 0,

  -- Status
  is_in_prison INTEGER DEFAULT 0,
  prison_fine INTEGER DEFAULT 0,

  -- Tick tracking
  last_action_at TEXT,
  ticks_since_action INTEGER DEFAULT 0,

  -- Hero tracking
  land_ownership_streak INTEGER DEFAULT 0,
  land_percentage REAL DEFAULT 0,

  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_game_companies_user ON game_companies(user_id);
CREATE INDEX idx_game_companies_map ON game_companies(current_map_id);
```

```sql
-- 0010_create_maps.sql
CREATE TABLE maps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  location_type TEXT CHECK(location_type IN ('town', 'city', 'capital')) NOT NULL,

  -- Grid size
  width INTEGER NOT NULL CHECK(width <= 100),
  height INTEGER NOT NULL CHECK(height <= 100),

  -- Hero requirements
  hero_net_worth INTEGER NOT NULL,
  hero_cash INTEGER NOT NULL,
  hero_land_percentage REAL NOT NULL,

  -- Police
  police_strike_day INTEGER CHECK(police_strike_day BETWEEN 0 AND 6),

  -- Metadata
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE tiles (
  id TEXT PRIMARY KEY,
  map_id TEXT NOT NULL,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,

  -- Terrain
  terrain_type TEXT CHECK(terrain_type IN ('free_land', 'water', 'road', 'dirt_track', 'trees')) NOT NULL,

  -- Special buildings (admin-placed, NULL = no special building)
  special_building TEXT CHECK(special_building IS NULL OR special_building IN ('temple', 'bank', 'police_station')),

  -- Ownership
  owner_company_id TEXT,
  purchased_at TEXT,

  FOREIGN KEY (map_id) REFERENCES maps(id),
  FOREIGN KEY (owner_company_id) REFERENCES game_companies(id),
  UNIQUE(map_id, x, y)
);

CREATE INDEX idx_tiles_map ON tiles(map_id);
CREATE INDEX idx_tiles_owner ON tiles(owner_company_id);
CREATE INDEX idx_tiles_coords ON tiles(map_id, x, y);
```

```sql
-- 0011_create_buildings.sql
CREATE TABLE building_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cost INTEGER NOT NULL,
  base_profit INTEGER NOT NULL,
  level_required INTEGER DEFAULT 1,
  requires_license INTEGER DEFAULT 0,

  -- Adjacency preferences (JSON)
  adjacency_bonuses TEXT, -- e.g., {"water": 0.2, "road": 0.1}
  adjacency_penalties TEXT, -- e.g., {"dirt_track": -0.05}

  -- Limits
  max_per_map INTEGER, -- null = unlimited

  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE building_instances (
  id TEXT PRIMARY KEY,
  tile_id TEXT NOT NULL UNIQUE,
  building_type_id TEXT NOT NULL,
  company_id TEXT NOT NULL,

  -- Status
  damage_percent INTEGER DEFAULT 0 CHECK(damage_percent BETWEEN 0 AND 100),
  is_on_fire INTEGER DEFAULT 0,
  is_collapsed INTEGER DEFAULT 0,

  -- Market
  is_for_sale INTEGER DEFAULT 0,
  sale_price INTEGER,

  -- Calculated profit (cached, recalculated on changes)
  calculated_profit INTEGER,
  profit_modifiers TEXT, -- JSON breakdown of modifiers

  -- Dirty tracking for efficient tick processing
  -- Set to 1 when adjacent buildings/terrain change, cleared after recalc
  needs_profit_recalc INTEGER DEFAULT 0,

  built_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (tile_id) REFERENCES tiles(id),
  FOREIGN KEY (building_type_id) REFERENCES building_types(id),
  FOREIGN KEY (company_id) REFERENCES game_companies(id)
);

CREATE INDEX idx_buildings_company ON building_instances(company_id);
CREATE INDEX idx_buildings_tile ON building_instances(tile_id);
CREATE INDEX idx_buildings_for_sale ON building_instances(is_for_sale) WHERE is_for_sale = 1;
CREATE INDEX idx_buildings_needs_recalc ON building_instances(needs_profit_recalc) WHERE needs_profit_recalc = 1;
```

```sql
-- 0012_create_game_transactions.sql
CREATE TABLE game_transactions (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  map_id TEXT,

  action_type TEXT NOT NULL,
  -- Types: buy_land, build, demolish, sell_to_state, list_for_sale,
  --        buy_property, dirty_trick, caught_by_police, pay_fine,
  --        tick_income, hero_out, bank_transfer, security_purchase

  target_tile_id TEXT,
  target_company_id TEXT,
  target_building_id TEXT,

  amount INTEGER, -- Money involved
  details TEXT, -- JSON with additional info

  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (company_id) REFERENCES game_companies(id),
  FOREIGN KEY (map_id) REFERENCES maps(id)
);

CREATE INDEX idx_game_transactions_company ON game_transactions(company_id);
CREATE INDEX idx_game_transactions_type ON game_transactions(action_type);
CREATE INDEX idx_game_transactions_time ON game_transactions(created_at);
```

```sql
-- 0013_create_security.sql
CREATE TABLE building_security (
  id TEXT PRIMARY KEY,
  building_id TEXT NOT NULL UNIQUE,

  has_cameras INTEGER DEFAULT 0,
  has_guard_dogs INTEGER DEFAULT 0,
  has_security_guards INTEGER DEFAULT 0,
  has_sprinklers INTEGER DEFAULT 0,

  -- Costs tracked for monthly deduction
  monthly_cost INTEGER DEFAULT 0,

  installed_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (building_id) REFERENCES building_instances(id)
);

CREATE INDEX idx_security_building ON building_security(building_id);
```

### TypeScript Types

> **Note:** SQLite stores booleans as INTEGER (0/1). The types below use `boolean` for convenience - convert when reading from DB.

```typescript
// src/types/game.ts

export interface GameCompany {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  current_map_id: string | null;
  location_type: 'town' | 'city' | 'capital' | null;
  cash: number;
  offshore: number;
  level: number;
  total_actions: number;
  is_in_prison: boolean;
  prison_fine: number;
  last_action_at: string | null;
  ticks_since_action: number;
  land_ownership_streak: number;
  land_percentage: number;
}

export interface GameMap {
  id: string;
  name: string;
  country: string;
  location_type: 'town' | 'city' | 'capital';
  width: number;
  height: number;
  hero_net_worth: number;
  hero_cash: number;
  hero_land_percentage: number;
  police_strike_day: number;
  created_at: string;
  is_active: boolean;
}

export type TerrainType = 'free_land' | 'water' | 'road' | 'dirt_track' | 'trees';
export type SpecialBuilding = 'temple' | 'bank' | 'police_station' | null;

export interface Tile {
  id: string;
  map_id: string;
  x: number;
  y: number;
  terrain_type: TerrainType;
  special_building: SpecialBuilding;
  owner_company_id: string | null;
  purchased_at: string | null;
}

export interface BuildingType {
  id: string;
  name: string;
  cost: number;
  base_profit: number;
  level_required: number;
  requires_license: boolean;
  adjacency_bonuses: Record<string, number>;
  adjacency_penalties: Record<string, number>;
  max_per_map: number | null;
}

export interface BuildingInstance {
  id: string;
  tile_id: string;
  building_type_id: string;
  company_id: string;
  damage_percent: number;
  is_on_fire: boolean;
  is_collapsed: boolean;
  is_for_sale: boolean;
  sale_price: number | null;
  calculated_profit: number;
  profit_modifiers: Record<string, number>;
  needs_profit_recalc: boolean; // Dirty flag for tick optimization
  built_at: string;
}

export interface BuildingSecurity {
  id: string;
  building_id: string;
  has_cameras: boolean;
  has_guard_dogs: boolean;
  has_security_guards: boolean;
  has_sprinklers: boolean;
  monthly_cost: number;
  installed_at: string;
}

export type ActionType =
  | 'buy_land'
  | 'build'
  | 'demolish'
  | 'sell_to_state'
  | 'list_for_sale'
  | 'buy_property'
  | 'dirty_trick'
  | 'caught_by_police'
  | 'pay_fine'
  | 'tick_income'
  | 'hero_out'
  | 'bank_transfer'
  | 'security_purchase';

export interface GameTransaction {
  id: string;
  company_id: string;
  map_id: string | null;
  action_type: ActionType;
  target_tile_id: string | null;
  target_company_id: string | null;
  target_building_id: string | null;
  amount: number | null;
  details: Record<string, unknown>;
  created_at: string;
}
```

## Database Changes

This stage adds game tables to the existing `notropolis-database`. No migrations of existing data required.

**Database:** `notropolis-database` (existing, ID: `9bbea853-8bb6-4e13-8713-e8086fef0528`)

## Test Cases

| Test | Input | Expected Output |
|------|-------|-----------------|
| Create game company | Valid user_id, name | Game company created with 50k cash, level 1 |
| Create map | 50x50 town map | Map created with 2500 tile records |
| Tile uniqueness | Same x,y on same map | Constraint violation |
| Building on tile | Valid tile_id, type | Building instance created |
| Company limit | User with 3 game_companies creates 4th | Should be blocked (app logic) |

## Acceptance Checklist

- [ ] All 5 migration files (0009-0013) created
- [ ] All migrations execute without error on `notropolis-database`
- [ ] TypeScript types compile without error
- [ ] Can insert test game_company via D1 console
- [ ] Can insert test map and tiles via D1 console
- [ ] Foreign key to users table works
- [ ] Indexes created and verified
- [ ] New tables visible: `game_companies`, `maps`, `tiles`, `building_types`, `building_instances`, `game_transactions`, `building_security`

## Deployment

```bash
# Run game migrations (0009-0013) on existing database
# From authentication-dashboard-system directory:
CLOUDFLARE_API_TOKEN="..." npx wrangler d1 execute notropolis-database --file="migrations/0009_create_game_companies.sql" --remote
CLOUDFLARE_API_TOKEN="..." npx wrangler d1 execute notropolis-database --file="migrations/0010_create_maps.sql" --remote
CLOUDFLARE_API_TOKEN="..." npx wrangler d1 execute notropolis-database --file="migrations/0011_create_buildings.sql" --remote
CLOUDFLARE_API_TOKEN="..." npx wrangler d1 execute notropolis-database --file="migrations/0012_create_game_transactions.sql" --remote
CLOUDFLARE_API_TOKEN="..." npx wrangler d1 execute notropolis-database --file="migrations/0013_create_security.sql" --remote

# Verify all tables exist (including new game tables)
CLOUDFLARE_API_TOKEN="..." npx wrangler d1 execute notropolis-database --remote --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

## Handoff Notes

- Uses existing database binding: `DB` (same as auth)
- All IDs use UUID format (generate with `crypto.randomUUID()`)
- `building_types` table needs seeding with initial building data [See: Stage 05]
- Police strike day is 0-6 (Sunday-Saturday)
- Adjacency data stored as JSON strings, parse on read
- Foreign key from `game_companies.user_id` to `users.id` is enforced at DB level
- **Naming:** Game tables use `game_` prefix where needed to avoid collision with existing auth tables (`game_companies`, `game_transactions`)
