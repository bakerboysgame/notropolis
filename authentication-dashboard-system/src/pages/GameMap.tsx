import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Navigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useActiveCompany } from '../contexts/CompanyContext';
import { useGameMap } from '../hooks/useGameMap';
import { MapCanvas } from '../components/game/MapCanvas';
import { IsometricView } from '../components/game/IsometricView';
import { PropertyModal } from '../components/game/PropertyModal';
import { MapLegend } from '../components/game/MapLegend';
import { MapControls } from '../components/game/MapControls';
import { MiniMap } from '../components/game/MiniMap';

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
  const [zoomCenter, setZoomCenter] = useState<{ x: number; y: number } | null>(initialCoords);

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

  // Handle click in overview mode - transition to zoomed view
  const handleOverviewClick = (coords: { x: number; y: number }) => {
    setZoomCenter(coords);
    setViewMode('zoomed');
  };

  // Handle click in zoomed mode - open property modal (skip terrain tiles)
  const handleZoomedClick = (coords: { x: number; y: number }) => {
    // Find the tile at these coordinates
    const tile = tiles.find((t) => t.x === coords.x && t.y === coords.y);

    // Don't open modal for terrain objects (water, road, trees, etc.)
    // These are owned by the map and cannot be interacted with
    if (tile && tile.terrain_type !== 'free_land') {
      return;
    }

    setModalTile(coords);
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

          {/* Back to menu button */}
          <Link
            to="/companies"
            className="absolute top-4 left-4 z-10 flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors shadow-lg"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Menu
          </Link>

          <MapControls
            zoom={zoom}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onReset={handleReset}
          />

          <MapLegend />
        </div>
      ) : (
        // ZOOMED MODE - Isometric view (full screen)
        <div className="h-full w-full relative overflow-hidden">
          <IsometricView
            map={map}
            tiles={tiles}
            buildings={buildings}
            activeCompanyId={activeCompany.id}
            centerTile={zoomCenter || { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) }}
            selectedTile={modalTile}
            onTileClick={handleZoomedClick}
            onCenterChange={setZoomCenter}
          />

          {/* Mini-map overlay */}
          <div className="absolute top-4 right-4 z-10">
            <MiniMap
              map={map}
              tiles={tiles}
              buildings={buildings}
              activeCompanyId={activeCompany.id}
              centerTile={zoomCenter || { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) }}
              onNavigate={setZoomCenter}
            />
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
