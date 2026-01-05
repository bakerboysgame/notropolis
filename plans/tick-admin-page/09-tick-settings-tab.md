# Stage 9: Tick Settings Tab

## Objective
Build the Tick Settings tab with grouped settings form, validation, save/reset functionality, and change log viewer.

## Dependencies
`[Requires: Stage 7 complete]` (TickAdminPage shell)
`[Requires: Stage 6 complete]` (Types, API service, SETTING_DEFINITIONS)

## Complexity
**Medium** — Form with grouped sections, validation, change tracking, log viewer

## Files to Create

### 1. `authentication-dashboard-system/src/components/admin/TickSettingsTab.tsx`
Main settings tab component.

### 2. `authentication-dashboard-system/src/components/admin/TickSettingsForm.tsx`
Form component with grouped setting inputs.

### 3. `authentication-dashboard-system/src/components/admin/TickSettingsLog.tsx`
Change log viewer component.

### 4. `authentication-dashboard-system/src/components/admin/SettingInput.tsx`
Individual setting input component with validation.

## Files to Modify

### `authentication-dashboard-system/src/pages/admin/TickAdminPage.tsx`
Replace placeholder with actual TickSettingsTab component.

## Implementation Details

### TickSettingsTab.tsx

```tsx
// src/components/admin/TickSettingsTab.tsx

import React, { useState, useEffect } from 'react';
import { tickAdminApi } from '../../services/tickAdminApi';
import { useToast } from '../../contexts/ToastContext';
import type { TickSettingsResponse } from '../../types/tick';
import TickSettingsForm from './TickSettingsForm';
import TickSettingsLog from './TickSettingsLog';

interface TickSettingsTabProps {
  onRefresh: () => void;
}

type SubTab = 'settings' | 'log';

const TickSettingsTab: React.FC<TickSettingsTabProps> = ({ onRefresh }) => {
  const { showToast } = useToast();
  const [subTab, setSubTab] = useState<SubTab>('settings');
  const [data, setData] = useState<TickSettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await tickAdminApi.getSettings();
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (updates: Record<string, number>) => {
    try {
      const result = await tickAdminApi.updateSettings(updates);
      showToast(`Updated ${result.updated.length} setting(s)`, 'success');
      fetchSettings(); // Refresh to get new metadata
      onRefresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save', 'error');
      throw err;
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset ALL settings to defaults? This cannot be undone.')) {
      return;
    }
    try {
      await tickAdminApi.resetSettings();
      showToast('All settings reset to defaults', 'success');
      fetchSettings();
      onRefresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to reset', 'error');
    }
  };

  if (loading && !data) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500">{error}</p>
        <button
          onClick={fetchSettings}
          className="mt-4 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Sub-tab navigation */}
      <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setSubTab('settings')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            subTab === 'settings'
              ? 'border-purple-500 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Configure Settings
        </button>
        <button
          onClick={() => setSubTab('log')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            subTab === 'log'
              ? 'border-purple-500 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Change Log
        </button>
      </div>

      {/* Sub-tab content */}
      {subTab === 'settings' && data && (
        <TickSettingsForm
          settings={data.settings}
          defaults={data.defaults}
          metadata={data.metadata}
          onSave={handleSave}
          onReset={handleReset}
        />
      )}
      {subTab === 'log' && <TickSettingsLog />}
    </div>
  );
};

export default TickSettingsTab;
```

### TickSettingsForm.tsx

