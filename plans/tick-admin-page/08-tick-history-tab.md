# Stage 8: Tick History Tab

## Objective
Build the Tick History tab with stats cards, trend charts, paginated table, and drill-down modal for company statistics.

## Dependencies
`[Requires: Stage 7 complete]` (TickAdminPage shell)
`[Requires: Stage 6 complete]` (Types and API service)

## Complexity
**Medium** — Multiple components, charts with recharts, modal for drill-down

## Files to Create

### 1. `authentication-dashboard-system/src/components/admin/TickHistoryTab.tsx`
Main history tab component.

### 2. `authentication-dashboard-system/src/components/admin/TickStatsCards.tsx`
Summary statistics cards.

### 3. `authentication-dashboard-system/src/components/admin/TickHistoryCharts.tsx`
Trend charts using recharts.

### 4. `authentication-dashboard-system/src/components/admin/TickHistoryTable.tsx`
Paginated tick history table.

### 5. `authentication-dashboard-system/src/components/admin/CompanyStatsModal.tsx`
Modal for drill-down into company statistics.

## Files to Modify

### `authentication-dashboard-system/src/pages/admin/TickAdminPage.tsx`
Replace placeholder with actual TickHistoryTab component.

## Implementation Details

### TickHistoryTab.tsx

```tsx
// src/components/admin/TickHistoryTab.tsx

import React, { useState, useEffect } from 'react';
import { tickAdminApi } from '../../services/tickAdminApi';
import type { TickStatsResponse, TickHistoryResponse, StatsPeriod } from '../../types/tick';
import TickStatsCards from './TickStatsCards';
import TickHistoryCharts from './TickHistoryCharts';
import TickHistoryTable from './TickHistoryTable';
import CompanyStatsModal from './CompanyStatsModal';

interface TickHistoryTabProps {
  onRefresh: () => void;
}

const TickHistoryTab: React.FC<TickHistoryTabProps> = ({ onRefresh }) => {
  const [stats, setStats] = useState<TickStatsResponse | null>(null);
  const [history, setHistory] = useState<TickHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<StatsPeriod>('24h');
  const [page, setPage] = useState(1);
  const [selectedTickId, setSelectedTickId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, historyData] = await Promise.all([
        tickAdminApi.getStats(period),
        tickAdminApi.getHistory({ page, limit: 20 }),
      ]);
      setStats(statsData);
      setHistory(historyData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [period, page]);

  // Refresh when parent triggers
  useEffect(() => {
    fetchData();
  }, [onRefresh]);

  if (loading && !stats) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500">{error}</p>
        <button
          onClick={fetchData}
          className="mt-4 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Period selector */}
      <div className="flex justify-end">
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as StatsPeriod)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="1h">Last Hour</option>
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="all">All Time</option>
        </select>
      </div>

      {/* Stats Cards */}
      {stats && <TickStatsCards summary={stats.summary} />}

      {/* Charts */}
      {stats && <TickHistoryCharts trends={stats.trends} />}

      {/* History Table */}
      {history && (
        <TickHistoryTable
          ticks={history.ticks}
          pagination={history.pagination}
          onPageChange={setPage}
          onTickClick={setSelectedTickId}
        />
      )}

      {/* Company Stats Modal */}
      {selectedTickId && (
        <CompanyStatsModal
          tickId={selectedTickId}
          onClose={() => setSelectedTickId(null)}
        />
      )}
    </div>
  );
};

export default TickHistoryTab;
```

### TickStatsCards.tsx

```tsx
// src/components/admin/TickStatsCards.tsx

import React from 'react';
import { Clock, DollarSign, Flame, AlertTriangle } from 'lucide-react';
import type { TickStatsSummary } from '../../types/tick';

interface TickStatsCardsProps {
  summary: TickStatsSummary;
}

const TickStatsCards: React.FC<TickStatsCardsProps> = ({ summary }) => {
  const cards = [
    {
      label: 'Total Ticks',
      value: summary.total_ticks.toLocaleString(),
      subValue: `Avg: ${summary.avg_execution_ms}ms`,
      icon: Clock,
      color: 'purple',
    },
    {
      label: 'Total Net Profit',
      value: `$${summary.total_net_profit.toLocaleString()}`,
      subValue: `Tax: $${summary.total_tax_collected.toLocaleString()}`,
      icon: DollarSign,
      color: 'green',
    },
    {
      label: 'Fires Started',
      value: summary.total_fires_started.toLocaleString(),
      subValue: `${summary.total_buildings_collapsed} collapsed`,
      icon: Flame,
      color: 'orange',
    },
    {
      label: 'Errors',
      value: summary.ticks_with_errors.toLocaleString(),
      subValue: summary.ticks_with_errors === 0 ? 'All clear' : 'Check logs',
      icon: AlertTriangle,
      color: summary.ticks_with_errors === 0 ? 'green' : 'red',
    },
  ];

  const colorClasses = {
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400',
    green: 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400',
    orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-400',
    red: 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400',
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{card.label}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {card.value}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {card.subValue}
              </p>
            </div>
            <div className={`p-3 rounded-lg ${colorClasses[card.color]}`}>
              <card.icon className="w-6 h-6" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TickStatsCards;
```

