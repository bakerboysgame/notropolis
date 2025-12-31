import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Sword, Shield, Calendar, MapPin, DollarSign, TrendingDown } from 'lucide-react';
import { useActiveCompany } from '../contexts/CompanyContext';
import { api, apiHelpers } from '../services/api';
import { DIRTY_TRICKS, type TrickType } from '../utils/dirtyTricks';

interface Attack {
  id: string;
  attacker_company_id: string;
  target_building_id: string;
  trick_type: TrickType;
  damage_dealt: number;
  was_caught: boolean;
  caught_by: string | null;
  fine_amount: number;
  security_active: boolean;
  police_active: boolean;
  created_at: string;
  building_type_name: string;
  x: number;
  y: number;
  map_name: string;
  target_company_name?: string; // For attacks made
  attacker_company_name?: string; // For attacks received
}

interface AttackHistory {
  attacks_made: Attack[];
  attacks_received: Attack[];
}

export function AttackLog(): JSX.Element {
  const { activeCompany } = useActiveCompany();
  const [history, setHistory] = useState<AttackHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'made' | 'received'>('made');

  useEffect(() => {
    if (!activeCompany) return;

    const fetchHistory = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await api.get('/api/game/attacks/history', {
          params: { company_id: activeCompany.id, limit: 50 },
        });

        if (response.data.success) {
          setHistory(response.data);
        } else {
          setError('Failed to load attack history');
        }
      } catch (err) {
        setError(apiHelpers.handleError(err));
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [activeCompany]);

  // Redirect if no active company
  if (!activeCompany) {
    return <Navigate to="/companies" replace />;
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const renderAttack = (attack: Attack, isMade: boolean) => {
    const trick = DIRTY_TRICKS[attack.trick_type];

    return (
      <div
        key={attack.id}
        className={`p-4 rounded-lg border ${
          attack.was_caught
            ? 'bg-red-900/20 border-red-800'
            : 'bg-gray-800 border-gray-700'
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          {/* Attack Info */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{trick?.icon || '💥'}</span>
              <div>
                <p className="font-bold text-white">{trick?.name || attack.trick_type}</p>
                <p className="text-sm text-gray-400">
                  {isMade ? (
                    <>
                      vs <span className="text-blue-400">{attack.target_company_name}</span>
                    </>
                  ) : (
                    <>
                      by <span className="text-red-400">{attack.attacker_company_name}</span>
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-2">
              <div className="flex items-center gap-1 text-gray-400">
                <MapPin className="w-3 h-3" />
                <span>
                  {attack.building_type_name} ({attack.x}, {attack.y})
                </span>
              </div>
              <div className="flex items-center gap-1 text-gray-400">
                <TrendingDown className="w-3 h-3" />
                <span className="text-red-400 font-bold">{attack.damage_dealt}% damage</span>
              </div>
              <div className="flex items-center gap-1 text-gray-400">
                <Calendar className="w-3 h-3" />
                <span>{formatDate(attack.created_at)}</span>
              </div>
              {attack.was_caught && attack.fine_amount > 0 && (
                <div className="flex items-center gap-1 text-gray-400">
                  <DollarSign className="w-3 h-3" />
                  <span className="text-red-400 font-bold">
                    ${attack.fine_amount.toLocaleString()} fine
                  </span>
                </div>
              )}
            </div>

            {/* Status badges */}
            <div className="flex flex-wrap gap-2">
              {attack.was_caught && (
                <span className="px-2 py-1 bg-red-900/30 text-red-400 text-xs rounded border border-red-800">
                  🚨 Caught by {attack.caught_by === 'security' ? 'Security' : 'Police'}
                </span>
              )}
              {!attack.was_caught && (
                <span className="px-2 py-1 bg-green-900/30 text-green-400 text-xs rounded border border-green-800">
                  ✅ Escaped
                </span>
              )}
              {attack.security_active && (
                <span className="px-2 py-1 bg-blue-900/30 text-blue-400 text-xs rounded border border-blue-800">
                  <Shield className="w-3 h-3 inline mr-1" />
                  Security Active
                </span>
              )}
              {!attack.police_active && (
                <span className="px-2 py-1 bg-yellow-900/30 text-yellow-400 text-xs rounded border border-yellow-800">
                  Police Strike
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <Sword className="w-8 h-8 text-red-400" />
            Attack History
          </h1>
          <p className="text-gray-400">
            View all dirty tricks attacks made and received
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('made')}
            className={`flex-1 px-4 py-3 rounded-lg font-bold transition-colors ${
              activeTab === 'made'
                ? 'bg-red-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <Sword className="w-5 h-5 inline mr-2" />
            Attacks Made ({history?.attacks_made.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('received')}
            className={`flex-1 px-4 py-3 rounded-lg font-bold transition-colors ${
              activeTab === 'received'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <Shield className="w-5 h-5 inline mr-2" />
            Attacks Received ({history?.attacks_received.length || 0})
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-400">Loading attack history...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 bg-red-900/30 rounded-lg border border-red-700">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Attack Lists */}
        {!loading && !error && history && (
          <div className="space-y-3">
            {activeTab === 'made' && history.attacks_made.length === 0 && (
              <div className="text-center py-12">
                <Sword className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No attacks made yet</p>
                <p className="text-gray-500 text-sm mt-2">
                  Attack enemy buildings to sabotage their operations!
                </p>
              </div>
            )}

            {activeTab === 'received' && history.attacks_received.length === 0 && (
              <div className="text-center py-12">
                <Shield className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No attacks received yet</p>
                <p className="text-gray-500 text-sm mt-2">
                  Install security systems to protect your buildings!
                </p>
              </div>
            )}

            {activeTab === 'made' &&
              history.attacks_made.map((attack) => renderAttack(attack, true))}

            {activeTab === 'received' &&
              history.attacks_received.map((attack) => renderAttack(attack, false))}
          </div>
        )}
      </div>
    </div>
  );
}
