import { useState, useEffect } from 'react';
import { X, Building2, DollarSign, TrendingUp, Lock } from 'lucide-react';
import { api, apiHelpers, BuildingType, ProfitPreviewResponse, BuildBuildingRequest } from '../../services/api';
import { type LevelUnlocks } from '../../utils/levels';
import { getBuildingVariants, requiresVariant } from '../../utils/buildingTypes';

interface LevelUpData {
  newLevel: number;
  unlocks: LevelUnlocks;
}

interface BuildModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (levelUp?: LevelUpData | null) => void;
  tile: any;
  mapId: string;
  activeCompanyId: string;
  activeCompanyCash: number;
  activeCompanyLevel: number;
}

export function BuildModal({
  isOpen,
  onClose,
  onSuccess,
  tile,
  mapId,
  activeCompanyId,
  activeCompanyCash,
  activeCompanyLevel,
}: BuildModalProps) {
  const [buildingTypes, setBuildingTypes] = useState<BuildingType[]>([]);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [profitPreview, setProfitPreview] = useState<ProfitPreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get available variants for selected building type
  const availableVariants = selectedType ? getBuildingVariants(selectedType) : null;
  const needsVariant = selectedType ? requiresVariant(selectedType) : false;

  useEffect(() => {
    if (isOpen) {
      loadBuildingTypes();
    }
  }, [isOpen]);

  // Reset variant when building type changes
  useEffect(() => {
    setSelectedVariant(null);
  }, [selectedType]);

  useEffect(() => {
    if (selectedType) {
      loadProfitPreview(selectedType);
    } else {
      setProfitPreview(null);
    }
  }, [selectedType]);

  const loadBuildingTypes = async () => {
    setLoadingTypes(true);
    try {
      const response = await api.get<{ success: boolean; data: { building_types: BuildingType[] } }>(
        `/api/game/buildings/types?map_id=${mapId}`
      );

      if (response.data.success) {
        setBuildingTypes(response.data.data.building_types);
      }
    } catch (err) {
      setError(apiHelpers.handleError(err));
    } finally {
      setLoadingTypes(false);
    }
  };

  const loadProfitPreview = async (buildingTypeId: string) => {
    setLoadingPreview(true);
    try {
      const response = await api.get<{ success: boolean; data: ProfitPreviewResponse }>(
        `/api/game/buildings/preview-profit?tile_id=${tile.id}&building_type_id=${buildingTypeId}`
      );

      if (response.data.success) {
        setProfitPreview(response.data.data);
      }
    } catch (err) {
      console.error('Failed to load profit preview:', err);
      setProfitPreview(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleBuild = async () => {
    if (!selectedType) return;

    const selectedBuilding = buildingTypes.find(bt => bt.id === selectedType);
    if (!selectedBuilding || activeCompanyCash < selectedBuilding.cost) return;

    // Validate variant selection for buildings that require it
    if (needsVariant && !selectedVariant) {
      setError('Please select a specialty for this building');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const request: BuildBuildingRequest = {
        company_id: activeCompanyId,
        tile_id: tile.id,
        building_type_id: selectedType,
        variant: selectedVariant || undefined,
      };

      const response = await api.post<{ success: boolean; data: { levelUp?: LevelUpData } }>('/api/game/buildings/build', request);

      if (response.data.success) {
        onSuccess(response.data.data?.levelUp);
        onClose();
      } else {
        setError('Failed to build');
      }
    } catch (err) {
      setError(apiHelpers.handleError(err));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const selectedBuilding = selectedType ? buildingTypes.find(bt => bt.id === selectedType) : null;
  const canAfford = selectedBuilding ? activeCompanyCash >= selectedBuilding.cost : false;
  const canBuild = selectedType && canAfford && (!needsVariant || selectedVariant);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-4xl border border-gray-700 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Build on ({tile.x}, {tile.y})
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

        <div className="grid md:grid-cols-2 gap-4">
          {/* Building list OR Variant selection */}
          <div>
            {/* Show variant selection when a variant-requiring building is selected */}
            {selectedType && availableVariants && availableVariants.length > 0 ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => setSelectedType(null)}
                    className="text-gray-400 hover:text-white text-sm flex items-center gap-1"
                  >
                    ← Back
                  </button>
                  <h3 className="text-sm text-gray-400">Select {selectedBuilding?.name} Specialty</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {availableVariants.map(variant => (
                    <button
                      key={variant.id}
                      onClick={() => setSelectedVariant(variant.id)}
                      className={`p-3 rounded text-center transition-colors ${
                        selectedVariant === variant.id
                          ? 'bg-purple-600 border border-purple-400'
                          : 'bg-gray-700 hover:bg-gray-600 border border-gray-600'
                      }`}
                    >
                      <span className="text-2xl">{variant.icon}</span>
                      <p className="text-sm text-white mt-1">{variant.name}</p>
                    </button>
                  ))}
                </div>
                {needsVariant && !selectedVariant && (
                  <p className="text-xs text-yellow-400 mt-3">
                    Select a specialty to build this {selectedBuilding?.name}
                  </p>
                )}
              </>
            ) : (
              <>
                <h3 className="text-sm text-gray-400 mb-2">Available Buildings</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {loadingTypes ? (
                    <div className="p-4 text-center text-gray-400">Loading buildings...</div>
                  ) : buildingTypes.length === 0 ? (
                    <div className="p-4 text-center text-gray-400">No buildings available</div>
                  ) : (
                    buildingTypes.map(type => {
                      const isLocked = activeCompanyLevel < type.level_required;
                      const noLicensesRemaining = type.requires_license && type.licenses_remaining === 0;
                      const isDisabled = isLocked || noLicensesRemaining;
                      const isSelected = selectedType === type.id;

                      return (
                        <div
                          key={type.id}
                          onClick={() => !isDisabled && setSelectedType(type.id)}
                          className={`p-3 rounded cursor-pointer transition-colors ${
                            isDisabled
                              ? 'bg-gray-700/50 cursor-not-allowed opacity-50'
                              : isSelected
                              ? 'bg-blue-600'
                              : 'bg-gray-700 hover:bg-gray-600'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white">{type.name}</span>
                                {type.requires_license && type.max_per_map && (
                                  <span className={`text-xs px-2 py-0.5 rounded border ${
                                    noLicensesRemaining
                                      ? 'bg-red-900/50 text-red-400 border-red-700'
                                      : 'bg-purple-900/50 text-purple-400 border-purple-700'
                                  }`}>
                                    {type.licenses_remaining}/{type.max_per_map} licenses
                                  </span>
                                )}
                                {isLocked && (
                                  <Lock className="w-4 h-4 text-gray-500" />
                                )}
                              </div>
                              <div className="text-sm mt-1">
                                <span className="text-gray-400">Base profit:</span>{' '}
                                <span className="text-green-400">${type.base_profit}/tick</span>
                              </div>
                              {isLocked && (
                                <div className="text-xs text-gray-500 mt-1">
                                  Requires Level {type.level_required}
                                </div>
                              )}
                              {noLicensesRemaining && !isLocked && (
                                <div className="text-xs text-red-400 mt-1">
                                  No licenses available
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="text-yellow-400 font-mono">${type.cost.toLocaleString()}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>

          {/* Profit preview */}
          <div>
            <h3 className="text-sm text-gray-400 mb-2">Profit Preview</h3>
            <div className="bg-gray-700 p-4 rounded min-h-[200px]">
              {!selectedBuilding ? (
                <p className="text-gray-400 text-center py-8">
                  Select a building to see profit preview
                </p>
              ) : loadingPreview ? (
                <p className="text-gray-400 text-center py-8">Loading...</p>
              ) : profitPreview ? (
                <>
                  <div className="mb-4">
                    <h3 className="font-bold text-white mb-1">{selectedBuilding.name}</h3>
                    <p className="text-sm text-gray-400">
                      Cost: <span className="text-yellow-400">${selectedBuilding.cost.toLocaleString()}</span>
                    </p>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400">Expected Profit</span>
                      <span className="text-2xl text-green-400 font-bold flex items-center gap-1">
                        <TrendingUp className="w-5 h-5" />
                        ${profitPreview.final_profit}/tick
                      </span>
                    </div>
                    {profitPreview.total_modifier !== 0 && (
                      <p className="text-xs text-gray-500">
                        Base: ${profitPreview.base_profit} ({profitPreview.total_modifier >= 0 ? '+' : ''}
                        {(profitPreview.total_modifier * 100).toFixed(0)}%)
                      </p>
                    )}
                  </div>

                  {profitPreview.breakdown.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-400 mb-2">Modifiers:</p>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {profitPreview.breakdown.map((item, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-gray-400">{item.source}</span>
                            <span className={item.modifier >= 0 ? 'text-green-400' : 'text-red-400'}>
                              {item.modifier >= 0 ? '+' : ''}
                              {(item.modifier * 100).toFixed(0)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-gray-600">
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-400">Your Cash</span>
                      <span className={`font-mono ${canAfford ? 'text-green-400' : 'text-red-400'}`}>
                        ${activeCompanyCash.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">After Build</span>
                      <span className={`font-mono ${canAfford ? 'text-green-400' : 'text-red-400'}`}>
                        ${(activeCompanyCash - selectedBuilding.cost).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {!canAfford && (
                    <div className="mt-4 p-3 bg-yellow-900/30 rounded border border-yellow-700">
                      <p className="text-yellow-400 text-sm flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Insufficient funds
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-red-400 text-center py-8">Failed to load profit preview</p>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-gray-600 text-white rounded hover:bg-gray-500 transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleBuild}
            disabled={!canBuild || loading}
            className="flex-1 py-2 bg-green-600 text-white rounded hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Building...' : selectedVariant ? `Build ${selectedVariant} ${selectedBuilding?.name || ''}` : 'Build'}
          </button>
        </div>
      </div>
    </div>
  );
}
