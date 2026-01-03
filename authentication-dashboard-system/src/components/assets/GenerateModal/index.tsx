// src/components/assets/GenerateModal/index.tsx

import { useState, useEffect, useRef } from 'react';
import { X, Wand2, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import { AssetCategory, assetApi } from '../../../services/assetApi';
import { useToast } from '../../ui/Toast';
import CategoryStep from './CategoryStep';
import PromptEditorStep from './PromptEditorStep';
import ReferenceImagesStep from './ReferenceImagesStep';
import SettingsStep from './SettingsStep';
import ReviewStep from './ReviewStep';
import { GenerateFormData, Step, DEFAULT_GENERATION_SETTINGS, getDefaultAspectRatioForCategory } from './types';

interface GenerateModalProps {
  onClose: () => void;
  onSuccess: () => void;
  initialCategory?: AssetCategory;
  parentAsset?: { id: string; asset_key: string };
}

const STEPS: Step[] = [
  { id: 'category', title: 'Category', description: 'Select asset type' },
  { id: 'prompt', title: 'Prompt', description: 'Edit generation prompt' },
  { id: 'references', title: 'References', description: 'Add reference images' },
  { id: 'settings', title: 'Settings', description: 'Generation settings' },
  { id: 'review', title: 'Review', description: 'Review and generate' },
];

export function GenerateModal({
  onClose,
  onSuccess,
  initialCategory,
  parentAsset,
}: GenerateModalProps) {
  const { showToast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  const [formData, setFormData] = useState<GenerateFormData>({
    category: initialCategory || '',
    assetKey: parentAsset?.asset_key || '',
    variant: undefined,
    prompt: '',
    customDetails: '',
    systemInstructions: '',
    referenceImages: [],
    generationSettings: { ...DEFAULT_GENERATION_SETTINGS },
    parentAssetId: parentAsset ? parseInt(parentAsset.id) : undefined,
    spriteVariant: undefined,
  });

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Apply category-specific defaults when category changes
  useEffect(() => {
    if (formData.category) {
      const defaultAspectRatio = getDefaultAspectRatioForCategory(formData.category);
      setFormData(prev => ({
        ...prev,
        generationSettings: {
          ...prev.generationSettings,
          aspectRatio: defaultAspectRatio,
          imageSize: '4K',
        },
      }));
    }
  }, [formData.category]);

  // Auto-add parent reference when generating sprite from approved ref
  const parentRefLoaded = useRef(false);
  useEffect(() => {
    if (!parentAsset || parentRefLoaded.current) return;
    parentRefLoaded.current = true;

    const loadParentReference = async () => {
      try {
        // Fetch the thumbnail URL for the parent asset
        const { url } = await assetApi.getPreviewUrl(parentAsset.id);

        // Format the asset key for display
        const name = parentAsset.asset_key
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

        // Auto-add to reference images
        setFormData(prev => ({
          ...prev,
          referenceImages: [
            {
              type: 'approved_asset',
              id: parseInt(parentAsset.id),
              thumbnailUrl: url,
              name: `${name} (Reference Sheet)`,
            },
            ...prev.referenceImages,
          ],
        }));
      } catch (error) {
        console.error('Failed to load parent reference:', error);
      }
    };

    loadParentReference();
  }, [parentAsset]);

  // Note: We always start at step 0 (Category) even if category is pre-filled
  // This allows the user to review/change the category selection

  const updateFormData = (updates: Partial<GenerateFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleStepClick = (index: number) => {
    // Only allow clicking to previous steps or current step
    if (index <= currentStep) {
      setCurrentStep(index);
    }
  };

  const canProceed = () => {
    switch (STEPS[currentStep].id) {
      case 'category':
        return !!formData.category && !!formData.assetKey;
      case 'prompt':
        return true; // Prompt is optional
      case 'references':
        return true; // References are optional
      case 'settings':
        return true; // Settings have defaults
      case 'review':
        return true;
      default:
        return true;
    }
  };

  const handleGenerate = async () => {
    if (!formData.category) {
      showToast('Please select a category', 'error');
      return;
    }

    setIsGenerating(true);
    try {
      const result = await assetApi.generate({
        category: formData.category as AssetCategory,
        asset_key: formData.assetKey || formData.category,
        variant: formData.variant,
        prompt: formData.prompt || undefined,
        custom_details: formData.customDetails || undefined,
        system_instructions: formData.systemInstructions || undefined,
        reference_images: formData.referenceImages.length > 0
          ? formData.referenceImages.map(ref => ({
              type: ref.type,
              id: ref.id,
            }))
          : undefined,
        generation_settings: formData.generationSettings,
        parent_asset_id: formData.parentAssetId,
        sprite_variant: formData.spriteVariant,
      });

      showToast(
        `Generation started for ${formData.assetKey || formData.category}`,
        'success'
      );

      if (result.used_reference_image) {
        showToast('Using approved reference sheet', 'info');
      }

      onSuccess();
      onClose();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to generate',
        'error'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const renderStep = () => {
    const props = { formData, updateFormData };

    switch (STEPS[currentStep].id) {
      case 'category':
        return (
          <CategoryStep
            {...props}
            // Don't lock - let user change category even if pre-filled
          />
        );
      case 'prompt':
        return <PromptEditorStep {...props} />;
      case 'references':
        return <ReferenceImagesStep {...props} />;
      case 'settings':
        return <SettingsStep {...props} />;
      case 'review':
        return <ReviewStep {...props} />;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Generate Asset
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress */}
        <div className="px-6 pt-4 pb-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <button
                  onClick={() => handleStepClick(index)}
                  disabled={index > currentStep}
                  className={clsx(
                    'flex items-center gap-2 group',
                    index > currentStep && 'cursor-not-allowed opacity-50'
                  )}
                >
                  <div
                    className={clsx(
                      'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                      index < currentStep
                        ? 'bg-purple-600 text-white'
                        : index === currentStep
                        ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 ring-2 ring-purple-600'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    )}
                  >
                    {index < currentStep ? '✓' : index + 1}
                  </div>
                  <div className="hidden md:block">
                    <p
                      className={clsx(
                        'text-sm font-medium',
                        index === currentStep
                          ? 'text-purple-700 dark:text-purple-300'
                          : 'text-gray-600 dark:text-gray-400'
                      )}
                    >
                      {step.title}
                    </p>
                  </div>
                </button>
                {index < STEPS.length - 1 && (
                  <div
                    className={clsx(
                      'flex-1 h-0.5 mx-2',
                      index < currentStep
                        ? 'bg-purple-600'
                        : 'bg-gray-200 dark:bg-gray-700'
                    )}
                  />
                )}
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
            Step {currentStep + 1}: {STEPS[currentStep].description}
          </p>
        </div>

        {/* Step Content */}
        <div className="flex-1 p-6 overflow-y-auto min-h-[400px]">
          {renderStep()}
        </div>

        {/* Footer with Navigation */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={currentStep === 0 ? onClose : handleBack}
            className="flex items-center gap-1 px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
          >
            {currentStep > 0 && <ChevronLeft className="w-4 h-4" />}
            {currentStep === 0 ? 'Cancel' : 'Back'}
          </button>

          <div className="flex gap-2">
            {currentStep < STEPS.length - 1 ? (
              <button
                onClick={handleNext}
                disabled={!canProceed()}
                className="flex items-center gap-1 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !canProceed()}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    Generate
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default GenerateModal;