```tsx
// src/components/admin/TickSettingsForm.tsx

import React, { useState, useMemo } from 'react';
import { Save, RotateCcw, AlertTriangle } from 'lucide-react';
import type { TickSettings, TickSettingsMetadata, SettingCategory } from '../../types/tick';
import { SETTINGS_BY_CATEGORY, CATEGORY_LABELS } from '../../types/tick';
import SettingInput from './SettingInput';

interface TickSettingsFormProps {
  settings: TickSettings;
  defaults: TickSettings;
  metadata: TickSettingsMetadata;
  onSave: (updates: Record<string, number>) => Promise<void>;
  onReset: () => Promise<void>;
}

const TickSettingsForm: React.FC<TickSettingsFormProps> = ({
  settings,
  defaults,
  metadata,
  onSave,
  onReset,
}) => {
  const [localSettings, setLocalSettings] = useState<TickSettings>({ ...settings });
  const [saving, setSaving] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<SettingCategory>>(
    new Set(['fire', 'tax'])
  );

  // Track which settings have changed
  const changedSettings = useMemo(() => {
    const changes: Record<string, number> = {};
    for (const key of Object.keys(localSettings) as (keyof TickSettings)[]) {
      if (localSettings[key] !== settings[key]) {
        changes[key] = localSettings[key];
      }
    }
    return changes;
  }, [localSettings, settings]);

  const hasChanges = Object.keys(changedSettings).length > 0;

  const handleChange = (key: keyof TickSettings, value: number) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!hasChanges) return;
    setSaving(true);
    try {
      await onSave(changedSettings);
      // Update local state to match saved
      setLocalSettings({ ...settings, ...changedSettings });
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setLocalSettings({ ...settings });
  };

  const toggleCategory = (category: SettingCategory) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const categories = Object.keys(SETTINGS_BY_CATEGORY) as SettingCategory[];

  return (
    <div className="space-y-6">
      {/* Metadata */}
      {metadata.updated_at && (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Last updated: {new Date(metadata.updated_at).toLocaleString()}
          {metadata.updated_by_email && ` by ${metadata.updated_by_email}`}
        </div>
      )}

      {/* Unsaved changes warning */}
      {hasChanges && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600" />
          <span className="text-yellow-800 dark:text-yellow-200">
            You have {Object.keys(changedSettings).length} unsaved change(s)
          </span>
          <div className="ml-auto flex gap-2">
            <button
              onClick={handleDiscard}
              className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900"
            >
              Discard
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Settings by category */}
      <div className="space-y-4">
        {categories.map((category) => {
          const { label, icon } = CATEGORY_LABELS[category];
          const categorySettings = SETTINGS_BY_CATEGORY[category];
          const isExpanded = expandedCategories.has(category);

          // Count changes in this category
          const categoryChanges = categorySettings.filter(
            s => changedSettings[s.key] !== undefined
          ).length;

          return (
            <div
              key={category}
              className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
            >
              {/* Category header */}
              <button
                onClick={() => toggleCategory(category)}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <span className="flex items-center gap-2 font-medium text-gray-900 dark:text-white">
                  <span>{icon}</span>
                  {label}
                  {categoryChanges > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-xs rounded">
                      {categoryChanges} changed
                    </span>
                  )}
                </span>
                <span className="text-gray-400">
                  {isExpanded ? '−' : '+'}
                </span>
              </button>

              {/* Category settings */}
              {isExpanded && (
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {categorySettings.map((def) => (
                    <SettingInput
                      key={def.key}
                      definition={def}
                      value={localSettings[def.key]}
                      defaultValue={defaults[def.key]}
                      originalValue={settings[def.key]}
                      onChange={(value) => handleChange(def.key, value)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="flex justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Reset All to Defaults
        </button>

        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};

export default TickSettingsForm;
```

### SettingInput.tsx

```tsx
// src/components/admin/SettingInput.tsx

import React from 'react';
import { RotateCcw } from 'lucide-react';
import type { SettingDefinition } from '../../types/tick';

interface SettingInputProps {
  definition: SettingDefinition;
  value: number;
  defaultValue: number;
  originalValue: number;
  onChange: (value: number) => void;
}

const SettingInput: React.FC<SettingInputProps> = ({
  definition,
  value,
  defaultValue,
  originalValue,
  onChange,
}) => {
  const { key, label, description, min, max, step, unit, format } = definition;

  const isChanged = value !== originalValue;
  const isDefault = value === defaultValue;

  // Format value for display
  const formatValue = (v: number): string => {
    switch (format) {
      case 'percent':
        return `${(v * 100).toFixed(0)}%`;
      case 'currency':
        return `$${v.toLocaleString()}`;
      case 'decimal':
        return v.toFixed(2);
      default:
        return v.toString();
    }
  };

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = parseFloat(e.target.value);
    if (isNaN(newValue)) newValue = min;
    newValue = Math.max(min, Math.min(max, newValue));
    onChange(newValue);
  };

  // Reset to default
  const handleReset = () => {
    onChange(defaultValue);
  };

  return (
    <div className={`p-3 rounded-lg ${isChanged ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'bg-gray-50 dark:bg-gray-800'}`}>
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
        {!isDefault && (
          <button
            onClick={handleReset}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title="Reset to default"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        )}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        {description}
      </p>

      <div className="flex items-center gap-3">
        {/* Slider */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
        />

        {/* Number input */}
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={format === 'percent' ? (value * 100).toFixed(0) : value}
            onChange={(e) => {
              let v = parseFloat(e.target.value);
              if (format === 'percent') v = v / 100;
              onChange(Math.max(min, Math.min(max, v)));
            }}
            className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <span className="text-xs text-gray-500 dark:text-gray-400 w-8">
            {unit}
          </span>
        </div>
      </div>

      {/* Default indicator */}
      <div className="mt-1 text-xs text-gray-400">
        Default: {formatValue(defaultValue)}
        {isChanged && (
          <span className="ml-2 text-yellow-600">
            (was: {formatValue(originalValue)})
          </span>
        )}
      </div>
    </div>
  );
};

export default SettingInput;
```

### TickSettingsLog.tsx

