// src/components/assets/ReferenceLibrary/ReferenceImageCard.tsx

import { Check, Eye, Image as ImageIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { useState } from 'react';
import { ReferenceImage, referenceLibraryApi } from '../../../services/assetApi';

interface ReferenceImageCardProps {
  image: ReferenceImage;
  isSelected: boolean;
  onToggle: () => void;
}

export default function ReferenceImageCard({
  image,
  isSelected,
  onToggle,
}: ReferenceImageCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const handlePreviewClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (previewUrl) {
      window.open(previewUrl, '_blank');
      return;
    }

    setIsLoadingPreview(true);
    try {
      const { previewUrl: url } = await referenceLibraryApi.getPreviewUrl(image.id);
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
        {image.thumbnailUrl ? (
          <img
            src={image.thumbnailUrl}
            alt={image.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-gray-400" />
          </div>
        )}

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
            className="absolute top-2 right-2 p-1.5 bg-white/90 dark:bg-gray-800/90 rounded-full shadow-sm hover:bg-white dark:hover:bg-gray-700 transition-colors"
          >
            <Eye className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </button>
        )}
      </div>

      {/* Info */}
      <div className="p-2">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
          {image.name}
        </p>
        {image.category && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {image.category}
          </p>
        )}
      </div>
    </div>
  );
}
