import { useEffect, useState, useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, TrendingUp, TrendingDown, Wallet, Building2 } from 'lucide-react';
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

export function Statistics(): JSX.Element {
  const { activeCompany } = useActiveCompany();
  const navigate = useNavigate();
  const [data, setData] = useState<StatisticsData | null>(null);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    fetchStatistics();

    // Refresh every 30 seconds to catch tick updates
    const interval = setInterval(fetchStatistics, 30000);
    return () => clearInterval(interval);
  }, [fetchStatistics]);

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

        {/* Statistics Tables */}
        {data && (
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
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Statistics;
