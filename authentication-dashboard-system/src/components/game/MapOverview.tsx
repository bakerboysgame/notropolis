import { GameMap } from '../../types/game';

interface MapOverviewProps {
  map: GameMap;
  totalTiles: number;
  ownedTiles: number;
  totalFreeLand: number;
}

/**
 * Map overview panel showing map statistics
 * Displayed in the side panel when no tile is selected
 */
export function MapOverview({ map, totalTiles, ownedTiles, totalFreeLand }: MapOverviewProps): JSX.Element {
  const ownershipPercentage = totalTiles > 0 ? ((ownedTiles / totalTiles) * 100).toFixed(1) : '0.0';

  return (
    <div className="p-4">
      <h3 className="text-lg font-bold text-white mb-4">Map Overview</h3>

      {/* Map Info */}
      <div className="mb-6 p-3 bg-gray-700 rounded">
        <h4 className="text-white font-bold mb-2">{map.name}</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-gray-500">Location</p>
            <p className="text-white">{map.country}</p>
          </div>
          <div>
            <p className="text-gray-500">Type</p>
            <p className="text-white capitalize">{map.location_type}</p>
          </div>
          <div>
            <p className="text-gray-500">Size</p>
            <p className="text-white">{map.width} × {map.height}</p>
          </div>
          <div>
            <p className="text-gray-500">Total Tiles</p>
            <p className="text-white">{totalTiles.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Ownership Stats */}
      <div className="mb-6">
        <h4 className="text-sm font-bold text-gray-400 uppercase mb-2">Your Territory</h4>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">Tiles Owned</span>
              <span className="text-white font-bold">{ownedTiles}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${ownershipPercentage}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-1">{ownershipPercentage}% of map</p>
          </div>

          <div className="p-3 bg-gray-700 rounded">
            <p className="text-sm text-gray-400">Available Free Land</p>
            <p className="text-white font-bold text-lg">{totalFreeLand.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Hero Goals */}
      <div className="mb-6">
        <h4 className="text-sm font-bold text-gray-400 uppercase mb-2">Hero Goals</h4>
        <div className="space-y-2">
          <div className="p-3 bg-gray-700 rounded">
            <p className="text-sm text-gray-400">Net Worth</p>
            <p className="text-yellow-400 font-bold">${map.hero_net_worth.toLocaleString()}</p>
          </div>
          <div className="p-3 bg-gray-700 rounded">
            <p className="text-sm text-gray-400">Cash</p>
            <p className="text-green-400 font-bold">${map.hero_cash.toLocaleString()}</p>
          </div>
          <div className="p-3 bg-gray-700 rounded">
            <p className="text-sm text-gray-400">Land Control</p>
            <p className="text-blue-400 font-bold">{map.hero_land_percentage}%</p>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="p-3 bg-blue-900/20 border border-blue-700 rounded">
        <p className="text-sm text-blue-300">
          Click on a tile to view details and take actions.
        </p>
        <p className="text-xs text-blue-400 mt-1">
          Use mouse wheel to zoom, drag to pan.
        </p>
      </div>
    </div>
  );
}
