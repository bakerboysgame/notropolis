import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, Navigate } from 'react-router-dom';
import { useActiveCompany } from '../contexts/CompanyContext';
import { useGameMap } from '../hooks/useGameMap';
import { MapCanvas } from '../components/game/MapCanvas';
import { PixiGame } from '../components/game/pixijs/PixiGame';
import { PropertyModal } from '../components/game/PropertyModal';
import { MapLegend } from '../components/game/MapLegend';
import { MapControls } from '../components/game/MapControls';

type ViewMode = 'overview' | 'zoomed';

/**
 * Main game map page with two view modes:
 * - Overview: Colored grid view (existing MapCanvas) - read-only, click to zoom in
 * - Zoomed: Isometric view with sprites - full property actions via modal
 */
export function GameMap(): JSX.Element {
  const { mapId } = useParams<{ mapId: string }>();
  const [searchParams] = useSearchParams();
  const { activeCompany } = useActiveCompany();
  const { mapData, isLoading, error, refetch } = useGameMap(mapId);

  // Check for initial coordinates from URL (e.g., /map/123?x=5&y=10)
  const initialX = searchParams.get('x');
  const initialY = searchParams.get('y');
  const openModal = searchParams.get('modal') === 'true';
  const hasInitialCoords = initialX !== null && initialY !== null;
  const initialCoords = hasInitialCoords ? { x: parseInt(initialX, 10), y: parseInt(initialY, 10) } : null;

  // View mode state - start in zoomed mode if coordinates provided
  const [viewMode, setViewMode] = useState<ViewMode>(hasInitialCoords ? 'zoomed' : 'overview');

  // Broadcast view mode changes for Layout to use (overlay sidebar in zoomed mode)
  useEffect(() => {
    localStorage.setItem('mapViewMode', viewMode);
    window.dispatchEvent(new CustomEvent('mapViewModeChange', { detail: viewMode }));

    // Cleanup on unmount - reset to overview so Layout knows we're not on map
    return () => {
      localStorage.setItem('mapViewMode', 'none');
      window.dispatchEvent(new CustomEvent('mapViewModeChange', { detail: 'none' }));
    };
  }, [viewMode]);

  // Listen for toggle view mode events from Sidebar
  useEffect(() => {
    const handleToggleViewMode = () => {
      setViewMode((prev) => (prev === 'overview' ? 'zoomed' : 'overview'));
    };
    window.addEventListener('toggleMapViewMode', handleToggleViewMode);
    return () => window.removeEventListener('toggleMapViewMode', handleToggleViewMode);
  }, []);

  // Modal state for zoomed view - open automatically if modal=true in URL
  const [modalTile, setModalTile] = useState<{ x: number; y: number } | null>(
    openModal && initialCoords ? initialCoords : null
  );

  // Overview mode state
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Redirect if no active company
  if (!activeCompany) {
    return <Navigate to="/companies" replace />;
  }

  // Redirect if company not on a map
  if (!activeCompany.current_map_id) {
    return <Navigate to="/companies" replace />;
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white">Loading map...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !mapData) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-6xl mb-4">!</div>
          <h2 className="text-white text-2xl font-bold mb-2">Failed to Load Map</h2>
          <p className="text-gray-400 mb-4">{error || 'Unknown error'}</p>
          <a
            href="/companies"
            className="inline-block px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Return to Companies
          </a>
        </div>
      </div>
    );
  }

  const { map, tiles, buildings } = mapData;

  // Convert API tiles to PixiJS format
  const pixiTiles = useMemo(() => {
    const buildingMap = new Map(buildings.map((b) => [b.tile_id, b.building_type_id]));

    return tiles.map((tile) => {
      // Map terrain types to PixiJS types
      let type: 'building' | 'road' | 'water' | 'dirt_track' | 'grass';

      if (buildingMap.has(tile.id)) {
        type = 'building';
      } else if (tile.terrain_type === 'water') {
        type = 'water';
      } else if (tile.terrain_type === 'road') {
        type = 'road';
      } else if (tile.terrain_type === 'dirt_track') {
        type = 'dirt_track';
      } else {
        type = 'grass'; // free_land, trees, etc.
      }

      return {
        x: tile.x,
        y: tile.y,
        type,
        buildingType: buildingMap.get(tile.id),
      };
    });
  }, [tiles, buildings]);

  // Handle click in overview mode - transition to zoomed view
  const handleOverviewClick = () => {
    setViewMode('zoomed');
  };

  // Handle click in zoomed mode - open property modal (skip terrain tiles)
  const handleZoomedClick = (x: number, y: number) => {
    // Find the tile at these coordinates
    const tile = tiles.find((t) => t.x === x && t.y === y);

    // Don't open modal for terrain objects (water, road, trees, etc.)
    // These are owned by the map and cannot be interacted with
    if (tile && tile.terrain_type !== 'free_land') {
      return;
    }

    setModalTile({ x, y });
  };

  // Close property modal
  const handleCloseModal = () => {
    setModalTile(null);
  };

  // Overview mode zoom controls
  const handleZoomIn = () => {
    setZoom((z) => Math.min(4, z + 0.5));
  };

  const handleZoomOut = () => {
    setZoom((z) => Math.max(0.5, z - 0.5));
  };

  const handleReset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <div className="h-screen bg-gray-900 relative">
      {/* Full-screen map area */}
      {viewMode === 'overview' ? (
        // OVERVIEW MODE - Grid view
        <div className="h-full relative overflow-hidden">
          <MapCanvas
            map={map}
            tiles={tiles}
            buildings={buildings}
            activeCompanyId={activeCompany.id}
            zoom={zoom}
            offset={offset}
            onTileClick={handleOverviewClick}
            onPan={setOffset}
            onZoom={setZoom}
          />

          <MapControls
            zoom={zoom}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onReset={handleReset}
          />

          <MapLegend />
        </div>
      ) : (
        // ZOOMED MODE - PixiJS top-down view (full screen)
        <div className="h-full w-full relative">
          <PixiGame
            width={window.innerWidth}
            height={window.innerHeight}
            tiles={pixiTiles}
            tileSize={64}
            onTileClick={handleZoomedClick}
          />

          {/* Info overlay */}
          <div className="absolute top-4 left-4 bg-black/70 text-white p-4 rounded-lg text-sm font-mono z-10">
            <div className="text-[#0194F9] font-bold mb-2">{map.name}</div>
            <div>Map: {map.width}×{map.height} tiles</div>
            <div>Engine: PixiJS v8</div>
            <div className="mt-2 text-gray-400 text-xs">
              Drag to pan • Scroll to zoom • Click to interact
            </div>
          </div>
        </div>
      )}

      {/* Property Modal - opens when tile is clicked in zoomed mode */}
      {modalTile && viewMode === 'zoomed' && (
        <PropertyModal
          mapId={map.id}
          x={modalTile.x}
          y={modalTile.y}
          map={map}
          onClose={handleCloseModal}
          onRefresh={refetch}
        />
      )}
    </div>
  );
}
