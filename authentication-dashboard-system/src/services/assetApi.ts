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
  | 'terrain_ref'  // Reference sheets for terrain with variations (road, dirt, water)
  | 'terrain'      // Simple terrain tiles (grass, trees, mountain, sand)
  | 'scene'
  | 'ui'
  | 'overlay';

// Reference categories (require approval before sprites)
export const REF_CATEGORIES: AssetCategory[] = [
  'building_ref',
  'character_ref',
  'vehicle_ref',
  'effect_ref',
  'terrain_ref',  // Terrain reference sheets (road, dirt, water)
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
  'terrain',  // Simple terrain (grass, trees, mountain, sand)
  'scene',
  'ui',
  'overlay',
];

// Asset key mappings by category
export const ASSET_KEYS: Record<string, string[]> = {
  building_ref: [
    'restaurant', 'bank', 'temple', 'casino', 'manor', 'police_station',
    'high_street_store', 'shop', 'burger_bar', 'motel', 'market_stall',
    'hot_dog_stand', 'campsite', 'claim_stake', 'demolished'
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
  // Terrain reference sheets - when approved, sprites auto-generate
  terrain_ref: [
    'grass',  // Generates seamless grass tile
    'road',   // Generates 15 road tiles (straights, corners, T-junctions, 4-way, dead-ends)
    'dirt',   // Generates 6 dirt tiles (straights, corners)
    'water',  // Generates 12 water tiles (edges, outer/inner corners)
  ],
  // Simple terrain - single tiles with no variations
  terrain: [
    'trees', 'mountain', 'sand',
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
  { key: 'terrain', label: 'Terrain', refCategory: 'terrain_ref', spriteCategory: 'terrain' },
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
  public_url?: string;  // Public URL for published assets
  prompt?: string;
  rejection_reason?: string;
  parent_asset_id?: string;
  used_reference_image?: boolean;
  error_message?: string;
  is_active?: boolean;
  auto_created?: boolean;  // Stage 8: Whether this was auto-created from a reference
  generation_settings?: string | GenerationSettings;  // Stage 8: Gemini settings used for generation
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

// ============================================
// STAGE 4: GENERATION SETTINGS AND REFERENCES
// ============================================

// Gemini generation settings
export interface GenerationSettings {
  temperature?: number;  // 0.0 - 2.0, default 0.7
  topK?: number;         // 1 - 100, default 40
  topP?: number;         // 0.0 - 1.0, default 0.95
  maxOutputTokens?: number;
}

// Reference image specification for generation
export interface ReferenceImageSpec {
  type: 'library' | 'approved_asset';
  id: number;
}

// Stage 4: Enhanced generate parameters
// Stage 5a: Added parent_asset_id and sprite_variant for explicit sprite-reference linking
export interface GenerateParams {
  category: AssetCategory;
  asset_key: string;
  variant?: number;
  prompt?: string;                          // Custom prompt (optional, overrides template)
  custom_details?: string;                  // Additional details to append
  system_instructions?: string;             // Custom system instructions (overrides template)
  reference_images?: ReferenceImageSpec[];  // Reference images to include
  generation_settings?: GenerationSettings; // Gemini settings
  parent_asset_id?: number;                 // Stage 5a: Link to parent reference
  sprite_variant?: string;                  // Stage 5a: Which variant (e.g., 'main', 'n', 'corner')
}

// Generation response
// Stage 5a: Added sprite_variant to response
export interface GenerateResponse {
  success: boolean;
  asset_id: string;
  assetId?: number;  // Stage 4: camelCase alias
  variant?: number;
  r2_key: string;
  used_reference_image: boolean;
  user_references_count?: number;
  parent_asset_id?: string;
  sprite_variant?: string;  // Stage 5a: Which variant was generated
  generation_settings?: GenerationSettings & { model: string };
  message?: string;
  error?: string;
}

// ============================================
// STAGE 6: REGENERATE FLOW TYPES
// ============================================

// Stage 6: Regenerate parameters
export interface RegenerateParams {
  prompt?: string;                          // Override prompt
  custom_details?: string;                  // Additional details to append
  reference_images?: ReferenceImageSpec[];  // New references (replaces original links)
  generation_settings?: GenerationSettings; // Override settings (merged with original)
  preserve_old?: boolean;                   // Keep old version (default: true)
}

// Stage 6: Regenerate response
export interface RegenerateResponse {
  success: boolean;
  originalId?: number;
  originalVariant?: number;
  newAssetId?: number;
  newVariant?: number;
  r2_key?: string;
  generation_settings?: GenerationSettings & { model: string };
  message?: string;
  error?: string;
}

// Preview URL response
export interface PreviewUrlResponse {
  url: string;
  expires_at: string;
}

// Stage 8: Reference link for an asset
export interface AssetReferenceLink {
  id: number;
  link_type: 'library' | 'approved_asset';
  reference_image_id?: number;
  approved_asset_id?: number;
  thumbnailUrl?: string;
  name: string;
  sort_order: number;
}

// ============================================
// STAGE 5a: SPRITE REQUIREMENTS AND STATUS
// ============================================

// Sprite requirement definition
export interface SpriteRequirement {
  spriteCategory: string;
  variant: string;
  displayName: string;
  required: boolean;
}

// Individual sprite status in a reference's sprite set
export interface SpriteStatus {
  variant: string;
  displayName: string;
  required: boolean;
  spriteCategory: string;
  spriteAssetKey: string;
  spriteId: number | null;
  status: string | null;
  pipelineStatus: string | null;
  publicUrl: string | null;
  generationSettings: GenerationSettings | null;
}

// Response from sprite-status endpoint
export interface SpriteStatusResponse {
  success: boolean;
  reference: {
    id: number;
    category: string;
    asset_key: string;
    status: string;
  };
  sprites: SpriteStatus[];
  summary: {
    total: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    percentComplete: number;
  };
  message?: string;
}

// Response from sprite-requirements endpoint
export interface SpriteRequirementsResponse {
  success: boolean;
  refCategory: string;
  requirements: SpriteRequirement[];
  message?: string;
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
  // Stage 4: Enhanced with custom prompts, reference images, and Gemini settings
  // Stage 5a: Added parent_asset_id and sprite_variant for sprite-reference linking
  async generate(params: GenerateParams): Promise<GenerateResponse> {
    return this.fetch('/generate', {
      method: 'POST',
      body: JSON.stringify({
        category: params.category,
        asset_key: params.asset_key,
        variant: params.variant,
        prompt: params.prompt,
        custom_details: params.custom_details,
        system_instructions: params.system_instructions,
        reference_images: params.reference_images,
        generation_settings: params.generation_settings,
        parent_asset_id: params.parent_asset_id,
        sprite_variant: params.sprite_variant
      }),
    });
  }

  // Stage 5a: Get sprite requirements for a reference type
  async getSpriteRequirements(refCategory: string): Promise<SpriteRequirement[]> {
    const response = await this.fetch<SpriteRequirementsResponse>(`/sprite-requirements/${refCategory}`);
    return response.requirements || [];
  }

  // Stage 5a: Get sprite status for a specific reference
  async getSpriteStatus(refId: number): Promise<SpriteStatusResponse> {
    return this.fetch<SpriteStatusResponse>(`/sprite-status/${refId}`);
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

  // Regenerate asset (creates new version, preserves old)
  // Stage 6: Enhanced with optional params for prompt/reference/settings overrides
  async regenerate(assetId: string, params?: RegenerateParams): Promise<RegenerateResponse> {
    return this.fetch(`/regenerate/${assetId}`, {
      method: 'POST',
      body: JSON.stringify(params || {}),
    });
  }

  // Set asset as active (primary)
  async setActive(assetId: string): Promise<{ success: boolean }> {
    return this.fetch(`/set-active/${assetId}`, {
      method: 'PUT',
    });
  }

  // Get rejection history for an asset
  async getRejections(assetId: string): Promise<Rejection[]> {
    const data = await this.fetch<{ rejections: Rejection[] }>(`/rejections/${assetId}`);
    return data.rejections || [];
  }

  // Stage 8: Get reference images used for an asset
  async getReferenceLinks(assetId: string): Promise<AssetReferenceLink[]> {
    const data = await this.fetch<{ referenceLinks: AssetReferenceLink[] }>(`/reference-links/${assetId}`);
    return data.referenceLinks || [];
  }

  // Building Manager APIs
  async getBuildingConfigs(): Promise<BuildingConfig[]> {
    const data = await this.fetch<{ buildings: BuildingConfig[] }>('/buildings');
    return data.buildings || [];
  }

  async getBuildingSprites(buildingType: string): Promise<Asset[]> {
    const data = await this.fetch<{ sprites: Asset[] }>(`/buildings/${buildingType}/sprites`);
    return data.sprites || [];
  }

  async updateBuildingConfig(buildingType: string, config: Partial<BuildingConfigUpdate>): Promise<{ success: boolean }> {
    return this.fetch(`/buildings/${buildingType}`, {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  async publishBuilding(buildingType: string): Promise<{ success: boolean }> {
    return this.fetch(`/buildings/${buildingType}/publish`, { method: 'POST' });
  }

  async unpublishBuilding(buildingType: string): Promise<{ success: boolean }> {
    return this.fetch(`/buildings/${buildingType}/unpublish`, { method: 'POST' });
  }

  // Scene Template APIs
  async getSceneTemplates(): Promise<SceneTemplate[]> {
    const data = await this.fetch<{ templates: SceneTemplate[] }>('/scenes/templates');
    return data.templates || [];
  }

  async updateSceneTemplate(id: string, data: Partial<SceneTemplateUpdate>): Promise<{ success: boolean }> {
    return this.fetch(`/scenes/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async publishSceneTemplate(id: string): Promise<{ success: boolean }> {
    return this.fetch(`/scenes/templates/${id}/publish`, { method: 'POST' });
  }

  // Avatar composite preview
  async previewAvatarComposite(sceneId: string, companyId: string): Promise<{ composite_url: string }> {
    return this.fetch(`/scenes/compose/${sceneId}/${companyId}`);
  }
}

// Rejection history interface
export interface Rejection {
  id: string;
  asset_id: string;
  rejected_by: string;
  rejection_reason: string;
  prompt_at_rejection: string;
  prompt_version: number;
  r2_key_rejected: string;
  created_at: string;
}

// Building configuration interfaces
export interface BuildingConfig {
  building_type_id: string;
  building_name: string;
  level_required: number;
  requires_license: boolean;
  base_cost: number;
  base_profit: number;
  cost_override: number | null;
  base_profit_override: number | null;
  effective_cost: number;
  effective_profit: number;
  active_sprite_id: string | null;
  sprite_url: string | null;
  available_sprites: number;
  is_published: boolean;
  published_at: string | null;
  published_by: string | null;
}

export interface BuildingConfigUpdate {
  active_sprite_id: string;
  cost_override: number | null;
  base_profit_override: number | null;
}

// Scene template interfaces
export interface SceneTemplate {
  id: string;
  name: string;
  description: string;
  background_r2_key: string | null;
  background_url: string | null;
  foreground_r2_key: string | null;
  foreground_url: string | null;
  avatar_slot: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  width: number;
  height: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SceneTemplateUpdate {
  avatar_slot: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// Avatar layer types for composite preview
export const AVATAR_LAYER_TYPES = [
  { id: 'avatar_bg', name: 'Background', order: 0 },
  { id: 'base_body', name: 'Base Body', order: 1 },
  { id: 'outfit', name: 'Outfit', order: 3 },
  { id: 'hair', name: 'Hair', order: 4 },
  { id: 'headwear', name: 'Headwear', order: 5 },
  { id: 'accessory', name: 'Accessory', order: 6 },
] as const;

export const assetApi = new AssetAdminApi();

// ============================================
// REFERENCE LIBRARY TYPES AND API
// ============================================

export interface ReferenceImage {
  id: number;
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  thumbnailUrl?: string;
  thumbnail_r2_key?: string;
  r2_key?: string;
  width?: number;
  height?: number;
  file_size?: number;
  mime_type?: string;
  usage_count?: number;
  uploaded_by?: string;
  created_at: string;
  updated_at?: string;
  is_archived?: boolean;
}

export interface UploadReferenceParams {
  file: File;
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
}

export interface ReferenceImageUploadResponse {
  id: number;
  name: string;
  category: string;
  r2Key: string;
  thumbnailKey: string;
  width: number;
  height: number;
  fileSize: number;
}

class ReferenceLibraryApi {
  private baseUrl = `${config.API_BASE_URL}/api/admin/assets/reference-library`;

  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
    };
  }

  // List all reference images
  async list(params?: { category?: string; search?: string; archived?: boolean }): Promise<ReferenceImage[]> {
    const queryParams = new URLSearchParams();
    if (params?.category) queryParams.set('category', params.category);
    if (params?.search) queryParams.set('search', params.search);
    if (params?.archived) queryParams.set('archived', 'true');

    const response = await fetch(`${this.baseUrl}?${queryParams}`, {
      headers: this.getAuthHeaders()
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Failed to list reference images');
    return data.images;
  }

  // Get single reference image
  async get(id: number): Promise<ReferenceImage> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      headers: this.getAuthHeaders()
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Failed to get reference image');
    return data.image;
  }

  // Get preview URL for full-size image
  async getPreviewUrl(id: number): Promise<{ previewUrl: string; mimeType: string }> {
    const response = await fetch(`${this.baseUrl}/${id}/preview`, {
      headers: this.getAuthHeaders()
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Failed to get preview URL');
    return { previewUrl: data.previewUrl, mimeType: data.mimeType };
  }

  // Upload new reference image
  async upload(params: UploadReferenceParams): Promise<ReferenceImageUploadResponse> {
    const formData = new FormData();
    formData.append('file', params.file);
    formData.append('name', params.name);
    if (params.description) formData.append('description', params.description);
    if (params.category) formData.append('category', params.category);
    if (params.tags) formData.append('tags', JSON.stringify(params.tags));

    const response = await fetch(`${this.baseUrl}/upload`, {
      method: 'POST',
      headers: this.getAuthHeaders(), // Don't set Content-Type for FormData
      body: formData
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Failed to upload reference image');
    return data.image;
  }

  // Update metadata
  async update(id: number, updates: Partial<Pick<ReferenceImage, 'name' | 'description' | 'category' | 'tags'>>): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PUT',
      headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Failed to update reference image');
  }

  // Archive (soft delete)
  async archive(id: number): Promise<{ archived: boolean; wasInUse: boolean }> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Failed to archive reference image');
    return { archived: data.archived, wasInUse: data.wasInUse };
  }
}

export const referenceLibraryApi = new ReferenceLibraryApi();

// Reference library categories
export const REFERENCE_CATEGORIES = [
  'buildings',
  'characters',
  'vehicles',
  'effects',
  'general'
] as const;

export type ReferenceCategory = typeof REFERENCE_CATEGORIES[number];

// ============================================
// PROMPT TEMPLATE TYPES AND API
// ============================================

export interface PromptTemplate {
  id?: number;
  category: string;
  assetKey: string;
  templateName?: string;
  basePrompt: string;
  styleGuide?: string;
  systemInstructions?: string;
  version: number;
  isActive?: boolean;
  isHardcoded?: boolean;
  createdBy?: string;
  updatedAt?: string;
  changeNotes?: string;
}

export interface PromptTemplateVersion {
  id: number;
  version: number;
  isActive: boolean;
  basePrompt: string;
  styleGuide?: string;
  createdBy?: string;
  createdAt: string;
  changeNotes?: string;
}

export interface PromptCategoryList {
  [category: string]: Array<{ assetKey: string; templateName: string }>;
}

class PromptTemplateApi {
  private baseUrl = `${config.API_BASE_URL}/api/admin/assets/prompts`;

  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
    };
  }

  // List all categories and their templates
  async listCategories(): Promise<PromptCategoryList> {
    const response = await fetch(this.baseUrl, {
      headers: this.getAuthHeaders()
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Failed to list categories');
    return data.categories;
  }

  // Get active template for category/assetKey
  async get(category: string, assetKey: string): Promise<PromptTemplate> {
    const response = await fetch(`${this.baseUrl}/${category}/${assetKey}`, {
      headers: this.getAuthHeaders()
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Template not found');
    return data.template;
  }

  // Update template (creates new version)
  async update(
    category: string,
    assetKey: string,
    updates: {
      basePrompt: string;
      styleGuide?: string;
      systemInstructions?: string;
      templateName?: string;
      changeNotes?: string;
    }
  ): Promise<{ templateId: number; version: number }> {
    const response = await fetch(`${this.baseUrl}/${category}/${assetKey}`, {
      method: 'PUT',
      headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Failed to update template');
    return { templateId: data.templateId, version: data.version };
  }

  // Get version history
  async getHistory(category: string, assetKey: string): Promise<PromptTemplateVersion[]> {
    const response = await fetch(`${this.baseUrl}/${category}/${assetKey}/history`, {
      headers: this.getAuthHeaders()
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Failed to get history');
    return data.versions;
  }

  // Reset to system default (creates new version with original content)
  async reset(category: string, assetKey: string): Promise<{ templateId: number; version: number }> {
    const response = await fetch(`${this.baseUrl}/${category}/${assetKey}/reset`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Failed to reset template');
    return { templateId: data.templateId, version: data.version };
  }
}

export const promptTemplateApi = new PromptTemplateApi();

// Prompt template categories (matches backend categories)
export const PROMPT_CATEGORIES = [
  '_global',
  'building_ref',
  'building_sprite',
  'character_ref',
  'vehicle_ref',
  'effect_ref',
  'terrain_ref',
  'terrain',
  'effect',
  'scene',
  'npc',
  'avatar',
  'ui',
  'overlay'
] as const;

export type PromptCategory = typeof PROMPT_CATEGORIES[number];

// ============================================
// STAGE 10: ASSET CONFIGURATION TYPES AND API
// ============================================

// Asset configuration for non-building types
export interface AssetConfiguration {
  id?: number;
  category: string;
  asset_key: string;
  active_sprite_id?: number | null;
  config?: Record<string, unknown>;
  is_active?: boolean;
  is_published?: boolean;
  published_at?: string;
  published_by?: string;
  sprite_url?: string;
  available_sprites?: number;
  created_at?: string;
  updated_at?: string;
}

// Building configuration (extended from existing)
export interface BuildingConfiguration {
  asset_key: string;
  name: string;
  active_sprite_id?: number | null;
  cost_override?: number | null;
  base_profit_override?: number | null;
  default_cost?: number;
  default_profit?: number;
  effective_cost?: number;
  effective_profit?: number;
  is_published?: boolean;
  published_at?: string;
  published_by?: string;
  sprite_url?: string;
  available_sprites?: number;
}

// Available asset for configuration
export interface AvailableAsset {
  asset_key: string;
  sprite_count: number;
  sample_url?: string;
}

class AssetConfigurationApi {
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
    return data;
  }

  // Get configurations for a category
  async getConfigurations(category: string): Promise<AssetConfiguration[] | BuildingConfiguration[]> {
    const data = await this.fetch<{ configurations: AssetConfiguration[] | BuildingConfiguration[] }>(
      `/configurations/${category}`
    );
    return data.configurations;
  }

  // Get available sprites for an asset
  async getConfigurationSprites(category: string, assetKey: string): Promise<Asset[]> {
    const data = await this.fetch<{ sprites: Asset[] }>(
      `/configurations/${category}/${assetKey}/sprites`
    );
    return data.sprites;
  }

  // Update configuration for an asset
  async updateConfiguration(
    category: string,
    assetKey: string,
    updates: {
      active_sprite_id?: number | null;
      cost_override?: number | null;
      base_profit_override?: number | null;
      config?: Record<string, unknown>;
      is_active?: boolean;
    }
  ): Promise<void> {
    await this.fetch(`/configurations/${category}/${assetKey}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  // Publish an asset configuration
  async publishConfiguration(category: string, assetKey: string): Promise<void> {
    await this.fetch(`/configurations/${category}/${assetKey}/publish`, {
      method: 'POST',
    });
  }

  // Unpublish an asset configuration
  async unpublishConfiguration(category: string, assetKey: string): Promise<void> {
    await this.fetch(`/configurations/${category}/${assetKey}/unpublish`, {
      method: 'POST',
    });
  }

  // Get available approved assets for a category
  async getAvailableAssets(category: string): Promise<AvailableAsset[]> {
    const data = await this.fetch<{ assets: AvailableAsset[] }>(
      `/available-assets/${category}`
    );
    return data.assets;
  }

  // Set active base ground
  async setActiveBaseGround(assetKey: string): Promise<void> {
    await this.fetch('/base-ground/active', {
      method: 'PUT',
      body: JSON.stringify({ asset_key: assetKey }),
    });
  }

  // Get active base ground
  async getActiveBaseGround(): Promise<{ asset_key: string; sprite_url?: string } | null> {
    const data = await this.fetch<{ base_ground: { asset_key: string; sprite_url?: string } | null }>(
      '/base-ground/active'
    );
    return data.base_ground;
  }
}

export const assetConfigApi = new AssetConfigurationApi();

// Asset Manager categories (UI tabs)
export const ASSET_MANAGER_CATEGORIES = [
  { key: 'buildings', label: 'Buildings', hasPrice: true },
  { key: 'npcs', label: 'NPCs', hasPrice: false },
  { key: 'effects', label: 'Effects', hasPrice: false },
  { key: 'terrain', label: 'Terrain', hasPrice: false },
  { key: 'base_ground', label: 'Base Ground', hasPrice: false, singleActive: true },
] as const;

export type AssetManagerCategory = typeof ASSET_MANAGER_CATEGORIES[number]['key'];