```tsx
// src/components/admin/TickSettingsLog.tsx

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { tickAdminApi } from '../../services/tickAdminApi';
import type { SettingsLogResponse, SettingsLogEntry } from '../../types/tick';
import { CATEGORY_LABELS } from '../../types/tick';

const TickSettingsLog: React.FC = () => {
  const [data, setData] = useState<SettingsLogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const fetchLog = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await tickAdminApi.getSettingsLog({ page, limit: 10 });
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load log');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLog();
  }, [page]);

  if (loading && !data) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500">{error}</p>
        <button
          onClick={fetchLog}
          className="mt-4 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data || data.logs.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        No settings changes recorded yet.
      </div>
    );
  }

  const formatValue = (value: number, key: string): string => {
    if (key.includes('rate') || key.includes('chance') || key.includes('penalty') || key.includes('bonus') || key.includes('multiplier') || key.includes('floor')) {
      return `${(value * 100).toFixed(0)}%`;
    }
    if (key.includes('cost')) {
      return `$${value.toLocaleString()}`;
    }
    return value.toString();
  };

  return (
    <div className="space-y-4">
      {data.logs.map((entry) => (
        <LogEntry key={entry.id} entry={entry} formatValue={formatValue} />
      ))}

      {/* Pagination */}
      {data.pagination.total_pages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Page {data.pagination.page} of {data.pagination.total_pages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => p - 1)}
              disabled={page <= 1}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= data.pagination.total_pages}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

interface LogEntryProps {
  entry: SettingsLogEntry;
  formatValue: (value: number, key: string) => string;
}

const LogEntry: React.FC<LogEntryProps> = ({ entry, formatValue }) => {
  const categoryInfo = CATEGORY_LABELS[entry.category] || { label: entry.category, icon: '⚙️' };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span>{categoryInfo.icon}</span>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              {entry.summary}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {new Date(entry.changed_at).toLocaleString()} by {entry.user_email}
            </p>
          </div>
        </div>
        <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 text-xs rounded">
          {categoryInfo.label}
        </span>
      </div>

      {/* Changes */}
      <div className="p-4">
        <div className="space-y-2">
          {Object.entries(entry.changes).map(([key, change]) => (
            <div
              key={key}
              className="flex items-center gap-2 text-sm"
            >
              <span className="font-mono text-gray-600 dark:text-gray-400 w-48 truncate">
                {key}
              </span>
              <span className="text-red-500 line-through">
                {formatValue(change.old, key)}
              </span>
              <ArrowRight className="w-4 h-4 text-gray-400" />
              <span className="text-green-600 font-medium">
                {formatValue(change.new, key)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TickSettingsLog;
```

### Update TickAdminPage.tsx

Replace the placeholder import:

```tsx
// In TickAdminPage.tsx, replace:
// const TickSettingsTab = ({ onRefresh }: { onRefresh: () => void }) => (...)

// With:
import TickSettingsTab from '../../components/admin/TickSettingsTab';
```

## Database Changes

None — uses existing tables

## Test Cases

### Test 1: Settings Load
```
Navigate to /admin/tick → Settings tab
Expected: Settings form loads with current values
Expected: Categories collapsed except fire and tax
```

### Test 2: Expand/Collapse Categories
```
Click on "Profit Settings" header
Expected: Category expands to show settings
Click again
Expected: Category collapses
```

### Test 3: Change Setting
```
Adjust "Base Fire Damage" slider to 15
Expected: Yellow highlight appears
Expected: "1 unsaved change" warning shows
Expected: "was: 10" indicator appears
```

### Test 4: Save Changes
```
Click "Save Changes" button
Expected: Toast shows "Updated 1 setting(s)"
Expected: Yellow highlight clears
```

### Test 5: Discard Changes
```
Make a change
Click "Discard" in warning bar
Expected: Value reverts to original
```

### Test 6: Reset to Defaults
```
Click "Reset All to Defaults"
Click confirm in dialog
Expected: All values reset to defaults
Expected: Toast shows success message
```

### Test 7: Change Log
```
Click "Change Log" sub-tab
Expected: Log entries display with changes
Expected: Shows old → new values
```

### Test 8: Setting Validation
```
Try to set fire_damage_base to 100 (max is 50)
Expected: Value clamped to 50
```

## Acceptance Checklist

- [ ] TickSettingsTab component created
- [ ] TickSettingsForm shows grouped settings
- [ ] Categories expand/collapse
- [ ] SettingInput renders slider + number input
- [ ] Changed values highlighted in yellow
- [ ] Unsaved changes warning shows
- [ ] Save button works
- [ ] Discard button reverts changes
- [ ] Reset to defaults works with confirmation
- [ ] TickSettingsLog shows change history
- [ ] Log shows old → new values
- [ ] Pagination works in log
- [ ] Form shows last updated metadata
- [ ] Dark mode styling works

## Deployment

```bash
cd authentication-dashboard-system
npm run build
npm run deploy
```

## Handoff Notes

- Settings tab is fully functional
- [See: Stage 10] will complete integration with routing
- SETTING_DEFINITIONS from types/tick.ts drives form rendering
- Changes are tracked client-side until saved
- Reset requires confirmation dialog
- Log shows formatted values (percentages, currencies)
