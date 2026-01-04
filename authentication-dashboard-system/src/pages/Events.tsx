import { useEffect, useState, useCallback } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, Filter, ChevronDown, Loader2 } from 'lucide-react';
import { useActiveCompany } from '../contexts/CompanyContext';
import { api, apiHelpers } from '../services/api';
import { getBuildingSpriteUrl } from '../utils/isometricRenderer';

interface EventItem {
  id: string;
  type: string;
  actorId: string;
  actorName: string;
  targetCompanyId: string | null;
  targetCompanyName: string | null;
  targetTileId: string | null;
  targetBuildingId: string | null;
  buildingTypeId: string | null;
  tileX: number | null;
  tileY: number | null;
  amount: number | null;
  details: Record<string, unknown> | null;
  createdAt: string;
  description: string;
}

interface CompanyOption {
  id: string;
  name: string;
}

interface EventsData {
  events: EventItem[];
  hasMore: boolean;
  total: number;
  limit: number;
  offset: number;
}

export function Events(): JSX.Element {
  const { activeCompany } = useActiveCompany();
  const navigate = useNavigate();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  // Filters
  const [byFilter, setByFilter] = useState<string>('');
  const [toFilter, setToFilter] = useState<string>('');
  const [offset, setOffset] = useState(0);
  const limit = 25;

  // Fetch companies for filter dropdowns
  const fetchCompanies = useCallback(async () => {
    if (!activeCompany?.current_map_id) return;

    try {
      const response = await api.get('/api/game/events/companies', {
        params: { company_id: activeCompany.id },
      });

      if (response.data.success) {
        setCompanies(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch companies:', err);
    }
  }, [activeCompany]);

  // Fetch events
  const fetchEvents = useCallback(async (reset = false) => {
    if (!activeCompany?.current_map_id) return;

    const currentOffset = reset ? 0 : offset;

    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const params: Record<string, string | number> = {
        company_id: activeCompany.id,
        limit,
        offset: currentOffset,
      };

      if (byFilter) params.by = byFilter;
      if (toFilter) params.to = toFilter;

      const response = await api.get('/api/game/events', { params });

      if (response.data.success) {
        const data: EventsData = response.data.data;

        if (reset) {
          setEvents(data.events);
          setOffset(data.limit);
        } else {
          setEvents(prev => [...prev, ...data.events]);
          setOffset(currentOffset + data.limit);
        }

        setHasMore(data.hasMore);
        setTotal(data.total);
      } else {
        setError('Failed to load events');
      }
    } catch (err) {
      setError(apiHelpers.handleError(err));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activeCompany, byFilter, toFilter, offset]);

  // Initial load
  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  // Fetch events when filters change
  useEffect(() => {
    setOffset(0);
    fetchEvents(true);
  }, [activeCompany?.current_map_id, byFilter, toFilter]);

  // Redirect if no active company
  if (!activeCompany) {
    return <Navigate to="/companies" replace />;
  }

  // Redirect if company not in a location
  if (!activeCompany.current_map_id) {
    return <Navigate to={`/companies/${activeCompany.id}`} replace />;
  }

  const handleLoadMore = () => {
    fetchEvents(false);
  };

  const clearFilters = () => {
    setByFilter('');
    setToFilter('');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'buy_land':
      case 'build':
        return 'text-green-400';
      case 'dirty_trick':
      case 'caught_by_police':
        return 'text-red-400';
      case 'sell_to_state':
      case 'demolish':
        return 'text-orange-400';
      case 'bank_transfer':
        return 'text-blue-400';
      case 'tick_income':
        return 'text-emerald-400';
      case 'security_purchase':
        return 'text-purple-400';
      default:
        return 'text-gray-400';
    }
  };

  const hasActiveFilters = byFilter || toFilter;

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
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
            <Calendar className="w-7 h-7 text-blue-400" />
            Events
          </h1>
          <p className="text-gray-400 mt-1">
            Recent activity in this location ({total} total events)
          </p>
        </div>

        {/* Filters */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-300">Filters</span>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="ml-auto text-xs text-blue-400 hover:text-blue-300"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* By Filter */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">By (Actor)</label>
              <div className="relative">
                <select
                  value={byFilter}
                  onChange={(e) => setByFilter(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All companies</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* To Filter */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">To (Target)</label>
              <div className="relative">
                <select
                  value={toFilter}
                  onChange={(e) => setToFilter(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All companies</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-400">Loading events...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 bg-red-900/30 rounded-lg border border-red-700 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Events List */}
        {!loading && events.length > 0 && (
          <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            <div className="divide-y divide-gray-700">
              {events.map((event) => {
                const spriteUrl = event.buildingTypeId ? getBuildingSpriteUrl(event.buildingTypeId) : null;
                const canNavigate = spriteUrl && event.tileX !== null && event.tileY !== null && activeCompany.current_map_id;

                return (
                  <div
                    key={event.id}
                    className={`p-4 hover:bg-gray-750 ${
                      event.actorId === activeCompany.id || event.targetCompanyId === activeCompany.id
                        ? 'bg-blue-900/10'
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Building sprite - clickable to navigate to map */}
                      {spriteUrl && (
                        canNavigate ? (
                          <Link
                            to={`/map/${activeCompany.current_map_id}?x=${event.tileX}&y=${event.tileY}`}
                            className="flex-shrink-0 w-10 h-10 bg-gray-700 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all"
                            title="Go to building"
                          >
                            <img
                              src={spriteUrl}
                              alt="Building"
                              className="w-full h-full object-contain"
                            />
                          </Link>
                        ) : (
                          <div className="flex-shrink-0 w-10 h-10 bg-gray-700 rounded-lg overflow-hidden">
                            <img
                              src={spriteUrl}
                              alt="Building"
                              className="w-full h-full object-contain"
                            />
                          </div>
                        )
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${getEventTypeColor(event.type)}`}>
                          {event.description}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDate(event.createdAt)}
                        </p>
                      </div>
                      {event.amount !== null && event.amount !== 0 && (
                        <span className={`text-sm font-mono whitespace-nowrap ${
                          event.amount > 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {event.amount > 0 ? '+' : ''}${Math.abs(event.amount).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="p-4 border-t border-gray-700">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm text-white font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    `Load more (${events.length} of ${total})`
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!loading && events.length === 0 && (
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-12 text-center">
            <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">No events found</h3>
            <p className="text-gray-500 text-sm">
              {hasActiveFilters
                ? 'Try adjusting your filters to see more events.'
                : 'There are no events in this location yet.'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="mt-4 text-blue-400 hover:text-blue-300 text-sm"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Events;
