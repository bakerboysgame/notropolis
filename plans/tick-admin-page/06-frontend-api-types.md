# Stage 6: Frontend API Service + Types

## Objective
Create TypeScript types and API service for tick admin endpoints.

## Dependencies
`[Requires: Stage 3 complete]` (Tick History API)
`[Requires: Stage 4 complete]` (Tick Settings API)

## Complexity
**Low** — Two new files, no complex logic

## Files to Create

### 1. `authentication-dashboard-system/src/types/tick.ts`
TypeScript interfaces for tick data structures.

### 2. `authentication-dashboard-system/src/services/tickAdminApi.ts`
API service class for tick admin endpoints.

## Implementation Details

### types/tick.ts

```typescript
// authentication-dashboard-system/src/types/tick.ts

// ============================================
// TICK HISTORY TYPES
// ============================================

export interface TickHistoryEntry {
  id: string;
  processed_at: string;
  execution_time_ms: number;
  maps_processed: number;
  companies_updated: number;
  buildings_recalculated: number;
  gross_profit: number;
  tax_amount: number;
  net_profit: number;
  fires_started: number;
  fires_extinguished: number;
  buildings_damaged: number;
  buildings_collapsed: number;
  has_errors: boolean;
}

export interface TickDetail extends Omit<TickHistoryEntry, 'has_errors'> {
  errors: string[];
}

export interface CompanyStatSnapshot {
  id: string;
  company_id: string;
  company_name: string;
  map_id: string;
  map_name: string;
  building_count: number;
  collapsed_count: number;
  base_profit: number;
  gross_profit: number;
  tax_rate: number;
  tax_amount: number;
  security_cost: number;
  net_profit: number;
  total_building_value: number;
  damaged_building_value: number;
  total_damage_percent: number;
  average_damage_percent: number;
  buildings_on_fire: number;
  ticks_since_action: number;
  is_earning: boolean;
  last_tick_at: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface TickHistoryResponse {
  ticks: TickHistoryEntry[];
  pagination: Pagination;
}

export interface TickDetailResponse {
  tick: TickDetail;
  company_stats: CompanyStatSnapshot[];
}

// ============================================
// TICK STATS TYPES
// ============================================

export interface TickStatsSummary {
  total_ticks: number;
  avg_execution_ms: number;
  min_execution_ms: number;
  max_execution_ms: number;
  total_gross_profit: number;
  total_tax_collected: number;
  total_net_profit: number;
  total_fires_started: number;
  total_buildings_collapsed: number;
  ticks_with_errors: number;
}

export interface ExecutionTrend {
  time: string;
  value: number;
}

export interface ProfitTrend {
  time: string;
  gross: number;
  tax: number;
  net: number;
}

export interface FireTrend {
  time: string;
  started: number;
  extinguished: number;
  collapsed: number;
}

export interface TickStatsTrends {
  execution_time: ExecutionTrend[];
  profit: ProfitTrend[];
  fires: FireTrend[];
}

export interface TickStatsResponse {
  summary: TickStatsSummary;
  trends: TickStatsTrends;
}

export type StatsPeriod = '1h' | '24h' | '7d' | '30d' | 'all';

// ============================================
// TICK SETTINGS TYPES
// ============================================

export interface TickSettings {
  // Fire settings
  fire_damage_base: number;
  fire_damage_with_sprinklers: number;
  fire_spread_chance: number;
  fire_spread_chance_trees: number;
  sprinkler_extinguish_chance: number;
  collapse_threshold: number;

  // Tax rates
  tax_rate_town: number;
  tax_rate_city: number;
  tax_rate_capital: number;

  // Profit settings
  earning_threshold_ticks: number;
  collapsed_maintenance_rate: number;
  security_cost_divisor: number;
  damage_profit_multiplier: number;

  // Adjacency settings
  adjacency_range: number;
  competition_penalty: number;
  collapsed_neighbor_profit_penalty: number;
  collapsed_neighbor_value_penalty: number;
  damaged_neighbor_max_penalty: number;
  commercial_synergy_bonus: number;
  premium_terrain_trees: number;
  premium_terrain_water: number;
  penalty_terrain_dirt_track: number;
  min_building_value_floor: number;

  // Hero settings
  default_forced_hero_ticks: number;
  land_streak_requirement: number;

  // Land costs
  base_land_cost: number;
  land_multiplier_town: number;
  land_multiplier_city: number;
  land_multiplier_capital: number;
  terrain_multiplier_free_land: number;
  terrain_multiplier_dirt_track: number;
  terrain_multiplier_trees: number;

  // Combat settings (Dirty Tricks / Prison)
  prison_fine_multiplier: number;
  fine_multiplier_town: number;
  fine_multiplier_city: number;
  fine_multiplier_capital: number;
  security_bonus_cameras: number;
  security_bonus_guard_dogs: number;
  security_bonus_security_guards: number;
  cleanup_cost_percent: number;

  // Market settings
  sell_to_state_percent: number;
  min_listing_price_percent: number;
  forced_buy_multiplier: number;
}

export interface TickSettingsMetadata {
  updated_at: string | null;
  updated_by: string | null;
  updated_by_email: string | null;
}

export interface TickSettingsResponse {
  settings: TickSettings;
  metadata: TickSettingsMetadata;
  defaults: TickSettings;
}

export interface TickSettingsUpdateResponse {
  updated: string[];
  settings: TickSettings;
  message?: string;
}

// ============================================
// SETTINGS LOG TYPES
// ============================================

export interface SettingChange {
  old: number;
  new: number;
}

export interface SettingsLogEntry {
  id: string;
  user_email: string;
  changed_at: string;
  changes: Record<string, SettingChange>;
  category: 'fire' | 'tax' | 'profit' | 'adjacency' | 'hero' | 'land' | 'combat' | 'market' | 'multiple';
  summary: string;
}

export interface SettingsLogResponse {
  logs: SettingsLogEntry[];
  pagination: Pagination;
}

// ============================================
// SETTING METADATA (for UI)
// ============================================

export type SettingCategory = 'fire' | 'tax' | 'profit' | 'adjacency' | 'hero' | 'land' | 'combat' | 'market';

export interface SettingDefinition {
  key: keyof TickSettings;
  label: string;
  description: string;
  category: SettingCategory;
  min: number;
  max: number;
  step: number;
  unit: string; // '%', 'ticks', 'tiles', '$', ''
  format: 'percent' | 'integer' | 'decimal' | 'currency';
}

// Setting definitions for UI rendering
export const SETTING_DEFINITIONS: SettingDefinition[] = [
  // Fire
  { key: 'fire_damage_base', label: 'Base Fire Damage', description: 'Damage per tick without sprinklers', category: 'fire', min: 1, max: 50, step: 1, unit: '%', format: 'integer' },
  { key: 'fire_damage_with_sprinklers', label: 'Sprinkler Fire Damage', description: 'Damage per tick with sprinklers', category: 'fire', min: 0, max: 25, step: 1, unit: '%', format: 'integer' },
  { key: 'fire_spread_chance', label: 'Spread Chance', description: 'Probability of fire spreading to adjacent building', category: 'fire', min: 0, max: 1, step: 0.05, unit: '%', format: 'percent' },
  { key: 'fire_spread_chance_trees', label: 'Spread Through Trees', description: 'Probability of fire spreading through trees', category: 'fire', min: 0, max: 1, step: 0.05, unit: '%', format: 'percent' },
  { key: 'sprinkler_extinguish_chance', label: 'Extinguish Chance', description: 'Probability of sprinklers extinguishing fire per tick', category: 'fire', min: 0, max: 1, step: 0.05, unit: '%', format: 'percent' },
  { key: 'collapse_threshold', label: 'Collapse Threshold', description: 'Damage percent at which buildings collapse', category: 'fire', min: 50, max: 100, step: 5, unit: '%', format: 'integer' },

  // Tax
  { key: 'tax_rate_town', label: 'Town Tax Rate', description: 'Tax rate for town locations', category: 'tax', min: 0, max: 0.5, step: 0.01, unit: '%', format: 'percent' },
  { key: 'tax_rate_city', label: 'City Tax Rate', description: 'Tax rate for city locations', category: 'tax', min: 0, max: 0.5, step: 0.01, unit: '%', format: 'percent' },
  { key: 'tax_rate_capital', label: 'Capital Tax Rate', description: 'Tax rate for capital locations', category: 'tax', min: 0, max: 0.5, step: 0.01, unit: '%', format: 'percent' },

  // Profit
  { key: 'earning_threshold_ticks', label: 'Earning Threshold', description: 'Max idle ticks before company stops earning', category: 'profit', min: 1, max: 100, step: 1, unit: 'ticks', format: 'integer' },
  { key: 'collapsed_maintenance_rate', label: 'Collapsed Maintenance', description: 'Maintenance cost as % of building cost per tick', category: 'profit', min: 0, max: 0.5, step: 0.01, unit: '%', format: 'percent' },
  { key: 'security_cost_divisor', label: 'Security Cost Divisor', description: 'Monthly cost divided by this for per-tick cost', category: 'profit', min: 1, max: 1000, step: 1, unit: '', format: 'integer' },
  { key: 'damage_profit_multiplier', label: 'Damage Profit Multiplier', description: 'How much damage reduces profit (1.0 = linear)', category: 'profit', min: 1, max: 2, step: 0.01, unit: 'x', format: 'decimal' },

  // Adjacency
  { key: 'adjacency_range', label: 'Adjacency Range', description: 'Tile radius for adjacency calculations', category: 'adjacency', min: 1, max: 5, step: 1, unit: 'tiles', format: 'integer' },
  { key: 'competition_penalty', label: 'Competition Penalty', description: 'Penalty per same-type competitor nearby', category: 'adjacency', min: 0, max: 0.5, step: 0.01, unit: '%', format: 'percent' },
  { key: 'collapsed_neighbor_profit_penalty', label: 'Collapsed Neighbor (Profit)', description: 'Profit penalty per collapsed neighbor', category: 'adjacency', min: 0, max: 0.5, step: 0.01, unit: '%', format: 'percent' },
  { key: 'collapsed_neighbor_value_penalty', label: 'Collapsed Neighbor (Value)', description: 'Value penalty per collapsed neighbor', category: 'adjacency', min: 0, max: 0.5, step: 0.01, unit: '%', format: 'percent' },
  { key: 'damaged_neighbor_max_penalty', label: 'Damaged Neighbor Max', description: 'Max penalty per damaged neighbor', category: 'adjacency', min: 0, max: 0.5, step: 0.01, unit: '%', format: 'percent' },
  { key: 'commercial_synergy_bonus', label: 'Commercial Synergy', description: 'Value bonus per adjacent building', category: 'adjacency', min: 0, max: 0.2, step: 0.01, unit: '%', format: 'percent' },
  { key: 'premium_terrain_trees', label: 'Trees Bonus', description: 'Value bonus for adjacent trees', category: 'adjacency', min: 0, max: 0.3, step: 0.01, unit: '%', format: 'percent' },
  { key: 'premium_terrain_water', label: 'Water Bonus', description: 'Value bonus for adjacent water', category: 'adjacency', min: 0, max: 0.3, step: 0.01, unit: '%', format: 'percent' },
  { key: 'penalty_terrain_dirt_track', label: 'Dirt Track Penalty', description: 'Value penalty for adjacent dirt tracks', category: 'adjacency', min: 0, max: 0.2, step: 0.01, unit: '%', format: 'percent' },
  { key: 'min_building_value_floor', label: 'Min Value Floor', description: 'Minimum building value as % of cost', category: 'adjacency', min: 0.1, max: 1, step: 0.05, unit: '%', format: 'percent' },

  // Hero
  { key: 'default_forced_hero_ticks', label: 'Forced Hero Ticks', description: 'Default ticks before forced hero-out', category: 'hero', min: 1, max: 50, step: 1, unit: 'ticks', format: 'integer' },
  { key: 'land_streak_requirement', label: 'Land Streak Required', description: 'Consecutive ticks needed for land-based eligibility', category: 'hero', min: 1, max: 50, step: 1, unit: 'ticks', format: 'integer' },

  // Land
  { key: 'base_land_cost', label: 'Base Land Cost', description: 'Base cost for free land tiles', category: 'land', min: 100, max: 10000, step: 100, unit: '$', format: 'currency' },
  { key: 'land_multiplier_town', label: 'Town Multiplier', description: 'Land cost multiplier for towns', category: 'land', min: 0.1, max: 10, step: 0.1, unit: 'x', format: 'decimal' },
  { key: 'land_multiplier_city', label: 'City Multiplier', description: 'Land cost multiplier for cities', category: 'land', min: 1, max: 50, step: 0.5, unit: 'x', format: 'decimal' },
  { key: 'land_multiplier_capital', label: 'Capital Multiplier', description: 'Land cost multiplier for capitals', category: 'land', min: 5, max: 100, step: 1, unit: 'x', format: 'decimal' },
  { key: 'terrain_multiplier_free_land', label: 'Free Land Multiplier', description: 'Cost multiplier for free land', category: 'land', min: 0.5, max: 2, step: 0.1, unit: 'x', format: 'decimal' },
  { key: 'terrain_multiplier_dirt_track', label: 'Dirt Track Multiplier', description: 'Cost multiplier for dirt tracks', category: 'land', min: 0.1, max: 2, step: 0.1, unit: 'x', format: 'decimal' },
  { key: 'terrain_multiplier_trees', label: 'Trees Multiplier', description: 'Cost multiplier for wooded land', category: 'land', min: 0.5, max: 3, step: 0.1, unit: 'x', format: 'decimal' },

  // Combat (Dirty Tricks / Prison)
  { key: 'prison_fine_multiplier', label: 'Prison Fine Multiplier', description: 'Fine = trick_cost × this × location_multiplier', category: 'combat', min: 1, max: 20, step: 1, unit: 'x', format: 'decimal' },
  { key: 'fine_multiplier_town', label: 'Town Fine Multiplier', description: 'Fine multiplier for town locations', category: 'combat', min: 0.5, max: 5, step: 0.1, unit: 'x', format: 'decimal' },
  { key: 'fine_multiplier_city', label: 'City Fine Multiplier', description: 'Fine multiplier for city locations', category: 'combat', min: 0.5, max: 5, step: 0.1, unit: 'x', format: 'decimal' },
  { key: 'fine_multiplier_capital', label: 'Capital Fine Multiplier', description: 'Fine multiplier for capital locations', category: 'combat', min: 0.5, max: 5, step: 0.1, unit: 'x', format: 'decimal' },
  { key: 'security_bonus_cameras', label: 'Cameras Bonus', description: 'Added catch rate for security cameras', category: 'combat', min: 0, max: 0.5, step: 0.05, unit: '%', format: 'percent' },
  { key: 'security_bonus_guard_dogs', label: 'Guard Dogs Bonus', description: 'Added catch rate for guard dogs', category: 'combat', min: 0, max: 0.5, step: 0.05, unit: '%', format: 'percent' },
  { key: 'security_bonus_security_guards', label: 'Security Guards Bonus', description: 'Added catch rate for security guards', category: 'combat', min: 0, max: 0.5, step: 0.05, unit: '%', format: 'percent' },
  { key: 'cleanup_cost_percent', label: 'Cleanup Cost', description: 'Cost to cleanup as % of building cost per attack', category: 'combat', min: 0, max: 0.2, step: 0.01, unit: '%', format: 'percent' },

  // Market
  { key: 'sell_to_state_percent', label: 'Sell to State %', description: 'Percentage of building value when selling to state', category: 'market', min: 0.1, max: 1, step: 0.05, unit: '%', format: 'percent' },
  { key: 'min_listing_price_percent', label: 'Min Listing Price %', description: 'Minimum listing price as % of building value', category: 'market', min: 0.5, max: 1.5, step: 0.05, unit: '%', format: 'percent' },
  { key: 'forced_buy_multiplier', label: 'Forced Buy Multiplier', description: 'Forced buy price = building_value × this', category: 'market', min: 1, max: 20, step: 0.5, unit: 'x', format: 'decimal' },
];

// Group settings by category for UI
export const SETTINGS_BY_CATEGORY: Record<SettingCategory, SettingDefinition[]> = {
  fire: SETTING_DEFINITIONS.filter(s => s.category === 'fire'),
  tax: SETTING_DEFINITIONS.filter(s => s.category === 'tax'),
  profit: SETTING_DEFINITIONS.filter(s => s.category === 'profit'),
  adjacency: SETTING_DEFINITIONS.filter(s => s.category === 'adjacency'),
  hero: SETTING_DEFINITIONS.filter(s => s.category === 'hero'),
  land: SETTING_DEFINITIONS.filter(s => s.category === 'land'),
  combat: SETTING_DEFINITIONS.filter(s => s.category === 'combat'),
  market: SETTING_DEFINITIONS.filter(s => s.category === 'market'),
};

export const CATEGORY_LABELS: Record<SettingCategory, { label: string; icon: string }> = {
  fire: { label: 'Fire Mechanics', icon: '🔥' },
  tax: { label: 'Tax Rates', icon: '💰' },
  profit: { label: 'Profit Settings', icon: '📈' },
  adjacency: { label: 'Adjacency Modifiers', icon: '🏘️' },
  hero: { label: 'Hero System', icon: '👑' },
  land: { label: 'Land Costs', icon: '🗺️' },
  combat: { label: 'Combat & Prison', icon: '⚔️' },
  market: { label: 'Market Pricing', icon: '🏪' },
};
```

