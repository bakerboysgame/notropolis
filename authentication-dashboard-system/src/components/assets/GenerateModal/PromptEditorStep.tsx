// src/components/assets/GenerateModal/PromptEditorStep.tsx

import { useState, useEffect } from 'react';
import { Loader2, RotateCcw, Save, FileText, Info } from 'lucide-react';
import { clsx } from 'clsx';
import { promptTemplateApi, PromptTemplate } from '../../../services/assetApi';
import { useToast } from '../../ui/Toast';
import { GenerateFormData } from './types';

interface PromptEditorStepProps {
  formData: GenerateFormData;
  updateFormData: (updates: Partial<GenerateFormData>) => void;
}

export default function PromptEditorStep({
  formData,
  updateFormData,
}: PromptEditorStepProps) {
  const { showToast } = useToast();
  const [template, setTemplate] = useState<PromptTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasPromptChanged, setHasPromptChanged] = useState(false);

  const { category, assetKey, prompt, customDetails } = formData;

  // Load template when category/assetKey changes
  useEffect(() => {
    if (category && assetKey) {
      loadTemplate();
    }
  }, [category, assetKey]);

  // Track if prompt has been modified from template
  useEffect(() => {
    if (template && prompt !== template.basePrompt) {
      setHasPromptChanged(true);
    } else {
      setHasPromptChanged(false);
    }
  }, [prompt, template]);

  const loadTemplate = async () => {
    if (!category || !assetKey) return;
    setIsLoading(true);
    try {
      const tmpl = await promptTemplateApi.get(category, assetKey);
      setTemplate(tmpl);
      // Set prompt if not already set
      if (!prompt) {
        updateFormData({ prompt: tmpl.basePrompt });
      }
    } catch (error) {
      console.error('Failed to load template:', error);
      // Template might not exist - that's ok
      setTemplate(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetToDefault = () => {
    if (template) {
      updateFormData({ prompt: template.basePrompt });
      setHasPromptChanged(false);
      showToast('Prompt reset to default template', 'info');
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!prompt || !category || !assetKey) return;
    setIsSaving(true);
    try {
      await promptTemplateApi.update(category, assetKey, {
        basePrompt: prompt,
        styleGuide: template?.styleGuide,
        changeNotes: 'Updated from Generate Modal',
      });
      showToast('Template saved successfully!', 'success');
      // Reload to get new version
      await loadTemplate();
      setHasPromptChanged(false);
    } catch (error) {
      console.error('Failed to save template:', error);
      showToast('Failed to save template', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin mb-3" />
        <p>Loading prompt template...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-gray-500" />
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Generation Prompt
          </label>
          {template && (
            <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
              v{template.version}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetToDefault}
            disabled={!template || !hasPromptChanged}
            className={clsx(
              'flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors',
              hasPromptChanged
                ? 'text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30'
                : 'text-gray-400 cursor-not-allowed'
            )}
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <button
            type="button"
            onClick={handleSaveAsTemplate}
            disabled={isSaving || !hasPromptChanged}
            className={clsx(
              'flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors',
              hasPromptChanged
                ? 'text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/30'
                : 'text-gray-400 cursor-not-allowed'
            )}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isSaving ? 'Saving...' : 'Save as Template'}
          </button>
        </div>
      </div>

      {/* Prompt textarea */}
      <textarea
        value={prompt}
        onChange={(e) => updateFormData({ prompt: e.target.value })}
        className="w-full h-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm font-mono resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        placeholder="Enter the generation prompt..."
      />

      {/* Style guide info */}
      {template?.styleGuide && (
        <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-gray-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Style Guide
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {template.styleGuide}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Custom details */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Additional Details
          <span className="text-gray-400 font-normal ml-1">(optional)</span>
        </label>
        <textarea
          value={customDetails}
          onChange={(e) => updateFormData({ customDetails: e.target.value })}
          className="w-full h-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          placeholder="Add any specific requirements or notes that will be appended to the prompt..."
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          These details will be appended to the main prompt during generation.
        </p>
      </div>

      {/* No template warning */}
      {!template && !isLoading && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            No saved template found for this category/asset combination. Enter a custom prompt or it will use the default system prompt.
          </p>
        </div>
      )}
    </div>
  );
}
