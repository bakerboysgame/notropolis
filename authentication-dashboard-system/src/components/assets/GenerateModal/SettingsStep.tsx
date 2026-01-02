// src/components/assets/GenerateModal/SettingsStep.tsx

import { Sparkles, Target, Lightbulb, Info } from 'lucide-react';
import { clsx } from 'clsx';
import { GenerationSettings } from '../../../services/assetApi';
import { GenerateFormData } from './types';

interface SettingsStepProps {
  formData: GenerateFormData;
  updateFormData: (updates: Partial<GenerateFormData>) => void;
}

const PRESETS = {
  creative: {
    temperature: 1.2,
    topK: 60,
    topP: 0.98,
    label: 'Creative',
    description: 'More varied and experimental outputs',
    icon: Sparkles,
  },
  balanced: {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    label: 'Balanced',
    description: 'Good balance of creativity and consistency',
    icon: Target,
  },
  precise: {
    temperature: 0.3,
    topK: 20,
    topP: 0.85,
    label: 'Precise',
    description: 'More consistent and predictable outputs',
    icon: Lightbulb,
  },
};

export default function SettingsStep({
  formData,
  updateFormData,
}: SettingsStepProps) {
  const { generationSettings } = formData;

  const updateSettings = (updates: Partial<GenerationSettings>) => {
    updateFormData({
      generationSettings: { ...generationSettings, ...updates },
    });
  };

  const applyPreset = (preset: keyof typeof PRESETS) => {
    const { temperature, topK, topP } = PRESETS[preset];
    updateFormData({
      generationSettings: { ...generationSettings, temperature, topK, topP },
    });
  };

  const isPresetActive = (preset: keyof typeof PRESETS): boolean => {
    const { temperature, topK, topP } = PRESETS[preset];
    return (
      generationSettings.temperature === temperature &&
      generationSettings.topK === topK &&
      generationSettings.topP === topP
    );
  };

  return (
    <div className="space-y-6">
      {/* Presets */}
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Presets
        </p>
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(PRESETS).map(([key, preset]) => {
            const Icon = preset.icon;
            const isActive = isPresetActive(key as keyof typeof PRESETS);

            return (
              <button
                key={key}
                type="button"
                onClick={() => applyPreset(key as keyof typeof PRESETS)}
                className={clsx(
                  'p-4 border rounded-lg text-left transition-all',
                  isActive
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 ring-2 ring-purple-500'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-400'
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon
                    className={clsx(
                      'w-4 h-4',
                      isActive
                        ? 'text-purple-600 dark:text-purple-400'
                        : 'text-gray-500 dark:text-gray-400'
                    )}
                  />
                  <span
                    className={clsx(
                      'font-medium',
                      isActive
                        ? 'text-purple-700 dark:text-purple-300'
                        : 'text-gray-700 dark:text-gray-200'
                    )}
                  >
                    {preset.label}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {preset.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Temperature Slider */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Temperature
          </label>
          <span className="text-sm font-mono text-purple-600 dark:text-purple-400">
            {generationSettings.temperature?.toFixed(2)}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={generationSettings.temperature || 0.7}
          onChange={(e) => updateSettings({ temperature: parseFloat(e.target.value) })}
          className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
        />
        <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-1">
          <span>Precise (0)</span>
          <span>Creative (2)</span>
        </div>
      </div>

      {/* Top K Slider */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Top K
          </label>
          <span className="text-sm font-mono text-purple-600 dark:text-purple-400">
            {generationSettings.topK}
          </span>
        </div>
        <input
          type="range"
          min="1"
          max="100"
          step="1"
          value={generationSettings.topK || 40}
          onChange={(e) => updateSettings({ topK: parseInt(e.target.value) })}
          className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
        />
        <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-1">
          <span>Focused (1)</span>
          <span>Diverse (100)</span>
        </div>
      </div>

      {/* Top P Slider */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Top P
          </label>
          <span className="text-sm font-mono text-purple-600 dark:text-purple-400">
            {generationSettings.topP?.toFixed(2)}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={generationSettings.topP || 0.95}
          onChange={(e) => updateSettings({ topP: parseFloat(e.target.value) })}
          className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
        />
        <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-1">
          <span>Narrow (0)</span>
          <span>Wide (1)</span>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-gray-500 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              About these settings
            </p>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li>
                <strong className="text-gray-700 dark:text-gray-300">Temperature:</strong>{' '}
                Controls randomness. Higher values produce more creative but less
                consistent results.
              </li>
              <li>
                <strong className="text-gray-700 dark:text-gray-300">Top K:</strong>{' '}
                Limits vocabulary choices. Lower values produce more focused output.
              </li>
              <li>
                <strong className="text-gray-700 dark:text-gray-300">Top P:</strong>{' '}
                Nucleus sampling threshold. Lower values are more deterministic.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