### services/tickAdminApi.ts

```typescript
// authentication-dashboard-system/src/services/tickAdminApi.ts

import config from '../config';
import type {
  TickHistoryResponse,
  TickDetailResponse,
  TickStatsResponse,
  TickSettingsResponse,
  TickSettingsUpdateResponse,
  SettingsLogResponse,
  TickSettings,
  StatsPeriod,
} from '../types/tick';

class TickAdminApi {
  private baseUrl = `${config.API_BASE_URL}/api/admin/tick`;

  private async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const token = localStorage.getItem('token');
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options?.headers,
      },
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Request failed');
    }

    return data.data;
  }

  // ============================================
  // TICK HISTORY
  // ============================================

  async getHistory(params?: {
    page?: number;
    limit?: number;
    start_date?: string;
    end_date?: string;
  }): Promise<TickHistoryResponse> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.start_date) searchParams.set('start_date', params.start_date);
    if (params?.end_date) searchParams.set('end_date', params.end_date);

    const query = searchParams.toString();
    return this.fetch<TickHistoryResponse>(`/history${query ? `?${query}` : ''}`);
  }

  async getTickDetail(tickId: string): Promise<TickDetailResponse> {
    return this.fetch<TickDetailResponse>(`/history/${tickId}`);
  }

  async getStats(period: StatsPeriod = '24h'): Promise<TickStatsResponse> {
    return this.fetch<TickStatsResponse>(`/stats?period=${period}`);
  }

  // ============================================
  // TICK SETTINGS
  // ============================================

  async getSettings(): Promise<TickSettingsResponse> {
    return this.fetch<TickSettingsResponse>('/settings');
  }

  async updateSettings(updates: Partial<TickSettings>): Promise<TickSettingsUpdateResponse> {
    return this.fetch<TickSettingsUpdateResponse>('/settings', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async resetSettings(): Promise<{ message: string; settings: TickSettings }> {
    return this.fetch<{ message: string; settings: TickSettings }>('/settings/reset', {
      method: 'POST',
      body: JSON.stringify({ confirm: true }),
    });
  }

  async getSettingsLog(params?: {
    page?: number;
    limit?: number;
  }): Promise<SettingsLogResponse> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));

    const query = searchParams.toString();
    return this.fetch<SettingsLogResponse>(`/settings/log${query ? `?${query}` : ''}`);
  }
}

export const tickAdminApi = new TickAdminApi();
export default tickAdminApi;
```

