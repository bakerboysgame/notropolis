import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Shield,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Filter,
  AlertTriangle,
  XCircle,
  Globe,
  User,
  Activity,
  Building,
  Check,
  X,
  Users
} from 'lucide-react';
import { api, apiHelpers } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface AuditLog {
  id: string;
  original_log_id: string;
  timestamp: string;
  action_type: string;
  severity_level: 'CRITICAL' | 'ERROR' | 'WARNING' | 'INFO';
  user_email: string | null;
  user_name: string | null;
  user_id: string;
  company_name: string | null;
  company_id: string;
  ip_address: string | null;
  user_agent: string | null;
  action_description: string;
  resource_type: string;
  resource_identifier: string | null;
  details_summary: string | null;
}

interface AuditLogStatistics {
  total_events: number;
  unique_users: number;
  unique_companies: number;
  critical_events: number;
  error_events: number;
  warning_events: number;
  info_events: number;
  topActions: { action_type: string; count: number }[];
  topUsers: { user_email: string; user_name: string; count: number }[];
}

interface FilterOptions {
  actionTypes: string[];
  severityLevels: string[];
  companies: Array<{ company_id: string; company_name: string }>;
  users: Array<{ user_id: string; user_email: string; user_name: string }>;
}

interface AuditLogsResponse {
  data: AuditLog[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// Multi-select filter dropdown component
function MultiSelectFilter({
  label,
  options,
  selected,
  onSelectionChange,
  icon: Icon,
  placeholder = 'Filter...'
}: {
  label: string;
  options: { value: string; label: string; sublabel?: string }[];
  selected: string[];
  onSelectionChange: (selected: string[]) => void;
  icon: React.ComponentType<{ className?: string }>;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setFilterText('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onSelectionChange(selected.filter(s => s !== value));
    } else {
      onSelectionChange([...selected, value]);
    }
  };

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectionChange([]);
  };

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(filterText.toLowerCase()) ||
    (opt.sublabel && opt.sublabel.toLowerCase().includes(filterText.toLowerCase()))
  );

