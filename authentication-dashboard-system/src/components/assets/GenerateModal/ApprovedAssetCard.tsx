// src/components/assets/GenerateModal/ApprovedAssetCard.tsx

import { useState, useEffect } from 'react';
import { Check, Image as ImageIcon, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { Asset, assetApi } from '../../../services/assetApi';

interface ApprovedAssetCardProps {
  asset: Asset;
  isSelected: boolean;
  onToggle: (thumbnailUrl: string | undefined) => void;
}

function formatKey(key: string): string {
  return key
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function ApprovedAssetCard({
  asset,
  isSelected,
  onToggle,
}: ApprovedAssetCardProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  // Fetch preview URL on mount
  useEffect(() => {
    let mounted = true;

    const fetchThumbnail = async () => {
      // If already has public_url, use it
      if (asset.public_url) {
        setThumbnailUrl(asset.public_url);
        setIsLoading(false);
        return;
      }

      // Otherwise fetch preview URL
      try {
        const { url } = await assetApi.getPreviewUrl(asset.id);
        if (mounted) {
          setThumbnailUrl(url);
        }
      } catch (err) {
        console.error('Failed to load asset preview:', err);
        if (mounted) {
          setError(true);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchThumbnail();

    return () => {
      mounted = false;
    };
  }, [asset.id, asset.public_url]);

  return (
    <button
      type="button"
      onClick={() => onToggle(thumbnailUrl || undefined)}
      className={clsx(
        'relative rounded-lg border-2 overflow-hidden transition-all text-left',
        isSelected
          ? 'border-purple-500 ring-2 ring-purple-500/20'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
      )}
    >
      <div className="aspect-square bg-gray-100 dark:bg-gray-800">
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : error || !thumbnailUrl ? (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-gray-400" />
          </div>
        ) : (
          <img
            src={thumbnailUrl}
            alt={asset.asset_key}
            className="w-full h-full object-cover"
          />
        )}
        {isSelected && (
          <div className="absolute inset-0 bg-purple-500/20 flex items-center justify-center">
            <div className="bg-purple-500 rounded-full p-1">
              <Check className="w-5 h-5 text-white" />
            </div>
          </div>
        )}
      </div>
      <div className="p-2">
        <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
          {formatKey(asset.asset_key)}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {formatKey(asset.category)}
        </p>
      </div>
    </button>
  );
}
