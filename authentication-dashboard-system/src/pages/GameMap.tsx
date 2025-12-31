import { useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useActiveCompany } from '../contexts/CompanyContext';
import { useGameMap } from '../hooks/useGameMap';
import { MapCanvas } from '../components/game/MapCanvas';
import { TileInfo } from '../components/game/TileInfo';
import { MapLegend } from '../components/game/MapLegend';
import { MapControls } from '../components/game/MapControls';
import { MapOverview } from '../components/game/MapOverview';

/**
 * Main game map page with Canvas-based rendering
 * Shows the map grid with terrain, ownership, and buildings
 */
export function GameMap(): JSX.Element {
  const { mapId } = useParams<{ mapId: string }>();
  const { activeCompany } = useActiveCompany();
  const { mapData, isLoading, error } = useGameMap(mapId);

  const [selectedTile, setSelectedTile] = useState<{ x: number; y: number } | null>(null);
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
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
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

  const { map, tiles, buildings, playerTileCount, totalFreeLand } = mapData;

  const handleZoomIn = () => {
    setZoom(z => Math.min(4, z + 0.5));
  };

  const handleZoomOut = () => {
    setZoom(z => Math.max(0.5, z - 0.5));
  };

  const handleReset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setSelectedTile(null);
  };

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Main map area */}
      <div className="flex-1 relative overflow-hidden">
        <MapCanvas
          map={map}
          tiles={tiles}
          buildings={buildings}
          activeCompanyId={activeCompany.id}
          zoom={zoom}
          offset={offset}
          onTileClick={setSelectedTile}
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

      {/* Side panel */}
      <div className="w-80 bg-gray-800 border-l border-gray-700 overflow-y-auto">
        {selectedTile ? (
          <TileInfo
            mapId={map.id}
            x={selectedTile.x}
            y={selectedTile.y}
            onClose={() => setSelectedTile(null)}
          />
        ) : (
          <MapOverview
            map={map}
            totalTiles={tiles.length}
            ownedTiles={playerTileCount}
            totalFreeLand={totalFreeLand}
          />
        )}
      </div>
    </div>
  );
}
