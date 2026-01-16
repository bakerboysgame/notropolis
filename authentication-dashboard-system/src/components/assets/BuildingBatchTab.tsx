// src/components/assets/BuildingBatchTab.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Loader2,
  Wand2,
  ImagePlus,
  Scissors,
  Upload,
  Check,
  X,
  Eye,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Building2,
  RefreshCw,
} from 'lucide-react';
import { clsx } from 'clsx';
import { assetApi, Asset, ASSET_KEYS } from '../../services/assetApi';
import { useToast } from '../ui/Toast';
import { config } from '../../config/environment';
import { GenerateModal } from './GenerateModal';

// Types for extracted sprites
interface ExtractedSprite {
  id: string;
  imageData: string; // base64 data URL
  bounds: { x: number; y: number; width: number; height: number };
  mappedTo?: string; // building type key
}

interface BatchAsset extends Asset {
  extracted_sprites?: ExtractedSprite[];
  processing_status?: 'idle' | 'removing_bg' | 'splitting' | 'uploading' | 'done' | 'error';
  processing_error?: string;
}

// Building types for mapping
const BUILDING_TYPES = ASSET_KEYS.building_ref || [];

// Sprite splitting utility using Canvas API
function findSpriteIslands(imageData: ImageData): Array<{ x: number; y: number; width: number; height: number }> {
  const { width, height, data } = imageData;
  const visited = new Uint8Array(width * height);
  const islands: Array<{ x: number; y: number; width: number; height: number }> = [];

  // Alpha threshold - pixels with alpha > this are considered part of a sprite
  const ALPHA_THRESHOLD = 10;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const alpha = data[idx * 4 + 3];

      if (alpha > ALPHA_THRESHOLD && !visited[idx]) {
        // Found unvisited non-transparent pixel - flood fill to find island
        const bounds = floodFill(imageData, visited, x, y, ALPHA_THRESHOLD);

        // Only include islands that are reasonably sized (at least 50x50)
        if (bounds.width >= 50 && bounds.height >= 50) {
          islands.push(bounds);
        }
      }
    }
  }

  // Sort islands by position (top-to-bottom, left-to-right)
  islands.sort((a, b) => {
    const rowA = Math.floor(a.y / 100);
    const rowB = Math.floor(b.y / 100);
    if (rowA !== rowB) return rowA - rowB;
    return a.x - b.x;
  });

  return islands;
}

function floodFill(
  imageData: ImageData,
  visited: Uint8Array,
  startX: number,
  startY: number,
  alphaThreshold: number
): { x: number; y: number; width: number; height: number } {
  const { width, height, data } = imageData;
  const stack: [number, number][] = [[startX, startY]];

  let minX = startX, maxX = startX;
  let minY = startY, maxY = startY;

  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    const idx = y * width + x;

    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    if (visited[idx]) continue;
    if (data[idx * 4 + 3] <= alphaThreshold) continue;

    visited[idx] = 1;

    // Update bounding box
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);

    // Add neighbors (8-connected for better detection)
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    stack.push([x + 1, y + 1], [x - 1, y - 1], [x + 1, y - 1], [x - 1, y + 1]);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

// Extract sprite image from canvas
function extractSprite(
  canvas: HTMLCanvasElement,
  bounds: { x: number; y: number; width: number; height: number }
): string {
  const ctx = canvas.getContext('2d')!;
  const spriteCanvas = document.createElement('canvas');
  spriteCanvas.width = bounds.width;
  spriteCanvas.height = bounds.height;
  const spriteCtx = spriteCanvas.getContext('2d')!;

  const spriteData = ctx.getImageData(bounds.x, bounds.y, bounds.width, bounds.height);
  spriteCtx.putImageData(spriteData, 0, 0);

  return spriteCanvas.toDataURL('image/png');
}

