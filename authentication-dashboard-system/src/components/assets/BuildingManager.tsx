// src/components/assets/BuildingManager.tsx
import { useState, useEffect } from 'react';
import { Loader2, Building2 } from 'lucide-react';
import { clsx } from 'clsx';
import { assetApi, BuildingConfig, Asset } from '../../services/assetApi';
import { useToast } from '../ui/Toast';

export function BuildingManager() {
  const { showToast } = useToast();
  const [buildings, setBuildings] = useState<BuildingConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [sprites, setSprites] = useState<Asset[]>([]);
  const [loadingSprites, setLoadingSprites] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    loadBuildings();
  }, []);

  const loadBuildings = async () => {
    setLoading(true);
    try {
      const data = await assetApi.getBuildingConfigs();
      setBuildings(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load buildings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadSprites = async (buildingType: string) => {
    if (selectedBuilding === buildingType) {
      setSelectedBuilding(null);
      return;
    }
    setSelectedBuilding(buildingType);
    setLoadingSprites(true);
    try {
      const data = await assetApi.getBuildingSprites(buildingType);
      setSprites(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load sprites', 'error');
    } finally {
      setLoadingSprites(false);
    }
  };

  const handleSpriteChange = async (buildingType: string, spriteId: string) => {
    setSaving(buildingType);
    try {
      await assetApi.updateBuildingConfig(buildingType, { active_sprite_id: spriteId });
      showToast('Sprite updated', 'success');
      await loadBuildings();
      setSelectedBuilding(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update sprite', 'error');
    } finally {
      setSaving(null);
    }
  };

  const handlePublish = async (buildingType: string) => {
    setSaving(buildingType);
    try {
      await assetApi.publishBuilding(buildingType);
      showToast('Building published', 'success');
      await loadBuildings();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to publish', 'error');
    } finally {
      setSaving(null);
    }
  };

  const handleUnpublish = async (buildingType: string) => {
    setSaving(buildingType);
    try {
      await assetApi.unpublishBuilding(buildingType);
      showToast('Building unpublished', 'success');
      await loadBuildings();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to unpublish', 'error');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <Building2 className="w-6 h-6 text-blue-600" />
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Building Manager</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Configure which sprites are live in the game
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {buildings.map((building) => (
          <div
            key={building.building_type_id}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
          >
            <div className="flex gap-4">
              {/* Sprite Preview */}
              <div className="w-24 h-24 bg-gray-100 dark:bg-gray-900 rounded-lg flex items-center justify-center flex-shrink-0">
                {building.sprite_url ? (
                  <img
                    src={building.sprite_url}
                    alt={building.building_name}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <span className="text-gray-400 text-2xl">?</span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 dark:text-gray-100">
                  {building.building_name}
                </h3>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Level {building.level_required}
                  {building.requires_license ? ' - License Required' : ''}
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Cost:</span>{' '}
                    <span className="text-gray-900 dark:text-gray-100">
                      ${building.effective_cost?.toLocaleString() || building.base_cost?.toLocaleString() || 0}
                    </span>
                    {building.cost_override && (
                      <span className="text-blue-600 dark:text-blue-400 ml-1">(override)</span>
                    )}
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Profit:</span>{' '}
                    <span className="text-gray-900 dark:text-gray-100">
                      ${building.effective_profit?.toLocaleString() || building.base_profit?.toLocaleString() || 0}
                    </span>
                    {building.base_profit_override && (
                      <span className="text-blue-600 dark:text-blue-400 ml-1">(override)</span>
                    )}
                  </div>
                </div>

                {/* Sprite Selector */}
                <div className="mt-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Sprite:</span>
                  {building.available_sprites > 0 ? (
                    <button
                      onClick={() => loadSprites(building.building_type_id)}
                      className="ml-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {building.active_sprite_id
                        ? `Selected (${building.available_sprites} available)`
                        : `Choose from ${building.available_sprites} sprites`}
                    </button>
                  ) : (
                    <span className="ml-2 text-sm text-gray-400">
                      No approved sprites yet
                    </span>
                  )}
                </div>

                {/* Status Badge */}
                <div className="mt-2">
                  <span
                    className={clsx(
                      'px-2 py-1 rounded text-xs font-medium',
                      building.is_published
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : building.active_sprite_id
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    )}
                  >
                    {building.is_published
                      ? 'PUBLISHED'
                      : building.active_sprite_id
                        ? 'DRAFT'
                        : 'NO SPRITE'}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 flex-shrink-0">
                {building.active_sprite_id && !building.is_published && (
                  <button
                    onClick={() => handlePublish(building.building_type_id)}
                    disabled={saving === building.building_type_id}
                    className="px-3 py-1.5 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                  >
                    {saving === building.building_type_id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : null}
                    Publish
                  </button>
                )}
                {building.is_published && (
                  <button
                    onClick={() => handleUnpublish(building.building_type_id)}
                    disabled={saving === building.building_type_id}
                    className="px-3 py-1.5 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
                  >
                    {saving === building.building_type_id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : null}
                    Unpublish
                  </button>
                )}
              </div>
            </div>

            {/* Sprite Selection Panel */}
            {selectedBuilding === building.building_type_id && (
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Select Sprite
                </h4>
                {loadingSprites ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : sprites.length === 0 ? (
                  <p className="text-sm text-gray-500">No approved sprites available</p>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    {sprites.map((sprite) => (
                      <button
                        key={sprite.id}
                        onClick={() => handleSpriteChange(building.building_type_id, sprite.id)}
                        disabled={saving === building.building_type_id}
                        className={clsx(
                          'p-2 border rounded-lg transition-colors',
                          sprite.id === building.active_sprite_id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
                        )}
                      >
                        <img
                          src={sprite.r2_key ? `https://assets.notropolis.net/${sprite.r2_key}` : ''}
                          alt={`v${sprite.variant}`}
                          className="w-16 h-16 object-contain"
                        />
                        <div className="text-xs text-center text-gray-600 dark:text-gray-400 mt-1">
                          v{sprite.variant}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setSelectedBuilding(null)}
                  className="mt-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        ))}

        {buildings.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            No building configurations found
          </div>
        )}
      </div>
    </div>
  );
}
