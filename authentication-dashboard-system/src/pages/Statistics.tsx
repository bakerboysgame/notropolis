import { useEffect, useState, useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, TrendingUp, TrendingDown, Wallet, Building2, DollarSign, Flame, MapPin, ExternalLink, AlertTriangle } from 'lucide-react';
import { useActiveCompany } from '../contexts/CompanyContext';
import { api, apiHelpers } from '../services/api';

interface ProfitEntry {
  rank: number;
  companyId: string;
  companyName: string;
  monthlyProfit: number;
}

interface NetWorthEntry {
  rank: number;
  companyId: string;
  companyName: string;
  cash: number;
  buildingsValue: number;
  netWorth: number;
}

interface StatisticsData {
  mapId: string;
  mapName: string;
  locationType: string;
  profitLeaderboard: ProfitEntry[];
  netWorthLeaderboard: NetWorthEntry[];
}

interface PropertyAttack {
  id: string;
  trickType: string;
  damageDealt: number;
  isCleaned: boolean;
  attackerName: string;
  createdAt: string;
}

interface Property {
  id: string;
  tileId: string;
  buildingType: string;
  buildingTypeId: string;
  location: {
    mapId: string;
    mapName: string;
    x: number;
    y: number;
  };
  health: number;
  isOnFire: boolean;
  isCollapsed: boolean;
  isForSale: boolean;
  salePrice: number | null;
  value: number;
  baseCost: number;
  profitPerTick: number;
  baseProfit: number;
  security: {
    hasCameras: boolean;
    hasGuardDogs: boolean;
    hasSecurityGuards: boolean;
    hasSprinklers: boolean;
    monthlyCost: number;
  };
  recentAttacks: PropertyAttack[];
  builtAt: string;
}

interface PropertiesData {
  properties: Property[];
  totals: {
    totalValue: number;
    totalProfit: number;
    propertyCount: number;
    collapsedCount: number;
    onFireCount: number;
    attackedCount: number;
  };
  mapName: string;
  locationType: string;
  taxRate: number;
}

type TabType = 'leaderboards' | 'profit-loss';