### TickHistoryCharts.tsx

```tsx
// src/components/admin/TickHistoryCharts.tsx

import React from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { TickStatsTrends } from '../../types/tick';

interface TickHistoryChartsProps {
  trends: TickStatsTrends;
}

const TickHistoryCharts: React.FC<TickHistoryChartsProps> = ({ trends }) => {
  // Format time for display
  const formatTime = (time: string) => {
    const date = new Date(time);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Execution Time Chart */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
          Execution Time (ms)
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={trends.execution_time}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="time"
              tickFormatter={formatTime}
              stroke="#9CA3AF"
              tick={{ fontSize: 10 }}
            />
            <YAxis stroke="#9CA3AF" tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: 'none',
                borderRadius: '8px',
              }}
              labelFormatter={formatTime}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#8B5CF6"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Profit Chart */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
          Profit Distribution
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={trends.profit}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="time"
              tickFormatter={formatTime}
              stroke="#9CA3AF"
              tick={{ fontSize: 10 }}
            />
            <YAxis stroke="#9CA3AF" tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: 'none',
                borderRadius: '8px',
              }}
              labelFormatter={formatTime}
              formatter={(value: number) => `$${value.toLocaleString()}`}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="gross"
              stackId="1"
              stroke="#10B981"
              fill="#10B981"
              fillOpacity={0.3}
              name="Gross"
            />
            <Area
              type="monotone"
              dataKey="net"
              stackId="2"
              stroke="#3B82F6"
              fill="#3B82F6"
              fillOpacity={0.3}
              name="Net"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Fire Events Chart (full width) */}
      {trends.fires.some(f => f.started > 0 || f.collapsed > 0) && (
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
            Fire Events
          </h3>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={trends.fires}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="time"
                tickFormatter={formatTime}
                stroke="#9CA3AF"
                tick={{ fontSize: 10 }}
              />
              <YAxis stroke="#9CA3AF" tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: 'none',
                  borderRadius: '8px',
                }}
                labelFormatter={formatTime}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="started"
                stroke="#F59E0B"
                strokeWidth={2}
                name="Started"
              />
              <Line
                type="monotone"
                dataKey="extinguished"
                stroke="#10B981"
                strokeWidth={2}
                name="Extinguished"
              />
              <Line
                type="monotone"
                dataKey="collapsed"
                stroke="#EF4444"
                strokeWidth={2}
                name="Collapsed"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default TickHistoryCharts;
```

### TickHistoryTable.tsx

```tsx
// src/components/admin/TickHistoryTable.tsx

import React from 'react';
import { ChevronLeft, ChevronRight, AlertCircle, CheckCircle } from 'lucide-react';
import type { TickHistoryEntry, Pagination } from '../../types/tick';

interface TickHistoryTableProps {
  ticks: TickHistoryEntry[];
  pagination: Pagination;
  onPageChange: (page: number) => void;
  onTickClick: (tickId: string) => void;
}

const TickHistoryTable: React.FC<TickHistoryTableProps> = ({
  ticks,
  pagination,
  onPageChange,
  onTickClick,
}) => {
  const formatTime = (time: string) => {
    return new Date(time).toLocaleString();
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Tick History ({pagination.total.toLocaleString()} total)
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Duration
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Maps
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Companies
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Net Profit
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Fires
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {ticks.map((tick) => (
              <tr
                key={tick.id}
                onClick={() => onTickClick(tick.id)}
                className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                  {formatTime(tick.processed_at)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                  {tick.execution_time_ms}ms
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                  {tick.maps_processed}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                  {tick.companies_updated}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-green-600 dark:text-green-400">
                  ${tick.net_profit.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm">
                  {tick.fires_started > 0 ? (
                    <span className="text-orange-500">
                      {tick.fires_started} started
                      {tick.buildings_collapsed > 0 && (
                        <span className="text-red-500 ml-1">
                          ({tick.buildings_collapsed} collapsed)
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-gray-400">None</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {tick.has_errors ? (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Page {pagination.page} of {pagination.total_pages}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.total_pages}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TickHistoryTable;
```

### CompanyStatsModal.tsx

