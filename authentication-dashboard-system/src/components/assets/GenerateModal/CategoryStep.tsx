// src/components/assets/GenerateModal/CategoryStep.tsx

import { useState, useEffect } from 'react';
import { Loader2, AlertCircle, CheckCircle2, Clock, Eye } from 'lucide-react';
import { clsx } from 'clsx';
import {
  AssetCategory,
  Asset,
  ASSET_KEYS,
  REF_CATEGORIES,
  SPRITE_CATEGORIES,
  STANDALONE_CATEGORIES,
  assetApi,
  SpriteStatusResponse,
} from '../../../services/assetApi';
import { GenerateFormData, SPRITE_TO_REF_CATEGORY } from './types';

interface CategoryStepProps {
  formData: GenerateFormData;
  updateFormData: (updates: Partial<GenerateFormData>) => void;
}

// Category labels for display
const CATEGORY_LABELS: Record<AssetCategory, string> = {
  building_ref: 'Building Reference Sheet',
  building_sprite: 'Building Sprite',
  character_ref: 'Character Reference Sheet',
  npc: 'NPC Sprite',
  vehicle_ref: 'Vehicle Reference Sheet',
  vehicle: 'Vehicle Sprite',
  effect_ref: 'Effect Reference Sheet',
  effect: 'Effect Sprite',
  avatar: 'Avatar',
  terrain_ref: 'Terrain Reference Sheet',
  terrain: 'Terrain Tile',
  scene: 'Scene Background',
  ui: 'UI Element',
  overlay: 'Overlay',
};

