// src/components/assets/ReferenceLibrary/index.tsx

import { Loader2, Image as ImageIcon } from 'lucide-react';
import { ReferenceImage } from '../../../services/assetApi';
import ReferenceImageCard from './ReferenceImageCard';

interface ReferenceLibraryProps {
  images: ReferenceImage[];
  selectedIds: number[];
  onToggle: (image: ReferenceImage) => void;
  isLoading?: boolean;
}

export default function ReferenceLibrary({
  images,
  selectedIds,
  onToggle,
  isLoading,
}: ReferenceLibraryProps) {
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
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
      {images.map((image) => (
        <ReferenceImageCard
          key={image.id}
          image={image}
          isSelected={selectedIds.includes(image.id)}
          onToggle={() => onToggle(image)}
        />
      ))}
    </div>
  );
}
