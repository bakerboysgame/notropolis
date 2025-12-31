import { useState, useEffect } from 'react';
import { ShoppingCart, X, MapPin, DollarSign, Building2 } from 'lucide-react';
import { api, apiHelpers } from '../../services/api';

interface MarketListing {
  id: string;
  company_id: string;
  company_name: string;
  building_type_id: string;
  type_name: string;
  type_cost: number;
  sale_price: number;
  x: number;
  y: number;
  damage_percent: number;
  calculated_profit: number;
}

interface MarketListingsProps {
  mapId: string;
  activeCompanyId: string;
  activeCompanyCash: number;
  onSuccess: () => void;
}

export function MarketListings({
  mapId,
  activeCompanyId,
  activeCompanyCash,
  onSuccess,
}: MarketListingsProps) {
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);

  useEffect(() => {
    loadListings();
  }, [mapId]);

  const loadListings = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<{
        success: boolean;
        listings: MarketListing[];
      }>(`/api/game/market/listings?map_id=${mapId}`);

      if (response.data.success) {
        setListings(response.data.listings);
      }
    } catch (err) {
      setError(apiHelpers.handleError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = async (buildingId: string, price: number) => {
    if (activeCompanyCash < price) {
      setError('Insufficient funds');
      return;
    }

    setBuyingId(buildingId);
    setError(null);

    try {
      const response = await api.post('/api/game/market/buy-property', {
        company_id: activeCompanyId,
        building_id: buildingId,
      });

      if (response.data.success) {
        onSuccess();
        loadListings(); // Refresh listings
      } else {
        setError('Failed to purchase property');
      }
    } catch (err) {
      setError(apiHelpers.handleError(err));
    } finally {
      setBuyingId(null);
    }
  };

  const handleCancelListing = async (buildingId: string) => {
    setBuyingId(buildingId);
    setError(null);

    try {
      const response = await api.post('/api/game/market/cancel-listing', {
        company_id: activeCompanyId,
        building_id: buildingId,
      });

      if (response.data.success) {
        onSuccess();
        loadListings(); // Refresh listings
      } else {
        setError('Failed to cancel listing');
      }
    } catch (err) {
      setError(apiHelpers.handleError(err));
    } finally {
      setBuyingId(null);
    }
  };

  const myListings = listings.filter((l) => l.company_id === activeCompanyId);
  const otherListings = listings.filter((l) => l.company_id !== activeCompanyId);

  if (loading) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-400">Loading market listings...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Building2 className="w-6 h-6" />
          Property Market
        </h1>
        <div className="text-sm text-gray-400">
          Your Cash:{' '}
          <span className="text-green-400 font-mono">${activeCompanyCash.toLocaleString()}</span>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-900/30 rounded border border-red-700">
          <div className="flex items-center justify-between">
            <p className="text-red-400 text-sm">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* My Listings */}
      {myListings.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-white mb-4">Your Listings</h2>
          <div className="space-y-2">
            {myListings.map((listing) => (
              <div
                key={listing.id}
                className="flex justify-between items-center p-4 bg-gray-700 rounded-lg border border-gray-600"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-400" />
                    <span className="font-bold text-white">{listing.type_name}</span>
                    {listing.damage_percent > 0 && (
                      <span className="text-xs px-2 py-0.5 bg-yellow-900/50 text-yellow-400 rounded">
                        {listing.damage_percent}% damaged
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      ({listing.x}, {listing.y})
                    </span>
                    {listing.calculated_profit > 0 && (
                      <span className="text-green-400">
                        ${listing.calculated_profit}/tick
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-yellow-400 font-mono font-bold">
                      ${listing.sale_price.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      Cost: ${listing.type_cost.toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCancelListing(listing.id)}
                    disabled={buyingId === listing.id}
                    className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-500 disabled:opacity-50 transition-colors"
                  >
                    {buyingId === listing.id ? 'Canceling...' : 'Cancel'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Properties */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4">Available Properties</h2>
        {otherListings.length === 0 ? (
          <div className="p-8 text-center bg-gray-700 rounded-lg">
            <p className="text-gray-400">No properties currently for sale</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {otherListings.map((listing) => {
              const canAfford = activeCompanyCash >= listing.sale_price;

              return (
                <div
                  key={listing.id}
                  className="p-4 bg-gray-700 rounded-lg border border-gray-600 hover:border-gray-500 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="w-4 h-4 text-blue-400" />
                        <span className="font-bold text-white">{listing.type_name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-400">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          ({listing.x}, {listing.y})
                        </span>
                      </div>
                    </div>
                    {listing.damage_percent > 0 && (
                      <span className="text-xs px-2 py-0.5 bg-yellow-900/50 text-yellow-400 rounded">
                        {listing.damage_percent}% damaged
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 mb-3">
                    {listing.calculated_profit > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Profit:</span>
                        <span className="text-green-400 font-mono">
                          ${listing.calculated_profit}/tick
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Seller:</span>
                      <span className="text-gray-300">{listing.company_name}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Original Cost:</span>
                      <span className="text-gray-300 font-mono">
                        ${listing.type_cost.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-600">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-400">Asking Price:</span>
                      <span className="text-xl text-yellow-400 font-bold font-mono">
                        ${listing.sale_price.toLocaleString()}
                      </span>
                    </div>
                    <button
                      onClick={() => handleBuy(listing.id, listing.sale_price)}
                      disabled={!canAfford || buyingId === listing.id}
                      className="w-full py-2 bg-green-600 text-white rounded hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {buyingId === listing.id ? (
                        'Purchasing...'
                      ) : !canAfford ? (
                        <>
                          <DollarSign className="w-4 h-4" />
                          Insufficient Funds
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="w-4 h-4" />
                          Buy Property
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