export function Statistics(): JSX.Element {
  const { activeCompany } = useActiveCompany();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('leaderboards');
  const [data, setData] = useState<StatisticsData | null>(null);
  const [propertiesData, setPropertiesData] = useState<PropertiesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [propertiesLoading, setPropertiesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatistics = useCallback(async () => {
    if (!activeCompany || !activeCompany.current_map_id) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.get('/api/game/statistics', {
        params: { company_id: activeCompany.id },
      });

      if (response.data.success) {
        setData(response.data.data);
      } else {
        setError('Failed to load statistics');
      }
    } catch (err) {
      setError(apiHelpers.handleError(err));
    } finally {
      setLoading(false);
    }
  }, [activeCompany]);

  const fetchProperties = useCallback(async () => {
    if (!activeCompany || !activeCompany.current_map_id) return;

    setPropertiesLoading(true);
    setError(null);

    try {
      const response = await api.get('/api/game/statistics/properties', {
        params: { company_id: activeCompany.id },
      });

      if (response.data.success) {
        setPropertiesData(response.data.data);
      } else {
        setError('Failed to load properties');
      }
    } catch (err) {
      setError(apiHelpers.handleError(err));
    } finally {
      setPropertiesLoading(false);
    }
  }, [activeCompany]);

  useEffect(() => {
    fetchStatistics();

    // Refresh every 30 seconds to catch tick updates
    const interval = setInterval(fetchStatistics, 30000);
    return () => clearInterval(interval);
  }, [fetchStatistics]);

  useEffect(() => {
    if (activeTab === 'profit-loss' && !propertiesData) {
      fetchProperties();
    }
  }, [activeTab, propertiesData, fetchProperties]);

  // Redirect if no active company
  if (!activeCompany) {
    return <Navigate to="/companies" replace />;
  }

  // Redirect if company not in a location
  if (!activeCompany.current_map_id) {
    return <Navigate to={`/companies/${activeCompany.id}`} replace />;
  }

  const formatMoney = (amount: number) => {
    const prefix = amount >= 0 ? '+' : '';
    return `${prefix}$${Math.abs(amount).toLocaleString()}`;
  };

  const formatNetWorth = (amount: number) => {
    return `$${amount.toLocaleString()}`;
  };

  const formatTrickType = (trickType: string) => {
    return trickType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const getHealthColor = (health: number) => {
    if (health >= 80) return 'text-green-400';
    if (health >= 50) return 'text-yellow-400';
    if (health >= 25) return 'text-orange-400';
    return 'text-red-400';
  };

  const getHealthBg = (health: number) => {
    if (health >= 80) return 'bg-green-500';
    if (health >= 50) return 'bg-yellow-500';
    if (health >= 25) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate(`/companies/${activeCompany.id}`)}
            className="flex items-center gap-2 text-neutral-400 hover:text-white mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to {activeCompany.name}
          </button>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-blue-400" />
            {data?.mapName || 'Town'} Statistics
          </h1>
          <p className="text-gray-400 mt-1">
            Company rankings updated every tick
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('leaderboards')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'leaderboards'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Leaderboards
          </button>
          <button
            onClick={() => setActiveTab('profit-loss')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'profit-loss'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Profit / Loss
          </button>
        </div>

        {/* Loading State */}
        {loading && !data && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-400">Loading statistics...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 bg-red-900/30 rounded-lg border border-red-700 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Leaderboards Tab */}
        {activeTab === 'leaderboards' && data && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly Profit/Loss Column */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
              <div className="p-4 border-b border-gray-700 flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-green-400" />
                <h2 className="text-lg font-bold text-white">Monthly Profit/Loss</h2>
              </div>
              <div className="divide-y divide-gray-700">
                {data.profitLeaderboard.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    No companies in this location yet
                  </div>
                ) : (
                  data.profitLeaderboard.map((entry) => (
                    <div
                      key={entry.companyId}
                      className={`p-4 flex items-center justify-between ${
                        entry.companyId === activeCompany.id ? 'bg-blue-900/20' : ''
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          entry.rank === 1 ? 'bg-yellow-500 text-black' :
                          entry.rank === 2 ? 'bg-gray-400 text-black' :
                          entry.rank === 3 ? 'bg-amber-700 text-white' :
                          'bg-gray-700 text-gray-300'
                        }`}>
                          {entry.rank}
                        </span>
                        {entry.companyId === activeCompany.id ? (
                          <span className="font-medium text-blue-400">
                            {entry.companyName}
                            <span className="ml-2 text-xs text-blue-400">(You)</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => navigate(`/enemy-hq/${entry.companyId}`)}
                            className="font-medium text-white hover:text-purple-400 hover:underline cursor-pointer transition-colors"
                          >
                            {entry.companyName}
                          </button>
                        )}
                      </div>
                      <div className={`flex items-center gap-2 font-mono font-bold ${
                        entry.monthlyProfit >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {entry.monthlyProfit >= 0 ? (
                          <TrendingUp className="w-4 h-4" />
                        ) : (
                          <TrendingDown className="w-4 h-4" />
                        )}
                        {formatMoney(entry.monthlyProfit)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Net Worth Column */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
              <div className="p-4 border-b border-gray-700 flex items-center gap-3">
                <Wallet className="w-5 h-5 text-purple-400" />
                <h2 className="text-lg font-bold text-white">Net Worth</h2>
              </div>
              <div className="divide-y divide-gray-700">
                {data.netWorthLeaderboard.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    No companies in this location yet
                  </div>
                ) : (
                  data.netWorthLeaderboard.map((entry) => (
                    <div
                      key={entry.companyId}
                      className={`p-4 ${
                        entry.companyId === activeCompany.id ? 'bg-blue-900/20' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-4">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            entry.rank === 1 ? 'bg-yellow-500 text-black' :
                            entry.rank === 2 ? 'bg-gray-400 text-black' :
                            entry.rank === 3 ? 'bg-amber-700 text-white' :
                            'bg-gray-700 text-gray-300'
                          }`}>
                            {entry.rank}
                          </span>
                          {entry.companyId === activeCompany.id ? (
                            <span className="font-medium text-blue-400">
                              {entry.companyName}
                              <span className="ml-2 text-xs text-blue-400">(You)</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => navigate(`/enemy-hq/${entry.companyId}`)}
                              className="font-medium text-white hover:text-purple-400 hover:underline cursor-pointer transition-colors"
                            >
                              {entry.companyName}
                            </button>
                          )}
                        </div>
                        <span className="font-mono font-bold text-purple-400">
                          {formatNetWorth(entry.netWorth)}
                        </span>
                      </div>
                      {entry.companyId === activeCompany.id && (
                        <div className="ml-12 flex items-center gap-4 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <Wallet className="w-3 h-3" />
                            Cash: {formatNetWorth(entry.cash)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            Buildings: {formatNetWorth(entry.buildingsValue)}
                          </span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Profit / Loss Tab */}
        {activeTab === 'profit-loss' && (
          <>
            {propertiesLoading && !propertiesData && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-gray-400">Loading properties...</p>
                </div>
              </div>
            )}

            {propertiesData && (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                    <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                      <Building2 className="w-4 h-4" />
                      Properties
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {propertiesData.totals.propertyCount}
                    </div>
                  </div>
                  <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                    <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                      <DollarSign className="w-4 h-4" />
                      Total Value
                    </div>
                    <div className="text-2xl font-bold text-purple-400">
                      ${propertiesData.totals.totalValue.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                    <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                      <TrendingUp className="w-4 h-4" />
                      Profit/Tick
                    </div>
                    <div className={`text-2xl font-bold ${propertiesData.totals.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatMoney(propertiesData.totals.totalProfit)}
                    </div>
                  </div>
                  <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                    <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                      <AlertTriangle className="w-4 h-4" />
                      Under Attack
                    </div>
                    <div className="text-2xl font-bold text-orange-400">
                      {propertiesData.totals.attackedCount}
                    </div>
                  </div>
                </div>

                {/* Properties Table */}
                <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                  <div className="p-4 border-b border-gray-700 flex items-center gap-3">
                    <DollarSign className="w-5 h-5 text-green-400" />
                    <h2 className="text-lg font-bold text-white">Your Properties</h2>
                    <span className="text-sm text-gray-400 ml-auto">
                      Tax Rate: {Math.round(propertiesData.taxRate * 100)}%
                    </span>
                  </div>

                  {propertiesData.properties.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      You don't own any properties yet
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-900/50">
                          <tr className="text-left text-xs text-gray-400 uppercase">
                            <th className="px-4 py-3">Property</th>
                            <th className="px-4 py-3">Location</th>
                            <th className="px-4 py-3">Health</th>
                            <th className="px-4 py-3">Attacks</th>
                            <th className="px-4 py-3 text-right">Value</th>
                            <th className="px-4 py-3 text-right">Profit/Tick</th>
                            <th className="px-4 py-3"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                          {[...propertiesData.properties].sort((a, b) => b.profitPerTick - a.profitPerTick).map((property) => (
                            <tr
                              key={property.id}
                              className={`hover:bg-gray-700/50 ${
                                property.isCollapsed ? 'opacity-50' : ''
                              }`}
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-white">
                                    {property.buildingType}
                                  </span>
                                  {property.isOnFire && (
                                    <span title="On Fire!">
                                      <Flame className="w-4 h-4 text-orange-500" />
                                    </span>
                                  )}
                                  {property.isCollapsed && (
                                    <span className="text-xs bg-red-900/50 text-red-400 px-2 py-0.5 rounded">
                                      Collapsed
                                    </span>
                                  )}
                                  {property.isForSale && (
                                    <span className="text-xs bg-blue-900/50 text-blue-400 px-2 py-0.5 rounded">
                                      For Sale
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1 text-gray-300">
                                  <MapPin className="w-3 h-3 text-gray-500" />
                                  ({property.location.x}, {property.location.y})
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-2 bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full ${getHealthBg(property.health)}`}
                                      style={{ width: `${property.health}%` }}
                                    />
                                  </div>
                                  <span className={`text-sm font-medium ${getHealthColor(property.health)}`}>
                                    {property.health}%
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                {property.recentAttacks.length > 0 && property.health < 100 ? (
                                  <div className="flex flex-col gap-1">
                                    {property.recentAttacks.slice(0, 2).map((attack) => (
                                      <div
                                        key={attack.id}
                                        className={`text-xs px-2 py-0.5 rounded ${
                                          attack.isCleaned
                                            ? 'bg-gray-700 text-gray-400'
                                            : 'bg-red-900/50 text-red-400'
                                        }`}
                                      >
                                        {formatTrickType(attack.trickType)} (-{attack.damageDealt}%)
                                      </div>
                                    ))}
                                    {property.recentAttacks.length > 2 && (
                                      <span className="text-xs text-gray-500">
                                        +{property.recentAttacks.length - 2} more
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-500 text-sm">None</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className="font-mono text-purple-400">
                                  ${property.value.toLocaleString()}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className={`font-mono font-medium ${
                                  property.profitPerTick >= 0 ? 'text-green-400' : 'text-red-400'
                                }`}>
                                  {formatMoney(property.profitPerTick)}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => navigate(`/map/${property.location.mapId}?x=${property.location.x}&y=${property.location.y}&modal=true`)}
                                  className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                                  title="View on map"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Statistics;
