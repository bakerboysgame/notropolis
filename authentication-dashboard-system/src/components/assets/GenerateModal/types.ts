// src/components/assets/GenerateModal/types.ts

import { AssetCategory, GenerationSettings, ReferenceImageSpec, AspectRatio } from '../../../services/assetApi';

export interface GenerateFormData {
  category: AssetCategory | '';
  assetKey: string;
  variant?: number;
  prompt: string;
  customDetails: string;
  systemInstructions: string;
  referenceImages: Array<ReferenceImageSpec & {
    thumbnailUrl?: string;
    name?: string;
  }>;
  generationSettings: GenerationSettings;
  parentAssetId?: number;
  spriteVariant?: string;
}

export interface Step {
  id: string;
  title: string;
  description: string;
}

export interface StepProps {
  formData: GenerateFormData;
  updateFormData: (updates: Partial<GenerateFormData>) => void;
}

// Map sprite categories to their parent reference categories
export const SPRITE_TO_REF_CATEGORY: Record<string, string> = {
  'building_sprite': 'building_ref',
  'terrain': 'terrain_ref',
  'npc': 'character_ref',
  'effect': 'effect_ref',
  'avatar': 'character_ref',
};

// Map ref categories to their sprite categories
export const REF_TO_SPRITE_CATEGORY: Record<string, string> = {
  'building_ref': 'building_sprite',
  'terrain_ref': 'terrain',
  'character_ref': 'npc',
  'effect_ref': 'effect',
  'vehicle_ref': 'npc',
};

export const DEFAULT_GENERATION_SETTINGS: GenerationSettings = {
  temperature: 0.7,
  topK: 40,
  topP: 0.95,
  aspectRatio: '1:1',
  imageSize: '4K',
};

// Get default aspect ratio based on category
export function getDefaultAspectRatioForCategory(category: string): AspectRatio {
  // Reference sheets use 3:2 for 6-panel layout
  if (category?.endsWith('_ref')) {
    return '3:2';
  }
  // Scenes use 16:9 for widescreen
  if (category === 'scene') {
    return '16:9';
  }
  // All sprites and other assets use 1:1
  return '1:1';
}