```tsx
// src/components/admin/CompanyStatsModal.tsx

import React, { useState, useEffect } from 'react';
import { X, Building2, DollarSign, Flame, TrendingUp } from 'lucide-react';
import { tickAdminApi } from '../../services/tickAdminApi';
import type { TickDetailResponse } from '../../types/tick';

interface CompanyStatsModalProps {
  tickId: string;
  onClose: () => void;
}

const CompanyStatsModal: React.FC<CompanyStatsModalProps> = ({ tickId, onClose }) => {
  const [data, setData] = useState<TickDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const detail = await tickAdminApi.getTickDetail(tickId);
        setData(detail);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [tickId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Tick Details
            </h2>
            {data && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {new Date(data.tick.processed_at).toLocaleString()}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading && (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-red-500">{error}</div>
          )}

          {data && (
            <div className="space-y-6">
              {/* Tick Summary */}
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-900 rounded">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {data.tick.execution_time_ms}ms
                  </p>
                  <p className="text-xs text-gray-500">Duration</p>
                </div>
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-900 rounded">
                  <p className="text-2xl font-bold text-green-600">
                    ${data.tick.net_profit.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">Net Profit</p>
                </div>
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-900 rounded">
                  <p className="text-2xl font-bold text-blue-600">
                    ${data.tick.tax_amount.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">Tax Collected</p>
                </div>
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-900 rounded">
                  <p className="text-2xl font-bold text-orange-600">
                    {data.tick.fires_started}
                  </p>
                  <p className="text-xs text-gray-500">Fires Started</p>
                </div>
              </div>

              {/* Errors if any */}
              {data.tick.errors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-4">
                  <h3 className="font-medium text-red-800 dark:text-red-400 mb-2">
                    Errors ({data.tick.errors.length})
                  </h3>
                  <ul className="text-sm text-red-600 dark:text-red-300 space-y-1">
                    {data.tick.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Company Stats */}
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-3">
                  Company Statistics ({data.company_stats.length})
                </h3>
                <div className="space-y-3">
                  {data.company_stats.map((company) => (
                    <div
                      key={company.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {company.company_name}
                          </h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {company.map_name}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {company.is_earning ? (
                            <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs rounded">
                              Earning
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded">
                              Idle ({company.ticks_since_action} ticks)
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <span>{company.building_count} buildings</span>
                          {company.collapsed_count > 0 && (
                            <span className="text-red-500">
                              ({company.collapsed_count} collapsed)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-green-500" />
                          <span className="text-green-600">
                            +${company.net_profit.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-gray-400" />
                          <span>Tax: ${company.tax_amount.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Flame className="w-4 h-4 text-orange-500" />
                          <span>
                            {company.buildings_on_fire} on fire
                            {company.average_damage_percent > 0 && (
                              <span className="text-gray-500 ml-1">
                                (avg {company.average_damage_percent.toFixed(0)}% dmg)
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompanyStatsModal;
```

### Update TickAdminPage.tsx

Replace the placeholder import:

```tsx
// In TickAdminPage.tsx, replace:
// const TickHistoryTab = ({ onRefresh }: { onRefresh: () => void }) => (...)

// With:
import TickHistoryTab from '../../components/admin/TickHistoryTab';
```

## Database Changes

None — uses existing tables

## Test Cases

### Test 1: Stats Load
```
Navigate to /admin/tick
Expected: Stats cards show with data from last 24h
```

### Test 2: Period Selector
```
Change period to "Last 7 Days"
Expected: Stats and charts update to show 7-day data
```

### Test 3: Charts Render
```
View execution time chart
Expected: Line chart shows with data points
View profit chart
Expected: Area chart shows gross/net profit
```

### Test 4: Table Pagination
```
Click next page button
Expected: Page 2 loads with older ticks
Click previous button
Expected: Returns to page 1
```

### Test 5: Drill-Down Modal
```
Click on a tick row in table
Expected: Modal opens with tick details
Expected: Company statistics list shows
Click X to close
Expected: Modal closes
```

### Test 6: Error State
```
Simulate API error (disconnect network)
Expected: Error message with retry button
```

## Acceptance Checklist

- [ ] TickHistoryTab component created
- [ ] TickStatsCards shows 4 summary cards
- [ ] TickHistoryCharts shows execution and profit charts
- [ ] Fire events chart shows when there's fire data
- [ ] TickHistoryTable shows paginated ticks
- [ ] Table rows are clickable
- [ ] CompanyStatsModal opens on row click
- [ ] Modal shows tick summary
- [ ] Modal shows company statistics list
- [ ] Period selector works (1h, 24h, 7d, 30d, all)
- [ ] Pagination works
- [ ] Loading states show spinners
- [ ] Error states show retry option
- [ ] Dark mode styling works

## Deployment

```bash
cd authentication-dashboard-system
npm run build
npm run deploy
```

## Handoff Notes

- History tab is fully functional
- [See: Stage 9] will build the Settings tab
- [See: Stage 10] will add routing and complete integration
- Charts use recharts (already installed)
- Modal uses fixed positioning for overlay
- All components follow existing dark mode patterns
