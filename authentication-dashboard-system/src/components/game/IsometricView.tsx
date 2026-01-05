import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { GameMap, Tile, BuildingInstance } from '../../types/game';
import { useIsometricAssets, getSprite, getTerrainSprite, getDirtyTrickOverlay, getBuildingOutline } from '../../hooks/useIsometricAssets';
import {
  TERRAIN_COLORS,
  gridToScreen,
  screenToGrid,
  getBuildingMapScale,
} from '../../utils/isometricRenderer';
import { useHighlights } from '../../contexts/HighlightContext';

// Responsive tile size: 64px for mobile/tablet, 85px for desktop (2/3 of 128)
const MOBILE_TILE_SIZE = 64;
const DESKTOP_TILE_SIZE = 85;
const BREAKPOINT = 1024; // lg breakpoint
const VIEWPORT_TILES = 15; // Show ~15x15 tiles in view

// Clamp coordinate to map bounds (no wrapping)
function clampCoordinate(coord: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, coord));
}

// Get visible tiles without wrapping
function getVisibleTilesNoWrap(
  centerX: number,
  centerY: number,
  mapWidth: number,
  mapHeight: number,
  viewportRadius: number = Math.ceil(VIEWPORT_TILES / 2) + 2
): Array<{ x: number; y: number }> {
  const result: Array<{ x: number; y: number }> = [];

  for (let dy = -viewportRadius; dy <= viewportRadius; dy++) {
    for (let dx = -viewportRadius; dx <= viewportRadius; dx++) {
      const x = centerX + dx;
      const y = centerY + dy;
      // Only include tiles within map bounds
      if (x >= 0 && x < mapWidth && y >= 0 && y < mapHeight) {
        result.push({ x, y });
      }
    }
  }

  // Sort for proper rendering order (top to bottom, left to right)
  return result.sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });
}

interface IsometricViewProps {
  map: GameMap;
  tiles: Tile[];
  buildings: (BuildingInstance & { name?: string; building_type_id?: string })[];
  activeCompanyId: string;
  centerTile: { x: number; y: number };
  selectedTile: { x: number; y: number } | null;
  onTileClick: (coords: { x: number; y: number }) => void;
  onCenterChange: (coords: { x: number; y: number }) => void;
}

/**
 * Isometric zoomed view with sprite rendering
 * Shows a ~15x15 tile area with building sprites
 */
// Outline expansion size (must match OutlineGeneratorTool OUTLINE_SIZE)
const OUTLINE_EXPANSION = 24;

