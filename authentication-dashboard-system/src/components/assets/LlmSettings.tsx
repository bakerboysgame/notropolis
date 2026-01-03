// src/components/assets/LlmSettings.tsx
import { useState, useEffect } from 'react';
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  Edit2,
  Save,
  Users,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { clsx } from 'clsx';
import {
  llmSettingsApi,
  LlmSettingsGroup,
  LlmSettingsTemplate,
} from '../../services/assetApi';
import { useToast } from '../ui/Toast';

// Badge for category display
function CategoryBadge({ category }: { category: string }) {
  const colorMap: Record<string, string> = {
    building_sprite: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    building_ref: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    terrain: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    terrain_ref: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    effect: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    effect_ref: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    npc: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    avatar: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
    scene: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    _global: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  };

  return (
    <span className={clsx(
      'px-2 py-0.5 rounded text-xs font-medium',
      colorMap[category] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    )}>
      {category.replace('_', ' ')}
    </span>
  );
}

// Editor for template prompts
function TemplateEditor({
  template,
  systemInstructions,
  onSave,
  onCancel,
  saving,
}: {
  template: LlmSettingsTemplate;
  systemInstructions: string;
  onSave: (updates: { base_prompt?: string; system_instructions?: string }) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [basePrompt, setBasePrompt] = useState(template.base_prompt);
  const [sysInstructions, setSysInstructions] = useState(systemInstructions);
  const [activeTab, setActiveTab] = useState<'prompt' | 'system'>('prompt');

  const handleSave = () => {
    const updates: { base_prompt?: string; system_instructions?: string } = {};
    if (basePrompt !== template.base_prompt) updates.base_prompt = basePrompt;
    if (sysInstructions !== systemInstructions) updates.system_instructions = sysInstructions;
    onSave(updates);
  };

  const hasChanges = basePrompt !== template.base_prompt || sysInstructions !== systemInstructions;

  return (
    <div className="mt-4 border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
        <button
          onClick={() => setActiveTab('prompt')}
          className={clsx(
            'px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'prompt'
              ? 'text-blue-700 dark:text-blue-300 border-b-2 border-blue-500 bg-white dark:bg-gray-800'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          )}
        >
          <FileText className="w-4 h-4 inline-block mr-1.5" />
          Base Prompt
        </button>
        <button
          onClick={() => setActiveTab('system')}
          className={clsx(
            'px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'system'
              ? 'text-blue-700 dark:text-blue-300 border-b-2 border-blue-500 bg-white dark:bg-gray-800'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          )}
        >
          <Users className="w-4 h-4 inline-block mr-1.5" />
          System Instructions
        </button>
      </div>

      {/* Content */}
      <div className="p-4 bg-white dark:bg-gray-800">
        {activeTab === 'prompt' && (
          <textarea
            value={basePrompt}
            onChange={(e) => setBasePrompt(e.target.value)}
            className="w-full h-48 p-3 text-sm font-mono border rounded-md
                       dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200
                       focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter base prompt..."
          />
        )}
        {activeTab === 'system' && (
          <textarea
            value={sysInstructions}
            onChange={(e) => setSysInstructions(e.target.value)}
            className="w-full h-48 p-3 text-sm font-mono border rounded-md
                       dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200
                       focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter system instructions..."
          />
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800
                       dark:text-gray-400 dark:hover:text-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className={clsx(
              'px-4 py-1.5 text-sm font-medium rounded-md flex items-center gap-1.5',
              hasChanges
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
            )}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Shared system instructions editor
function SharedEditor({
  group,
  onSave,
  onCancel,
  saving,
}: {
  group: LlmSettingsGroup;
  onSave: (newSystemInstructions: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [sysInstructions, setSysInstructions] = useState(group.system_instructions);
  const hasChanges = sysInstructions !== group.system_instructions;

  return (
    <div className="mt-4 border border-orange-200 dark:border-orange-800 rounded-lg overflow-hidden">
      <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border-b border-orange-200 dark:border-orange-800">
        <div className="flex items-center gap-2 text-orange-800 dark:text-orange-300">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm font-medium">
            Editing shared system instructions for {group.template_count} templates
          </span>
        </div>
        <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
          Changes will be applied to: {group.templates.map(t => `${t.category}/${t.asset_key}`).join(', ')}
        </p>
      </div>

      <div className="p-4 bg-white dark:bg-gray-800">
        <textarea
          value={sysInstructions}
          onChange={(e) => setSysInstructions(e.target.value)}
          className="w-full h-64 p-3 text-sm font-mono border rounded-md
                     dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200
                     focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          placeholder="Enter shared system instructions..."
        />

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800
                       dark:text-gray-400 dark:hover:text-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(sysInstructions)}
            disabled={saving || !hasChanges}
            className={clsx(
              'px-4 py-1.5 text-sm font-medium rounded-md flex items-center gap-1.5',
              hasChanges
                ? 'bg-orange-600 text-white hover:bg-orange-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
            )}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Updating {group.template_count} templates...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Update All ({group.template_count})
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Single template row
function TemplateRow({
  template,
  systemInstructions,
  onEdit,
  isEditing,
  onSaveEdit,
  onCancelEdit,
  saving,
}: {
  template: LlmSettingsTemplate;
  systemInstructions: string;
  onEdit: () => void;
  isEditing: boolean;
  onSaveEdit: (updates: { base_prompt?: string; system_instructions?: string }) => void;
  onCancelEdit: () => void;
  saving: boolean;
}) {
  return (
    <div className="border-b border-gray-100 dark:border-gray-700 last:border-b-0">
      <div className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <CategoryBadge category={template.category} />
          <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
            {template.asset_key}
          </span>
          {template.template_name && (
            <span className="text-sm text-gray-500 dark:text-gray-400 truncate">
              ({template.template_name})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">v{template.version}</span>
          {!isEditing && (
            <button
              onClick={onEdit}
              className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400
                         hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
              title="Edit template"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {isEditing && (
        <div className="px-3 pb-3">
          <TemplateEditor
            template={template}
            systemInstructions={systemInstructions}
            onSave={onSaveEdit}
            onCancel={onCancelEdit}
            saving={saving}
          />
        </div>
      )}
    </div>
  );
}

// Group component
function SettingsGroup({
  group,
  onRefresh,
}: {
  group: LlmSettingsGroup;
  onRefresh: () => void;
}) {
  const { showToast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<number | null>(null);
  const [editingShared, setEditingShared] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSaveTemplate = async (
    templateId: number,
    updates: { base_prompt?: string; system_instructions?: string }
  ) => {
    if (Object.keys(updates).length === 0) return;

    try {
      setSaving(true);
      await llmSettingsApi.updateTemplate(templateId, updates);
      showToast('Template updated successfully', 'success');
      setEditingTemplate(null);
      onRefresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to update template', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveShared = async (newSystemInstructions: string) => {
    try {
      setSaving(true);
      const templateIds = group.templates.map(t => t.id);
      const result = await llmSettingsApi.updateShared(
        templateIds,
        newSystemInstructions,
        'Updated via LLM Settings bulk edit'
      );
      showToast(result.message, 'success');
      setEditingShared(false);
      onRefresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to update templates', 'error');
    } finally {
      setSaving(false);
    }
  };

  const previewText = group.system_instructions
    ? group.system_instructions.substring(0, 100) + (group.system_instructions.length > 100 ? '...' : '')
    : '(No system instructions)';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div
        className={clsx(
          'flex items-center gap-3 p-4 cursor-pointer transition-colors',
          'hover:bg-gray-50 dark:hover:bg-gray-700/50',
          group.is_shared && 'bg-orange-50/50 dark:bg-orange-900/10'
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <button className="flex-shrink-0">
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {group.is_shared && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-800
                             dark:bg-orange-900/30 dark:text-orange-300 rounded text-xs font-medium">
                <Users className="w-3 h-3" />
                Shared ({group.template_count})
              </span>
            )}
            {group.categories.map(cat => (
              <CategoryBadge key={cat} category={cat} />
            ))}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate font-mono">
            {previewText}
          </p>
        </div>

        {group.is_shared && !editingShared && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditingShared(true);
              setExpanded(true);
            }}
            className="flex-shrink-0 px-3 py-1.5 text-sm font-medium text-orange-600
                       hover:bg-orange-100 dark:text-orange-400 dark:hover:bg-orange-900/30
                       rounded-md flex items-center gap-1.5"
          >
            <Edit2 className="w-4 h-4" />
            Edit Shared
          </button>
        )}
      </div>

      {/* Shared editor */}
      {editingShared && (
        <div className="px-4 pb-4">
          <SharedEditor
            group={group}
            onSave={handleSaveShared}
            onCancel={() => setEditingShared(false)}
            saving={saving}
          />
        </div>
      )}

      {/* Template list */}
      {expanded && !editingShared && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          {group.templates.map((template) => (
            <TemplateRow
              key={template.id}
              template={template}
              systemInstructions={group.system_instructions}
              onEdit={() => setEditingTemplate(template.id)}
              isEditing={editingTemplate === template.id}
              onSaveEdit={(updates) => handleSaveTemplate(template.id, updates)}
              onCancelEdit={() => setEditingTemplate(null)}
              saving={saving}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Main component
export function LlmSettings() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<LlmSettingsGroup[]>([]);
  const [totalTemplates, setTotalTemplates] = useState(0);
  const [filter, setFilter] = useState<string>('all');

  const loadSettings = async (isInitialLoad = true) => {
    try {
      if (isInitialLoad) {
        setLoading(true);
      }
      const data = await llmSettingsApi.getAll();
      setGroups(data.groups);
      setTotalTemplates(data.total_templates);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to load settings', 'error');
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      }
    }
  };

  // Background refresh that doesn't show loading spinner
  const refreshSettings = () => loadSettings(false);

  useEffect(() => {
    loadSettings(true);
  }, []);

  // Get unique categories for filter
  const allCategories = [...new Set(groups.flatMap(g => g.categories))].sort();

  // Filter groups
  const filteredGroups = filter === 'all'
    ? groups
    : filter === 'shared'
      ? groups.filter(g => g.is_shared)
      : groups.filter(g => g.categories.includes(filter));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              LLM Settings
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              View and edit all prompt templates. Shared system instructions are grouped together.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {totalTemplates} templates in {groups.length} groups
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            onClick={() => setFilter('all')}
            className={clsx(
              'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              filter === 'all'
                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400'
            )}
          >
            All
          </button>
          <button
            onClick={() => setFilter('shared')}
            className={clsx(
              'px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1',
              filter === 'shared'
                ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400'
            )}
          >
            <Users className="w-3.5 h-3.5" />
            Shared Only
          </button>
          {allCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={clsx(
                'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                filter === cat
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400'
              )}
            >
              {cat.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Groups */}
      <div className="space-y-4">
        {filteredGroups.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400">
              No templates match the current filter.
            </p>
          </div>
        ) : (
          filteredGroups.map((group) => (
            <SettingsGroup
              key={group.group_id}
              group={group}
              onRefresh={refreshSettings}
            />
          ))
        )}
      </div>
    </div>
  );
}
