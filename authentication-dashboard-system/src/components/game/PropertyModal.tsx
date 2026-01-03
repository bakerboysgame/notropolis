import { useState, useEffect } from 'react';
import { X, Building2, DollarSign, Shield, Flame, ShoppingCart, Hammer, Trash2 } from 'lucide-react';
import { useTileDetail } from '../../hooks/useTileDetail';
import { useActiveCompany } from '../../contexts/CompanyContext';
import { BuyLandModal } from './BuyLandModal';
import { BuildModal } from './BuildModal';
import { SellModal } from './SellModal';
import { AttackModal } from './AttackModal';
import { AttackResult } from './AttackResult';
import { SecurityModal } from './SecurityModal';
import { LevelUpModal } from './LevelUpModal';
import { api, apiHelpers } from '../../services/api';
import { type LevelUnlocks } from '../../utils/levels';
import { GameMap } from '../../types/game';

interface LevelUpData {
  newLevel: number;
  unlocks: LevelUnlocks;
}

interface PropertyModalProps {
  mapId: string;
  x: number;
  y: number;
  map: GameMap;
  onClose: () => void;
  onRefresh: () => void;
}

/**
 * Modal component for tile/property actions in zoomed isometric view
 * Shows context-dependent actions based on tile ownership and building state
 */