## Database Changes

None — frontend only

## Test Cases

### Test 1: Types Compile
```bash
cd authentication-dashboard-system
npx tsc --noEmit
# Expected: No type errors
```

### Test 2: API Service Imports
```typescript
// In a test file or component
import { tickAdminApi } from '../services/tickAdminApi';
import type { TickHistoryEntry, TickSettings } from '../types/tick';

// Should compile without errors
```

### Test 3: API Methods Work
```typescript
// Manual browser console test
const response = await tickAdminApi.getHistory({ page: 1, limit: 10 });
console.log(response.ticks.length); // Should be 10
console.log(response.pagination.total); // Should be 907+
```

### Test 4: Settings Definitions Complete
```typescript
import { SETTING_DEFINITIONS, TickSettings } from '../types/tick';

// Verify all settings have definitions
const settingKeys = SETTING_DEFINITIONS.map(s => s.key);
const allKeys: (keyof TickSettings)[] = [
  'fire_damage_base', /* ... all 31 keys ... */
];
const missing = allKeys.filter(k => !settingKeys.includes(k));
console.log('Missing definitions:', missing); // Should be empty
```

## Acceptance Checklist

- [ ] `src/types/tick.ts` created with all interfaces
- [ ] `src/services/tickAdminApi.ts` created with all methods
- [ ] All types match API response shapes from Stage 3 & 4
- [ ] SETTING_DEFINITIONS covers all 31 settings
- [ ] SETTINGS_BY_CATEGORY correctly groups settings
- [ ] TypeScript compiles without errors
- [ ] API methods handle errors correctly
- [ ] Pagination types are reusable

## Deployment

No deployment needed — frontend files only.

```bash
# Verify build works
cd authentication-dashboard-system
npm run build
# Should complete without errors
```

## Handoff Notes

- Types and API service ready for UI components
- [See: Stage 7] will create the page shell that imports these
- [See: Stage 8] will use `tickAdminApi.getHistory()` and `getStats()`
- [See: Stage 9] will use `tickAdminApi.getSettings()` and `updateSettings()`
- SETTING_DEFINITIONS provides all metadata for rendering setting inputs
- Use `SETTINGS_BY_CATEGORY` to render grouped sections
- Use `CATEGORY_LABELS` for section headers with icons
