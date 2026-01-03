// src/components/assets/GenerateModal/ReferenceImagesStep.tsx

import { useState, useEffect, useMemo } from 'react';
import { X, Library, Upload, Link } from 'lucide-react';
import { clsx } from 'clsx';
import {
  referenceLibraryApi,
  assetApi,
  ReferenceImage,
  ReferenceImageSpec,
  ReferenceImageSourceType,
  Asset,
  AssetCategory,
} from '../../../services/assetApi';
import ReferenceLibrary from '../ReferenceLibrary';
import UploadDropzone from '../ReferenceLibrary/UploadDropzone';
import { GenerateFormData, SPRITE_TO_REF_CATEGORY } from './types';

interface ReferenceImagesStepProps {
  formData: GenerateFormData;
  updateFormData: (updates: Partial<GenerateFormData>) => void;
}

type TabType = 'library' | 'upload';

// Category display names for approved assets
const categoryLabels: Record<string, string> = {
  building_ref: 'Buildings',
  character_ref: 'Characters',
  vehicle_ref: 'Vehicles',
  effect_ref: 'Effects',
  terrain_ref: 'Terrain',
};

function formatKey(key: string): string {
  return key
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Convert approved asset to ReferenceImage format
function assetToReferenceImage(asset: Asset): ReferenceImage & { assetId: string } {
  return {
    id: parseInt(asset.id), // Use negative ID to avoid conflicts with library images
    assetId: asset.id, // Keep original asset ID for reference
    name: `${formatKey(asset.asset_key)}`,
    category: categoryLabels[asset.category] || formatKey(asset.category),
    source_type: 'generated' as ReferenceImageSourceType,
    created_at: asset.created_at,
    uploaded_by: asset.approved_by,
    // Thumbnail will be fetched dynamically
    thumbnailUrl: undefined,
  };
}

export default function ReferenceImagesStep({
  formData,
  updateFormData,
}: ReferenceImagesStepProps) {
  const { category, referenceImages, parentAssetId } = formData;
  const [activeTab, setActiveTab] = useState<TabType>('library');
  const [libraryImages, setLibraryImages] = useState<ReferenceImage[]>([]);
  const [approvedAssets, setApprovedAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [availableSourceTypes, setAvailableSourceTypes] = useState<ReferenceImageSourceType[]>([]);

  const isSprite = category ? !!SPRITE_TO_REF_CATEGORY[category] : false;

  // Load both library images and approved assets on mount
  useEffect(() => {
    loadAllReferences();
  }, []);

  const loadAllReferences = async () => {
    setIsLoading(true);
    try {
      // Load library images and approved assets in parallel
      const [libraryResult, ...assetResults] = await Promise.all([
        referenceLibraryApi.listWithFilters(),
        // Load approved assets from relevant categories
        ...(['building_ref', 'character_ref', 'vehicle_ref', 'effect_ref', 'terrain_ref'] as AssetCategory[]).map(
          async (cat) => {
            try {
              const assets = await assetApi.listAssets(cat);
              return assets.filter((a) => a.status === 'approved');
            } catch {
              return [];
            }
          }
        ),
      ]);

      // Set library images
      setLibraryImages(libraryResult.images);

      // Flatten all approved assets
      const allApprovedAssets = assetResults.flat();
      setApprovedAssets(allApprovedAssets);

      // Build combined categories list
      const libCategories = libraryResult.filters.categories;
      const assetCategories = [...new Set(allApprovedAssets.map((a) => categoryLabels[a.category] || formatKey(a.category)))];
      const combinedCategories = [...new Set([...libCategories, ...assetCategories])].sort();
      setAvailableCategories(combinedCategories);

      // Build combined source types - add 'generated' if we have approved assets
      const sourceTypes = [...libraryResult.filters.sourceTypes];
      if (allApprovedAssets.length > 0 && !sourceTypes.includes('generated')) {
        sourceTypes.push('generated');
      }
      setAvailableSourceTypes(sourceTypes);
    } catch (error) {
      console.error('Failed to load references:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Combine library images with converted approved assets
  const allImages = useMemo(() => {
    const approvedAsReferenceImages = approvedAssets.map(assetToReferenceImage);
    // Library images first, then approved assets
    return [...libraryImages, ...approvedAsReferenceImages];
  }, [libraryImages, approvedAssets]);

  // Get selected IDs for both types
  const selectedIds = useMemo(() => {
    const libraryIds = referenceImages
      .filter((r) => r.type === 'library')
      .map((r) => r.id);
    const approvedIds = referenceImages
      .filter((r) => r.type === 'approved_asset')
      .map((r) => r.id);
    return [...libraryIds, ...approvedIds];
  }, [referenceImages]);

  const handleToggleReference = (
    ref: ReferenceImageSpec & { thumbnailUrl?: string; name?: string }
  ) => {
    const exists = referenceImages.some(
      (r) => r.type === ref.type && r.id === ref.id
    );

    if (exists) {
      updateFormData({
        referenceImages: referenceImages.filter(
          (r) => !(r.type === ref.type && r.id === ref.id)
        ),
      });
    } else {
      updateFormData({
        referenceImages: [...referenceImages, ref],
      });
    }
  };

  const handleRemoveReference = (ref: ReferenceImageSpec) => {
    updateFormData({
      referenceImages: referenceImages.filter(
        (r) => !(r.type === ref.type && r.id === ref.id)
      ),
    });
  };

  const handleImageToggle = (image: ReferenceImage & { assetId?: string }) => {
    // Determine if this is a library image or approved asset
    const isApprovedAsset = image.source_type === 'generated' && image.assetId;

    if (isApprovedAsset) {
      handleToggleReference({
        type: 'approved_asset',
        id: parseInt(image.assetId!),
        thumbnailUrl: image.thumbnailUrl,
        name: image.name,
      });
    } else {
      handleToggleReference({
        type: 'library',
        id: image.id,
        thumbnailUrl: image.thumbnailUrl,
        name: image.name,
      });
    }
  };

  const handleUploadComplete = (image: ReferenceImage) => {
    setLibraryImages((prev) => [image, ...prev]);
    // Auto-select the uploaded image
    handleToggleReference({
      type: 'library',
      id: image.id,
      thumbnailUrl: image.thumbnailUrl,
      name: image.name,
    });
    // Switch to library tab to show the uploaded image
    setActiveTab('library');
  };

  const tabs: { id: TabType; label: string; icon: typeof Library }[] = [
    { id: 'library', label: 'Library', icon: Library },
    { id: 'upload', label: 'Upload New', icon: Upload },
  ];

  return (
    <div className="space-y-4">
      {/* Parent reference indicator */}
      {isSprite && parentAssetId && (
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Link className="w-4 h-4 text-purple-500" />
            <p className="text-sm text-purple-700 dark:text-purple-300">
              <span className="font-medium">Parent Reference:</span> The approved
              reference sheet has been pre-selected below. You can add more references if needed.
            </p>
          </div>
        </div>
      )}

      {/* Selected references */}
      {referenceImages.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Selected References ({referenceImages.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {referenceImages.map((ref) => (
              <div
                key={`${ref.type}-${ref.id}`}
                className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg px-3 py-1.5"
              >
                {ref.thumbnailUrl && (
                  <img
                    src={ref.thumbnailUrl}
                    alt=""
                    className="w-6 h-6 rounded object-cover"
                  />
                )}
                <span className="text-sm text-gray-700 dark:text-gray-200">
                  {ref.name || `${ref.type} #${ref.id}`}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveReference(ref)}
                  className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 ml-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="min-h-[250px]">
        {activeTab === 'library' && (
          <ReferenceLibrary
            images={allImages}
            selectedIds={selectedIds}
            onToggle={handleImageToggle}
            isLoading={isLoading}
            availableCategories={availableCategories}
            availableSourceTypes={availableSourceTypes}
            approvedAssets={approvedAssets}
          />
        )}

        {activeTab === 'upload' && (
          <UploadDropzone
            onUploadComplete={handleUploadComplete}
            category="general"
          />
        )}
      </div>

      {/* Helper text */}
      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
        Reference images help guide the generation to match your desired style
      </p>
    </div>
  );
}
