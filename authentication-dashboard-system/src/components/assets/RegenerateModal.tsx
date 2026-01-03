// src/components/assets/RegenerateModal.tsx
// Stage 8: Modal for regenerating assets with parameter overrides

import { useState, useEffect } from 'react';
import { X, RefreshCw, Loader2, Sparkles, Image as ImageIcon, Settings, Maximize2 } from 'lucide-react';
import { clsx } from 'clsx';
import {
  Asset,
  assetApi,
  GenerationSettings,
  AssetReferenceLink,
  ReferenceImageSpec,
  referenceLibraryApi,
  ReferenceImage,
  VALID_ASPECT_RATIOS,
  VALID_IMAGE_SIZES,
  AspectRatio,
  ImageSize,
} from '../../services/assetApi';
import { useToast } from '../ui/Toast';

interface RegenerateModalProps {
  isOpen: boolean;
  asset: Asset;
  currentPrompt: string;
  currentReferences: AssetReferenceLink[];
  currentSettings: GenerationSettings | null;
  onClose: () => void;
  onRegenerate: (newAssetId: number) => void;
}

type TabType = 'prompt' | 'references' | 'settings';

const PRESETS = {
  creative: {
    temperature: 1.2,
    topK: 60,
    topP: 0.98,
    label: 'Creative',
    description: 'More varied and experimental outputs',
  },
  balanced: {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    label: 'Balanced',
    description: 'Good balance of creativity and consistency',
  },
  precise: {
    temperature: 0.3,
    topK: 20,
    topP: 0.85,
    label: 'Precise',
    description: 'More consistent and predictable outputs',
  },
};

