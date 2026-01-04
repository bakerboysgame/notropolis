import { useRef, useEffect, useState, useMemo } from 'react';
import { GameMap, Tile, BuildingInstance } from '../../types/game';
import { renderMap, screenToTile } from '../../utils/mapRenderer';
import { useHighlights } from '../../contexts/HighlightContext';

interface MapCanvasProps {
  map: GameMap;
  tiles: Tile[];
  buildings: (BuildingInstance & { name?: string })[];
  activeCompanyId: string;
  zoom: number;
  offset: { x: number; y: number };
  onTileClick: (coords: { x: number; y: number }) => void;
  onPan: (offset: { x: number; y: number }) => void;
  onZoom: (zoom: number) => void;
}

/**
 * Canvas-based map renderer with pan/zoom support
 * Uses viewport culling for performance with large maps
 */
export function MapCanvas({
  map,
  tiles,
  buildings,
  activeCompanyId,
  zoom,
  offset,
  onTileClick,
  onPan,
  onZoom,
}: MapCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [clickStart, setClickStart] = useState({ x: 0, y: 0 });

  // Convert arrays to maps for O(1) lookup
  const tileMap = useMemo(() => {
    const m = new Map<string, Tile>();
    tiles.forEach(t => m.set(`${t.x},${t.y}`, t));
    return m;
  }, [tiles]);

  const buildingMap = useMemo(() => {
    const m = new Map<string, BuildingInstance>();
    buildings.forEach(b => m.set(b.tile_id, b));
    return m;
  }, [buildings]);

  // Get highlighted companies and convert to Map<companyId, color>
  const { highlightedCompanies } = useHighlights();
  const highlightMap = useMemo(() => {
    const m = new Map<string, string>();
    highlightedCompanies.forEach((data, id) => m.set(id, data.color));
    return m;
  }, [highlightedCompanies]);

  // Render map whenever dependencies change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderMap(ctx, map, tileMap, buildingMap, activeCompanyId, zoom, offset, highlightMap);
  }, [map, tileMap, buildingMap, activeCompanyId, zoom, offset, highlightMap]);

  // Handle canvas resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas || !canvas.parentElement) return;

      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;

      // Re-render after resize
      const ctx = canvas.getContext('2d');
      if (ctx) {
        renderMap(ctx, map, tileMap, buildingMap, activeCompanyId, zoom, offset, highlightMap);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [map, tileMap, buildingMap, activeCompanyId, zoom, offset, highlightMap]);

  // Mouse down handler
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // Left click only
      setIsDragging(true);
      setLastMouse({ x: e.clientX, y: e.clientY });
      setClickStart({ x: e.clientX, y: e.clientY });
    }
  };

  // Mouse move handler (panning)
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const dx = e.clientX - lastMouse.x;
      const dy = e.clientY - lastMouse.y;
      onPan({ x: offset.x + dx, y: offset.y + dy });
      setLastMouse({ x: e.clientX, y: e.clientY });
    }
  };

  // Mouse up handler
  const handleMouseUp = (e: React.MouseEvent) => {
    if (isDragging) {
      setIsDragging(false);

      // Only trigger click if mouse didn't move much (not a drag)
      const dx = Math.abs(e.clientX - clickStart.x);
      const dy = Math.abs(e.clientY - clickStart.y);

      if (dx < 5 && dy < 5) {
        // This was a click, not a drag
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const tileCoords = screenToTile(screenX, screenY, zoom, offset);

        // Validate coordinates are within map bounds
        if (
          tileCoords.x >= 0 && tileCoords.x < map.width &&
          tileCoords.y >= 0 && tileCoords.y < map.height
        ) {
          onTileClick(tileCoords);
        }
      }
    }
  };

  // Mouse leave handler
  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  // Wheel handler (zooming)
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.max(0.5, Math.min(4, zoom + delta));
    onZoom(newZoom);
  };

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setLastMouse({ x: touch.clientX, y: touch.clientY });
      setClickStart({ x: touch.clientX, y: touch.clientY });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    e.preventDefault(); // Prevent page scroll

    const touch = e.touches[0];
    const dx = touch.clientX - lastMouse.x;
    const dy = touch.clientY - lastMouse.y;
    onPan({ x: offset.x + dx, y: offset.y + dy });
    setLastMouse({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isDragging) return;
    setIsDragging(false);

    if (e.changedTouches.length === 1) {
      const touch = e.changedTouches[0];
      const dx = Math.abs(touch.clientX - clickStart.x);
      const dy = Math.abs(touch.clientY - clickStart.y);

      // Only trigger click if finger didn't move much (not a drag)
      if (dx < 10 && dy < 10) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const screenX = touch.clientX - rect.left;
        const screenY = touch.clientY - rect.top;
        const tileCoords = screenToTile(screenX, screenY, zoom, offset);

        if (
          tileCoords.x >= 0 && tileCoords.x < map.width &&
          tileCoords.y >= 0 && tileCoords.y < map.height
        ) {
          onTileClick(tileCoords);
        }
      }
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className={`${isDragging ? 'cursor-grabbing' : 'cursor-grab'} touch-none`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    />
  );
}
