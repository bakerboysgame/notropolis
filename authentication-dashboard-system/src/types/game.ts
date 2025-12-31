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