export default function RegenerateModal({
  isOpen,
  asset,
  currentPrompt,
  currentReferences,
  currentSettings,
  onClose,
  onRegenerate,
}: RegenerateModalProps) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('prompt');
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Form state
  const [prompt, setPrompt] = useState(currentPrompt);
  const [customDetails, setCustomDetails] = useState('');
  const [settings, setSettings] = useState<GenerationSettings>(
    currentSettings || { temperature: 0.7, topK: 40, topP: 0.95 }
  );
  const [references, setReferences] = useState<Array<ReferenceImageSpec & { thumbnailUrl?: string; name?: string }>>(
    currentReferences.map(r => ({
      type: r.link_type,
      id: r.reference_image_id || r.approved_asset_id || 0,
      thumbnailUrl: r.thumbnailUrl,
      name: r.name,
    }))
  );

  // Library images for reference selection
  const [libraryImages, setLibraryImages] = useState<ReferenceImage[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);

  // Reset form when asset changes
  useEffect(() => {
    setPrompt(currentPrompt);
    setSettings(currentSettings || { temperature: 0.7, topK: 40, topP: 0.95 });
    setReferences(
      currentReferences.map(r => ({
        type: r.link_type,
        id: r.reference_image_id || r.approved_asset_id || 0,
        thumbnailUrl: r.thumbnailUrl,
        name: r.name,
      }))
    );
  }, [asset.id, currentPrompt, currentSettings, currentReferences]);

  // Load library images when references tab is selected
  useEffect(() => {
    if (activeTab === 'references' && libraryImages.length === 0) {
      loadLibraryImages();
    }
  }, [activeTab]);

  const loadLibraryImages = async () => {
    setLoadingLibrary(true);
    try {
      const images = await referenceLibraryApi.list();
      setLibraryImages(images);
    } catch (error) {
      console.error('Failed to load library:', error);
    } finally {
      setLoadingLibrary(false);
    }
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const result = await assetApi.regenerate(asset.id, {
        prompt: prompt !== currentPrompt ? prompt : undefined,
        custom_details: customDetails || undefined,
        reference_images: references.length > 0
          ? references.map(r => ({ type: r.type, id: r.id }))
          : undefined,
        generation_settings: settings,
        preserve_old: true,
      });

      if (result.success && result.newAssetId) {
        onRegenerate(result.newAssetId);
      } else {
        showToast(result.error || 'Regeneration failed', 'error');
      }
    } catch (error) {
      console.error('Regenerate error:', error);
      showToast(error instanceof Error ? error.message : 'Failed to regenerate', 'error');
    } finally {
      setIsRegenerating(false);
    }
  };

  const toggleReference = (ref: ReferenceImageSpec & { thumbnailUrl?: string; name?: string }) => {
    const exists = references.some(r => r.type === ref.type && r.id === ref.id);
    if (exists) {
      setReferences(references.filter(r => !(r.type === ref.type && r.id === ref.id)));
    } else {
      setReferences([...references, ref]);
    }
  };

  const applyPreset = (preset: keyof typeof PRESETS) => {
    const { temperature, topK, topP } = PRESETS[preset];
    setSettings({ ...settings, temperature, topK, topP });
  };

  const isPresetActive = (preset: keyof typeof PRESETS): boolean => {
    const { temperature, topK, topP } = PRESETS[preset];
    return (
      settings.temperature === temperature &&
      settings.topK === topK &&
      settings.topP === topP
    );
  };

  if (!isOpen) return null;

  const tabs: { id: TabType; label: string; icon: typeof Sparkles }[] = [
    { id: 'prompt', label: 'Prompt', icon: Sparkles },
    { id: 'references', label: 'References', icon: ImageIcon },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Regenerate: {asset.asset_key} v{asset.variant}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Creates a new version (v{asset.variant + 1}). Current version will be preserved.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Prompt Tab */}
          {activeTab === 'prompt' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Prompt
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full h-48 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Additional Details
                </label>
                <textarea
                  value={customDetails}
                  onChange={(e) => setCustomDetails(e.target.value)}
                  placeholder="Add specific requirements for this regeneration..."
                  className="w-full h-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm resize-none"
                />
              </div>
            </div>
          )}

          {/* References Tab */}
          {activeTab === 'references' && (
            <div className="space-y-4">
              {/* Selected References */}
              {references.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Selected References ({references.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {references.map((ref) => (
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
                          onClick={() => toggleReference(ref)}
                          className="text-red-500 hover:text-red-600 ml-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Library Images */}
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Reference Library
                </p>
                {loadingLibrary ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : libraryImages.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No reference images in library</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-3">
                    {libraryImages.map((image) => {
                      const isSelected = references.some(
                        (r) => r.type === 'library' && r.id === image.id
                      );
                      return (
                        <button
                          key={image.id}
                          onClick={() =>
                            toggleReference({
                              type: 'library',
                              id: image.id,
                              thumbnailUrl: image.thumbnailUrl,
                              name: image.name,
                            })
                          }
                          className={clsx(
                            'relative rounded-lg border-2 overflow-hidden transition-all text-left',
                            isSelected
                              ? 'border-purple-500 ring-2 ring-purple-500/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-400'
                          )}
                        >
                          <div className="aspect-square bg-gray-100 dark:bg-gray-800">
                            {image.thumbnailUrl ? (
                              <img
                                src={image.thumbnailUrl}
                                alt={image.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ImageIcon className="w-6 h-6 text-gray-400" />
                              </div>
                            )}
                            {isSelected && (
                              <div className="absolute inset-0 bg-purple-500/20 flex items-center justify-center">
                                <div className="bg-purple-500 rounded-full p-1">
                                  <svg
                                    className="w-4 h-4 text-white"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="p-1.5">
                            <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                              {image.name}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              {/* Presets */}
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Presets
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(PRESETS).map(([key, preset]) => {
                    const isActive = isPresetActive(key as keyof typeof PRESETS);
                    return (
                      <button
                        key={key}
                        onClick={() => applyPreset(key as keyof typeof PRESETS)}
                        className={clsx(
                          'p-3 border rounded-lg text-left transition-all',
                          isActive
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 ring-2 ring-purple-500'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-400'
                        )}
                      >
                        <span
                          className={clsx(
                            'font-medium text-sm',
                            isActive
                              ? 'text-purple-700 dark:text-purple-300'
                              : 'text-gray-700 dark:text-gray-200'
                          )}
                        >
                          {preset.label}
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {preset.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Temperature */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Temperature
                  </label>
                  <span className="text-sm font-mono text-purple-600 dark:text-purple-400">
                    {settings.temperature?.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={settings.temperature || 0.7}
                  onChange={(e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>Precise (0)</span>
                  <span>Creative (2)</span>
                </div>
              </div>

              {/* Top K */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Top K
                  </label>
                  <span className="text-sm font-mono text-purple-600 dark:text-purple-400">
                    {settings.topK}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  step="1"
                  value={settings.topK || 40}
                  onChange={(e) => setSettings({ ...settings, topK: parseInt(e.target.value) })}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>Focused (1)</span>
                  <span>Diverse (100)</span>
                </div>
              </div>

              {/* Top P */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Top P
                  </label>
                  <span className="text-sm font-mono text-purple-600 dark:text-purple-400">
                    {settings.topP?.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.topP || 0.95}
                  onChange={(e) => setSettings({ ...settings, topP: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>Narrow (0)</span>
                  <span>Wide (1)</span>
                </div>
              </div>

              {/* Image Settings */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <ImageIcon className="w-4 h-4 text-purple-600" />
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Image Settings
                  </p>
                </div>

                {/* Aspect Ratio */}
                <div className="mb-4">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Aspect Ratio
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {VALID_ASPECT_RATIOS.map((ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => setSettings({ ...settings, aspectRatio: ratio as AspectRatio })}
                        className={clsx(
                          'px-3 py-2 text-sm rounded-lg border transition-all',
                          settings.aspectRatio === ratio
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 ring-2 ring-purple-500'
                            : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-400'
                        )}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Image Size */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Image Size
                    </label>
                    <div className="flex items-center gap-1">
                      <Maximize2 className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Higher = more detail
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {VALID_IMAGE_SIZES.map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setSettings({ ...settings, imageSize: size as ImageSize })}
                        className={clsx(
                          'px-4 py-3 rounded-lg border transition-all text-center',
                          settings.imageSize === size
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 ring-2 ring-purple-500'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-400'
                        )}
                      >
                        <span className={clsx(
                          'font-medium',
                          settings.imageSize === size
                            ? 'text-purple-700 dark:text-purple-300'
                            : 'text-gray-700 dark:text-gray-200'
                        )}>
                          {size}
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {size === '1K' ? '1024px' : size === '2K' ? '2048px' : '4096px'}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 flex justify-between">
          <button
            onClick={onClose}
            disabled={isRegenerating}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {isRegenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Regenerating...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Regenerate
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