// Batch asset card component
function BatchAssetCard({
  asset,
  onProcess,
  onPreview,
  onMapSprite,
  onUploadSprites,
  processing,
  extractedSprites,
}: {
  asset: BatchAsset;
  onProcess: () => void;
  onPreview: () => void;
  onMapSprite: (spriteId: string, buildingType: string) => void;
  onUploadSprites: () => void;
  processing: boolean;
  extractedSprites: ExtractedSprite[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (asset.public_url) {
      setImageUrl(asset.public_url);
    } else {
      assetApi.getPreviewUrl(asset.id).then(({ url }) => setImageUrl(url)).catch(() => {});
    }
  }, [asset]);

  const canProcess = asset.status === 'approved' && !processing;
  const hasExtractedSprites = extractedSprites.length > 0;
  const allMapped = hasExtractedSprites && extractedSprites.every(s => s.mappedTo);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className={clsx(
          'flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50',
          expanded && 'border-b border-gray-200 dark:border-gray-700'
        )}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Preview */}
        <div className="w-20 h-20 bg-gray-100 dark:bg-gray-900 rounded flex items-center justify-center flex-shrink-0">
          {imageUrl ? (
            <img src={imageUrl} alt="Batch" className="max-w-full max-h-full object-contain" />
          ) : (
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900 dark:text-gray-100">
              Batch #{asset.id}
            </h3>
            <span
              className={clsx(
                'px-2 py-0.5 rounded text-xs font-medium',
                asset.status === 'approved'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                  : asset.status === 'completed'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                  : asset.status === 'rejected'
                  ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
              )}
            >
              {asset.status.toUpperCase()}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Created: {new Date(asset.created_at).toLocaleDateString()}
          </p>
          {hasExtractedSprites && (
            <p className="text-sm text-indigo-600 dark:text-indigo-400 mt-1">
              {extractedSprites.length} sprites extracted
              {allMapped && ' • All mapped'}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onPreview(); }}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title="Preview"
          >
            <Eye className="w-5 h-5" />
          </button>
          {canProcess && !hasExtractedSprites && (
            <button
              onClick={(e) => { e.stopPropagation(); onProcess(); }}
              disabled={processing}
              className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Scissors className="w-4 h-4" />
                  Extract Sprites
                </>
              )}
            </button>
          )}
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>

      {/* Expanded content - Extracted sprites */}
      {expanded && hasExtractedSprites && (
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">
              Extracted Sprites ({extractedSprites.length})
            </h4>
            {allMapped && (
              <button
                onClick={onUploadSprites}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Upload All to R2
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {extractedSprites.map((sprite, index) => (
              <div
                key={sprite.id}
                className={clsx(
                  'border rounded-lg p-2 bg-white dark:bg-gray-800',
                  sprite.mappedTo
                    ? 'border-green-300 dark:border-green-700'
                    : 'border-gray-200 dark:border-gray-700'
                )}
              >
                <div className="aspect-square bg-gray-100 dark:bg-gray-900 rounded mb-2 flex items-center justify-center">
                  <img
                    src={sprite.imageData}
                    alt={`Sprite ${index + 1}`}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  {sprite.bounds.width}×{sprite.bounds.height}
                </div>
                <select
                  value={sprite.mappedTo || ''}
                  onChange={(e) => onMapSprite(sprite.id, e.target.value)}
                  className="w-full text-xs p-1.5 border rounded dark:bg-gray-700 dark:border-gray-600"
                >
                  <option value="">Select building...</option>
                  {BUILDING_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Processing status */}
      {processing && (
        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border-t border-indigo-200 dark:border-indigo-800">
          <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">
              {asset.processing_status === 'removing_bg' && 'Removing background...'}
              {asset.processing_status === 'splitting' && 'Finding sprite islands...'}
              {asset.processing_status === 'uploading' && 'Uploading sprites...'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// Main component
export function BuildingBatchTab() {
  const { showToast } = useToast();
  const [batches, setBatches] = useState<BatchAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [processingBatch, setProcessingBatch] = useState<string | null>(null);
  const [extractedSpritesMap, setExtractedSpritesMap] = useState<Record<string, ExtractedSprite[]>>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load batches
  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = async () => {
    setLoading(true);
    try {
      const assets = await assetApi.listAssets('building_batch', true);
      setBatches(assets as BatchAsset[]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load batches', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Process batch - remove background and split
  const processBatch = async (batch: BatchAsset) => {
    setProcessingBatch(batch.id);

    try {
      // Step 1: Get the image URL
      const { url } = await assetApi.getPreviewUrl(batch.id);

      // Step 2: Remove background via Slazzer (no trim)
      setBatches(prev => prev.map(b =>
        b.id === batch.id ? { ...b, processing_status: 'removing_bg' } : b
      ));

      // Call the remove background API (we'll need to add a no-trim option)
      const token = localStorage.getItem('token');
      const bgResponse = await fetch(`${config.API_BASE_URL}/api/admin/assets/remove-background-no-trim/${batch.id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const bgResult = await bgResponse.json();

      if (!bgResult.success) {
        throw new Error(bgResult.error || 'Failed to remove background');
      }

      // Step 3: Load the processed image
      setBatches(prev => prev.map(b =>
        b.id === batch.id ? { ...b, processing_status: 'splitting' } : b
      ));

      // Get the updated preview URL (after bg removal)
      const { url: processedUrl } = await assetApi.getPreviewUrl(batch.id);

      // Load image into canvas
      const img = await loadImage(processedUrl);
      const canvas = canvasRef.current!;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      // Step 4: Find sprite islands
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const islands = findSpriteIslands(imageData);

      if (islands.length === 0) {
        throw new Error('No sprites detected in the image');
      }

      // Step 5: Extract each sprite
      const extracted: ExtractedSprite[] = islands.map((bounds, index) => ({
        id: `${batch.id}-sprite-${index}`,
        imageData: extractSprite(canvas, bounds),
        bounds,
        mappedTo: undefined,
      }));

      setExtractedSpritesMap(prev => ({
        ...prev,
        [batch.id]: extracted,
      }));

      setBatches(prev => prev.map(b =>
        b.id === batch.id ? { ...b, processing_status: 'done' } : b
      ));

      showToast(`Extracted ${extracted.length} sprites from batch`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to process batch', 'error');
      setBatches(prev => prev.map(b =>
        b.id === batch.id ? { ...b, processing_status: 'error', processing_error: err instanceof Error ? err.message : 'Unknown error' } : b
      ));
    } finally {
      setProcessingBatch(null);
    }
  };

  // Load image helper
  const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
  };

  // Map sprite to building type
  const handleMapSprite = (batchId: string, spriteId: string, buildingType: string) => {
    setExtractedSpritesMap(prev => ({
      ...prev,
      [batchId]: (prev[batchId] || []).map(sprite =>
        sprite.id === spriteId ? { ...sprite, mappedTo: buildingType } : sprite
      ),
    }));
  };

  // Upload all mapped sprites
  const handleUploadSprites = async (batchId: string) => {
    const sprites = extractedSpritesMap[batchId] || [];
    const mappedSprites = sprites.filter(s => s.mappedTo);

    if (mappedSprites.length === 0) {
      showToast('No sprites have been mapped to building types', 'error');
      return;
    }

    setProcessingBatch(batchId);
    setBatches(prev => prev.map(b =>
      b.id === batchId ? { ...b, processing_status: 'uploading' } : b
    ));

    try {
      const token = localStorage.getItem('token');
      let successCount = 0;

      for (const sprite of mappedSprites) {
        // Upload each sprite as a new building_sprite asset
        const response = await fetch(`${config.API_BASE_URL}/api/admin/assets/upload-batch-sprite`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            parent_batch_id: batchId,
            asset_key: sprite.mappedTo,
            image_data: sprite.imageData,
            bounds: sprite.bounds,
          }),
        });

        const result = await response.json();
        if (result.success) {
          successCount++;
        } else {
          console.error(`Failed to upload sprite ${sprite.id}:`, result.error);
        }
      }

      showToast(`Uploaded ${successCount}/${mappedSprites.length} sprites`, successCount === mappedSprites.length ? 'success' : 'warning');

      // Clear extracted sprites for this batch
      setExtractedSpritesMap(prev => {
        const newMap = { ...prev };
        delete newMap[batchId];
        return newMap;
      });

      // Reload batches
      await loadBatches();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to upload sprites', 'error');
    } finally {
      setProcessingBatch(null);
      setBatches(prev => prev.map(b =>
        b.id === batchId ? { ...b, processing_status: 'idle' } : b
      ));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hidden canvas for image processing */}
      <canvas ref={canvasRef} style={{ position: 'absolute', left: '-9999px', top: '-9999px' }} />

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Building2 className="w-6 h-6 text-indigo-600" />
              Building Batch Generator
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Generate multiple building sprites in one image for consistent style, then split and map to building types.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadBatches}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowGenerateModal(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 flex items-center gap-2"
            >
              <ImagePlus className="w-5 h-5" />
              Generate Batch
            </button>
          </div>
        </div>
      </div>

      {/* Info box */}
      <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Wand2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-0.5" />
          <div>
            <h3 className="font-medium text-indigo-800 dark:text-indigo-200">How it works</h3>
            <ol className="text-sm text-indigo-700 dark:text-indigo-300 mt-2 space-y-1 list-decimal list-inside">
              <li><strong>Generate</strong> - Create a 4K image with multiple buildings using the batch prompt</li>
              <li><strong>Review & Approve</strong> - Check the generated image and approve if satisfactory</li>
              <li><strong>Extract Sprites</strong> - Auto-detect individual buildings and extract them</li>
              <li><strong>Map to Types</strong> - Assign each sprite to a building type (restaurant, bank, etc.)</li>
              <li><strong>Upload</strong> - Push all mapped sprites to R2 as building_sprite assets</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Batches list */}
      <div className="space-y-4">
        {batches.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center">
            <Building2 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No batches yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Generate your first building batch to get started.
            </p>
            <button
              onClick={() => setShowGenerateModal(true)}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"
            >
              Generate Batch
            </button>
          </div>
        ) : (
          batches.map(batch => (
            <BatchAssetCard
              key={batch.id}
              asset={batch}
              onProcess={() => processBatch(batch)}
              onPreview={async () => {
                const { url } = await assetApi.getPreviewUrl(batch.id);
                setPreviewUrl(url);
              }}
              onMapSprite={(spriteId, buildingType) => handleMapSprite(batch.id, spriteId, buildingType)}
              onUploadSprites={() => handleUploadSprites(batch.id)}
              processing={processingBatch === batch.id}
              extractedSprites={extractedSpritesMap[batch.id] || []}
            />
          ))
        )}
      </div>

      {/* Preview modal */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="max-w-6xl max-h-[90vh] overflow-auto">
            <img src={previewUrl} alt="Batch preview" className="max-w-full" />
          </div>
        </div>
      )}

      {/* Generate modal */}
      {showGenerateModal && (
        <GenerateModal
          onClose={() => setShowGenerateModal(false)}
          onSuccess={() => {
            setShowGenerateModal(false);
            loadBatches();
          }}
          initialCategory="building_batch"
        />
      )}
    </div>
  );
}
