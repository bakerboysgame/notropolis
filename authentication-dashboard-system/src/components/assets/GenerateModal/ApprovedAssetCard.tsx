// src/components/assets/GenerateModal/ApprovedAssetCard.tsx

import { useState, useEffect } from 'react';
import { Check, Image as ImageIcon, Loader2, Calendar, UserCheck, Sparkles } from 'lucide-react';
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

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
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
      <div className="aspect-square bg-gray-100 dark:bg-gray-800 relative">
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

        {/* Source type badge - generated assets are AI-created */}
        <div
          className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-xs font-medium flex items-center gap-1 bg-white/90 dark:bg-gray-900/90 shadow-sm text-purple-600 dark:text-purple-400"
          title="AI Generated"
        >
          <Sparkles className="w-3 h-3" />
        </div>

        {isSelected && (
          <div className="absolute inset-0 bg-purple-500/20 flex items-center justify-center">
            <div className="bg-purple-500 rounded-full p-1">
              <Check className="w-5 h-5 text-white" />
            </div>
          </div>
        )}
      </div>
      <div className="p-2 space-y-1">
        <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
          {formatKey(asset.asset_key)}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {formatKey(asset.category)}
        </p>

        {/* Metadata row */}
        <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
          {/* Date */}
          {asset.created_at && (
            <span className="flex items-center gap-0.5" title={new Date(asset.created_at).toLocaleString()}>
              <Calendar className="w-3 h-3" />
              {formatDate(asset.created_at)}
            </span>
          )}

          {/* Approver */}
          {asset.approved_by && (
            <span className="flex items-center gap-0.5 truncate" title={`Approved by ${asset.approved_by}`}>
              <UserCheck className="w-3 h-3" />
              <span className="truncate max-w-[50px]">{asset.approved_by}</span>
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