export function PropertyModal({
  mapId,
  x,
  y,
  map,
  onClose,
  onRefresh,
}: PropertyModalProps): JSX.Element {
  const { data, isLoading, error, refetch } = useTileDetail(mapId, x, y);
  const { activeCompany, refreshCompany } = useActiveCompany();

  // Sub-modal states
  const [showBuyLandModal, setShowBuyLandModal] = useState(false);
  const [showBuildModal, setShowBuildModal] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [showAttackModal, setShowAttackModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [attackResult, setAttackResult] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [levelUpData, setLevelUpData] = useState<LevelUpData | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleActionSuccess = async (levelUp?: LevelUpData | null) => {
    await refreshCompany();
    await refetch();
    onRefresh();
    if (levelUp) {
      setLevelUpData(levelUp);
    }
  };

  const handleAttackSuccess = async (result: any) => {
    setAttackResult(result);
    const levelUp = result?.levelUp;
    await handleActionSuccess(levelUp);
  };

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Loading state
  if (isLoading) {
    return (
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        onClick={handleBackdropClick}
      >
        <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        onClick={handleBackdropClick}
      >
        <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <h2 className="text-lg font-bold text-white">Tile ({x}, {y})</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-700 rounded-full transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
          <div className="p-4">
            <p className="text-red-400">{error || 'Failed to load tile details'}</p>
          </div>
        </div>
      </div>
    );
  }

  const { tile, building, owner, security } = data;

  // Determine ownership state
  const isOwned = tile?.owner_company_id === activeCompany?.id;
  const isEnemyOwned = tile?.owner_company_id && tile.owner_company_id !== activeCompany?.id;
  const isUnclaimed = !tile?.owner_company_id;
  const isSpecialBuilding =
    tile?.special_building && ['temple', 'bank', 'police_station'].includes(tile.special_building);
  const canBuyLand =
    isUnclaimed &&
    tile.terrain_type !== 'water' &&
    tile.terrain_type !== 'road' &&
    !tile.special_building;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        onClick={handleBackdropClick}
      >
        <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <div className="flex items-center gap-3">
              {building ? (
                <Building2 className="w-6 h-6 text-blue-400" />
              ) : tile.special_building ? (
                <Shield className="w-6 h-6 text-yellow-400" />
              ) : (
                <div className="w-6 h-6 rounded bg-green-600" />
              )}
              <div>
                <h2 className="text-lg font-bold text-white">
                  {building
                    ? (building as any).name || 'Building'
                    : tile.special_building
                    ? tile.special_building.replace(/_/g, ' ')
                    : tile.terrain_type.replace(/_/g, ' ')}
                </h2>
                <p className="text-sm text-gray-400">
                  Position: ({x}, {y})
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-3 -mr-2 hover:bg-gray-700 rounded-full transition-colors"
              aria-label="Close modal"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Error message */}
            {actionError && (
              <div className="p-3 bg-red-900/30 rounded border border-red-700">
                <p className="text-red-400 text-sm">{actionError}</p>
              </div>
            )}

            {/* Ownership Info */}
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Owner:</span>
              <span className={isOwned ? 'text-green-400' : isEnemyOwned ? 'text-red-400' : 'text-gray-300'}>
                {isOwned ? 'You' : owner?.name || 'Available'}
              </span>
            </div>

            {/* Terrain Info */}
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Terrain:</span>
              <span className="text-white capitalize">{tile.terrain_type.replace(/_/g, ' ')}</span>
            </div>

            {/* Building Info */}
            {building && (
              <div className="p-3 bg-gray-700 rounded space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Health:</span>
                  <span
                    className={
                      building.damage_percent > 50
                        ? 'text-red-400'
                        : building.damage_percent > 0
                        ? 'text-yellow-400'
                        : 'text-green-400'
                    }
                  >
                    {100 - (building.damage_percent || 0)}%
                  </span>
                </div>
                {(building as any).calculated_profit !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Income:</span>
                    <span className="text-green-400">${(building as any).calculated_profit}/tick</span>
                  </div>
                )}

                {/* Status indicators */}
                <div className="flex gap-2 flex-wrap">
                  {building.is_on_fire && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-900/50 rounded text-xs text-red-400 border border-red-700">
                      <Flame className="w-3 h-3" /> On Fire
                    </span>
                  )}
                  {building.is_collapsed && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-700 rounded text-xs text-gray-400 border border-gray-600">
                      Collapsed
                    </span>
                  )}
                  {building.is_for_sale && building.sale_price && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-900/50 rounded text-xs text-yellow-400 border border-yellow-700">
                      <ShoppingCart className="w-3 h-3" /> ${building.sale_price.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Security Info */}
            {security && (
              <div className="flex gap-2 flex-wrap">
                {security.has_cameras && (
                  <span className="px-2 py-1 bg-blue-900/30 rounded text-xs text-blue-400 border border-blue-700">
                    Cameras
                  </span>
                )}
                {security.has_guard_dogs && (
                  <span className="px-2 py-1 bg-blue-900/30 rounded text-xs text-blue-400 border border-blue-700">
                    Dogs
                  </span>
                )}
                {security.has_security_guards && (
                  <span className="px-2 py-1 bg-blue-900/30 rounded text-xs text-blue-400 border border-blue-700">
                    Guards
                  </span>
                )}
                {security.has_sprinklers && (
                  <span className="px-2 py-1 bg-blue-900/30 rounded text-xs text-blue-400 border border-blue-700">
                    Sprinklers
                  </span>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2 pt-2 border-t border-gray-700">
              {/* Unclaimed Land - Buy */}
              {canBuyLand && activeCompany && (
                <button
                  onClick={() => setShowBuyLandModal(true)}
                  className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <DollarSign className="w-5 h-5" />
                  Buy Land
                </button>
              )}

              {/* Your Empty Property - Build */}
              {isOwned && !building && !isSpecialBuilding && (
                <button
                  onClick={() => setShowBuildModal(true)}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Hammer className="w-5 h-5" />
                  Build...
                </button>
              )}

              {/* Your Property with Building */}
              {isOwned && building && !isSpecialBuilding && (
                <>
                  {/* Repair */}
                  {building.damage_percent > 0 && !building.is_collapsed && (
                    <button
                      onClick={async () => {
                        setActionLoading(true);
                        setActionError(null);
                        try {
                          const response = await api.post('/api/game/buildings/repair', {
                            company_id: activeCompany?.id,
                            building_id: building.id,
                          });
                          if (response.data.success) {
                            await handleActionSuccess();
                          }
                        } catch (err) {
                          setActionError(apiHelpers.handleError(err));
                        } finally {
                          setActionLoading(false);
                        }
                      }}
                      disabled={actionLoading}
                      className="w-full py-3 px-4 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      {actionLoading ? 'Repairing...' : `Repair (${building.damage_percent}% damage)`}
                    </button>
                  )}

                  {/* Security */}
                  {!building.is_collapsed && (
                    <button
                      onClick={() => setShowSecurityModal(true)}
                      className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <Shield className="w-5 h-5" />
                      Security
                    </button>
                  )}

                  {/* Sell */}
                  {!building.is_collapsed && !building.is_for_sale && (
                    <button
                      onClick={() => setShowSellModal(true)}
                      className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <ShoppingCart className="w-5 h-5" />
                      Sell Property
                    </button>
                  )}

                  {/* Cancel listing */}
                  {building.is_for_sale && (
                    <button
                      onClick={async () => {
                        setActionLoading(true);
                        setActionError(null);
                        try {
                          await api.post('/api/game/market/cancel-listing', {
                            company_id: activeCompany?.id,
                            building_id: building.id,
                          });
                          await handleActionSuccess();
                        } catch (err) {
                          setActionError(apiHelpers.handleError(err));
                        } finally {
                          setActionLoading(false);
                        }
                      }}
                      disabled={actionLoading}
                      className="w-full py-3 px-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      {actionLoading ? 'Canceling...' : 'Cancel Listing'}
                    </button>
                  )}

                  {/* Demolish collapsed buildings */}
                  {building.is_collapsed && (
                    <button
                      onClick={async () => {
                        setActionLoading(true);
                        setActionError(null);
                        try {
                          const response = await api.post('/api/game/market/demolish', {
                            company_id: activeCompany?.id,
                            building_id: building.id,
                          });
                          if (response.data.success) {
                            await handleActionSuccess();
                          }
                        } catch (err) {
                          setActionError(apiHelpers.handleError(err));
                        } finally {
                          setActionLoading(false);
                        }
                      }}
                      disabled={actionLoading}
                      className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-5 h-5" />
                      {actionLoading ? 'Demolishing...' : 'Demolish'}
                    </button>
                  )}
                </>
              )}

              {/* Enemy Property */}
              {isEnemyOwned && building && !building.is_collapsed && activeCompany && (
                <button
                  onClick={() => setShowAttackModal(true)}
                  className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Flame className="w-5 h-5" />
                  Attack...
                </button>
              )}

              {/* Buy from market */}
              {building && building.is_for_sale && building.sale_price && !isOwned && activeCompany && (
                <button
                  onClick={async () => {
                    if (!activeCompany || !building.sale_price || activeCompany.cash < building.sale_price) {
                      setActionError('Insufficient funds');
                      return;
                    }
                    setActionLoading(true);
                    setActionError(null);
                    try {
                      const response = await api.post<{
                        success: boolean;
                        purchase_price: number;
                        levelUp?: LevelUpData;
                      }>('/api/game/market/buy-property', {
                        company_id: activeCompany.id,
                        building_id: building.id,
                      });
                      await handleActionSuccess(response.data.levelUp);
                    } catch (err) {
                      setActionError(apiHelpers.handleError(err));
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                  disabled={actionLoading || (activeCompany && building.sale_price ? activeCompany.cash < building.sale_price : true)}
                  className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <ShoppingCart className="w-5 h-5" />
                  {actionLoading ? 'Purchasing...' : `Buy for $${building.sale_price.toLocaleString()}`}
                </button>
              )}

              {/* Special Buildings Info */}
              {tile.special_building === 'bank' && (
                <div className="p-3 bg-gray-700 rounded text-center">
                  <p className="text-gray-300 text-sm">
                    Visit the Bank page to deposit/withdraw funds
                  </p>
                </div>
              )}

              {tile.special_building === 'temple' && (
                <div className="p-3 bg-gray-700 rounded text-center">
                  <p className="text-gray-300 text-sm">
                    A sacred place. Donations may bring good fortune.
                  </p>
                </div>
              )}

              {tile.special_building === 'police_station' && (
                <div className="p-3 bg-gray-700 rounded text-center">
                  <p className="text-gray-300 text-sm">
                    The local police station. Stay out of trouble!
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sub-modals */}
      {activeCompany && (
        <>
          <BuyLandModal
            isOpen={showBuyLandModal}
            onClose={() => setShowBuyLandModal(false)}
            onSuccess={handleActionSuccess}
            tile={tile}
            map={map}
            activeCompanyId={activeCompany.id}
            activeCompanyCash={activeCompany.cash}
          />

          <BuildModal
            isOpen={showBuildModal}
            onClose={() => setShowBuildModal(false)}
            onSuccess={handleActionSuccess}
            tile={tile}
            activeCompanyId={activeCompany.id}
            activeCompanyCash={activeCompany.cash}
            activeCompanyLevel={activeCompany.level}
          />

          {building && (
            <>
              <SellModal
                isOpen={showSellModal}
                onClose={() => setShowSellModal(false)}
                onSuccess={handleActionSuccess}
                building={building}
                buildingType={{ cost: (building as any).cost || 0, name: (building as any).name }}
                tile={tile}
                map={map}
                activeCompanyId={activeCompany.id}
              />

              <AttackModal
                isOpen={showAttackModal}
                onClose={() => setShowAttackModal(false)}
                onSuccess={handleAttackSuccess}
                building={{ ...building, owner_name: owner?.name }}
                buildingType={{ name: (building as any).name }}
                map={map}
                activeCompanyId={activeCompany.id}
                companyLevel={activeCompany.level}
                companyCash={activeCompany.cash}
              />

              <AttackResult
                isOpen={attackResult !== null}
                onClose={() => setAttackResult(null)}
                result={attackResult}
              />

              <SecurityModal
                isOpen={showSecurityModal}
                onClose={() => setShowSecurityModal(false)}
                onSuccess={handleActionSuccess}
                building={{ id: building.id, name: (building as any).name, cost: (building as any).cost || 0 }}
                security={security}
              />
            </>
          )}
        </>
      )}

      {/* Level Up Modal */}
      {levelUpData && (
        <LevelUpModal
          isOpen={true}
          onClose={() => setLevelUpData(null)}
          newLevel={levelUpData.newLevel}
          unlocks={levelUpData.unlocks}
        />
      )}
    </>
  );
}
