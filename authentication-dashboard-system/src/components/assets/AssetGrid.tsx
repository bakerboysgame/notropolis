// src/components/assets/AssetGrid.tsx
import { useState, useEffect } from 'react';
import { Loader2, Plus, RefreshCw, FolderOpen } from 'lucide-react';
import { Asset, AssetCategory, assetApi } from '../../services/assetApi';
import { AssetCard } from './AssetCard';

interface AssetGridProps {
  category: AssetCategory;
  title: string;
  onPreview: (asset: Asset) => void;
  onGenerate: () => void;
  onGenerateSprite?: (asset: Asset) => void;
  showGenerateSprite?: boolean;
  refreshTrigger?: number;
  showHidden?: boolean;
}

export function AssetGrid({
  category,
  title,
  onPreview,
  onGenerate,
  onGenerateSprite,
  showGenerateSprite = false,
  refreshTrigger = 0,
  showHidden = false,
}: AssetGridProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssets = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await assetApi.listAssets(category, showHidden);
      setAssets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [category, refreshTrigger, showHidden]);

  // Group assets by asset_key for better organization
  const groupedAssets = assets.reduce((acc, asset) => {
    if (!acc[asset.asset_key]) {
      acc[asset.asset_key] = [];
    }
    acc[asset.asset_key].push(asset);
    return acc;
  }, {} as Record<string, Asset[]>);

  // Sort by variant within each group
  Object.values(groupedAssets).forEach(group => {
    group.sort((a, b) => b.variant - a.variant);
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            ({assets.length} assets)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAssets}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={onGenerate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Generate
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-500 dark:text-red-400 mb-4">{error}</p>
            <button
              onClick={fetchAssets}
              className="text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400"
            >
              Try again
            </button>
          </div>
        ) : assets.length === 0 ? (
          <div className="text-center py-12">
            <FolderOpen className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No assets in this category yet
            </p>
            <button
              onClick={onGenerate}
              className="text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400"
            >
              Generate your first asset
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {assets.map(asset => (
              <AssetCard
                key={asset.id}
                asset={asset}
                onPreview={onPreview}
                onGenerateSprite={onGenerateSprite}
                showGenerateSprite={showGenerateSprite}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