  const getSelectedLabel = () => {
    if (selected.length === 0) return null;
    if (selected.length === 1) {
      const opt = options.find(o => o.value === selected[0]);
      return opt?.label || selected[0];
    }
    return `${selected.length} selected`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 border rounded-lg text-sm transition-colors text-left ${
          selected.length > 0
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
        }`}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Icon className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">
            {getSelectedLabel() || `Select ${label.toLowerCase()}...`}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {selected.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="p-0.5 hover:bg-blue-200 rounded"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-80 overflow-hidden">
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <input
              type="text"
              placeholder={placeholder}
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              autoFocus
            />
          </div>
          <div className="p-2 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
            <span className="text-xs text-gray-500 dark:text-gray-400">{filteredOptions.length} options</span>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => onSelectionChange([])}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="p-1 max-h-56 overflow-auto">
            {filteredOptions.map(option => (
              <label
                key={option.value}
                onClick={() => toggleOption(option.value)}
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer"
              >
                <div className={`w-4 h-4 border rounded flex items-center justify-center flex-shrink-0 ${
                  selected.includes(option.value)
                    ? 'bg-blue-600 border-blue-600'
                    : 'border-gray-300 dark:border-gray-600'
                }`}>
                  {selected.includes(option.value) && <Check className="w-3 h-3 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-gray-700 dark:text-gray-200 block truncate">{option.label}</span>
                  {option.sublabel && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 block truncate">{option.sublabel}</span>
                  )}
                </div>
              </label>
            ))}
            {filteredOptions.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">No matches</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AuditLogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [statistics, setStatistics] = useState<AuditLogStatistics | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ actionTypes: [], severityLevels: [], companies: [], users: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const limit = 100;

  // Filters
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    selectedActionTypes: [] as string[],
    severityLevel: '',
    selectedUserIds: [] as string[],
    selectedCompanyIds: [] as string[]
  });

  // Fetch audit logs
  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      params.append('offset', ((currentPage - 1) * limit).toString());

      // Apply filters
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.severityLevel) params.append('severityLevel', filters.severityLevel);
      if (filters.selectedActionTypes.length > 0) {
        params.append('actions', filters.selectedActionTypes.join(','));
      }
      if (filters.selectedUserIds.length > 0) {
        params.append('userIds', filters.selectedUserIds.join(','));
      }
      if (filters.selectedCompanyIds.length > 0) {
        params.append('companyIds', filters.selectedCompanyIds.join(','));
      }

      const response = await api.get(`/api/audit/logs?${params}`);
      const data = apiHelpers.handleResponse<AuditLogsResponse>(response);

      setLogs(data.data);
      setTotalCount(data.pagination.total);
      setHasMore(data.pagination.hasMore);
    } catch (err) {
      setError('Failed to load audit logs');
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, filters, limit]);

  // Fetch statistics
  const fetchStatistics = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const response = await api.get(`/api/audit/statistics?${params}`);
      const data = apiHelpers.handleResponse<AuditLogStatistics>(response);
      setStatistics(data);
    } catch (err) {
      console.error('Error fetching statistics:', err);
    }
  }, [filters.startDate, filters.endDate]);

  // Fetch filter options
  const fetchFilterOptions = useCallback(async () => {
    try {
      const response = await api.get('/api/audit/filter-options');
      const data = apiHelpers.handleResponse<FilterOptions>(response);
      setFilterOptions(data);
    } catch (err) {
      console.error('Error fetching filter options:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchLogs();
    fetchStatistics();
    fetchFilterOptions();
  }, [fetchLogs, fetchStatistics, fetchFilterOptions]);

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchLogs(), fetchStatistics()]);
    setRefreshing(false);
  };

  // Handle filter apply
  const handleApplyFilters = () => {
    setCurrentPage(1);
    fetchLogs();
    fetchStatistics();
    setShowFilters(false);
  };

  // Handle filter clear
  const handleClearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      selectedActionTypes: [],
      severityLevel: '',
      selectedUserIds: [],
      selectedCompanyIds: []
    });
    setCurrentPage(1);
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;

    return date.toLocaleString();
  };

  // Get severity badge colors
  const getSeverityColors = (severity: string) => {
    const colors: Record<string, string> = {
      CRITICAL: 'bg-red-100 text-red-800',
      ERROR: 'bg-orange-100 text-orange-800',
      WARNING: 'bg-yellow-100 text-yellow-800',
      INFO: 'bg-blue-100 text-blue-800',
    };
    return colors[severity] || 'bg-gray-100 text-gray-800';
  };

  // Convert action type to user-friendly label
  const getActionTypeLabel = (actionType: string): string => {
    const labels: Record<string, string> = {
      'LOGIN': 'User Login',
      'LOGOUT': 'User Logout',
      'LOGIN_FAILED': 'Failed Login',
      'USER_CREATED': 'User Created',
      'USER_UPDATED': 'User Updated',
      'USER_DELETED': 'User Deleted',
      'USER_ARCHIVED': 'User Archived',
      'USER_RESTORED': 'User Restored',
      'USER_INVITED': 'User Invited',
      'INVITATION_RESENT': 'Invitation Resent',
      'PASSWORD_CHANGED': 'Password Changed',
      'PASSWORD_RESET_REQUESTED': 'Password Reset',
      '2FA_ENABLED': '2FA Enabled',
      '2FA_DISABLED': '2FA Disabled',
      'MAGIC_LINK_SENT': 'Magic Link Sent',
      'MAGIC_LINK_USED': 'Magic Link Used',
      'COMPANY_CREATED': 'Company Created',
      'COMPANY_UPDATED': 'Company Updated',
      'COMPANY_ARCHIVED': 'Company Archived',
      'COMPANY_RESTORED': 'Company Restored',
      'PERMISSION_GRANTED': 'Permission Granted',
      'PERMISSION_REVOKED': 'Permission Revoked',
      'ROLE_CREATED': 'Role Created',
      'ROLE_UPDATED': 'Role Updated',
      'ROLE_DELETED': 'Role Deleted',
      'ROLE_PAGES_UPDATED': 'Role Pages Updated',
      '2FA_CODE_REQUESTED': '2FA Code Requested',
      'TOTP_SETUP_STARTED': 'TOTP Setup Started',
      'TOTP_ENABLED': 'TOTP Enabled'
    };

    return labels[actionType] || actionType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  // Parse and format details for display
  const parseDetails = (detailsJson: string | null): { changes?: { field: string; before: any; after: any }[]; changedFieldsOnly?: string[]; raw?: any } | null => {
    if (!detailsJson) return null;
    try {
      const details = JSON.parse(detailsJson);

      // Check if it has old_values and new_values (new format with before/after)
      if (details.old_values && details.new_values) {
        const changes: { field: string; before: any; after: any }[] = [];
        const allFields = new Set([...Object.keys(details.old_values || {}), ...Object.keys(details.new_values || {})]);

        allFields.forEach(field => {
          const before = details.old_values?.[field];
          const after = details.new_values?.[field];
          if (before !== after) {
            changes.push({ field, before, after });
          }
        });

        return { changes, raw: details };
      }

      // Old format: just field names without values
      if (details.changes && Array.isArray(details.changes)) {
        return { changedFieldsOnly: details.changes, raw: details };
      }
      if (details.changed_fields && Array.isArray(details.changed_fields)) {
        return { changedFieldsOnly: details.changed_fields, raw: details };
      }

      return { raw: details };
    } catch {
      return null;
    }
  };

  // Format a value for display
  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '(empty)';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return value.join(', ') || '(none)';
    return String(value);
  };

  // Format field name for display
  const formatFieldName = (field: string): string => {
    return field
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Audit Logs</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Monitor system activity and security events</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              showFilters
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Events</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {statistics.total_events.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Critical Events</p>
                <p className="text-2xl font-semibold text-red-600 dark:text-red-400">
                  {statistics.critical_events.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <User className="w-8 h-8 text-green-600 dark:text-green-400" />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Unique Users</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {statistics.unique_users.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {user?.role === 'master_admin' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-3">
                <Building className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Companies</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    {statistics.unique_companies.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Severity</label>
              <select
                value={filters.severityLevel}
                onChange={(e) => setFilters({ ...filters, severityLevel: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="ERROR">Error</option>
                <option value="WARNING">Warning</option>
                <option value="INFO">Info</option>
              </select>
            </div>

            {/* Action Type Multi-Select */}
            <MultiSelectFilter
              label="Action"
              icon={Activity}
              options={(filterOptions?.actionTypes || []).map(action => ({
                value: action,
                label: getActionTypeLabel(action)
              }))}
              selected={filters.selectedActionTypes}
              onSelectionChange={(selected) => setFilters({ ...filters, selectedActionTypes: selected })}
              placeholder="Search actions..."
            />

            {/* User Multi-Select Filter */}
            <MultiSelectFilter
              label="User"
              icon={Users}
              options={(filterOptions?.users || []).map(u => ({
                value: u.user_id,
                label: u.user_name || u.user_email,
                sublabel: u.user_name ? u.user_email : undefined
              }))}
              selected={filters.selectedUserIds}
              onSelectionChange={(selected) => setFilters({ ...filters, selectedUserIds: selected })}
              placeholder="Search users..."
            />

            {/* Company Multi-Select (Master Admin only) */}
            {user?.role === 'master_admin' && (
              <MultiSelectFilter
                label="Company"
                icon={Building}
                options={(filterOptions?.companies || []).map(c => ({
                  value: c.company_id,
                  label: c.company_name
                }))}
                selected={filters.selectedCompanyIds}
                onSelectionChange={(selected) => setFilters({ ...filters, selectedCompanyIds: selected })}
                placeholder="Search companies..."
              />
            )}
          </div>

          {/* Filter Actions */}
          <div className="flex items-center gap-3 mt-6">
            <button
              onClick={handleApplyFilters}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Apply Filters
            </button>
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {/* Audit Logs Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64 text-red-600 dark:text-red-400">
            <AlertTriangle className="w-6 h-6 mr-2" />
            {error}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
            <Shield className="w-12 h-12 mb-3 text-gray-300 dark:text-gray-600" />
            <p>No audit logs found</p>
            <p className="text-sm">Try adjusting your filters or check back later</p>
          </div>
        ) : (
          <div className="overflow-hidden">
            <table className="w-full divide-y divide-gray-200 dark:divide-gray-700 table-fixed">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">
                    When
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">
                    Severity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-44">
                    User
                  </th>
                  {user?.role === 'master_admin' && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-36">
                      Company
                    </th>
                  )}
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-20">
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {logs.map((log) => (
                  <React.Fragment key={log.id}>
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <div className="text-gray-900 dark:text-gray-100 font-medium">
                          {formatTimestamp(log.timestamp)}
                        </div>
                        <div className="text-gray-400 dark:text-gray-500 text-xs">
                          {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-md ${getSeverityColors(log.severity_level)}`}>
                          {log.severity_level}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={log.action_description}>
                            {log.action_description}
                          </div>
                          <code className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 px-1 py-0.5 rounded truncate max-w-[180px]" title={log.action_type}>
                            {log.action_type}
                          </code>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {log.user_email ? (
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={log.user_name || 'Unknown'}>{log.user_name || 'Unknown'}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate" title={log.user_email}>{log.user_email}</div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400 dark:text-gray-500 italic">System</span>
                        )}
                      </td>
                      {user?.role === 'master_admin' && (
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          <span className="truncate block" title={log.company_name || '-'}>{log.company_name || <span className="text-gray-400 dark:text-gray-500">-</span>}</span>
                        </td>
                      )}
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <button
                          onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                          className={`text-sm font-medium px-2 py-1 rounded transition-colors ${
                            expandedRow === log.id
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                              : 'text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          {expandedRow === log.id ? 'Hide' : 'Details'}
                        </button>
                      </td>
                    </tr>
                    {expandedRow === log.id && (
                      <tr className="bg-gray-50 dark:bg-gray-900">
                        <td
                          colSpan={user?.role === 'master_admin' ? 6 : 5}
                          className="px-4 py-4"
                        >
                          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Resource Type</span>
                                <p className="text-gray-900 dark:text-gray-100 font-medium mt-0.5">{log.resource_type}</p>
                              </div>
                              {log.resource_identifier && (
                                <div>
                                  <span className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Resource ID</span>
                                  <p className="text-gray-900 dark:text-gray-100 font-mono text-xs mt-0.5 break-all">
                                    {log.resource_identifier}
                                  </p>
                                </div>
                              )}
                              {log.ip_address && (
                                <div>
                                  <span className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">IP Address</span>
                                  <p className="text-gray-900 dark:text-gray-100 font-mono text-sm mt-0.5 flex items-center gap-1">
                                    <Globe className="w-3 h-3 text-gray-400" />
                                    {log.ip_address}
                                  </p>
                                </div>
                              )}
                            </div>
                            {log.user_agent && (
                              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                                <span className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">User Agent</span>
                                <p className="text-gray-600 dark:text-gray-300 text-xs mt-0.5 break-all font-mono bg-gray-50 dark:bg-gray-900 p-2 rounded">
                                  {log.user_agent}
                                </p>
                              </div>
                            )}
                            {log.details_summary && (() => {
                              const parsed = parseDetails(log.details_summary);
                              if (!parsed) return null;

                              return (
                                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                                  {/* Show changes in before/after format - PROMINENT DISPLAY */}
                                  {parsed.changes && parsed.changes.length > 0 && (
                                    <div className="mb-4">
                                      <div className="flex items-center gap-2 mb-3">
                                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
                                          What Changed
                                        </span>
                                      </div>
                                      <div className="space-y-3">
                                        {parsed.changes.map((change, idx) => (
                                          <div key={idx} className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                                            {/* Field name header */}
                                            <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 border-b border-gray-200 dark:border-gray-600">
                                              <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                                                {formatFieldName(change.field)}
                                              </span>
                                            </div>
                                            {/* Before/After values */}
                                            <div className="grid grid-cols-2 divide-x divide-gray-200 dark:divide-gray-600">
                                              {/* Before */}
                                              <div className="p-3 bg-red-50 dark:bg-red-900/20">
                                                <div className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase mb-1">
                                                  Before
                                                </div>
                                                <div className="text-sm font-medium text-red-800 dark:text-red-200 line-through">
                                                  {formatValue(change.before)}
                                                </div>
                                              </div>
                                              {/* After */}
                                              <div className="p-3 bg-green-50 dark:bg-green-900/20">
                                                <div className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase mb-1">
                                                  After
                                                </div>
                                                <div className="text-sm font-bold text-green-800 dark:text-green-200">
                                                  {formatValue(change.after)}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Show other details (excluding old_values/new_values) */}
                                  {parsed.raw && Object.entries(parsed.raw).filter(([key]) => !['old_values', 'new_values', 'changed_fields'].includes(key)).length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                                      <div className="flex items-center gap-2 mb-3">
                                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                                          Additional Info
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-2 gap-3">
                                        {Object.entries(parsed.raw)
                                          .filter(([key]) => !['old_values', 'new_values', 'changed_fields'].includes(key))
                                          .map(([key, value]) => (
                                            <div key={key} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                                              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">{formatFieldName(key)}</div>
                                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatValue(value)}</div>
                                            </div>
                                          ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && logs.length > 0 && (
          <div className="flex items-center justify-between px-6 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Showing {((currentPage - 1) * limit) + 1} to{' '}
              {Math.min(currentPage * limit, totalCount)} of {totalCount} results
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={!hasMore}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
