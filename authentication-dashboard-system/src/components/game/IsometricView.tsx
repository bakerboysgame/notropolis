import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { GameMap, Tile, BuildingInstance } from '../../types/game';
import { useIsometricAssets, getSprite, getTerrainSprite } from '../../hooks/useIsometricAssets';
import {
  TERRAIN_COLORS,
  gridToScreen,
  screenToGrid,
  wrapCoordinate,
  getVisibleTiles,
  getRelativePosition,
} from '../../utils/isometricRenderer';

// Responsive tile size: 64px for mobile/tablet, 128px for desktop
const MOBILE_TILE_SIZE = 64;
const DESKTOP_TILE_SIZE = 128;
const BREAKPOINT = 1024; // lg breakpoint

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
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragDistance, setDragDistance] = useState(0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [baseTileSize, setBaseTileSize] = useState(
    typeof window !== 'undefined' && window.innerWidth < BREAKPOINT ? MOBILE_TILE_SIZE : DESKTOP_TILE_SIZE
  );

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

  // Get visible tiles
  const visibleTiles = useMemo(() => {
    return getVisibleTiles(centerTile.x, centerTile.y, map.width, map.height);
  }, [centerTile, map.width, map.height]);

  // Render function
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || isLoading) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Disable image smoothing for crisp pixel rendering when scaling sprites
    ctx.imageSmoothingEnabled = false;

    const tileSize = baseTileSize * zoom;
    // Base scale depends on tile size: 64px = 0.2, 128px = 0.4
    const baseScale = baseTileSize / 320;
    const screenCenterX = canvas.width / 2 + panOffset.x;
    const screenCenterY = canvas.height / 2 + panOffset.y;

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grass background (tiled)
    if (grassBackground) {
      const bgSize = 512 * zoom;
      // Calculate offset for seamless tiling
      const offsetX = ((screenCenterX % bgSize) + bgSize) % bgSize;
      const offsetY = ((screenCenterY % bgSize) + bgSize) % bgSize;

      // Draw enough tiles to cover the canvas
      for (let x = -bgSize + offsetX; x < canvas.width + bgSize; x += bgSize) {
        for (let y = -bgSize + offsetY; y < canvas.height + bgSize; y += bgSize) {
          ctx.drawImage(grassBackground, x - offsetX, y - offsetY, bgSize, bgSize);
        }
      }
    }

    // Render each visible tile
    for (const { x, y } of visibleTiles) {
      const tile = tileMap.get(`${x},${y}`);
      if (!tile) continue;

      // Calculate relative position from center (with wrapping)
      const { relX, relY } = getRelativePosition(
        x,
        y,
        centerTile.x,
        centerTile.y,
        map.width,
        map.height
      );

      const { screenX, screenY } = gridToScreen(relX, relY, screenCenterX, screenCenterY, zoom, baseTileSize);

      // Skip if off-screen
      if (
        screenX < -tileSize ||
        screenX > canvas.width + tileSize ||
        screenY < -tileSize ||
        screenY > canvas.height + tileSize
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

      // Draw ownership overlay
      if (tile.owner_company_id) {
        ctx.fillStyle =
          tile.owner_company_id === activeCompanyId
            ? 'rgba(59, 130, 246, 0.25)' // Royal blue for owned
            : 'rgba(239, 68, 68, 0.2)'; // Red for enemy
        ctx.fillRect(screenX - tileSize / 2, screenY - tileSize / 2, tileSize, tileSize);
      }

      // Draw special building indicator (temple, bank, police)
      if (tile.special_building) {
        const specialSprite = getSprite(sprites, tile.special_building);
        if (specialSprite) {
          const spriteWidth = specialSprite.naturalWidth * baseScale * zoom;
          const spriteHeight = specialSprite.naturalHeight * baseScale * zoom;

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
          const spriteWidth = buildingSprite.naturalWidth * baseScale * zoom;
          const spriteHeight = buildingSprite.naturalHeight * baseScale * zoom;

          // Ownership glow (blue halo for user's buildings)
          const isOwned = tile.owner_company_id === activeCompanyId;
          if (isOwned) {
            ctx.shadowColor = 'rgba(59, 130, 246, 0.8)';
            ctx.shadowBlur = 12 * zoom;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
          }

          // Building sprite centered horizontally, bottom at tile bottom
          ctx.drawImage(
            buildingSprite,
            screenX - spriteWidth / 2,
            screenY - spriteHeight + tileSize / 2,
            spriteWidth,
            spriteHeight
          );

          // Reset shadow
          if (isOwned) {
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
          }

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

          // Fire effect
          if (building.is_on_fire) {
            ctx.fillStyle = 'rgba(255, 100, 0, 0.4)';
            ctx.fillRect(
              screenX - spriteWidth / 2,
              screenY - spriteHeight + tileSize / 2,
              spriteWidth,
              spriteHeight
            );
          }

          // For sale indicator (golden glow)
          if (building.is_for_sale) {
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 2 * zoom;
            ctx.strokeRect(
              screenX - spriteWidth / 2 - 2,
              screenY - spriteHeight + tileSize / 2 - 2,
              spriteWidth + 4,
              spriteHeight + 4
            );
          }
        } else {
          // Fallback: draw a simple building indicator
          ctx.fillStyle = building.is_on_fire ? '#ef4444' : '#ffffff';
          ctx.beginPath();
          ctx.arc(screenX, screenY - tileSize / 4, tileSize / 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw claim stake for owned land without buildings
      if (tile.owner_company_id && !building && !tile.special_building) {
        const stakeSprite = getSprite(sprites, 'claim_stake');
        if (stakeSprite) {
          // Stakes are smaller at 75% of normal building scale
          const stakeScale = baseScale * 0.75;
          const spriteWidth = stakeSprite.naturalWidth * stakeScale * zoom;
          const spriteHeight = stakeSprite.naturalHeight * stakeScale * zoom;
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

      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;

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
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;

    // Track total drag distance
    setDragDistance((prev) => prev + Math.abs(dx) + Math.abs(dy));

    setPanOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    setDragStart({ x: e.clientX, y: e.clientY });

    // Update center tile when panned far enough
    const threshold = baseTileSize * zoom;
    const newPanX = panOffset.x + dx;
    const newPanY = panOffset.y + dy;

    if (Math.abs(newPanX) > threshold || Math.abs(newPanY) > threshold) {
      const tileShiftX = Math.round(newPanX / threshold);
      const tileShiftY = Math.round(newPanY / threshold);

      if (tileShiftX !== 0 || tileShiftY !== 0) {
        const newX = wrapCoordinate(centerTile.x - tileShiftX, map.width);
        const newY = wrapCoordinate(centerTile.y - tileShiftY, map.height);
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

      const x = wrapCoordinate(centerTile.x + gridX, map.width);
      const y = wrapCoordinate(centerTile.y + gridY, map.height);

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

    setPanOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    setDragStart({ x: touch.clientX, y: touch.clientY });

    // Update center tile when panned far enough
    const threshold = baseTileSize * zoom;
    const newPanX = panOffset.x + dx;
    const newPanY = panOffset.y + dy;

    if (Math.abs(newPanX) > threshold || Math.abs(newPanY) > threshold) {
      const tileShiftX = Math.round(newPanX / threshold);
      const tileShiftY = Math.round(newPanY / threshold);

      if (tileShiftX !== 0 || tileShiftY !== 0) {
        const newX = wrapCoordinate(centerTile.x - tileShiftX, map.width);
        const newY = wrapCoordinate(centerTile.y - tileShiftY, map.height);
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

      const x = wrapCoordinate(centerTile.x + gridX, map.width);
      const y = wrapCoordinate(centerTile.y + gridY, map.height);

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

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} touch-none`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => setIsDragging(false)}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    />
  );
}