export function IsometricView({
  map,
  tiles,
  buildings,
  activeCompanyId,
  centerTile,
  selectedTile,
  onTileClick,
  onCenterChange,
}: IsometricViewProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tintCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragDistance, setDragDistance] = useState(0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [baseTileSize, setBaseTileSize] = useState(
    typeof window !== 'undefined' && window.innerWidth < BREAKPOINT ? MOBILE_TILE_SIZE : DESKTOP_TILE_SIZE
  );
  const [hoveredBuilding, setHoveredBuilding] = useState<{
    building: BuildingInstance & { name?: string; building_type_id?: string };
    screenX: number;
    screenY: number;
  } | null>(null);

  // Create offscreen canvas for tinting outlines (lazy init)
  const getTintCanvas = useCallback(() => {
    if (!tintCanvasRef.current) {
      tintCanvasRef.current = document.createElement('canvas');
    }
    return tintCanvasRef.current;
  }, []);

  // Tint a white outline image with a color
  const tintOutline = useCallback((outline: HTMLImageElement, color: string): HTMLCanvasElement => {
    const tintCanvas = getTintCanvas();
    tintCanvas.width = outline.naturalWidth;
    tintCanvas.height = outline.naturalHeight;
    const tintCtx = tintCanvas.getContext('2d')!;

    // Draw the white outline
    tintCtx.clearRect(0, 0, tintCanvas.width, tintCanvas.height);
    tintCtx.drawImage(outline, 0, 0);

    // Tint it with the color using source-in composite
    tintCtx.globalCompositeOperation = 'source-in';
    tintCtx.fillStyle = color;
    tintCtx.fillRect(0, 0, tintCanvas.width, tintCanvas.height);
    tintCtx.globalCompositeOperation = 'source-over';

    return tintCanvas;
  }, [getTintCanvas]);

  // Preload sprites
  const { sprites, grassBackground, isLoading, loadingProgress } = useIsometricAssets();

  // Build lookup maps for O(1) access
  const tileMap = useMemo(() => {
    const m = new Map<string, Tile>();
    tiles.forEach((t) => m.set(`${t.x},${t.y}`, t));
    return m;
  }, [tiles]);

  const buildingMap = useMemo(() => {
    const m = new Map<string, BuildingInstance & { name?: string; building_type_id?: string }>();
    buildings.forEach((b) => m.set(b.tile_id, b));
    return m;
  }, [buildings]);

  // Get highlight function for company colors
  const { getCompanyHighlight } = useHighlights();

  // Get visible tiles
  const visibleTiles = useMemo(() => {
    return getVisibleTilesNoWrap(centerTile.x, centerTile.y, map.width, map.height);
  }, [centerTile, map.width, map.height]);

  // Render function
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || isLoading) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high-DPI displays - scale context for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Calculate logical dimensions (CSS pixels, not buffer pixels)
    const logicalWidth = canvas.width / dpr;
    const logicalHeight = canvas.height / dpr;

    // Enable high-quality image smoothing for AI-generated sprites
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const tileSize = baseTileSize * zoom;
    // Base scale depends on tile size: 64px = 0.2, 128px = 0.4
    const baseScale = baseTileSize / 320;
    const screenCenterX = logicalWidth / 2 + panOffset.x;
    const screenCenterY = logicalHeight / 2 + panOffset.y;

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);

    // Draw grass background (tiled, scrolls with map)
    if (grassBackground) {
      const bgSize = 512 * zoom;
      // Calculate start position for seamless tiling that follows pan
      const startX = ((panOffset.x % bgSize) + bgSize) % bgSize - bgSize;
      const startY = ((panOffset.y % bgSize) + bgSize) % bgSize - bgSize;

      // Tile background across canvas
      for (let x = startX; x < logicalWidth; x += bgSize) {
        for (let y = startY; y < logicalHeight; y += bgSize) {
          ctx.drawImage(grassBackground, x, y, bgSize, bgSize);
        }
      }
    }

    // Render each visible tile
    for (const { x, y } of visibleTiles) {
      const tile = tileMap.get(`${x},${y}`);
      if (!tile) continue;

      // Calculate relative position from center (no wrapping)
      const relX = x - centerTile.x;
      const relY = y - centerTile.y;

      const { screenX, screenY } = gridToScreen(relX, relY, screenCenterX, screenCenterY, zoom, baseTileSize);

      // Skip if off-screen
      if (
        screenX < -tileSize ||
        screenX > logicalWidth + tileSize ||
        screenY < -tileSize ||
        screenY > logicalHeight + tileSize
      ) {
        continue;
      }

      // Draw terrain for non-free_land tiles (water, road, dirt, trees)
      if (tile.terrain_type !== 'free_land') {
        // Try to draw terrain sprite first
        const terrainSprite = getTerrainSprite(sprites, tile.terrain_type);
        if (terrainSprite) {
          const spriteWidth = terrainSprite.naturalWidth * baseScale * zoom;
          const spriteHeight = terrainSprite.naturalHeight * baseScale * zoom;
          ctx.drawImage(
            terrainSprite,
            screenX - spriteWidth / 2,
            screenY - spriteHeight + tileSize / 2,
            spriteWidth,
            spriteHeight
          );
        } else {
          // Fallback to color
          const color = TERRAIN_COLORS[tile.terrain_type] || TERRAIN_COLORS.free_land;
          ctx.fillStyle = color;
          ctx.fillRect(screenX - tileSize / 2, screenY - tileSize / 2, tileSize, tileSize);
        }
      }

      // Draw special building indicator (temple, bank, police)
      if (tile.special_building) {
        const specialSprite = getSprite(sprites, tile.special_building);
        if (specialSprite) {
          // Apply per-building map scale from Asset Manager
          const mapScale = getBuildingMapScale(tile.special_building);
          const spriteWidth = specialSprite.naturalWidth * baseScale * zoom * mapScale;
          const spriteHeight = specialSprite.naturalHeight * baseScale * zoom * mapScale;

          // Center horizontally on tile, bottom at tile center
          ctx.drawImage(
            specialSprite,
            screenX - spriteWidth / 2,
            screenY - spriteHeight + tileSize / 2,
            spriteWidth,
            spriteHeight
          );
        } else {
          // Fallback: colored rectangle for special buildings
          const colors: Record<string, string> = {
            temple: '#fbbf24',
            bank: '#94a3b8',
            police_station: '#3b82f6',
          };
          ctx.fillStyle = colors[tile.special_building] || '#ffffff';
          ctx.fillRect(screenX - tileSize / 4, screenY - tileSize / 2, tileSize / 2, tileSize / 2);
        }
      }

      // Draw building if present
      const building = buildingMap.get(tile.id);
      if (building) {
        const buildingTypeId = building.building_type_id || 'shop';

        // Use demolished sprite for collapsed buildings
        const effectiveTypeId = building.is_collapsed ? 'demolished' : buildingTypeId;
        const buildingSprite = getSprite(sprites, effectiveTypeId);

        if (buildingSprite) {
          // Apply per-building map scale from Asset Manager
          const mapScale = getBuildingMapScale(effectiveTypeId);
          const spriteWidth = buildingSprite.naturalWidth * baseScale * zoom * mapScale;
          const spriteHeight = buildingSprite.naturalHeight * baseScale * zoom * mapScale;

          // Check if we need to draw an outline (owned building or tracked company)
          const isOwned = building.company_id === activeCompanyId;
          const highlightColor = !isOwned && building.company_id
            ? getCompanyHighlight(building.company_id)
            : null;
          const outlineColor = isOwned ? 'rgba(59, 130, 246, 0.9)' : highlightColor;

          // Draw outline behind building if applicable
          if (outlineColor && !building.is_collapsed) {
            const outlineSprite = getBuildingOutline(sprites, effectiveTypeId);
            if (outlineSprite) {
              // Tint the white outline with the highlight color
              const tintedOutline = tintOutline(outlineSprite, outlineColor);

              // Outline is OUTLINE_EXPANSION pixels larger on each side
              // Scale the expansion with the same factor as the sprite
              const outlineScale = baseScale * zoom * mapScale;
              const outlineWidth = outlineSprite.naturalWidth * outlineScale;
              const outlineHeight = outlineSprite.naturalHeight * outlineScale;
              const expansionScaled = OUTLINE_EXPANSION * outlineScale;

              // Position outline so its inner sprite area aligns with the sprite
              // Sprite top-left is at (screenX - spriteWidth/2, screenY - spriteHeight + tileSize/2)
              // Outline needs to be offset by -expansionScaled on both axes
              ctx.drawImage(
                tintedOutline,
                screenX - spriteWidth / 2 - expansionScaled,
                screenY - spriteHeight + tileSize / 2 - expansionScaled,
                outlineWidth,
                outlineHeight
              );
            }
          }

          // Building sprite centered horizontally, bottom at tile bottom
          ctx.drawImage(
            buildingSprite,
            screenX - spriteWidth / 2,
            screenY - spriteHeight + tileSize / 2,
            spriteWidth,
            spriteHeight
          );

          // Damage overlay (darken based on damage)
          if (building.damage_percent > 0 && !building.is_collapsed) {
            ctx.fillStyle = `rgba(0, 0, 0, ${building.damage_percent / 200})`;
            ctx.fillRect(
              screenX - spriteWidth / 2,
              screenY - spriteHeight + tileSize / 2,
              spriteWidth,
              spriteHeight
            );
          }

          // Fire effect - use published overlay sprite
          if (building.is_on_fire) {
            const fireOverlay = getDirtyTrickOverlay(sprites, 'fire');
            if (fireOverlay) {
              const overlayScale = baseScale * zoom;
              const overlayWidth = fireOverlay.naturalWidth * overlayScale;
              const overlayHeight = fireOverlay.naturalHeight * overlayScale;
              ctx.globalAlpha = 0.8;
              ctx.drawImage(
                fireOverlay,
                screenX - overlayWidth / 2,
                screenY - overlayHeight + tileSize / 2,
                overlayWidth,
                overlayHeight
              );
              ctx.globalAlpha = 1.0;
            }
          }

          // For sale indicator - use published overlay sprite
          if (building.is_for_sale) {
            const forSaleOverlay = getDirtyTrickOverlay(sprites, 'for_sale');
            if (forSaleOverlay) {
              const overlayScale = baseScale * zoom;
              const overlayWidth = forSaleOverlay.naturalWidth * overlayScale;
              const overlayHeight = forSaleOverlay.naturalHeight * overlayScale;
              ctx.drawImage(
                forSaleOverlay,
                screenX - overlayWidth / 2,
                screenY - overlayHeight + tileSize / 2,
                overlayWidth,
                overlayHeight
              );
            }
          }
        }
      }

      // Draw claim stake for owned land without buildings
      if (tile.owner_company_id && !building && !tile.special_building) {
        const stakeSprite = getSprite(sprites, 'claim_stake');
        if (stakeSprite) {
          // Apply per-building map scale from Asset Manager (defaults to 1.0, can be adjusted)
          const mapScale = getBuildingMapScale('claim_stake');
          const stakeScale = baseScale * 0.75 * mapScale;
          const spriteWidth = stakeSprite.naturalWidth * stakeScale * zoom;
          const spriteHeight = stakeSprite.naturalHeight * stakeScale * zoom;

          // Blue outline for user's own claim stakes, or highlight color for tracked companies
          const isOwned = tile.owner_company_id === activeCompanyId;
          const stakeHighlightColor = !isOwned
            ? getCompanyHighlight(tile.owner_company_id) : null;
          const stakeOutlineColor = isOwned ? 'rgba(59, 130, 246, 0.9)' : stakeHighlightColor;

          // Draw outline behind claim stake if applicable
          if (stakeOutlineColor) {
            const outlineSprite = getBuildingOutline(sprites, 'claim_stake');
            if (outlineSprite) {
              const tintedOutline = tintOutline(outlineSprite, stakeOutlineColor);
              const outlineScale = stakeScale * zoom;
              const outlineWidth = outlineSprite.naturalWidth * outlineScale;
              const outlineHeight = outlineSprite.naturalHeight * outlineScale;
              const expansionScaled = OUTLINE_EXPANSION * outlineScale;

              // Position outline so its inner sprite area aligns with the stake
              ctx.drawImage(
                tintedOutline,
                screenX - spriteWidth / 2 - expansionScaled,
                screenY - spriteHeight + tileSize / 2 - expansionScaled,
                outlineWidth,
                outlineHeight
              );
            }
          }

          ctx.drawImage(
            stakeSprite,
            screenX - spriteWidth / 2,
            screenY - spriteHeight + tileSize / 2,
            spriteWidth,
            spriteHeight
          );
        }
      }

      // Selection highlight
      if (selectedTile && x === selectedTile.x && y === selectedTile.y) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3 * zoom;
        ctx.strokeRect(
          screenX - tileSize / 2 + 2,
          screenY - tileSize / 2 + 2,
          tileSize - 4,
          tileSize - 4
        );
      }
    }
  }, [
    visibleTiles,
    sprites,
    grassBackground,
    isLoading,
    tileMap,
    buildingMap,
    activeCompanyId,
    centerTile,
    zoom,
    panOffset,
    selectedTile,
    map.width,
    map.height,
    baseTileSize,
    getCompanyHighlight,
    tintOutline,
  ]);

  // Render on changes
  useEffect(() => {
    render();
  }, [render]);

  // Handle canvas resize and responsive tile size
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas || !canvas.parentElement) return;

      // Handle high-DPI displays (retina) for crisp rendering
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.parentElement.getBoundingClientRect();

      // Set canvas buffer size (actual pixels)
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      // Set CSS display size (logical pixels)
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';

      // Update tile size based on screen width
      const newTileSize = window.innerWidth < BREAKPOINT ? MOBILE_TILE_SIZE : DESKTOP_TILE_SIZE;
      setBaseTileSize(newTileSize);

      render();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [render]);

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setDragDistance(0);
    setHoveredBuilding(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Update hover state when not dragging
    if (!isDragging) {
      const screenCenterX = rect.width / 2 + panOffset.x;
      const screenCenterY = rect.height / 2 + panOffset.y;

      const { gridX, gridY } = screenToGrid(
        e.clientX - rect.left,
        e.clientY - rect.top,
        screenCenterX,
        screenCenterY,
        zoom,
        baseTileSize
      );

      const x = clampCoordinate(centerTile.x + gridX, 0, map.width - 1);
      const y = clampCoordinate(centerTile.y + gridY, 0, map.height - 1);

      const tile = tileMap.get(`${x},${y}`);
      if (tile) {
        const building = buildingMap.get(tile.id);
        if (building) {
          setHoveredBuilding({
            building,
            screenX: e.clientX - rect.left,
            screenY: e.clientY - rect.top,
          });
        } else {
          setHoveredBuilding(null);
        }
      } else {
        setHoveredBuilding(null);
      }
      return;
    }

    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;

    // Track total drag distance
    setDragDistance((prev) => prev + Math.abs(dx) + Math.abs(dy));
    setDragStart({ x: e.clientX, y: e.clientY });

    // Check if we're at map edges - prevent pan accumulation if so
    const atLeftEdge = centerTile.x === 0;
    const atRightEdge = centerTile.x === map.width - 1;
    const atTopEdge = centerTile.y === 0;
    const atBottomEdge = centerTile.y === map.height - 1;

    // Only accumulate pan offset if we can actually move in that direction
    const effectiveDx = (atLeftEdge && dx > 0) || (atRightEdge && dx < 0) ? 0 : dx;
    const effectiveDy = (atTopEdge && dy > 0) || (atBottomEdge && dy < 0) ? 0 : dy;

    const newPanX = panOffset.x + effectiveDx;
    const newPanY = panOffset.y + effectiveDy;
    setPanOffset({ x: newPanX, y: newPanY });

    // Update center tile when panned far enough
    const threshold = baseTileSize * zoom;

    if (Math.abs(newPanX) > threshold || Math.abs(newPanY) > threshold) {
      const tileShiftX = Math.round(newPanX / threshold);
      const tileShiftY = Math.round(newPanY / threshold);

      if (tileShiftX !== 0 || tileShiftY !== 0) {
        const newX = clampCoordinate(centerTile.x - tileShiftX, 0, map.width - 1);
        const newY = clampCoordinate(centerTile.y - tileShiftY, 0, map.height - 1);
        onCenterChange({ x: newX, y: newY });
        setPanOffset({ x: 0, y: 0 });
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setIsDragging(false);

    // Only trigger click if mouse didn't move much (not a drag)
    if (dragDistance < 10) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const screenCenterX = rect.width / 2 + panOffset.x;
      const screenCenterY = rect.height / 2 + panOffset.y;

      const { gridX, gridY } = screenToGrid(
        e.clientX - rect.left,
        e.clientY - rect.top,
        screenCenterX,
        screenCenterY,
        zoom,
        baseTileSize
      );

      const x = clampCoordinate(centerTile.x + gridX, 0, map.width - 1);
      const y = clampCoordinate(centerTile.y + gridY, 0, map.height - 1);

      onTileClick({ x, y });
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.max(0.5, Math.min(2, z + delta)));
  };

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX, y: touch.clientY });
      setDragDistance(0);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    e.preventDefault(); // Prevent page scroll

    const touch = e.touches[0];
    const dx = touch.clientX - dragStart.x;
    const dy = touch.clientY - dragStart.y;

    // Track total drag distance
    setDragDistance((prev) => prev + Math.abs(dx) + Math.abs(dy));
    setDragStart({ x: touch.clientX, y: touch.clientY });

    // Check if we're at map edges - prevent pan accumulation if so
    const atLeftEdge = centerTile.x === 0;
    const atRightEdge = centerTile.x === map.width - 1;
    const atTopEdge = centerTile.y === 0;
    const atBottomEdge = centerTile.y === map.height - 1;

    // Only accumulate pan offset if we can actually move in that direction
    const effectiveDx = (atLeftEdge && dx > 0) || (atRightEdge && dx < 0) ? 0 : dx;
    const effectiveDy = (atTopEdge && dy > 0) || (atBottomEdge && dy < 0) ? 0 : dy;

    const newPanX = panOffset.x + effectiveDx;
    const newPanY = panOffset.y + effectiveDy;
    setPanOffset({ x: newPanX, y: newPanY });

    // Update center tile when panned far enough
    const threshold = baseTileSize * zoom;

    if (Math.abs(newPanX) > threshold || Math.abs(newPanY) > threshold) {
      const tileShiftX = Math.round(newPanX / threshold);
      const tileShiftY = Math.round(newPanY / threshold);

      if (tileShiftX !== 0 || tileShiftY !== 0) {
        const newX = clampCoordinate(centerTile.x - tileShiftX, 0, map.width - 1);
        const newY = clampCoordinate(centerTile.y - tileShiftY, 0, map.height - 1);
        onCenterChange({ x: newX, y: newY });
        setPanOffset({ x: 0, y: 0 });
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isDragging) return;
    setIsDragging(false);

    // Only trigger click if finger didn't move much (not a drag)
    if (dragDistance < 10 && e.changedTouches.length === 1) {
      const touch = e.changedTouches[0];
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const screenCenterX = rect.width / 2 + panOffset.x;
      const screenCenterY = rect.height / 2 + panOffset.y;

      const { gridX, gridY } = screenToGrid(
        touch.clientX - rect.left,
        touch.clientY - rect.top,
        screenCenterX,
        screenCenterY,
        zoom,
        baseTileSize
      );

      const x = clampCoordinate(centerTile.x + gridX, 0, map.width - 1);
      const y = clampCoordinate(centerTile.y + gridY, 0, map.height - 1);

      onTileClick({ x, y });
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-gray-900">
        <div className="text-center">
          <div className="relative w-24 h-24 mx-auto mb-4">
            <svg className="animate-spin h-24 w-24" viewBox="0 0 100 100">
              <circle
                className="stroke-gray-700"
                strokeWidth="8"
                fill="none"
                cx="50"
                cy="50"
                r="40"
              />
              <circle
                className="stroke-blue-500"
                strokeWidth="8"
                fill="none"
                cx="50"
                cy="50"
                r="40"
                strokeDasharray={`${loadingProgress * 251.2} 251.2`}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white text-lg font-bold">
                {Math.round(loadingProgress * 100)}%
              </span>
            </div>
          </div>
          <p className="text-white">Loading assets...</p>
        </div>
      </div>
    );
  }

  // Format building type for display (e.g., "high_street_store" -> "High Street Store")
  const formatBuildingType = (typeId: string) => {
    return typeId
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className={`w-full h-full ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} touch-none`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setIsDragging(false);
          setHoveredBuilding(null);
        }}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
      {hoveredBuilding && (
        <div
          className="absolute pointer-events-none bg-gray-900/95 border border-gray-600 rounded-lg px-3 py-2 text-sm shadow-lg z-50"
          style={{
            left: hoveredBuilding.screenX + 12,
            top: hoveredBuilding.screenY + 12,
            transform: hoveredBuilding.screenX > window.innerWidth / 2 ? 'translateX(-100%)' : 'none',
          }}
        >
          <div className="text-white font-semibold">
            {hoveredBuilding.building.name || formatBuildingType(hoveredBuilding.building.building_type_id || 'Unknown')}
          </div>
          {hoveredBuilding.building.variant && (
            <div className="text-gray-300">
              Variant: <span className="text-amber-400">{hoveredBuilding.building.variant}</span>
            </div>
          )}
          <div className="text-gray-300">
            Health: <span className={hoveredBuilding.building.damage_percent > 50 ? 'text-red-400' : hoveredBuilding.building.damage_percent > 20 ? 'text-yellow-400' : 'text-green-400'}>
              {100 - hoveredBuilding.building.damage_percent}%
            </span>
          </div>
          <div className="text-gray-300">
            Value: <span className="text-emerald-400">
              ${hoveredBuilding.building.calculated_value?.toLocaleString() ?? 'N/A'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
