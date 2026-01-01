// src/components/assets/AssetCard.tsx
import { useState, useEffect } from 'react';
import {
  Eye,
  Wand2,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Image as ImageIcon,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Asset, AssetStatus, assetApi } from '../../services/assetApi';

interface AssetCardProps {
  asset: Asset;
  onPreview: (asset: Asset) => void;
  onGenerateSprite?: (asset: Asset) => void;
  showGenerateSprite?: boolean;
}

// Status badge configuration
const STATUS_CONFIG: Record<AssetStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: {
    label: 'Pending',
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    icon: <Clock className="w-3 h-3" />,
  },
  generating: {
    label: 'Generating',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
  },
  completed: {
    label: 'Ready for Review',
    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    icon: <Eye className="w-3 h-3" />,
  },
  approved: {
    label: 'Approved',
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    icon: <CheckCircle className="w-3 h-3" />,
  },
  rejected: {
    label: 'Rejected',
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    icon: <XCircle className="w-3 h-3" />,
  },
  failed: {
    label: 'Failed',
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    icon: <AlertTriangle className="w-3 h-3" />,
  },
};

export function AssetCard({
  asset,
  onPreview,
  onGenerateSprite,
  showGenerateSprite = false,
}: AssetCardProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [loadingThumbnail, setLoadingThumbnail] = useState(true);
  const [thumbnailError, setThumbnailError] = useState(false);

  const statusConfig = STATUS_CONFIG[asset.status];
  const isGenerating = asset.status === 'generating';
  const canGenerateSprite = showGenerateSprite && asset.status === 'approved';

  // Fetch preview URL for thumbnail
  useEffect(() => {
    let mounted = true;

    const fetchThumbnail = async () => {
      if (asset.status === 'pending' || asset.status === 'generating') {
        setLoadingThumbnail(false);
        return;
      }

      try {
        const { url } = await assetApi.getPreviewUrl(asset.id);
        if (mounted) {
          setThumbnailUrl(url);
          setThumbnailError(false);
        }
      } catch {
        if (mounted) {
          setThumbnailError(true);
        }
      } finally {
        if (mounted) {
          setLoadingThumbnail(false);
        }
      }
    };

    fetchThumbnail();
    return () => { mounted = false; };
  }, [asset.id, asset.status]);

  // Format asset key for display
  const formatAssetKey = (key: string) => {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Thumbnail */}
      <div className="aspect-square bg-gray-100 dark:bg-gray-900 relative">
        {loadingThumbnail ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : thumbnailError || !thumbnailUrl ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
            <ImageIcon className="w-12 h-12 mb-2" />
            <span className="text-xs">
              {asset.status === 'generating' ? 'Generating...' : 'No preview'}
            </span>
          </div>
        ) : (
          <img
            src={thumbnailUrl}
            alt={`${asset.asset_key} v${asset.variant}`}
            className="w-full h-full object-contain"
          />
        )}

        {/* Generating overlay */}
        {isGenerating && (
          <div className="absolute inset-0 bg-blue-500/10 flex items-center justify-center">
            <div className="bg-blue-600 text-white px-3 py-1.5 rounded-full flex items-center gap-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        {/* Title and variant */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">
            {formatAssetKey(asset.asset_key)}
          </h3>
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
            v{asset.variant}
          </span>
        </div>

        {/* Status badge */}
        <div className="mb-2">
          <span className={clsx(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
            statusConfig.color
          )}>
            {statusConfig.icon}
            {statusConfig.label}
          </span>
        </div>

        {/* Parent reference info */}
        {asset.parent_asset_id && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 truncate">
            Parent: #{String(asset.parent_asset_id).slice(0, 8)}
          </p>
        )}

        {/* Used reference indicator */}
        {asset.used_reference_image && (
          <p className="text-xs text-purple-600 dark:text-purple-400 mb-2">
            Uses reference sheet
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => onPreview(asset)}
            disabled={isGenerating}
            className={clsx(
              'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors',
              isGenerating
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            )}
          >
            <Eye className="w-3.5 h-3.5" />
            Preview
          </button>

          {canGenerateSprite && onGenerateSprite && (
            <button
              onClick={() => onGenerateSprite(asset)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors"
            >
              <Wand2 className="w-3.5 h-3.5" />
              Sprite
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
