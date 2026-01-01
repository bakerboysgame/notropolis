import { useState } from 'react';
import { X, DollarSign, MapPin } from 'lucide-react';
import { api, apiHelpers, BuyLandRequest, BuyLandResponse } from '../../services/api';
import { type LevelUnlocks } from '../../utils/levels';

interface LevelUpData {
  newLevel: number;
  unlocks: LevelUnlocks;
}

interface BuyLandModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (levelUp?: LevelUpData | null) => void;
  tile: any;
  map: any;
  activeCompanyId: string;
  activeCompanyCash: number;
}

export function BuyLandModal({
  isOpen,
  onClose,
  onSuccess,
  tile,
  map,
  activeCompanyId,
  activeCompanyCash,
}: BuyLandModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Calculate land cost
  const calculateLandCost = () => {
    let baseCost = 500;

    const terrainMultipliers: Record<string, number> = {
      free_land: 1.0,
      dirt_track: 0.8,
      trees: 1.2,
    };

    baseCost *= terrainMultipliers[tile.terrain_type] || 1.0;

    const locationMultipliers: Record<string, number> = {
      town: 1.0,
      city: 5.0,
      capital: 20.0,
    };

    baseCost *= locationMultipliers[map.location_type] || 1.0;

    return Math.round(baseCost);
  };

  const cost = calculateLandCost();
  const canAfford = activeCompanyCash >= cost;

  const handleBuy = async () => {
    if (!canAfford) return;

    setLoading(true);
    setError(null);

    try {
      const request: BuyLandRequest = {
        company_id: activeCompanyId,
        tile_x: tile.x,
        tile_y: tile.y,
      };

      const response = await api.post<{ success: boolean; data: BuyLandResponse & { levelUp?: LevelUpData } }>(
        '/api/game/land/buy',
        request
      );

      if (response.data.success) {
        onSuccess(response.data.data?.levelUp);
        onClose();
      } else {
        setError('Failed to purchase land');
      }
    } catch (err) {
      setError(apiHelpers.handleError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Buy Land
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            disabled={loading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Description */}
        <p className="text-gray-300 mb-4">
          Purchase tile at ({tile.x}, {tile.y})
        </p>

        {/* Cost breakdown */}
        <div className="bg-gray-700 p-4 rounded mb-4">
          <div className="flex justify-between mb-2">
            <span className="text-gray-400">Terrain</span>
            <span className="text-white capitalize">{tile.terrain_type.replace(/_/g, ' ')}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="text-gray-400">Location Type</span>
            <span className="text-white capitalize">{map.location_type}</span>
          </div>
          <div className="h-px bg-gray-600 my-3"></div>
          <div className="flex justify-between mb-2">
            <span className="text-gray-400">Cost</span>
            <span className="text-white font-mono font-bold">${cost.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Your Cash</span>
            <span className={`font-mono ${canAfford ? 'text-green-400' : 'text-red-400'}`}>
              ${activeCompanyCash.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between mt-2 pt-2 border-t border-gray-600">
            <span className="text-gray-400">Remaining</span>
            <span className={`font-mono ${canAfford ? 'text-green-400' : 'text-red-400'}`}>
              ${(activeCompanyCash - cost).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/30 rounded border border-red-700">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Insufficient funds warning */}
        {!canAfford && (
          <div className="mb-4 p-3 bg-yellow-900/30 rounded border border-yellow-700">
            <p className="text-yellow-400 text-sm flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Insufficient funds
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-gray-600 text-white rounded hover:bg-gray-500 transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleBuy}
            disabled={!canAfford || loading}
            className="flex-1 py-2 bg-green-600 text-white rounded hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Buying...' : 'Buy Land'}
          </button>
        </div>
      </div>
    </div>
  );
}
