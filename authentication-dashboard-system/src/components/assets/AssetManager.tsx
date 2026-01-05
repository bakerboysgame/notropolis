// src/components/assets/AssetManager.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, ImageOff, Settings, Check, X, DollarSign, Package, Maximize2, Wand2, CheckCircle, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import {
  assetApi,
  assetConfigApi,
  Asset,
  BuildingConfiguration,
  AssetConfiguration,
  ASSET_MANAGER_CATEGORIES,
} from '../../services/assetApi';
import { useToast } from '../ui/Toast';
import { config } from '../../config/environment';

// Component to load sprite images
function SpriteImage({ asset, alt, className }: { asset: Asset | { public_url?: string; id?: string }; alt: string; className?: string }) {
  const publicUrl = 'public_url' in asset ? asset.public_url : undefined;
  const [imageUrl, setImageUrl] = useState<string | null>(publicUrl || null);
  const [loading, setLoading] = useState(!publicUrl);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (publicUrl) {
      setImageUrl(publicUrl);
      setLoading(false);
      return;
    }

    if (!('id' in asset) || !asset.id) {
      setLoading(false);
      setError(true);
      return;
    }

    let cancelled = false;
    const loadImage = async () => {
      try {
        setLoading(true);
        setError(false);
        const { url } = await assetApi.getPreviewUrl(asset.id as string);
        if (!cancelled) {
          setImageUrl(url);
        }
      } catch {
        if (!cancelled) {
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    loadImage();
    return () => { cancelled = true; };
  }, [asset, publicUrl]);

  if (loading) {
    return (
      <div className={clsx('flex items-center justify-center bg-gray-100 dark:bg-gray-800', className)}>
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !imageUrl) {
    return (
      <div className={clsx('flex items-center justify-center bg-gray-100 dark:bg-gray-800', className)}>
        <ImageOff className="w-4 h-4 text-gray-400" />
      </div>
    );
  }

  return <img src={imageUrl} alt={alt} className={className} />;
}

// Building edit form for price overrides and map scale
function BuildingEditForm({
  building,
  onSave,
  onCancel,
  saving,
}: {
  building: BuildingConfiguration;
  onSave: (values: { cost_override: number | null; base_profit_override: number | null; map_scale: number | null }) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [cost, setCost] = useState<string>(
    building.cost_override?.toString() || building.default_cost?.toString() || ''
  );
  const [profit, setProfit] = useState<string>(
    building.base_profit_override?.toString() || building.default_profit?.toString() || ''
  );
  const [useDefaultCost, setUseDefaultCost] = useState(building.cost_override === null);
  const [useDefaultProfit, setUseDefaultProfit] = useState(building.base_profit_override === null);
  const [mapScale, setMapScale] = useState<number>(building.map_scale ?? building.default_map_scale ?? 1.0);
  const [useDefaultScale, setUseDefaultScale] = useState(building.map_scale === null || building.map_scale === undefined);

  const handleSave = () => {
    onSave({
      cost_override: useDefaultCost ? null : parseInt(cost) || null,
      base_profit_override: useDefaultProfit ? null : parseInt(profit) || null,
      map_scale: useDefaultScale ? null : mapScale,
    });
  };

  return (
    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
      <h4 className="font-medium mb-3 text-gray-900 dark:text-gray-100">Edit Configuration</h4>

      <div className="grid grid-cols-2 gap-4">
        {/* Cost */}
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Cost</label>
          <div className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              id="use-default-cost"
              checked={useDefaultCost}
              onChange={(e) => setUseDefaultCost(e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="use-default-cost" className="text-sm text-gray-600 dark:text-gray-400">
              Use default (${building.default_cost?.toLocaleString()})
            </label>
          </div>
          {!useDefaultCost && (
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="number"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-600"
                placeholder="Override cost"
              />
            </div>
          )}
        </div>

        {/* Profit */}
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Base Profit</label>
          <div className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              id="use-default-profit"
              checked={useDefaultProfit}
              onChange={(e) => setUseDefaultProfit(e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="use-default-profit" className="text-sm text-gray-600 dark:text-gray-400">
              Use default (${building.default_profit?.toLocaleString()})
            </label>
          </div>
          {!useDefaultProfit && (
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="number"
                value={profit}
                onChange={(e) => setProfit(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-600"
                placeholder="Override profit"
              />
            </div>
          )}
        </div>
      </div>

      {/* Map Scale */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-2">
          <input
            type="checkbox"
            id="use-default-scale"
            checked={useDefaultScale}
            onChange={(e) => {
              setUseDefaultScale(e.target.checked);
              if (e.target.checked) {
                setMapScale(building.default_map_scale ?? 1.0);
              }
            }}
            className="rounded border-gray-300"
          />
          <label htmlFor="use-default-scale" className="text-sm text-gray-600 dark:text-gray-400">
            Use default scale ({building.default_map_scale?.toFixed(1) ?? '1.0'}x)
          </label>
        </div>
        {!useDefaultScale && (
          <div className="flex items-center gap-3">
            <Maximize2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Map Scale
                </label>
                <span className="text-sm font-mono text-gray-500">
                  {mapScale.toFixed(1)}x
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="2.0"
                step="0.1"
                value={mapScale}
                onChange={(e) => setMapScale(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>0.1x</span>
                <span>1.0x</span>
                <span>2.0x</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Save
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// Buildings list component
function BuildingsList() {
  const { showToast } = useToast();
  const [buildings, setBuildings] = useState<BuildingConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [editingBuilding, setEditingBuilding] = useState<string | null>(null);
  const [sprites, setSprites] = useState<Asset[]>([]);
  const [loadingSprites, setLoadingSprites] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    loadBuildings();
  }, []);

  const loadBuildings = async () => {
    setLoading(true);
    try {
      const data = await assetConfigApi.getConfigurations('buildings') as BuildingConfiguration[];
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
      const data = await assetConfigApi.getConfigurationSprites('buildings', buildingType);
      setSprites(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load sprites', 'error');
    } finally {
      setLoadingSprites(false);
    }
  };

  const handleSpriteChange = async (buildingType: string, spriteId: number) => {
    setSaving(buildingType);
    try {
      await assetConfigApi.updateConfiguration('buildings', buildingType, { active_sprite_id: spriteId });
      showToast('Sprite updated', 'success');
      await loadBuildings();
      setSelectedBuilding(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update sprite', 'error');
    } finally {
      setSaving(null);
    }
  };

  const handlePriceUpdate = async (
    buildingType: string,
    values: { cost_override: number | null; base_profit_override: number | null; map_scale: number | null }
  ) => {
    setSaving(buildingType);
    try {
      await assetConfigApi.updateConfiguration('buildings', buildingType, values);
      showToast('Configuration updated', 'success');
      await loadBuildings();
      setEditingBuilding(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update configuration', 'error');
    } finally {
      setSaving(null);
    }
  };

  const handlePublish = async (buildingType: string) => {
    setSaving(buildingType);
    try {
      await assetConfigApi.publishConfiguration('buildings', buildingType);
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
      await assetConfigApi.unpublishConfiguration('buildings', buildingType);
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
    <div className="space-y-4">
      {buildings.map((building) => (
        <div
          key={building.asset_key}
          className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
        >
          <div className="flex gap-4">
            {/* Sprite Preview */}
            <div className="w-24 h-24 bg-gray-100 dark:bg-gray-900 rounded-lg flex items-center justify-center flex-shrink-0">
              {building.sprite_url ? (
                <img
                  src={building.sprite_url}
                  alt={building.name}
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <span className="text-gray-400 text-2xl">?</span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-900 dark:text-gray-100">
                {building.name}
              </h3>

              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Cost:</span>{' '}
                  <span className="text-gray-900 dark:text-gray-100">
                    ${building.effective_cost?.toLocaleString() || 0}
                  </span>
                  {building.cost_override !== null && (
                    <span className="text-blue-600 dark:text-blue-400 ml-1">(override)</span>
                  )}
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Profit:</span>{' '}
                  <span className="text-gray-900 dark:text-gray-100">
                    ${building.effective_profit?.toLocaleString() || 0}
                  </span>
                  {building.base_profit_override !== null && (
                    <span className="text-blue-600 dark:text-blue-400 ml-1">(override)</span>
                  )}
                </div>
              </div>

              {/* Sprite Selector */}
              <div className="mt-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Sprite:</span>
                {(building.available_sprites ?? 0) > 0 ? (
                  <button
                    onClick={() => loadSprites(building.asset_key)}
                    className="ml-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {building.active_sprite_id
                      ? `Selected (${building.available_sprites} available)`
                      : `Choose from ${building.available_sprites} sprites`}
                  </button>
                ) : (
                  <span className="ml-2 text-sm text-gray-400">No approved sprites yet</span>
                )}
              </div>

              {/* Status Badge */}
              <div className="mt-2 flex items-center gap-2">
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
                  {building.is_published ? 'PUBLISHED' : building.active_sprite_id ? 'DRAFT' : 'NO SPRITE'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 flex-shrink-0">
              <button
                onClick={() => setEditingBuilding(editingBuilding === building.asset_key ? null : building.asset_key)}
                className="px-3 py-1.5 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1"
              >
                <Settings className="w-4 h-4" />
                Pricing
              </button>
              {building.active_sprite_id && !building.is_published && (
                <button
                  onClick={() => handlePublish(building.asset_key)}
                  disabled={saving === building.asset_key}
                  className="px-3 py-1.5 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                >
                  {saving === building.asset_key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Publish
                </button>
              )}
              {building.is_published && (
                <button
                  onClick={() => handleUnpublish(building.asset_key)}
                  disabled={saving === building.asset_key}
                  className="px-3 py-1.5 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
                >
                  {saving === building.asset_key ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                  Unpublish
                </button>
              )}
            </div>
          </div>

          {/* Price Edit Form */}
          {editingBuilding === building.asset_key && (
            <BuildingEditForm
              building={building}
              onSave={(values) => handlePriceUpdate(building.asset_key, values)}
              onCancel={() => setEditingBuilding(null)}
              saving={saving === building.asset_key}
            />
          )}

          {/* Sprite Selection Panel */}
          {selectedBuilding === building.asset_key && (
            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Select Sprite</h4>
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
                      onClick={() => handleSpriteChange(building.asset_key, parseInt(sprite.id))}
                      disabled={saving === building.asset_key}
                      className={clsx(
                        'p-2 border rounded-lg transition-colors',
                        sprite.id === String(building.active_sprite_id)
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
                      )}
                    >
                      <SpriteImage asset={sprite} alt={`v${sprite.variant}`} className="w-16 h-16 object-contain" />
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
  );
}

// Generic asset list for NPCs, Effects, Terrain
function GenericAssetList({ category }: { category: string }) {
  const { showToast } = useToast();
  const [assets, setAssets] = useState<AssetConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [sprites, setSprites] = useState<Asset[]>([]);
  const [loadingSprites, setLoadingSprites] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    loadAssets();
  }, [category]);

  const loadAssets = async () => {
    setLoading(true);
    try {
      const data = await assetConfigApi.getConfigurations(category) as AssetConfiguration[];
      setAssets(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load assets', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadSprites = async (assetKey: string) => {
    if (selectedAsset === assetKey) {
      setSelectedAsset(null);
      return;
    }
    setSelectedAsset(assetKey);
    setLoadingSprites(true);
    try {
      const data = await assetConfigApi.getConfigurationSprites(category, assetKey);
      setSprites(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load sprites', 'error');
    } finally {
      setLoadingSprites(false);
    }
  };

  const handleSpriteChange = async (assetKey: string, spriteId: number) => {
    setSaving(assetKey);
    try {
      await assetConfigApi.updateConfiguration(category, assetKey, { active_sprite_id: spriteId });
      showToast('Sprite updated', 'success');
      await loadAssets();
      setSelectedAsset(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update sprite', 'error');
    } finally {
      setSaving(null);
    }
  };

  const handlePublish = async (assetKey: string) => {
    setSaving(assetKey);
    try {
      await assetConfigApi.publishConfiguration(category, assetKey);
      showToast('Asset published', 'success');
      await loadAssets();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to publish', 'error');
    } finally {
      setSaving(null);
    }
  };

  const handleUnpublish = async (assetKey: string) => {
    setSaving(assetKey);
    try {
      await assetConfigApi.unpublishConfiguration(category, assetKey);
      showToast('Asset unpublished', 'success');
      await loadAssets();
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

  if (assets.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <Package className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
        <p>No {category} configurations found.</p>
        <p className="text-sm mt-2">
          Generate and approve {category} sprites first, then they will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {assets.map((asset) => (
        <div
          key={asset.asset_key}
          className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
        >
          {/* Sprite Preview */}
          <div className="w-full h-32 bg-gray-100 dark:bg-gray-900 rounded-lg flex items-center justify-center mb-3">
            {asset.sprite_url ? (
              <img
                src={asset.sprite_url}
                alt={asset.asset_key}
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <span className="text-gray-400 text-3xl">?</span>
            )}
          </div>

          {/* Info */}
          <h3 className="font-bold text-gray-900 dark:text-gray-100 capitalize">
            {asset.asset_key.replace(/_/g, ' ')}
          </h3>

          {/* Sprite Selector */}
          <div className="mt-2">
            {(asset.available_sprites ?? 0) > 0 ? (
              <button
                onClick={() => loadSprites(asset.asset_key)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                {asset.active_sprite_id
                  ? `Change sprite (${asset.available_sprites} available)`
                  : `Choose from ${asset.available_sprites} sprites`}
              </button>
            ) : (
              <span className="text-sm text-gray-400">No approved sprites</span>
            )}
          </div>

          {/* Status and Actions */}
          <div className="mt-3 flex items-center justify-between">
            <span
              className={clsx(
                'px-2 py-1 rounded text-xs font-medium',
                asset.is_published
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                  : asset.active_sprite_id
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
              )}
            >
              {asset.is_published ? 'PUBLISHED' : asset.active_sprite_id ? 'DRAFT' : 'NO SPRITE'}
            </span>

            {asset.active_sprite_id && !asset.is_published && (
              <button
                onClick={() => handlePublish(asset.asset_key)}
                disabled={saving === asset.asset_key}
                className="px-2 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {saving === asset.asset_key ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Publish'}
              </button>
            )}
            {asset.is_published && (
              <button
                onClick={() => handleUnpublish(asset.asset_key)}
                disabled={saving === asset.asset_key}
                className="px-2 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {saving === asset.asset_key ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Unpublish'}
              </button>
            )}
          </div>

          {/* Sprite Selection Panel */}
          {selectedAsset === asset.asset_key && (
            <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2 text-sm">Select Sprite</h4>
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
                      onClick={() => handleSpriteChange(asset.asset_key, parseInt(sprite.id))}
                      disabled={saving === asset.asset_key}
                      className={clsx(
                        'p-2 border rounded-lg transition-colors',
                        sprite.id === String(asset.active_sprite_id)
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-400'
                      )}
                    >
                      <SpriteImage asset={sprite} alt={`v${sprite.variant}`} className="w-12 h-12 object-contain" />
                      <div className="text-xs text-center text-gray-600 dark:text-gray-400 mt-1">
                        v{sprite.variant}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => setSelectedAsset(null)}
                className="mt-2 text-xs text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Base ground list (special - only one can be active)
function BaseGroundList() {
  const { showToast } = useToast();
  const [grounds, setGrounds] = useState<AssetConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGround, setActiveGround] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadGrounds();
  }, []);

  const loadGrounds = async () => {
    setLoading(true);
    try {
      const data = await assetConfigApi.getConfigurations('base_ground') as AssetConfiguration[];
      setGrounds(data);
      const active = data.find((g) => g.is_active);
      setActiveGround(active?.asset_key || null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load base grounds', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSetActive = async (assetKey: string) => {
    setSaving(true);
    try {
      await assetConfigApi.setActiveBaseGround(assetKey);
      showToast('Base ground updated', 'success');
      setActiveGround(assetKey);
      await loadGrounds();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update', 'error');
    } finally {
      setSaving(false);
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
    <div className="space-y-4">
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
        <h4 className="font-medium text-blue-800 dark:text-blue-200">About Base Ground</h4>
        <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">
          The base ground is a seamless tiling texture that appears BEHIND all terrain tiles.
          Roads, dirt tracks, and properties are rendered ON TOP of this layer.
          Only ONE base ground can be active at a time.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {grounds.map((ground) => (
          <button
            key={ground.asset_key}
            onClick={() => handleSetActive(ground.asset_key)}
            disabled={saving}
            className={clsx(
              'border rounded-lg p-4 cursor-pointer transition-colors text-left',
              activeGround === ground.asset_key
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-400'
            )}
          >
            <div className="w-full aspect-[2/1] bg-gray-100 dark:bg-gray-800 rounded mb-2 flex items-center justify-center">
              {ground.sprite_url ? (
                <img
                  src={ground.sprite_url}
                  alt={ground.asset_key}
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-gray-400 text-2xl">?</span>
              )}
            </div>
            <div className="text-center">
              <span className="font-medium capitalize text-gray-900 dark:text-gray-100">
                {ground.asset_key.replace(/_/g, ' ')}
              </span>
              {activeGround === ground.asset_key && (
                <span className="ml-2 px-2 py-0.5 bg-green-500 text-white text-xs rounded">
                  ACTIVE
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {grounds.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Package className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <p>No base ground textures available.</p>
          <p className="text-sm mt-2">Generate one in the asset generation panel.</p>
        </div>
      )}
    </div>
  );
}

// Outline Generator Tool - generates outline silhouettes for building highlights
interface SpriteForOutline {
  id: number;
  category: string;
  asset_key: string;
  variant: number;
  r2_url: string;
  outline_url: string | null;
}

function OutlineGeneratorTool() {
  const { showToast } = useToast();
  const [sprites, setSprites] = useState<SpriteForOutline[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, currentAsset: '' });
  const [results, setResults] = useState<{ id: number; asset_key: string; success: boolean; error?: string }[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const OUTLINE_SIZE = 24; // pixels of outline expansion (doubled for visibility)

  useEffect(() => {
    loadSprites();
  }, []);

  const loadSprites = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.API_BASE_URL}/api/admin/assets/sprites-for-outline`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setSprites(data.sprites);
      } else {
        showToast(data.error || 'Failed to load sprites', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load sprites', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Generate outline from sprite image
  const generateOutline = useCallback((img: HTMLImageElement): string => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;

    // Set canvas size to accommodate outline
    canvas.width = img.naturalWidth + OUTLINE_SIZE * 2;
    canvas.height = img.naturalHeight + OUTLINE_SIZE * 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the sprite at multiple offsets to create expanded outline
    const steps = 16;
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const ox = Math.cos(angle) * OUTLINE_SIZE;
      const oy = Math.sin(angle) * OUTLINE_SIZE;
      ctx.drawImage(img, OUTLINE_SIZE + ox, OUTLINE_SIZE + oy);
    }

    // Fill the drawn area with white using source-in
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';

    // Cut out the original sprite shape to leave just the outline
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(img, OUTLINE_SIZE, OUTLINE_SIZE);
    ctx.globalCompositeOperation = 'source-over';

    // Return as WebP base64
    return canvas.toDataURL('image/webp', 0.9);
  }, []);

  // Load image from URL with cache busting to ensure full resolution
  const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // Verify we got a real image
        if (img.naturalWidth === 0 || img.naturalHeight === 0) {
          reject(new Error(`Image loaded but has zero dimensions: ${url}`));
          return;
        }
        resolve(img);
      };
      img.onerror = () => reject(new Error(`Failed to load: ${url}`));
      // Add cache-busting parameter to ensure fresh load
      const cacheBuster = `?_t=${Date.now()}`;
      img.src = url + cacheBuster;
    });
  };

  // Process all sprites without outlines
  const processAllSprites = async () => {
    const spritesToProcess = sprites.filter(s => !s.outline_url);
    if (spritesToProcess.length === 0) {
      showToast('All sprites already have outlines', 'info');
      return;
    }

    setProcessing(true);
    setProgress({ current: 0, total: spritesToProcess.length, currentAsset: '' });
    setResults([]);

    const newResults: typeof results = [];
    const token = localStorage.getItem('token');

    for (let i = 0; i < spritesToProcess.length; i++) {
      const sprite = spritesToProcess[i];
      setProgress({ current: i + 1, total: spritesToProcess.length, currentAsset: sprite.asset_key });

      try {
        // Load the sprite image
        const img = await loadImage(sprite.r2_url);

        // Generate outline
        const outlineData = generateOutline(img);

        // Upload to backend
        const response = await fetch(`${config.API_BASE_URL}/api/admin/assets/upload-outline/${sprite.id}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ outline_data: outlineData }),
        });

        const data = await response.json();
        if (data.success) {
          newResults.push({ id: sprite.id, asset_key: sprite.asset_key, success: true });
        } else {
          newResults.push({ id: sprite.id, asset_key: sprite.asset_key, success: false, error: data.error });
        }
      } catch (err) {
        newResults.push({
          id: sprite.id,
          asset_key: sprite.asset_key,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    setResults(newResults);
    setProcessing(false);

    const successful = newResults.filter(r => r.success).length;
    showToast(`Generated ${successful}/${spritesToProcess.length} outlines`, successful === spritesToProcess.length ? 'success' : 'warning');

    // Reload sprites to update status
    await loadSprites();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const withOutline = sprites.filter(s => s.outline_url).length;
  const withoutOutline = sprites.filter(s => !s.outline_url).length;

  return (
    <div className="space-y-6">
      {/* Hidden canvas for outline generation */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
        <h4 className="font-medium text-blue-800 dark:text-blue-200 flex items-center gap-2">
          <Wand2 className="w-5 h-5" />
          Outline Generator
        </h4>
        <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">
          Generates pre-rendered outline silhouettes for building sprites. These are used for
          ownership highlights (blue glow) and company tracking colors without expensive runtime filters.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{sprites.length}</div>
          <div className="text-sm text-gray-500">Total Sprites</div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{withOutline}</div>
          <div className="text-sm text-green-600 dark:text-green-400">With Outline</div>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{withoutOutline}</div>
          <div className="text-sm text-yellow-600 dark:text-yellow-400">Need Outline</div>
        </div>
      </div>

      {/* Action Button */}
      <div className="flex items-center gap-4">
        <button
          onClick={processAllSprites}
          disabled={processing || withoutOutline === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {processing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4" />
              Generate {withoutOutline} Outlines
            </>
          )}
        </button>

        {withoutOutline === 0 && (
          <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
            <CheckCircle className="w-4 h-4" />
            All sprites have outlines
          </span>
        )}
      </div>

      {/* Progress */}
      {processing && (
        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600 dark:text-gray-400">Processing: {progress.currentAsset}</span>
            <span className="text-gray-600 dark:text-gray-400">{progress.current}/{progress.total}</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && !processing && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-900 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
            <span className="font-medium text-gray-900 dark:text-gray-100">Results</span>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {results.map((r) => (
              <div
                key={r.id}
                className={clsx(
                  'px-4 py-2 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 last:border-0',
                  r.success ? 'bg-green-50 dark:bg-green-900/10' : 'bg-red-50 dark:bg-red-900/10'
                )}
              >
                <span className="text-sm text-gray-900 dark:text-gray-100">{r.asset_key}</span>
                {r.success ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <span className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {r.error}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sprite List Preview */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-900 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
          <span className="font-medium text-gray-900 dark:text-gray-100">Published Building Sprites</span>
        </div>
        <div className="max-h-96 overflow-y-auto">
          <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 p-4">
            {sprites.map((sprite) => (
              <div
                key={sprite.id}
                className={clsx(
                  'relative p-2 rounded-lg border',
                  sprite.outline_url
                    ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10'
                    : 'border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/10'
                )}
              >
                <img
                  src={sprite.r2_url}
                  alt={sprite.asset_key}
                  className="w-full aspect-square object-contain"
                />
                <div className="text-xs text-center mt-1 truncate text-gray-600 dark:text-gray-400">
                  {sprite.asset_key}
                </div>
                {sprite.outline_url && (
                  <div className="absolute top-1 right-1">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Main Asset Manager component with tabs
export function AssetManager() {
  const [activeTab, setActiveTab] = useState<string>('buildings');

  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Asset Manager</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Configure which assets are live in the game
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 px-6 overflow-x-auto">
        {ASSET_MANAGER_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveTab(cat.key)}
            className={clsx(
              'py-3 px-4 text-sm font-medium whitespace-nowrap transition-colors',
              activeTab === cat.key
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            {cat.label}
          </button>
        ))}
        {/* Tools tab for outline generation etc */}
        <button
          onClick={() => setActiveTab('tools')}
          className={clsx(
            'py-3 px-4 text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1',
            activeTab === 'tools'
              ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          )}
        >
          <Wand2 className="w-4 h-4" />
          Tools
        </button>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'buildings' && <BuildingsList />}
        {activeTab === 'npcs' && <GenericAssetList category="npcs" />}
        {activeTab === 'dirty_tricks' && <GenericAssetList category="effects" />}
        {activeTab === 'terrain' && <GenericAssetList category="terrain" />}
        {activeTab === 'base_ground' && <BaseGroundList />}
        {activeTab === 'tools' && <OutlineGeneratorTool />}
      </div>
    </div>
  );
}