export default function CategoryStep({
  formData,
  updateFormData,
}: CategoryStepProps) {
  const [approvedRefs, setApprovedRefs] = useState<Asset[]>([]);
  const [spriteStatus, setSpriteStatus] = useState<SpriteStatusResponse | null>(null);
  const [isLoadingRefs, setIsLoadingRefs] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  const { category, assetKey, variant, parentAssetId, spriteVariant } = formData;
  const assetKeys = category ? ASSET_KEYS[category] || [] : [];
  const isSprite = SPRITE_CATEGORIES.includes(category as AssetCategory);
  const refCategory = isSprite ? SPRITE_TO_REF_CATEGORY[category as string] : null;

  // Load approved references when sprite category is selected
  useEffect(() => {
    if (isSprite && refCategory) {
      loadApprovedRefs();
    } else {
      setApprovedRefs([]);
      setSpriteStatus(null);
    }
  }, [category, refCategory, isSprite]);

  // Load sprite status when parent is selected
  useEffect(() => {
    if (parentAssetId) {
      loadSpriteStatus();
    } else {
      setSpriteStatus(null);
    }
  }, [parentAssetId]);

  const loadApprovedRefs = async () => {
    if (!refCategory) return;
    setIsLoadingRefs(true);
    try {
      const assets = await assetApi.listAssets(refCategory as AssetCategory);
      const approved = assets.filter(a => a.status === 'approved');
      setApprovedRefs(approved);
    } catch (error) {
      console.error('Failed to load refs:', error);
    } finally {
      setIsLoadingRefs(false);
    }
  };

  const loadSpriteStatus = async () => {
    if (!parentAssetId) return;
    setIsLoadingStatus(true);
    try {
      const status = await assetApi.getSpriteStatus(parentAssetId);
      setSpriteStatus(status);
    } catch (error) {
      console.error('Failed to load sprite status:', error);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const handleCategoryChange = (newCategory: string) => {
    updateFormData({
      category: newCategory as AssetCategory,
      assetKey: '',
      parentAssetId: undefined,
      spriteVariant: undefined,
    });
  };

  const handleParentChange = (refId: number) => {
    const selectedRef = approvedRefs.find(r => parseInt(r.id) === refId);
    updateFormData({
      parentAssetId: refId,
      assetKey: selectedRef?.asset_key || assetKey,
      spriteVariant: undefined,
    });
  };

  const handleSpriteVariantChange = (variantKey: string, variantAssetKey: string) => {
    updateFormData({
      spriteVariant: variantKey,
      assetKey: variantAssetKey,
    });
  };

  const formatKey = (key: string) => {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getStatusIcon = (status: string | null) => {
    if (!status) return <Clock className="w-4 h-4 text-gray-400" />;
    switch (status) {
      case 'generating':
      case 'pending':
        return <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />;
      case 'review':
      case 'completed':
        return <Eye className="w-4 h-4 text-blue-500" />;
      case 'approved':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusText = (status: string | null) => {
    if (!status) return 'Not started';
    switch (status) {
      case 'generating':
      case 'pending':
        return 'Generating...';
      case 'review':
      case 'completed':
        return 'Ready for review';
      case 'approved':
        return 'Complete';
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* Category Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Category
        </label>
        <select
          value={category}
          onChange={(e) => handleCategoryChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
        >
          <option value="">Select category...</option>
          <optgroup label="Reference Sheets">
            {REF_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </option>
            ))}
          </optgroup>
          <optgroup label="Sprites (require parent ref)">
            {SPRITE_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </option>
            ))}
          </optgroup>
          <optgroup label="Standalone">
            {STANDALONE_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      {/* Parent Reference Selector (for sprites only) */}
      {isSprite && (
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <label className="block text-sm font-medium text-purple-800 dark:text-purple-200 mb-2">
            Parent Reference (Required for sprites)
          </label>
          {isLoadingRefs ? (
            <div className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading approved references...
            </div>
          ) : approvedRefs.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4" />
              No approved {refCategory?.replace('_', ' ')}s found. Create and approve a reference first.
            </div>
          ) : (
            <select
              value={parentAssetId || ''}
              onChange={(e) => handleParentChange(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-purple-300 dark:border-purple-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
            >
              <option value="">Select parent reference...</option>
              {approvedRefs.map((ref) => (
                <option key={ref.id} value={ref.id}>
                  {formatKey(ref.asset_key)} (v{ref.variant}) - approved{' '}
                  {ref.approved_at
                    ? new Date(ref.approved_at).toLocaleDateString()
                    : 'N/A'}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Sprite Variant Selector (when parent is selected) */}
      {isSprite && parentAssetId && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Sprite Variant
          </label>
          {isLoadingStatus ? (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading sprite status...
            </div>
          ) : spriteStatus?.sprites && spriteStatus.sprites.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                {spriteStatus.sprites.map((sprite) => {
                  const isComplete = sprite.status === 'approved';
                  const isSelected = spriteVariant === sprite.variant;

                  return (
                    <button
                      key={sprite.variant}
                      type="button"
                      onClick={() => handleSpriteVariantChange(sprite.variant, sprite.spriteAssetKey)}
                      disabled={isComplete}
                      className={clsx(
                        'p-3 border rounded-lg text-left transition-colors',
                        isSelected
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                          : isComplete
                          ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 opacity-50 cursor-not-allowed'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-400'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {sprite.displayName}
                        </span>
                        {getStatusIcon(sprite.status)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {getStatusText(sprite.status)}
                      </div>
                    </button>
                  );
                })}
              </div>
              {spriteStatus.summary && (
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all"
                      style={{ width: `${spriteStatus.summary.percentComplete}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {spriteStatus.summary.completed}/{spriteStatus.summary.total} complete
                  </span>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No sprite requirements defined for this reference type.
            </p>
          )}
        </div>
      )}

      {/* Asset Key (for non-sprites or when sprite variant not available) */}
      {!isSprite && category && assetKeys.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Asset Type
          </label>
          <select
            value={assetKey}
            onChange={(e) => updateFormData({ assetKey: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
          >
            <option value="">Select type...</option>
            {assetKeys.map((key) => (
              <option key={key} value={key}>
                {formatKey(key)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Manual asset key input for categories without predefined keys */}
      {!isSprite && category && assetKeys.length === 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Asset Key
          </label>
          <input
            type="text"
            value={assetKey}
            onChange={(e) => updateFormData({ assetKey: e.target.value })}
            placeholder="Enter asset key..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
          />
        </div>
      )}

      {/* Variant Number */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Variant Number
          <span className="text-gray-400 font-normal ml-1">(optional)</span>
        </label>
        <input
          type="number"
          min="1"
          value={variant || ''}
          onChange={(e) =>
            updateFormData({
              variant: e.target.value ? parseInt(e.target.value, 10) : undefined,
            })
          }
          placeholder="Auto-increment if empty"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Leave empty to use the next available variant number
        </p>
      </div>

      {/* Sprite requirement note */}
      {isSprite && !parentAssetId && approvedRefs.length > 0 && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            Please select a parent reference above to generate a sprite.
          </p>
        </div>
      )}
    </div>
  );
}
