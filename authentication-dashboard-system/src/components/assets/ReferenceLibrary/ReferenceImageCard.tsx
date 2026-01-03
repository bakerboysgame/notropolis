// src/components/assets/ReferenceLibrary/ReferenceImageCard.tsx

import { Check, Eye, Image as ImageIcon, Upload, Link, Sparkles, Download, User, Calendar, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useState, useEffect } from 'react';
import { ReferenceImage, referenceLibraryApi, assetApi, ReferenceImageSourceType } from '../../../services/assetApi';

// Extended ReferenceImage that may include assetId for generated assets
export interface ExtendedReferenceImage extends ReferenceImage {
  assetId?: string;
}

interface ReferenceImageCardProps {
  image: ExtendedReferenceImage;
  isSelected: boolean;
  onToggle: () => void;
}

const SOURCE_TYPE_CONFIG: Record<ReferenceImageSourceType, { icon: React.ReactNode; label: string; color: string }> = {
  upload: { icon: <Upload className="w-3 h-3" />, label: 'Upload', color: 'text-green-600 dark:text-green-400' },
  external_url: { icon: <Link className="w-3 h-3" />, label: 'URL', color: 'text-blue-600 dark:text-blue-400' },
  generated: { icon: <Sparkles className="w-3 h-3" />, label: 'AI', color: 'text-purple-600 dark:text-purple-400' },
  imported: { icon: <Download className="w-3 h-3" />, label: 'Import', color: 'text-orange-600 dark:text-orange-400' },
};

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

export default function ReferenceImageCard({
  image,
  isSelected,
  onToggle,
}: ReferenceImageCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | undefined>(image.thumbnailUrl);
  const [isLoadingThumbnail, setIsLoadingThumbnail] = useState(false);

  const sourceType = image.source_type || 'upload';
  const sourceConfig = SOURCE_TYPE_CONFIG[sourceType] || SOURCE_TYPE_CONFIG.upload;
  const isGeneratedAsset = image.assetId && sourceType === 'generated';

  // Fetch thumbnail dynamically for generated assets
  useEffect(() => {
    if (!isGeneratedAsset || thumbnailUrl) return;

    let mounted = true;
    setIsLoadingThumbnail(true);

    const fetchThumbnail = async () => {
      try {
        const { url } = await assetApi.getPreviewUrl(image.assetId!);
        if (mounted) {
          setThumbnailUrl(url);
        }
      } catch (error) {
        console.error('Failed to load asset thumbnail:', error);
      } finally {
        if (mounted) {
          setIsLoadingThumbnail(false);
        }
      }
    };

    fetchThumbnail();
    return () => { mounted = false; };
  }, [image.assetId, isGeneratedAsset, thumbnailUrl]);

  const handlePreviewClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (previewUrl) {
      window.open(previewUrl, '_blank');
      return;
    }

    setIsLoadingPreview(true);
    try {
      // Use different API for generated assets vs library images
      let url: string;
      if (isGeneratedAsset) {
        const result = await assetApi.getPreviewUrl(image.assetId!);
        url = result.url;
      } else {
        const result = await referenceLibraryApi.getPreviewUrl(image.id);
        url = result.previewUrl;
      }
      setPreviewUrl(url);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Failed to get preview URL:', error);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  return (
    <div
      onClick={onToggle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={clsx(
        'relative rounded-lg border-2 overflow-hidden cursor-pointer transition-all group',
        isSelected
          ? 'border-purple-500 ring-2 ring-purple-500/20'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
      )}
    >
      {/* Thumbnail */}
      <div className="aspect-square bg-gray-100 dark:bg-gray-800 relative">
        {isLoadingThumbnail ? (
          <div className="w-full h-full flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={image.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-gray-400" />
          </div>
        )}

        {/* Source type badge */}
        <div
          className={clsx(
            'absolute top-1 left-1 px-1.5 py-0.5 rounded text-xs font-medium flex items-center gap-1',
            'bg-white/90 dark:bg-gray-900/90 shadow-sm',
            sourceConfig.color
          )}
          title={`Source: ${sourceConfig.label}`}
        >
          {sourceConfig.icon}
        </div>

        {/* Selection overlay */}
        {isSelected && (
          <div className="absolute inset-0 bg-purple-500/20 flex items-center justify-center">
            <div className="bg-purple-500 rounded-full p-1">
              <Check className="w-5 h-5 text-white" />
            </div>
          </div>
        )}

        {/* Preview button */}
        {isHovered && (
          <button
            onClick={handlePreviewClick}
            disabled={isLoadingPreview}
            className="absolute top-1 right-1 p-1.5 bg-white/90 dark:bg-gray-800/90 rounded-full shadow-sm hover:bg-white dark:hover:bg-gray-700 transition-colors"
          >
            <Eye className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </button>
        )}
      </div>

      {/* Info */}
      <div className="p-2 space-y-1">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
          {image.name}
        </p>

        {/* Category */}
        {image.category && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {image.category}
          </p>
        )}

        {/* Metadata row */}
        <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
          {/* Date */}
          {image.created_at && (
            <span className="flex items-center gap-0.5" title={new Date(image.created_at).toLocaleString()}>
              <Calendar className="w-3 h-3" />
              {formatDate(image.created_at)}
            </span>
          )}

          {/* Uploader */}
          {image.uploaded_by && (
            <span className="flex items-center gap-0.5 truncate" title={`Uploaded by ${image.uploaded_by}`}>
              <User className="w-3 h-3" />
              <span className="truncate max-w-[60px]">{image.uploaded_by}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
