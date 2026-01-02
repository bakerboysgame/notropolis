// src/components/assets/ReferenceLibrary/index.tsx

import { useState, useMemo } from 'react';
import { Loader2, Image as ImageIcon, Filter, X } from 'lucide-react';
import { clsx } from 'clsx';
import { ReferenceImage, ReferenceImageSourceType } from '../../../services/assetApi';
import ReferenceImageCard from './ReferenceImageCard';

interface ReferenceLibraryProps {
  images: ReferenceImage[];
  selectedIds: number[];
  onToggle: (image: ReferenceImage) => void;
  isLoading?: boolean;
  availableCategories?: string[];
  availableSourceTypes?: ReferenceImageSourceType[];
}

const SOURCE_TYPE_LABELS: Record<ReferenceImageSourceType, string> = {
  upload: 'Upload',
  external_url: 'External URL',
  generated: 'AI Generated',
  imported: 'Imported',
};

export default function ReferenceLibrary({
  images,
  selectedIds,
  onToggle,
  isLoading,
  availableCategories = [],
  availableSourceTypes = [],
}: ReferenceLibraryProps) {
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [sourceTypeFilter, setSourceTypeFilter] = useState<ReferenceImageSourceType | null>(null);

  // Filter images based on selected filters
  const filteredImages = useMemo(() => {
    return images.filter((img) => {
      if (categoryFilter && img.category !== categoryFilter) return false;
      if (sourceTypeFilter && img.source_type !== sourceTypeFilter) return false;
      return true;
    });
  }, [images, categoryFilter, sourceTypeFilter]);

  const hasActiveFilters = categoryFilter || sourceTypeFilter;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin mb-3" />
        <p className="text-sm">Loading reference library...</p>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
        <ImageIcon className="w-12 h-12 mb-3 text-gray-300 dark:text-gray-600" />
        <p className="text-sm font-medium">No reference images</p>
        <p className="text-xs mt-1">Upload images using the Upload tab</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      {(availableCategories.length > 0 || availableSourceTypes.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-gray-200 dark:border-gray-700">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">Filter:</span>

          {/* Category filters */}
          {availableCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
              className={clsx(
                'px-2 py-1 text-xs rounded-full transition-colors',
                categoryFilter === cat
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              )}
            >
              {cat}
            </button>
          ))}

          {/* Divider if both filter types exist */}
          {availableCategories.length > 0 && availableSourceTypes.length > 0 && (
            <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />
          )}

          {/* Source type filters */}
          {availableSourceTypes.map((type) => (
            <button
              key={type}
              onClick={() => setSourceTypeFilter(sourceTypeFilter === type ? null : type)}
              className={clsx(
                'px-2 py-1 text-xs rounded-full transition-colors',
                sourceTypeFilter === type
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              )}
            >
              {SOURCE_TYPE_LABELS[type] || type}
            </button>
          ))}

          {/* Clear filters button */}
          {hasActiveFilters && (
            <button
              onClick={() => {
                setCategoryFilter(null);
                setSourceTypeFilter(null);
              }}
              className="ml-2 px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>
      )}

      {/* Results count */}
      <div className="text-xs text-gray-500 dark:text-gray-400">
        Showing {filteredImages.length} of {images.length} images
      </div>

      {/* Image Grid */}
      {filteredImages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
          <ImageIcon className="w-10 h-10 mb-2 text-gray-300 dark:text-gray-600" />
          <p className="text-sm">No images match the current filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {filteredImages.map((image) => (
            <ReferenceImageCard
              key={image.id}
              image={image}
              isSelected={selectedIds.includes(image.id)}
              onToggle={() => onToggle(image)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
