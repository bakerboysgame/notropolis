import { Building2, MapPin, TrendingUp, Clock, MessageSquare } from 'lucide-react';
import { GameCompany } from '../../types/game';
import { CompanyStats } from '../../hooks/useCompanyStats';

interface CompanyCardProps {
  company: GameCompany;
  stats?: CompanyStats | null;
  unreadMessages?: number;
  onSelect: () => void;
  isActive?: boolean;
  isLoadingStats?: boolean;
}

function formatTimeAtLocation(joinedAt: string | null): string {
  if (!joinedAt) return 'Just arrived';

  const joined = new Date(joinedAt);
  const now = new Date();
  const diffMs = now.getTime() - joined.getTime();

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return 'Just arrived';
}

export function CompanyCard({ company, stats, unreadMessages = 0, onSelect, isActive, isLoadingStats }: CompanyCardProps) {
  return (
    <div
      onClick={onSelect}
      className={`bg-neutral-800 rounded-lg p-6 cursor-pointer hover:bg-neutral-700 transition border-2 ${
        isActive ? 'border-primary-500' : 'border-transparent'
      }`}
    >
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-xl font-bold text-white">{company.name}</h3>
        {unreadMessages > 0 && (
          <div className="flex items-center gap-1 bg-red-500/20 text-red-400 px-2 py-1 rounded text-xs">
            <MessageSquare className="w-3 h-3" />
            <span>{unreadMessages}</span>
          </div>
        )}
      </div>

      {company.current_map_id ? (
        <>
          {/* Location info */}
          <div className="flex items-center gap-2 text-sm text-neutral-400 mb-4">
            <MapPin className="w-4 h-4" />
            <span className="capitalize">
              {stats?.mapName || company.location_type || 'Unknown'}
            </span>
            <span className="text-neutral-600">•</span>
            <span className="capitalize">{company.location_type}</span>
            <span className="text-neutral-600">•</span>
            <span>Level {company.level}</span>
          </div>

          {isLoadingStats ? (
            <div className="animate-pulse space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="h-12 bg-neutral-700 rounded"></div>
                <div className="h-12 bg-neutral-700 rounded"></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="h-10 bg-neutral-700 rounded"></div>
                <div className="h-10 bg-neutral-700 rounded"></div>
                <div className="h-10 bg-neutral-700 rounded"></div>
              </div>
            </div>
          ) : (
            <>
              {/* Primary stats row */}
              <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                <div className="bg-neutral-900/50 rounded p-3">
                  <p className="text-neutral-500 text-xs mb-1">Net Worth</p>
                  <p className="text-yellow-400 font-mono font-bold">
                    ${(stats?.netWorth ?? company.cash).toLocaleString()}
                  </p>
                </div>
                <div className="bg-neutral-900/50 rounded p-3">
                  <p className="text-neutral-500 text-xs mb-1">Cash</p>
                  <p className="text-green-400 font-mono font-bold">
                    ${company.cash.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Secondary stats row */}
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-neutral-900/50 rounded p-2">
                  <div className="flex items-center gap-1 text-neutral-500 text-xs mb-1">
                    <Building2 className="w-3 h-3" />
                    <span>Buildings</span>
                  </div>
                  <p className="text-white font-mono">
                    {stats?.buildingsOwned ?? 0}
                  </p>
                </div>
                <div className="bg-neutral-900/50 rounded p-2">
                  <div className="flex items-center gap-1 text-neutral-500 text-xs mb-1">
                    <TrendingUp className="w-3 h-3" />
                    <span>Profit/mo</span>
                  </div>
                  <p className={`font-mono ${(stats?.monthlyProfit ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${(stats?.monthlyProfit ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="bg-neutral-900/50 rounded p-2">
                  <div className="flex items-center gap-1 text-neutral-500 text-xs mb-1">
                    <Clock className="w-3 h-3" />
                    <span>Time</span>
                  </div>
                  <p className="text-white font-mono text-xs">
                    {formatTimeAtLocation(stats?.joinedLocationAt ?? null)}
                  </p>
                </div>
              </div>
            </>
          )}

          {company.is_in_prison && (
            <div className="mt-4 p-2 bg-red-900/50 rounded text-red-400 text-sm flex items-center gap-2">
              <span>In Prison</span>
              <span>-</span>
              <span>Fine: ${company.prison_fine.toLocaleString()}</span>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-4">
          <MapPin className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
          <p className="text-neutral-500">No location</p>
          <p className="text-neutral-400 text-sm">Click to join a town</p>
        </div>
      )}
    </div>
  );
}
