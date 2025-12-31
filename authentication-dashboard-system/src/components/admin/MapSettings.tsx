import { useState, useEffect } from 'react';
import { GameMap } from '../../types/game';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface MapSettingsProps {
  map: GameMap | null;
  onSave: (settings: Partial<GameMap>) => Promise<void>;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
}

export function MapSettings({ map, onSave, isSaving, hasUnsavedChanges }: MapSettingsProps) {
  const [settings, setSettings] = useState<Partial<GameMap>>({});
  const [isDirty, setIsDirty] = useState(false);

  // Initialize settings when map loads
  useEffect(() => {
    if (map) {
      setSettings({
        name: map.name,
        country: map.country,
        location_type: map.location_type,
        hero_net_worth: map.hero_net_worth,
        hero_cash: map.hero_cash,
        hero_land_percentage: map.hero_land_percentage,
        police_strike_day: map.police_strike_day,
        is_active: map.is_active,
      });
      setIsDirty(false);
    }
  }, [map]);

  const handleChange = <K extends keyof GameMap>(key: K, value: GameMap[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    await onSave(settings);
    setIsDirty(false);
  };

  if (!map) {
    return (
      <div className="w-72 bg-neutral-900 border-l border-neutral-700 p-4">
        <p className="text-neutral-500">No map loaded</p>
      </div>
    );
  }

  return (
    <div className="w-72 bg-neutral-900 border-l border-neutral-700 p-4 flex flex-col gap-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <h3 className="text-neutral-100 font-bold text-lg">Map Settings</h3>
        {(isDirty || hasUnsavedChanges) && (
          <span className="text-xs text-yellow-500">Unsaved</span>
        )}
      </div>

      {/* Map Info */}
      <div className="text-xs text-neutral-500 bg-neutral-800 p-2 rounded">
        <div>Size: {map.width} x {map.height}</div>
        <div>Tiles: {map.width * map.height}</div>
        <div className="truncate" title={map.id}>ID: {map.id.slice(0, 8)}...</div>
      </div>

      {/* Name */}
      <label className="block">
        <span className="text-neutral-300 text-sm font-medium">Name</span>
        <input
          type="text"
          value={settings.name || ''}
          onChange={(e) => handleChange('name', e.target.value)}
          className="mt-1 w-full p-2 rounded-md bg-neutral-800 border border-neutral-600 text-neutral-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="Map name"
        />
      </label>

      {/* Country */}
      <label className="block">
        <span className="text-neutral-300 text-sm font-medium">Country</span>
        <input
          type="text"
          value={settings.country || ''}
          onChange={(e) => handleChange('country', e.target.value)}
          className="mt-1 w-full p-2 rounded-md bg-neutral-800 border border-neutral-600 text-neutral-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="UK, USA, etc."
        />
      </label>

      {/* Location Type */}
      <label className="block">
        <span className="text-neutral-300 text-sm font-medium">Type</span>
        <select
          value={settings.location_type || 'town'}
          onChange={(e) => handleChange('location_type', e.target.value as 'town' | 'city' | 'capital')}
          className="mt-1 w-full p-2 rounded-md bg-neutral-800 border border-neutral-600 text-neutral-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="town">Town</option>
          <option value="city">City</option>
          <option value="capital">Capital</option>
        </select>
      </label>

      {/* Divider */}
      <div className="border-t border-neutral-700" />

      {/* Hero Requirements */}
      <div>
        <h4 className="text-neutral-300 font-semibold text-sm mb-2">Hero Requirements</h4>

        <label className="block mb-3">
          <span className="text-neutral-400 text-xs">Net Worth ($)</span>
          <input
            type="number"
            value={settings.hero_net_worth || 0}
            onChange={(e) => handleChange('hero_net_worth', Number(e.target.value))}
            className="mt-1 w-full p-2 rounded-md bg-neutral-800 border border-neutral-600 text-neutral-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </label>

        <label className="block mb-3">
          <span className="text-neutral-400 text-xs">Cash ($)</span>
          <input
            type="number"
            value={settings.hero_cash || 0}
            onChange={(e) => handleChange('hero_cash', Number(e.target.value))}
            className="mt-1 w-full p-2 rounded-md bg-neutral-800 border border-neutral-600 text-neutral-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </label>

        <label className="block">
          <span className="text-neutral-400 text-xs">Land Ownership (%)</span>
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={settings.hero_land_percentage || 0}
            onChange={(e) => handleChange('hero_land_percentage', Number(e.target.value))}
            className="mt-1 w-full p-2 rounded-md bg-neutral-800 border border-neutral-600 text-neutral-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </label>
      </div>

      {/* Divider */}
      <div className="border-t border-neutral-700" />

      {/* Police Strike Day */}
      <label className="block">
        <span className="text-neutral-300 text-sm font-medium">Police Strike Day</span>
        <select
          value={settings.police_strike_day ?? 3}
          onChange={(e) => handleChange('police_strike_day', Number(e.target.value))}
          className="mt-1 w-full p-2 rounded-md bg-neutral-800 border border-neutral-600 text-neutral-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          {DAYS_OF_WEEK.map((day, i) => (
            <option key={i} value={i}>
              {day}
            </option>
          ))}
        </select>
      </label>

      {/* Active Status */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={settings.is_active ?? true}
          onChange={(e) => handleChange('is_active', e.target.checked)}
          className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-primary-500 focus:ring-primary-500"
        />
        <span className="text-neutral-300 text-sm font-medium">Map Active</span>
      </label>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={isSaving || !isDirty}
        className="mt-4 w-full p-3 bg-primary-600 text-white rounded-md font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSaving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}
