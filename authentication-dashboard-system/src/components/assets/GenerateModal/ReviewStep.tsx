// src/components/assets/GenerateModal/ReviewStep.tsx

import { FileText, Image, Settings2, Tag, Layers, Link, Zap } from 'lucide-react';
import { clsx } from 'clsx';
import { GenerateFormData, SPRITE_TO_REF_CATEGORY } from './types';

interface ReviewStepProps {
  formData: GenerateFormData;
  updateFormData: (updates: Partial<GenerateFormData>) => void;
  isPedestrianSprite?: boolean;
}

export default function ReviewStep({ formData, updateFormData, isPedestrianSprite }: ReviewStepProps) {
  const {
    category,
    assetKey,
    variant,
    prompt,
    customDetails,
    referenceImages,
    generationSettings,
    parentAssetId,
    spriteVariant,
  } = formData;

  const isSprite = category ? !!SPRITE_TO_REF_CATEGORY[category] : false;

  const formatKey = (key: string) => {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="space-y-6">
      <div className="text-center pb-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Review Generation
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Please review the settings below before generating
        </p>
      </div>

      {/* Basic Info */}
      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          <Tag className="w-4 h-4" />
          Asset Details
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Category</p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {category ? formatKey(category) : '-'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Asset Key</p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {assetKey ? formatKey(assetKey) : '-'}
            </p>
          </div>
          {variant && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Variant</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {variant}
              </p>
            </div>
          )}
          {isSprite && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Type</p>
              <p className="text-sm font-medium text-purple-600 dark:text-purple-400">
                Sprite
              </p>
            </div>
          )}
        </div>

        {/* Parent Reference (for sprites) */}
        {isSprite && parentAssetId && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <Link className="w-4 h-4 text-purple-500" />
              <p className="text-xs text-gray-500 dark:text-gray-400">Parent Reference</p>
            </div>
            <p className="text-sm font-medium text-purple-600 dark:text-purple-400">
              #{parentAssetId}
              {spriteVariant && (
                <span className="ml-2 text-gray-500 dark:text-gray-400">
                  ({spriteVariant} variant)
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Prompt Preview */}
      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          <FileText className="w-4 h-4" />
          Prompt Preview
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-3 max-h-32 overflow-y-auto">
          {prompt ? (
            <pre className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap font-mono">
              {prompt.slice(0, 500)}
              {prompt.length > 500 && '...'}
            </pre>
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500 italic">
              Using default system prompt
            </p>
          )}
        </div>
        {customDetails && (
          <div className="mt-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Additional Details:
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {customDetails}
            </p>
          </div>
        )}
      </div>

      {/* Reference Images */}
      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          <Image className="w-4 h-4" />
          Reference Images ({referenceImages.length})
        </div>
        {referenceImages.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {referenceImages.map((ref) => (
              <div
                key={`${ref.type}-${ref.id}`}
                className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5"
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
                <span
                  className={clsx(
                    'text-xs px-1.5 py-0.5 rounded',
                    ref.type === 'library'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  )}
                >
                  {ref.type}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">
            No additional reference images selected
          </p>
        )}
        {isSprite && parentAssetId && (
          <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
            + Parent reference sheet will be automatically included
          </p>
        )}
      </div>

      {/* Generation Settings */}
      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          <Settings2 className="w-4 h-4" />
          Generation Settings
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Temperature</p>
            <p className="text-lg font-mono font-semibold text-gray-900 dark:text-gray-100">
              {generationSettings.temperature?.toFixed(1)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Top K</p>
            <p className="text-lg font-mono font-semibold text-gray-900 dark:text-gray-100">
              {generationSettings.topK}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Top P</p>
            <p className="text-lg font-mono font-semibold text-gray-900 dark:text-gray-100">
              {generationSettings.topP?.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Batch Generation Option for Pedestrians */}
      {isPedestrianSprite && (
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <div>
                <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
                  Generate Both Walk Frames
                </p>
                <p className="text-xs text-purple-600 dark:text-purple-400">
                  Creates walk_1 and walk_2 in a single API call (saves 50% API usage)
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => updateFormData({ generateBothFrames: !formData.generateBothFrames })}
              className={clsx(
                'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-600 focus:ring-offset-2',
                formData.generateBothFrames
                  ? 'bg-purple-600'
                  : 'bg-gray-200 dark:bg-gray-600'
              )}
            >
              <span
                className={clsx(
                  'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                  formData.generateBothFrames ? 'translate-x-5' : 'translate-x-0'
                )}
              />
            </button>
          </div>
          {formData.generateBothFrames && (
            <div className="mt-3 text-xs text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/40 rounded p-2">
              Will generate 2 separate images: Frame 1 (right leg forward) and Frame 2 (left leg forward)
            </div>
          )}
        </div>
      )}

      {/* Ready message */}
      <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
        <Layers className="w-6 h-6 text-green-600 dark:text-green-400 mx-auto mb-2" />
        <p className="text-sm font-medium text-green-700 dark:text-green-300">
          Ready to generate!
        </p>
        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
          {isPedestrianSprite && formData.generateBothFrames
            ? 'Click Generate to create both walk frames in 1 API call'
            : 'Click the Generate button below to start'}
        </p>
      </div>
    </div>
  );
}
