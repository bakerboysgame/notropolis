import { useState } from 'react';
import { X, DollarSign, Store, Tag } from 'lucide-react';
import { api, apiHelpers } from '../../services/api';
import { calculateSellToStateValue, calculateMinListingPrice } from '../../utils/marketPricing';
import { type LevelUnlocks } from '../../utils/levels';

interface LevelUpData {
  newLevel: number;
  unlocks: LevelUnlocks;
}

interface SellModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (levelUp?: LevelUpData | null) => void;
  building: any;
  buildingType: any;
  tile: any;
  map: any;
  activeCompanyId: string;
}

type ModalMode = 'options' | 'state' | 'list';

export function SellModal({
  isOpen,
  onClose,
  onSuccess,
  building,
  buildingType,
  tile,
  map,
  activeCompanyId,
}: SellModalProps) {
  const [mode, setMode] = useState<ModalMode>('options');
  const [listPrice, setListPrice] = useState(buildingType?.cost || 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate values
  const stateValue = building && buildingType && tile && map
    ? calculateSellToStateValue(building, buildingType, tile, map)
    : 0;
  const minListPrice = building && buildingType
    ? calculateMinListingPrice(building, buildingType)
    : 0;

  const handleSellToState = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.post<{ success: boolean; sale_value: number; levelUp?: LevelUpData }>('/api/game/market/sell-to-state', {
        company_id: activeCompanyId,
        building_id: building.id,
      });

      if (response.data.success) {
        onSuccess(response.data.levelUp);
        onClose();
      } else {
        setError('Failed to sell building');
      }
    } catch (err) {
      setError(apiHelpers.handleError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleListForSale = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/api/game/market/list-for-sale', {
        company_id: activeCompanyId,
        building_id: building.id,
        price: listPrice,
      });

      if (response.data.success) {
        onSuccess();
        onClose();
      } else {
        setError('Failed to list building');
      }
    } catch (err) {
      setError(apiHelpers.handleError(err));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg border border-gray-700">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">
            Sell {buildingType?.name || 'Building'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            disabled={loading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/30 rounded border border-red-700">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Options Mode */}
        {mode === 'options' && (
          <div className="space-y-4">
            <button
              onClick={() => setMode('state')}
              className="w-full p-4 bg-gray-700 rounded-lg text-left hover:bg-gray-600 transition-colors group"
              disabled={loading}
            >
              <div className="flex items-start gap-3">
                <Store className="w-5 h-5 text-blue-400 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold text-white group-hover:text-blue-400 transition-colors">
                    Sell to State
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    Instant sale for{' '}
                    <span className="text-green-400 font-mono">${stateValue.toLocaleString()}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Building and land returned to state
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setMode('list')}
              className="w-full p-4 bg-gray-700 rounded-lg text-left hover:bg-gray-600 transition-colors group"
              disabled={loading}
            >
              <div className="flex items-start gap-3">
                <Tag className="w-5 h-5 text-yellow-400 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold text-white group-hover:text-yellow-400 transition-colors">
                    List on Market
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    Set your own price for other players
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Minimum:{' '}
                    <span className="text-yellow-400 font-mono">${minListPrice.toLocaleString()}</span>
                  </p>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* State Sale Mode */}
        {mode === 'state' && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-700 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-400">You will receive:</span>
                <span className="text-2xl text-green-400 font-bold flex items-center gap-1">
                  <DollarSign className="w-6 h-6" />
                  ${stateValue.toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-gray-500">
                The building will be demolished and land returned to the state.
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setMode('options')}
                className="flex-1 py-2 bg-gray-600 text-white rounded hover:bg-gray-500 transition-colors"
                disabled={loading}
              >
                Back
              </button>
              <button
                onClick={handleSellToState}
                className="flex-1 py-2 bg-green-600 text-white rounded hover:bg-green-500 transition-colors disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Selling...' : `Sell for $${stateValue.toLocaleString()}`}
              </button>
            </div>
          </div>
        )}

        {/* List for Sale Mode */}
        {mode === 'list' && (
          <div className="space-y-4">
            <div>
              <label className="block text-gray-400 mb-2">Listing Price</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="number"
                  value={listPrice}
                  onChange={(e) => setListPrice(Math.max(minListPrice, Number(e.target.value)))}
                  min={minListPrice}
                  className="w-full pl-10 pr-4 py-3 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
                  disabled={loading}
                />
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Minimum: ${minListPrice.toLocaleString()}
              </p>
            </div>

            <div className="p-4 bg-gray-700 rounded-lg">
              <p className="text-sm text-gray-400 mb-2">Preview:</p>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Listing Price:</span>
                <span className="text-yellow-400 font-mono font-bold">
                  ${listPrice.toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Your building will appear on the market for other players to purchase.
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setMode('options')}
                className="flex-1 py-2 bg-gray-600 text-white rounded hover:bg-gray-500 transition-colors"
                disabled={loading}
              >
                Back
              </button>
              <button
                onClick={handleListForSale}
                className="flex-1 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors disabled:opacity-50"
                disabled={loading || listPrice < minListPrice}
              >
                {loading ? 'Listing...' : `List for $${listPrice.toLocaleString()}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
