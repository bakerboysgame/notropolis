// src/components/assets/GenerateModal.tsx
import { useState, useEffect } from 'react';
import {
  X,
  Wand2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { clsx } from 'clsx';
import {
  AssetCategory,
  ASSET_KEYS,
  REF_CATEGORIES,
  SPRITE_CATEGORIES,
  STANDALONE_CATEGORIES,
  assetApi,
} from '../../services/assetApi';
import { useToast } from '../ui/Toast';

interface GenerateModalProps {
  onClose: () => void;
  onSuccess: () => void;
  initialCategory?: AssetCategory;
  parentAsset?: { id: string; asset_key: string };
}

// Category labels for display
const CATEGORY_LABELS: Record<AssetCategory, string> = {
  building_ref: 'Building Reference Sheet',
  building_sprite: 'Building Sprite',
  character_ref: 'Character Reference Sheet',
  npc: 'NPC Sprite',
  vehicle_ref: 'Vehicle Reference Sheet',
  effect_ref: 'Effect Reference Sheet',
  effect: 'Effect Sprite',
  avatar: 'Avatar',
  terrain_ref: 'Terrain Reference Sheet',  // Shows all variations in grid
  terrain: 'Terrain Tile',  // Simple single tiles
  scene: 'Scene Background',
  ui: 'UI Element',
  overlay: 'Overlay',
};

// Group categories for the dropdown
const CATEGORY_GROUPS = [
  { label: 'Reference Sheets', categories: REF_CATEGORIES },
  { label: 'Sprites (from refs)', categories: SPRITE_CATEGORIES },
  { label: 'Standalone', categories: STANDALONE_CATEGORIES },
];

export function GenerateModal({
  onClose,
  onSuccess,
  initialCategory,
  parentAsset,
}: GenerateModalProps) {
  const { showToast } = useToast();
  const [category, setCategory] = useState<AssetCategory>(initialCategory || 'building_ref');
  const [assetKey, setAssetKey] = useState<string>('');
  const [variant, setVariant] = useState<number | ''>('');
  const [customDetails, setCustomDetails] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get available asset keys for selected category
  const availableKeys = ASSET_KEYS[category] || [];
  const isSprite = SPRITE_CATEGORIES.includes(category);

  // Reset asset key when category changes
  useEffect(() => {
    if (parentAsset) {
      setAssetKey(parentAsset.asset_key);
    } else if (availableKeys.length > 0 && !availableKeys.includes(assetKey)) {
      setAssetKey(availableKeys[0]);
    } else if (availableKeys.length === 0) {
      setAssetKey('');
    }
  }, [category, availableKeys, parentAsset]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!category) {
      setError('Please select a category');
      return;
    }

    if (availableKeys.length > 0 && !assetKey) {
      setError('Please select an asset key');
      return;
    }

    setGenerating(true);
    try {
      const result = await assetApi.generate({
        category,
        asset_key: assetKey || category, // Use category as key for sprites without predefined keys
        variant: variant !== '' ? variant : undefined,
        custom_details: customDetails.trim() || undefined,
      });

      showToast(
        `Generation started for ${assetKey || category}`,
        'success'
      );

      if (result.used_reference_image) {
        showToast('Using approved reference sheet', 'info');
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setGenerating(false);
    }
  };

  const formatKey = (key: string) => {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Generate Asset
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Parent info */}
          {parentAsset && (
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <p className="text-sm text-purple-700 dark:text-purple-300">
                Generating sprite from reference: <strong>{formatKey(parentAsset.asset_key)}</strong>
              </p>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1 font-mono">
                ID: {parentAsset.id}
              </p>
            </div>
          )}

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as AssetCategory)}
              disabled={!!parentAsset}
              className={clsx(
                'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm',
                parentAsset && 'opacity-60 cursor-not-allowed'
              )}
            >
              {CATEGORY_GROUPS.map(group => (
                <optgroup key={group.label} label={group.label}>
                  {group.categories.map(cat => (
                    <option key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Asset Key */}
          {availableKeys.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Asset Type
              </label>
              <select
                value={assetKey}
                onChange={(e) => setAssetKey(e.target.value)}
                disabled={!!parentAsset}
                className={clsx(
                  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm',
                  parentAsset && 'opacity-60 cursor-not-allowed'
                )}
              >
                {availableKeys.map(key => (
                  <option key={key} value={key}>
                    {formatKey(key)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Variant */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Variant Number
              <span className="text-gray-400 font-normal ml-1">(optional)</span>
            </label>
            <input
              type="number"
              min="1"
              value={variant}
              onChange={(e) => setVariant(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
              placeholder="Auto-increment if empty"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Leave empty to use the next available variant number
            </p>
          </div>

          {/* Custom Details */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Custom Details
              <span className="text-gray-400 font-normal ml-1">(optional)</span>
            </label>
            <textarea
              value={customDetails}
              onChange={(e) => setCustomDetails(e.target.value)}
              rows={3}
              placeholder="Additional details to include in the generation prompt..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm resize-none"
            />
          </div>

          {/* Sprite note */}
          {isSprite && !parentAsset && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Sprites require an approved reference sheet. The system will automatically use the matching reference if available.
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={generating}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Generate Asset
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
