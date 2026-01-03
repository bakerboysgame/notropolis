// src/components/assets/GenerateModal/ReferenceImagesStep.tsx

import { useState, useEffect, useMemo } from 'react';
import { Loader2, X, Library, FolderCheck, Upload, Link, Filter } from 'lucide-react';
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
import ApprovedAssetCard from './ApprovedAssetCard';
import { GenerateFormData, SPRITE_TO_REF_CATEGORY } from './types';

interface ReferenceImagesStepProps {
  formData: GenerateFormData;
  updateFormData: (updates: Partial<GenerateFormData>) => void;
}

type TabType = 'library' | 'approved' | 'upload';

export default function ReferenceImagesStep({
  formData,
  updateFormData,
}: ReferenceImagesStepProps) {
  const { category, referenceImages, parentAssetId } = formData;
  const [activeTab, setActiveTab] = useState<TabType>('library');
  const [libraryImages, setLibraryImages] = useState<ReferenceImage[]>([]);
  const [approvedAssets, setApprovedAssets] = useState<Asset[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  const [isLoadingApproved, setIsLoadingApproved] = useState(false);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [availableSourceTypes, setAvailableSourceTypes] = useState<ReferenceImageSourceType[]>([]);
  const [approvedCategoryFilter, setApprovedCategoryFilter] = useState<AssetCategory | null>(null);

  const isSprite = category ? !!SPRITE_TO_REF_CATEGORY[category] : false;

  // Get unique categories from approved assets for filtering
  const approvedAssetCategories = useMemo(() => {
    const cats = [...new Set(approvedAssets.map(a => a.category))];
    return cats.sort();
  }, [approvedAssets]);

  // Filter approved assets by selected category
  const filteredApprovedAssets = useMemo(() => {
    if (!approvedCategoryFilter) return approvedAssets;
    return approvedAssets.filter(a => a.category === approvedCategoryFilter);
  }, [approvedAssets, approvedCategoryFilter]);

  // Category display names
  const categoryLabels: Record<string, string> = {
    building_ref: 'Buildings',
    character_ref: 'Characters',
    vehicle_ref: 'Vehicles',
    effect_ref: 'Effects',
    terrain_ref: 'Terrain',
  };

  // Load library images on mount
  useEffect(() => {
    loadLibraryImages();
  }, []);

  // Load approved assets when switching to that tab
  useEffect(() => {
    if (activeTab === 'approved' && approvedAssets.length === 0) {
      loadApprovedAssets();
    }
  }, [activeTab]);

  const loadLibraryImages = async () => {
    setIsLoadingLibrary(true);
    try {
      const result = await referenceLibraryApi.listWithFilters();
      setLibraryImages(result.images);
      setAvailableCategories(result.filters.categories);
      setAvailableSourceTypes(result.filters.sourceTypes);
    } catch (error) {
      console.error('Failed to load library:', error);
    } finally {
      setIsLoadingLibrary(false);
    }
  };

  const loadApprovedAssets = async () => {
    setIsLoadingApproved(true);
    try {
      // Load approved assets from relevant categories
      const categories: AssetCategory[] = [
        'building_ref',
        'character_ref',
        'vehicle_ref',
        'effect_ref',
        'terrain_ref',
      ];

      const allAssets: Asset[] = [];
      for (const cat of categories) {
        try {
          const assets = await assetApi.listAssets(cat);
          const approved = assets.filter(a => a.status === 'approved');
          allAssets.push(...approved);
        } catch (e) {
          // Ignore errors for individual categories
        }
      }

      setApprovedAssets(allAssets);
    } catch (error) {
      console.error('Failed to load approved assets:', error);
    } finally {
      setIsLoadingApproved(false);
    }
  };

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
    { id: 'approved', label: 'Approved Assets', icon: FolderCheck },
    { id: 'upload', label: 'Upload New', icon: Upload },
  ];

  const formatKey = (key: string) => {
    return key
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="space-y-4">
      {/* Parent reference indicator */}
      {isSprite && parentAssetId && (
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Link className="w-4 h-4 text-purple-500" />
            <p className="text-sm text-purple-700 dark:text-purple-300">
              <span className="font-medium">Parent Reference:</span> The approved
              reference sheet (#{parentAssetId}) will be automatically included
              as the primary reference.
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
            images={libraryImages}
            selectedIds={referenceImages
              .filter((r) => r.type === 'library')
              .map((r) => r.id)}
            onToggle={(image) =>
              handleToggleReference({
                type: 'library',
                id: image.id,
                thumbnailUrl: image.thumbnailUrl,
                name: image.name,
              })
            }
            isLoading={isLoadingLibrary}
            availableCategories={availableCategories}
            availableSourceTypes={availableSourceTypes}
          />
        )}

        {activeTab === 'approved' && (
          <div className="space-y-4">
            {isLoadingApproved ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin mb-3" />
                <p className="text-sm">Loading approved assets...</p>
              </div>
            ) : approvedAssets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                <FolderCheck className="w-12 h-12 mb-3 text-gray-300 dark:text-gray-600" />
                <p className="text-sm font-medium">No approved assets</p>
                <p className="text-xs mt-1">
                  Approve some reference sheets first
                </p>
              </div>
            ) : (
              <>
                {/* Filter bar */}
                {approvedAssetCategories.length > 1 && (
                  <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-gray-200 dark:border-gray-700">
                    <Filter className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">Filter:</span>

                    {approvedAssetCategories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setApprovedCategoryFilter(approvedCategoryFilter === cat ? null : cat)}
                        className={clsx(
                          'px-2 py-1 text-xs rounded-full transition-colors',
                          approvedCategoryFilter === cat
                            ? 'bg-purple-500 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        )}
                      >
                        {categoryLabels[cat] || formatKey(cat)}
                      </button>
                    ))}

                    {approvedCategoryFilter && (
                      <button
                        type="button"
                        onClick={() => setApprovedCategoryFilter(null)}
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
                  Showing {filteredApprovedAssets.length} of {approvedAssets.length} assets
                </div>

                {/* Asset grid */}
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {filteredApprovedAssets.map((asset) => {
                    const isSelected = referenceImages.some(
                      (r) =>
                        r.type === 'approved_asset' &&
                        r.id === parseInt(asset.id)
                    );

                    return (
                      <ApprovedAssetCard
                        key={asset.id}
                        asset={asset}
                        isSelected={isSelected}
                        onToggle={(thumbnailUrl) =>
                          handleToggleReference({
                            type: 'approved_asset',
                            id: parseInt(asset.id),
                            thumbnailUrl,
                            name: `${formatKey(asset.category)}/${formatKey(asset.asset_key)}`,
                          })
                        }
                      />
                    );
                  })}
                </div>
              </>
            )}
          </div>
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
