import { useState } from 'react';
import { useTileDetail } from '../../hooks/useTileDetail';
import { useActiveCompany } from '../../contexts/CompanyContext';
import { BuyLandModal } from './BuyLandModal';
import { BuildModal } from './BuildModal';
import { SellModal } from './SellModal';
import { AttackModal } from './AttackModal';
import { AttackResult } from './AttackResult';
import { api, apiHelpers } from '../../services/api';

interface TileInfoProps {
  mapId: string;
  x: number;
  y: number;
  map: any;
  onClose: () => void;
  onRefresh?: () => void;
}

/**
 * Side panel displaying detailed information about a selected tile
 * Shows terrain, ownership, building details, and security
 */
export function TileInfo({ mapId, x, y, map, onClose, onRefresh }: TileInfoProps): JSX.Element {
  const { data, isLoading, error, refetch } = useTileDetail(mapId, x, y);
  const { activeCompany, refreshCompany } = useActiveCompany();
  const [showBuyLandModal, setShowBuyLandModal] = useState(false);
  const [showBuildModal, setShowBuildModal] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [showAttackModal, setShowAttackModal] = useState(false);
  const [attackResult, setAttackResult] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleActionSuccess = async () => {
    await refreshCompany(); // Refresh company cash/data
    await refetch(); // Refresh tile data
    if (onRefresh) {
      onRefresh(); // Refresh parent component (map)
    }
  };

  const handleAttackSuccess = async (result: any) => {
    setAttackResult(result);
    await handleActionSuccess();
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-center h-32">
          <div className="text-gray-400">Loading...</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white">Tile ({x}, {y})</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">
            ×
          </button>
        </div>
        <div className="text-red-400">{error || 'Failed to load tile details'}</div>
      </div>
    );
  }

  const { tile, building, owner, security } = data;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-white">Tile ({x}, {y})</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">
          ×
        </button>
      </div>

      {/* Terrain */}
      <div className="mb-4">
        <p className="text-sm text-gray-500">Terrain</p>
        <p className="text-white capitalize">{tile.terrain_type.replace(/_/g, ' ')}</p>
      </div>

      {/* Special building */}
      {tile.special_building && (
        <div className="mb-4 p-3 bg-yellow-900/30 rounded border border-yellow-700">
          <p className="text-yellow-400 capitalize font-medium">
            {tile.special_building.replace(/_/g, ' ')}
          </p>
          <p className="text-xs text-yellow-600 mt-1">Special Location</p>
        </div>
      )}

      {/* Ownership */}
      <div className="mb-4">
        <p className="text-sm text-gray-500">Owner</p>
        {owner ? (
          <p className="text-red-400">{owner.name}</p>
        ) : (
          <p className="text-green-400">Available</p>
        )}
      </div>

      {/* Building */}
      {building && (
        <div className="mb-4 p-3 bg-gray-700 rounded">
          <p className="font-bold text-white">{building.name}</p>
          <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
            <div>
              <p className="text-gray-500">Profit</p>
              <p className="text-green-400">${building.calculated_profit}/tick</p>
            </div>
            <div>
              <p className="text-gray-500">Damage</p>
              <p className={building.damage_percent > 0 ? 'text-red-400' : 'text-gray-400'}>
                {building.damage_percent}%
              </p>
            </div>
          </div>

          {building.is_on_fire && (
            <div className="mt-2 p-2 bg-red-900/30 rounded border border-red-700">
              <p className="text-red-500 font-medium">🔥 On Fire!</p>
            </div>
          )}

          {building.is_collapsed && (
            <div className="mt-2 p-2 bg-gray-800 rounded border border-gray-600">
              <p className="text-gray-400">💥 Collapsed</p>
            </div>
          )}

          {building.is_for_sale && building.sale_price && (
            <div className="mt-2 p-2 bg-yellow-900/30 rounded border border-yellow-700">
              <p className="text-yellow-400">
                For Sale: ${building.sale_price.toLocaleString()}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Security */}
      {security && (
        <div className="mb-4">
          <p className="text-sm text-gray-500 mb-2">Security</p>
          <div className="flex gap-2 flex-wrap">
            {security.has_cameras && (
              <span className="px-2 py-1 bg-blue-900/30 rounded text-xs text-blue-400 border border-blue-700">
                📷 Cameras
              </span>
            )}
            {security.has_guard_dogs && (
              <span className="px-2 py-1 bg-blue-900/30 rounded text-xs text-blue-400 border border-blue-700">
                🐕 Dogs
              </span>
            )}
            {security.has_security_guards && (
              <span className="px-2 py-1 bg-blue-900/30 rounded text-xs text-blue-400 border border-blue-700">
                👮 Guards
              </span>
            )}
            {security.has_sprinklers && (
              <span className="px-2 py-1 bg-blue-900/30 rounded text-xs text-blue-400 border border-blue-700">
                💦 Sprinklers
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Monthly Cost: ${security.monthly_cost}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="mt-6 space-y-2">
        {actionError && (
          <div className="p-2 bg-red-900/30 rounded border border-red-700">
            <p className="text-red-400 text-sm">{actionError}</p>
          </div>
        )}

        {!tile.owner_company_id && tile.terrain_type !== 'water' && tile.terrain_type !== 'road' && !tile.special_building && activeCompany && (
          <button
            onClick={() => setShowBuyLandModal(true)}
            className="w-full py-2 bg-green-600 text-white rounded hover:bg-green-500 transition-colors"
          >
            Buy Land
          </button>
        )}

        {tile.owner_company_id === activeCompany?.id && !building && (
          <button
            onClick={() => setShowBuildModal(true)}
            className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors"
          >
            Build
          </button>
        )}

        {/* Sell button - for buildings owned by active company */}
        {building && building.company_id === activeCompany?.id && !building.is_collapsed && !building.is_for_sale && (
          <button
            onClick={() => setShowSellModal(true)}
            className="w-full py-2 bg-yellow-600 text-white rounded hover:bg-yellow-500 transition-colors"
          >
            Sell Property
          </button>
        )}

        {/* Cancel listing button - for buildings owned by active company that are listed */}
        {building && building.company_id === activeCompany?.id && building.is_for_sale && (
          <button
            onClick={async () => {
              setActionLoading(true);
              setActionError(null);
              try {
                await api.post('/api/game/market/cancel-listing', {
                  company_id: activeCompany.id,
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
            className="w-full py-2 bg-gray-600 text-white rounded hover:bg-gray-500 transition-colors disabled:opacity-50"
          >
            {actionLoading ? 'Canceling...' : 'Cancel Listing'}
          </button>
        )}

        {/* Buy button - for buildings listed for sale by others */}
        {building && building.is_for_sale && building.sale_price && building.company_id !== activeCompany?.id && activeCompany && (
          <button
            onClick={async () => {
              if (!activeCompany || !building.sale_price || activeCompany.cash < building.sale_price) {
                setActionError('Insufficient funds');
                return;
              }
              setActionLoading(true);
              setActionError(null);
              try {
                await api.post('/api/game/market/buy-property', {
                  company_id: activeCompany.id,
                  building_id: building.id,
                });
                await handleActionSuccess();
              } catch (err) {
                setActionError(apiHelpers.handleError(err));
              } finally {
                setActionLoading(false);
              }
            }}
            disabled={actionLoading || (activeCompany && building.sale_price ? activeCompany.cash < building.sale_price : true)}
            className="w-full py-2 bg-green-600 text-white rounded hover:bg-green-500 transition-colors disabled:opacity-50"
          >
            {actionLoading ? 'Purchasing...' : `Buy for $${building.sale_price.toLocaleString()}`}
          </button>
        )}

        {/* Attack button - for enemy buildings (not owned by player, not collapsed) */}
        {building && building.company_id !== activeCompany?.id && !building.is_collapsed && activeCompany && (
          <button
            onClick={() => setShowAttackModal(true)}
            className="w-full py-2 bg-red-600 text-white rounded hover:bg-red-500 transition-colors font-bold"
          >
            💥 Attack Building
          </button>
        )}

        {/* Demolish button - for collapsed buildings owned by active company */}
        {building && building.is_collapsed && building.company_id === activeCompany?.id && activeCompany && (
          <button
            onClick={async () => {
              setActionLoading(true);
              setActionError(null);
              try {
                const response = await api.post<{ success: boolean; demolition_cost: number }>('/api/game/market/demolish', {
                  company_id: activeCompany.id,
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
            className="w-full py-2 bg-red-600 text-white rounded hover:bg-red-500 transition-colors disabled:opacity-50"
          >
            {actionLoading ? 'Demolishing...' : 'Demolish (10% cost)'}
          </button>
        )}
      </div>

      {/* Modals */}
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
            <SellModal
              isOpen={showSellModal}
              onClose={() => setShowSellModal(false)}
              onSuccess={handleActionSuccess}
              building={building}
              buildingType={{ cost: building.cost || 0, name: building.name }}
              tile={tile}
              map={map}
              activeCompanyId={activeCompany.id}
            />
          )}

          {building && (
            <>
              <AttackModal
                isOpen={showAttackModal}
                onClose={() => setShowAttackModal(false)}
                onSuccess={handleAttackSuccess}
                building={{ ...building, owner_name: owner?.name }}
                buildingType={{ name: building.name }}
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
            </>
          )}
        </>
      )}
    </div>
  );
}
