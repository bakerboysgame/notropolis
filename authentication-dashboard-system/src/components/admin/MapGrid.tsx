import { useRef, useEffect, useState, useCallback } from 'react';
import { Tile } from '../../types/game';
import { ToolType } from '../../hooks/useMapBuilder';
import { ZoomIn, ZoomOut, Move, RotateCcw } from 'lucide-react';
import { getTerrainVariantUrl } from '../game/phaser/utils/assetLoader';

const TILE_SIZE = 16; // pixels per tile at 1x zoom
const COLORS: Record<string, string> = {
  free_land: '#90EE90',
  water: '#4169E1',
  road: '#696969',
  dirt_track: '#8B4513',
  trees: '#228B22',
  temple: '#FFD700',
  bank: '#C0C0C0',
  police_station: '#0000FF',
};

interface MapGridProps {
  width: number;
  height: number;
  tiles: Tile[];
  tileMap: Map<string, Tile>;
  selectedTool: ToolType;
  brushSize: number;
  zoom: number;
  offset: { x: number; y: number };
  onPaint: (x: number, y: number) => void;
  onZoomChange: (zoom: number) => void;
  onOffsetChange: (offset: { x: number; y: number }) => void;
  isSaving: boolean;
}

export function MapGrid({
  width,
  height,
  tiles,
  tileMap,
  selectedTool,
  brushSize,
  zoom,
  offset,
  onPaint,
  onZoomChange,
  onOffsetChange,
  isSaving,
}: MapGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPainting, setIsPainting] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPos, setLastPanPos] = useState({ x: 0, y: 0 });
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [imageLoadCounter, setImageLoadCounter] = useState(0); // Trigger re-render when images load

  // Image cache for terrain sprites
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

  // Load an image and cache it
  const loadImage = useCallback((key: string, url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      if (imageCache.current.has(key)) {
        resolve(imageCache.current.get(key)!);
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imageCache.current.set(key, img);
        setImageLoadCounter(c => c + 1); // Trigger re-render
        resolve(img);
      };
      img.onerror = () => reject(new Error(`Failed to load ${url}`));
      img.src = url;
    });
  }, []);

  // Calculate canvas dimensions based on container
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCanvasSize({
          width: Math.floor(rect.width),
          height: Math.floor(rect.height),
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Convert screen coordinates to tile coordinates
  const screenToTile = useCallback(
    (screenX: number, screenY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const x = Math.floor((screenX - rect.left - offset.x * zoom) / (TILE_SIZE * zoom));
      const y = Math.floor((screenY - rect.top - offset.y * zoom) / (TILE_SIZE * zoom));

      if (x >= 0 && x < width && y >= 0 && y < height) {
        return { x, y };
      }
      return null;
    },
    [offset, zoom, width, height]
  );

  // Render the grid
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate visible tile range for performance
    const startX = Math.max(0, Math.floor(-offset.x / TILE_SIZE));
    const startY = Math.max(0, Math.floor(-offset.y / TILE_SIZE));
    const endX = Math.min(width, Math.ceil((canvas.width / zoom - offset.x) / TILE_SIZE) + 1);
    const endY = Math.min(height, Math.ceil((canvas.height / zoom - offset.y) / TILE_SIZE) + 1);

    // Draw tiles
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const tile = tileMap.get(`${x},${y}`);
        const px = (x * TILE_SIZE + offset.x) * zoom;
        const py = (y * TILE_SIZE + offset.y) * zoom;
        const size = TILE_SIZE * zoom;

        // Try to load and draw terrain variant image
        if (tile && tile.terrain_type) {
          const imageKey = tile.terrain_variant
            ? `${tile.terrain_type}_${tile.terrain_variant}`
            : tile.terrain_type;
          const imageUrl = getTerrainVariantUrl(tile.terrain_type, tile.terrain_variant);

          const cachedImage = imageCache.current.get(imageKey);

          if (cachedImage) {
            // Draw the image
            ctx.drawImage(cachedImage, px, py, size, size);
          } else {
            // Load image asynchronously (don't await to avoid blocking render)
            loadImage(imageKey, imageUrl).catch(() => {
              // Silently fail - will use fallback color
            });

            // Draw fallback color while image loads
            const color = COLORS[tile.terrain_type || 'free_land'];
            ctx.fillStyle = color;
            ctx.fillRect(px, py, size - 1, size - 1);
          }
        } else {
          // No tile data, draw default
          ctx.fillStyle = COLORS['free_land'];
          ctx.fillRect(px, py, size - 1, size - 1);
        }

        // Draw special building marker overlay
        if (tile?.special_building) {
          const color = COLORS[tile.special_building];
          ctx.fillStyle = color + '80'; // Semi-transparent overlay
          ctx.fillRect(px, py, size, size);
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 2;
          ctx.strokeRect(px + 2, py + 2, size - 5, size - 5);
        }
      }
    }

    // Draw grid lines at higher zoom levels
    if (zoom >= 1) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.lineWidth = 1;

      for (let x = startX; x <= endX; x++) {
        const px = (x * TILE_SIZE + offset.x) * zoom;
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, canvas.height);
        ctx.stroke();
      }

      for (let y = startY; y <= endY; y++) {
        const py = (y * TILE_SIZE + offset.y) * zoom;
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(canvas.width, py);
        ctx.stroke();
      }
    }

    // Draw brush preview
    if (hoverPos) {
      const isSpecialTool = ['temple', 'bank', 'police_station'].includes(selectedTool as string);
      const effectiveBrushSize = isSpecialTool ? 1 : brushSize;
      const halfBrush = Math.floor(effectiveBrushSize / 2);

      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);

      const startPx = ((hoverPos.x - halfBrush) * TILE_SIZE + offset.x) * zoom;
      const startPy = ((hoverPos.y - halfBrush) * TILE_SIZE + offset.y) * zoom;
      const brushPxSize = effectiveBrushSize * TILE_SIZE * zoom;

      ctx.strokeRect(startPx, startPy, brushPxSize, brushPxSize);
      ctx.setLineDash([]);
    }
  }, [tiles, tileMap, zoom, offset, width, height, canvasSize, hoverPos, brushSize, selectedTool, imageLoadCounter, loadImage]);

  // Mouse handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        // Middle click or shift+left click for panning
        setIsPanning(true);
        setLastPanPos({ x: e.clientX, y: e.clientY });
        e.preventDefault();
      } else if (e.button === 0) {
        // Left click for painting
        setIsPainting(true);
        const pos = screenToTile(e.clientX, e.clientY);
        if (pos) {
          onPaint(pos.x, pos.y);
        }
      }
    },
    [screenToTile, onPaint]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        const dx = e.clientX - lastPanPos.x;
        const dy = e.clientY - lastPanPos.y;
        onOffsetChange({
          x: offset.x + dx / zoom,
          y: offset.y + dy / zoom,
        });
        setLastPanPos({ x: e.clientX, y: e.clientY });
      } else if (isPainting) {
        const pos = screenToTile(e.clientX, e.clientY);
        if (pos) {
          onPaint(pos.x, pos.y);
        }
      }

      // Update hover position
      const pos = screenToTile(e.clientX, e.clientY);
      setHoverPos(pos);
    },
    [isPanning, isPainting, lastPanPos, offset, zoom, screenToTile, onPaint, onOffsetChange]
  );

  const handleMouseUp = useCallback(() => {
    setIsPainting(false);
    setIsPanning(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsPainting(false);
    setIsPanning(false);
    setHoverPos(null);
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      onZoomChange(Math.max(0.25, Math.min(3, zoom + delta)));
    },
    [zoom, onZoomChange]
  );

  const resetView = useCallback(() => {
    onZoomChange(1);
    onOffsetChange({ x: 20, y: 20 });
  }, [onZoomChange, onOffsetChange]);

  return (
    <div className="flex-1 flex flex-col bg-neutral-950 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-neutral-900 border-b border-neutral-700">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onZoomChange(Math.min(3, zoom + 0.25))}
            className="p-2 rounded hover:bg-neutral-700 text-neutral-300"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <span className="text-neutral-400 text-sm w-16 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => onZoomChange(Math.max(0.25, zoom - 0.25))}
            className="p-2 rounded hover:bg-neutral-700 text-neutral-300"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-neutral-700 mx-2" />
          <button
            onClick={resetView}
            className="p-2 rounded hover:bg-neutral-700 text-neutral-300"
            title="Reset View"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs text-neutral-500">
          {hoverPos && (
            <span>
              Tile: ({hoverPos.x}, {hoverPos.y})
            </span>
          )}
          <span className="flex items-center gap-1">
            <Move className="w-3 h-3" />
            Shift+Drag or Middle-Click to Pan
          </span>
          {isSaving && <span className="text-yellow-500">Saving...</span>}
        </div>
      </div>

      {/* Canvas Container */}
      <div ref={containerRef} className="flex-1 overflow-hidden cursor-crosshair">
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
          onContextMenu={(e) => e.preventDefault()}
          className="block"
          style={{
            cursor: isPanning ? 'grabbing' : 'crosshair',
          }}
        />
      </div>
    </div>
  );
}
