// src/services/assetApi.ts
import { config } from '../config/environment';

// Asset status types
export type AssetStatus = 'pending' | 'generating' | 'completed' | 'review' | 'approved' | 'rejected' | 'failed';

// Asset categories
export type AssetCategory =
  | 'building_ref'
  | 'building_sprite'
  | 'character_ref'
  | 'npc'
  | 'vehicle_ref'
  | 'effect_ref'
  | 'effect'
  | 'avatar'
  | 'terrain'
  | 'scene'
  | 'ui'
  | 'overlay';

// Reference categories (require approval before sprites)
export const REF_CATEGORIES: AssetCategory[] = [
  'building_ref',
  'character_ref',
  'vehicle_ref',
  'effect_ref',
];

// Sprite categories (generated from approved refs)
export const SPRITE_CATEGORIES: AssetCategory[] = [
  'building_sprite',
  'npc',
  'effect',
  'avatar',
];

// Standalone categories (no ref needed)
export const STANDALONE_CATEGORIES: AssetCategory[] = [
  'terrain',
  'scene',
  'ui',
  'overlay',
];

// Asset key mappings by category
export const ASSET_KEYS: Record<string, string[]> = {
  building_ref: [
    'restaurant', 'bank', 'temple', 'casino', 'manor', 'police_station',
    'high_street_store', 'shop', 'burger_bar', 'motel', 'market_stall',
    'hot_dog_stand', 'campsite'
  ],
  character_ref: ['pedestrian', 'pedestrian_business', 'pedestrian_casual', 'avatar_base'],
  vehicle_ref: ['car_sedan', 'car_sports', 'car_van', 'car_taxi'],
  effect_ref: ['fire', 'cluster_bomb', 'vandalism', 'robbery', 'poisoning', 'blackout'],
  // NPC sprites - directional walk cycles and car sprites
  npc: [
    // Pedestrian directional sprites (2-frame animation strips)
    'ped_walk_n', 'ped_walk_s', 'ped_walk_e', 'ped_walk_w',
    // Car directional sprites (single images)
    'car_n', 'car_s', 'car_e', 'car_w',
    // Legacy types
    'pedestrian_walk', 'pedestrian_stand', 'pedestrian_suit', 'pedestrian_casual',
    'car_sedan', 'car_sports', 'car_van', 'car_taxi'
  ],
  terrain: [
    // Base terrain types ONLY - variations auto-generate when base is approved
    // User selects base type (road, dirt, water), approves it, then all variations generate automatically
    'grass', 'trees', 'mountain', 'sand', 'water', 'road', 'dirt',
  ],
  scene: [
    'arrest_bg', 'court_bg', 'prison_bg', 'hero_bg', 'bank_bg',
    'temple_bg', 'casino_bg', 'hospital_bg'
  ],
  ui: ['minimap_player', 'minimap_enemy', 'cursor_select', 'cursor_target'],
  overlay: ['owned_self', 'owned_other', 'for_sale', 'under_attack'],
};

// Tab configuration for the UI
export interface TabConfig {
  key: string;
  label: string;
  refCategory?: AssetCategory;
  spriteCategory?: AssetCategory;
  standaloneCategory?: AssetCategory;
}

export const TABS: TabConfig[] = [
  { key: 'buildings', label: 'Buildings', refCategory: 'building_ref', spriteCategory: 'building_sprite' },
  { key: 'characters', label: 'Characters', refCategory: 'character_ref', spriteCategory: 'npc' },
  { key: 'vehicles', label: 'Vehicles', refCategory: 'vehicle_ref', spriteCategory: 'npc' },
  { key: 'effects', label: 'Effects', refCategory: 'effect_ref', spriteCategory: 'effect' },
  { key: 'scenes', label: 'Scenes', standaloneCategory: 'scene' },
  { key: 'terrain', label: 'Terrain', standaloneCategory: 'terrain' },
  { key: 'avatars', label: 'Avatars', refCategory: 'character_ref', spriteCategory: 'avatar' },
  { key: 'ui', label: 'UI', standaloneCategory: 'ui' },
  { key: 'overlays', label: 'Overlays', standaloneCategory: 'overlay' },
];

// Asset interface
export interface Asset {
  id: string;
  category: AssetCategory;
  asset_key: string;
  variant: number;
  status: AssetStatus;
  r2_key: string;
  prompt?: string;
  rejection_reason?: string;
  parent_asset_id?: string;
  used_reference_image?: boolean;
  error_message?: string;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
  approved_at?: string;
  approved_by?: string;
}

// Queue item interface
export interface QueueItem {
  id: string;
  category: AssetCategory;
  asset_key: string;
  status: 'pending' | 'generating';
  created_at: string;
}

// Generation response
export interface GenerateResponse {
  success: boolean;
  asset_id: string;
  r2_key: string;
  used_reference_image: boolean;
  parent_asset_id?: string;
}

// Preview URL response
export interface PreviewUrlResponse {
  url: string;
  expires_at: string;
}

class AssetAdminApi {
  private baseUrl = `${config.API_BASE_URL}/api/admin/assets`;

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
    if (!data.success) throw new Error(data.error || 'Request failed');
    return data.data ?? data;
  }

  // List assets by category
  async listAssets(category: AssetCategory): Promise<Asset[]> {
    return this.fetch<Asset[]>(`/list/${category}`);
  }

  // Get generation queue status
  async getQueue(): Promise<{ pending: number; generating: number; items: QueueItem[] }> {
    return this.fetch('/queue');
  }

  // Get preview URL for private asset
  async getPreviewUrl(assetId: string): Promise<PreviewUrlResponse> {
    return this.fetch(`/preview/${assetId}`);
  }

  // Generate new asset
  async generate(params: {
    category: AssetCategory;
    asset_key: string;
    variant?: number;
    custom_details?: string;
  }): Promise<GenerateResponse> {
    return this.fetch('/generate', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // Remove background (Removal.ai)
  async removeBackground(assetId: string): Promise<{ success: boolean }> {
    return this.fetch(`/remove-background/${assetId}`, {
      method: 'POST',
    });
  }

  // Publish to public bucket as WebP
  async publish(assetId: string): Promise<{ success: boolean; public_url: string }> {
    return this.fetch(`/process/${assetId}`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  // Approve asset
  async approve(assetId: string): Promise<{ success: boolean }> {
    return this.fetch(`/approve/${assetId}`, {
      method: 'PUT',
    });
  }

  // Reject asset with reason
  async reject(assetId: string, reason: string): Promise<{ success: boolean }> {
    return this.fetch(`/reject/${assetId}`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    });
  }

  // Regenerate asset (uses updated prompt)
  async regenerate(assetId: string): Promise<GenerateResponse> {
    return this.fetch(`/regenerate/${assetId}`, {
      method: 'POST',
    });
  }

  // Set asset as active (primary)
  async setActive(assetId: string): Promise<{ success: boolean }> {
    return this.fetch(`/set-active/${assetId}`, {
      method: 'PUT',
    });
  }
}

export const assetApi = new AssetAdminApi();
