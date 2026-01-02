// src/components/assets/AvatarAssets.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Download, User } from 'lucide-react';
import { clsx } from 'clsx';
import { assetApi, Asset, AVATAR_LAYER_TYPES } from '../../services/assetApi';
import { useToast } from '../ui/Toast';

interface LayerAsset extends Asset {
  layer_type?: string;
  public_url?: string;
}

export function AvatarAssets() {
  const { showToast } = useToast();
  const [layerType, setLayerType] = useState('base_body');
  const [assets, setAssets] = useState<LayerAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<LayerAsset | null>(null);

  // Composite preview state
  const [previewLayers, setPreviewLayers] = useState<Record<string, LayerAsset | null>>({});
  const [approvedLayers, setApprovedLayers] = useState<Record<string, LayerAsset[]>>({});
  const [loadingLayers, setLoadingLayers] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    loadAssets();
  }, [layerType]);

  useEffect(() => {
    loadApprovedLayers();
  }, []);

  const loadAssets = async () => {
    setLoading(true);
    try {
      // Load avatar assets - filtering by layer type using the asset_key prefix
      const data = await assetApi.listAssets('avatar');
      const filtered = data.filter((a) => {
        const key = a.asset_key.toLowerCase();
        if (layerType === 'avatar_bg') return key.startsWith('avatar_bg') || key.includes('_bg_');
        if (layerType === 'base_body') return key.includes('body') || key.includes('base');
        if (layerType === 'hair') return key.includes('hair');
        if (layerType === 'outfit') return key.includes('outfit');
        if (layerType === 'headwear') return key.includes('headwear') || key.includes('hat');
        if (layerType === 'accessory') return key.includes('accessory') || key.includes('cigar') || key.includes('glasses');
        return false;
      });
      setAssets(filtered);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load assets', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadApprovedLayers = async () => {
    setLoadingLayers(true);
    try {
      // Load all approved avatar assets and group by layer type
      const data = await assetApi.listAssets('avatar');
      const approved = data.filter((a) => a.status === 'approved');

      const grouped: Record<string, LayerAsset[]> = {};
      AVATAR_LAYER_TYPES.forEach((lt) => {
        grouped[lt.id] = approved.filter((a) => {
          const key = a.asset_key.toLowerCase();
          if (lt.id === 'avatar_bg') return key.startsWith('avatar_bg') || key.includes('_bg_');
          if (lt.id === 'base_body') return key.includes('body') || key.includes('base');
          if (lt.id === 'hair') return key.includes('hair');
          if (lt.id === 'outfit') return key.includes('outfit');
          if (lt.id === 'headwear') return key.includes('headwear') || key.includes('hat');
          if (lt.id === 'accessory') return key.includes('accessory') || key.includes('cigar') || key.includes('glasses');
          return false;
        });
      });
      setApprovedLayers(grouped);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load approved layers', 'error');
    } finally {
      setLoadingLayers(false);
    }
  };

  // Render composite preview to canvas
  const renderComposite = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, 512, 512);

    // Fill with checkerboard pattern for transparency
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = 20;
    patternCanvas.height = 20;
    const patternCtx = patternCanvas.getContext('2d');
    if (patternCtx) {
      patternCtx.fillStyle = '#e5e5e5';
      patternCtx.fillRect(0, 0, 20, 20);
      patternCtx.fillStyle = '#ffffff';
      patternCtx.fillRect(0, 0, 10, 10);
      patternCtx.fillRect(10, 10, 10, 10);
      const pattern = ctx.createPattern(patternCanvas, 'repeat');
      if (pattern) {
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, 512, 512);
      }
    }

    // Sort layers by order and draw
    const sortedLayers = AVATAR_LAYER_TYPES
      .filter((lt) => previewLayers[lt.id])
      .sort((a, b) => a.order - b.order);

    for (const layer of sortedLayers) {
      const asset = previewLayers[layer.id];
      if (asset) {
        try {
          const url = await getAssetUrl(asset);
          if (url) {
            const img = await loadImage(url);
            ctx.drawImage(img, 0, 0, 512, 512);
          }
        } catch {
          // Skip failed images
        }
      }
    }
  }, [previewLayers]);

  useEffect(() => {
    renderComposite();
  }, [renderComposite]);

  const getAssetUrl = async (asset: LayerAsset): Promise<string | null> => {
    if (asset.public_url) return asset.public_url;
    if (asset.r2_key) {
      // Try to get preview URL
      try {
        const { url } = await assetApi.getPreviewUrl(asset.id);
        return url;
      } catch {
        return `https://assets.notropolis.net/${asset.r2_key}`;
      }
    }
    return null;
  };

  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  const exportComposite = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'avatar_composite.png';
    link.href = dataUrl;
    link.click();
    showToast('Composite exported', 'success');
  };

  const handleLayerSelect = (layerId: string, assetId: string) => {
    const asset = approvedLayers[layerId]?.find((a) => a.id === assetId);
    setPreviewLayers((prev) => ({ ...prev, [layerId]: asset || null }));
  };

  const handleLayerToggle = (layerId: string, enabled: boolean) => {
    if (!enabled) {
      setPreviewLayers((prev) => ({ ...prev, [layerId]: null }));
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <User className="w-6 h-6 text-purple-600" />
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Avatar Assets</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Preview and export avatar layer composites
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Asset List */}
        <div className="lg:col-span-2">
          {/* Layer Type Tabs */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {AVATAR_LAYER_TYPES.map((lt) => (
              <button
                key={lt.id}
                onClick={() => setLayerType(lt.id)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  layerType === lt.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                )}
              >
                {lt.name}
              </button>
            ))}
          </div>

          {/* Asset Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : assets.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              No {layerType.replace('_', ' ')} assets found.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {assets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  selected={selectedAsset?.id === asset.id}
                  onClick={() => setSelectedAsset(asset)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: Composite Preview */}
        <div className="lg:col-span-1">
          <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-4">Composite Preview</h3>

          <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4">
            <canvas
              ref={canvasRef}
              width={512}
              height={512}
              className="w-full aspect-square bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
            />
          </div>

          {/* Layer Selectors */}
          <div className="mt-4 space-y-2">
            {loadingLayers ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : (
              AVATAR_LAYER_TYPES.map((lt) => (
                <div key={lt.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!previewLayers[lt.id]}
                    onChange={(e) => handleLayerToggle(lt.id, e.target.checked)}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <select
                    value={previewLayers[lt.id]?.id || ''}
                    onChange={(e) => handleLayerSelect(lt.id, e.target.value)}
                    className="flex-1 text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">{lt.name}: None</option>
                    {approvedLayers[lt.id]?.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.asset_key.replace('avatar_', '')}
                      </option>
                    ))}
                  </select>
                </div>
              ))
            )}
          </div>

          <div className="mt-4">
            <button
              onClick={exportComposite}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export PNG
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Asset card component
function AssetCard({
  asset,
  selected,
  onClick,
}: {
  asset: LayerAsset;
  selected: boolean;
  onClick: () => void;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUrl = async () => {
      setLoading(true);
      try {
        if (asset.status === 'pending' || asset.status === 'generating') {
          setLoading(false);
          return;
        }
        const { url } = await assetApi.getPreviewUrl(asset.id);
        setImageUrl(url);
      } catch {
        setImageUrl(null);
      } finally {
        setLoading(false);
      }
    };
    loadUrl();
  }, [asset.id, asset.status]);

  return (
    <div
      onClick={onClick}
      className={clsx(
        'border rounded-lg overflow-hidden cursor-pointer transition-all hover:shadow-lg',
        selected
          ? 'border-purple-500 ring-2 ring-purple-200 dark:ring-purple-800'
          : 'border-gray-200 dark:border-gray-700'
      )}
    >
      <div className="h-24 bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        {loading ? (
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt={asset.asset_key}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <User className="w-8 h-8 text-gray-400" />
        )}
      </div>
      <div className="p-2">
        <div className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
          {asset.asset_key.replace('avatar_', '')}
        </div>
        <div className="flex gap-1 mt-1">
          <span
            className={clsx(
              'text-xs px-1.5 py-0.5 rounded',
              asset.status === 'approved'
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                : asset.status === 'review' || asset.status === 'completed'
                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                  : asset.status === 'rejected'
                    ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
            )}
          >
            {asset.status}
          </span>
        </div>
      </div>
    </div>
  );
}
