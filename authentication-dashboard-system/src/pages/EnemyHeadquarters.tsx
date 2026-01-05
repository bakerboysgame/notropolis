import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { ArrowLeft, Building2, Wallet, TrendingUp, TrendingDown, EyeOff } from 'lucide-react';
import { useActiveCompany } from '../contexts/CompanyContext';
import { useHighlights, HIGHLIGHT_COLORS } from '../contexts/HighlightContext';
import { api, apiHelpers } from '../services/api';

interface CompanyStats {
  companyId: string;
  companyName: string;
  monthlyProfit: number;
  cash: number;
  buildingsValue: number;
  netWorth: number;
  profitRank: number;
  netWorthRank: number;
}

export function EnemyHeadquarters(): JSX.Element {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const { activeCompany } = useActiveCompany();
  const { getCompanyHighlight, setCompanyHighlight } = useHighlights();
  const [companyStats, setCompanyStats] = useState<CompanyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentHighlight = companyId ? getCompanyHighlight(companyId) : null;

  const fetchCompanyStats = useCallback(async () => {
    if (!activeCompany || !activeCompany.current_map_id || !companyId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.get('/api/game/statistics', {
        params: { company_id: activeCompany.id },
      });

      if (response.data.success) {
        const { profitLeaderboard, netWorthLeaderboard } = response.data.data;

        const profitEntry = profitLeaderboard.find((e: { companyId: string }) => e.companyId === companyId);
        const netWorthEntry = netWorthLeaderboard.find((e: { companyId: string }) => e.companyId === companyId);

        if (profitEntry && netWorthEntry) {
          setCompanyStats({
            companyId: profitEntry.companyId,
            companyName: profitEntry.companyName,
            monthlyProfit: profitEntry.monthlyProfit,
            cash: netWorthEntry.cash,
            buildingsValue: netWorthEntry.buildingsValue,
            netWorth: netWorthEntry.netWorth,
            profitRank: profitEntry.rank,
            netWorthRank: netWorthEntry.rank,
          });
        } else {
          setError('Company not found in this location');
        }
      } else {
        setError('Failed to load company data');
      }
    } catch (err) {
      setError(apiHelpers.handleError(err));
    } finally {
      setLoading(false);
    }
  }, [activeCompany, companyId]);

  useEffect(() => {
    fetchCompanyStats();
  }, [fetchCompanyStats]);

  const handleColorSelect = async (color: string | null) => {
    if (companyId && companyStats && activeCompany) {
      // Only call API when setting a highlight (not removing)
      // and only if it's a new highlight (different from current)
      if (color && color !== currentHighlight) {
        try {
          await api.post('/api/game/highlight', {
            company_id: activeCompany.id,
            target_company_id: companyId
          });
        } catch {
          // Silently fail - the highlight still works locally
        }
      }
      setCompanyHighlight(companyId, companyStats.companyName, color);
    }
  };

  if (!activeCompany) {
    return <Navigate to="/companies" replace />;
  }

  if (!activeCompany.current_map_id) {
    return <Navigate to={`/companies/${activeCompany.id}`} replace />;
  }

  const formatMoney = (amount: number) => {
    return `$${Math.abs(amount).toLocaleString()}`;
  };

  const formatProfitLoss = (amount: number) => {
    const prefix = amount >= 0 ? '+' : '-';
    return `${prefix}$${Math.abs(amount).toLocaleString()}`;
  };

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate('/statistics')}
          className="flex items-center gap-2 text-neutral-400 hover:text-white mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Statistics
        </button>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-400">Loading company info...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 bg-red-900/30 rounded-lg border border-red-700">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Company Info Card */}
        {companyStats && (
          <div className="space-y-6">
            {/* Company Header */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-lg bg-gray-700 flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-gray-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">{companyStats.companyName}</h1>
                  <p className="text-gray-400">Enemy Company</p>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-400 mb-1">
                    {companyStats.monthlyProfit >= 0 ? (
                      <TrendingUp className="w-4 h-4 text-green-400" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-400" />
                    )}
                    <span className="text-sm">Monthly Profit</span>
                  </div>
                  <div className={`text-xl font-bold font-mono ${
                    companyStats.monthlyProfit >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {formatProfitLoss(companyStats.monthlyProfit)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Rank #{companyStats.profitRank}</div>
                </div>

                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-400 mb-1">
                    <Wallet className="w-4 h-4 text-purple-400" />
                    <span className="text-sm">Net Worth</span>
                  </div>
                  <div className="text-xl font-bold font-mono text-purple-400">
                    {formatMoney(companyStats.netWorth)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Rank #{companyStats.netWorthRank}</div>
                </div>

                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-400 mb-1">
                    <Wallet className="w-4 h-4" />
                    <span className="text-sm">Cash</span>
                  </div>
                  <div className="text-lg font-bold font-mono text-white">
                    {formatMoney(companyStats.cash)}
                  </div>
                </div>

                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-400 mb-1">
                    <Building2 className="w-4 h-4" />
                    <span className="text-sm">Buildings</span>
                  </div>
                  <div className="text-lg font-bold font-mono text-white">
                    {formatMoney(companyStats.buildingsValue)}
                  </div>
                </div>
              </div>
            </div>

            {/* Highlight Color Picker */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h2 className="text-lg font-bold text-white mb-2">Highlight on Map</h2>
              <p className="text-gray-400 text-sm mb-4">
                Choose a color to highlight this company's buildings on the map
              </p>

              <div className="flex flex-wrap gap-3">
                {/* No highlight option */}
                <button
                  onClick={() => handleColorSelect(null)}
                  className={`w-12 h-12 rounded-lg border-2 border-gray-600 flex items-center justify-center transition-all ${
                    !currentHighlight ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-800' : 'hover:border-gray-500'
                  }`}
                  title="No highlight"
                >
                  <EyeOff className="w-5 h-5 text-gray-400" />
                </button>

                {/* Color options */}
                {HIGHLIGHT_COLORS.map(({ name, hex }) => (
                  <button
                    key={hex}
                    onClick={() => handleColorSelect(hex)}
                    style={{ backgroundColor: hex }}
                    className={`w-12 h-12 rounded-lg transition-all ${
                      currentHighlight === hex
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-800'
                        : 'hover:scale-110'
                    }`}
                    title={name}
                  />
                ))}
              </div>

              {currentHighlight && (
                <p className="text-sm text-gray-400 mt-4">
                  Currently highlighted with{' '}
                  <span
                    className="font-medium"
                    style={{ color: currentHighlight }}
                  >
                    {HIGHLIGHT_COLORS.find(c => c.hex === currentHighlight)?.name || 'custom color'}
                  </span>
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default EnemyHeadquarters;
