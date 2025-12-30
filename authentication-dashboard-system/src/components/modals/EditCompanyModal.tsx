import { useState, useEffect } from 'react';
import { X, Save, Archive, RotateCcw, Trash2, AlertTriangle, Building2, Skull, FileText } from 'lucide-react';
import { api, apiHelpers } from '../../services/api';
import { clsx } from 'clsx';
import { useAuth } from '../../contexts/AuthContext';

// Available pages that can be enabled for companies
const AVAILABLE_PAGES = [
  { key: 'dashboard', label: 'Dashboard', description: 'Main dashboard with overview metrics' },
  { key: 'analytics', label: 'Analytics', description: 'Detailed analytics and reporting' },
  { key: 'reports', label: 'Reports', description: 'Generate and export reports' },
  { key: 'settings', label: 'Settings', description: 'Company and user settings' },
];

interface CompanyWithStats {
  id: string;
  name: string;
  domain?: string;
  is_active: boolean;
  total_users: number;
  active_users: number;
  logins_this_month: number;
  logins_last_month: number;
  admin_email?: string;
  admin_first_name?: string;
  admin_last_name?: string;
  created_at: string;
  hipaa_compliant: boolean;
}

interface EditCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: CompanyWithStats;
  onSuccess: () => void;
}

export function EditCompanyModal({ isOpen, onClose, company, onSuccess }: EditCompanyModalProps) {
  const { user } = useAuth();
  const isMasterAdmin = user?.role === 'master_admin';
  
  const [formData, setFormData] = useState({
    name: company.name || '',
    domain: company.domain || '',
    isActive: company.is_active ? 1 : 0,
    hipaaCompliant: company.hipaa_compliant ? 1 : 0,
    dataRetentionDays: 2555,
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMasterDeleteConfirm, setShowMasterDeleteConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Available pages state (master_admin only)
  const [enabledPages, setEnabledPages] = useState<string[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);

  // Fetch company available pages when modal opens (master_admin only)
  useEffect(() => {
    if (isOpen && isMasterAdmin && company.id) {
      const fetchAvailablePages = async () => {
        setLoadingPages(true);
        try {
          const response = await api.get(`/api/companies/${company.id}/available-pages`);
          const data = apiHelpers.handleResponse<{ company_id: string; pages: { page_key: string; is_enabled: number }[] }>(response);
          const pages = data.pages || [];
          setEnabledPages(pages.filter(p => p.is_enabled === 1).map(p => p.page_key));
        } catch (err) {
          console.error('Failed to fetch available pages:', err);
          // Default to empty - don't assume all pages are enabled
          setEnabledPages([]);
        } finally {
          setLoadingPages(false);
        }
      };
      fetchAvailablePages();
    }
  }, [isOpen, isMasterAdmin, company.id]);

  const handlePageToggle = (pageKey: string) => {
    setEnabledPages(prev =>
      prev.includes(pageKey)
        ? prev.filter(p => p !== pageKey)
        : [...prev, pageKey]
    );
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const updateData = {
        name: formData.name,
        domain: formData.domain || undefined,
        isActive: formData.isActive,
        hipaaCompliant: formData.hipaaCompliant,
        dataRetentionDays: formData.dataRetentionDays,
      };

      await api.patch(`/api/companies/${company.id}`, updateData);

      // Save available pages if master_admin
      if (isMasterAdmin) {
        await api.put(`/api/companies/${company.id}/available-pages`, { pages: enabledPages });
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(apiHelpers.handleError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    setActionLoading(true);
    setError(null);

    try {
      const response = await api.post(`/api/companies/${company.id}/archive`);
      const data = apiHelpers.handleResponse<{
        success: boolean;
        message: string;
        data: { archivedUsersCount: number };
      }>(response);
      
      alert(`Company archived successfully. ${data.data.archivedUsersCount} user(s) archived.`);
      onSuccess();
      onClose();
      setShowArchiveConfirm(false);
    } catch (err) {
      setError(apiHelpers.handleError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async () => {
    setActionLoading(true);
    setError(null);

    try {
      const response = await api.post(`/api/companies/${company.id}/restore`);
      const data = apiHelpers.handleResponse<{
        success: boolean;
        message: string;
        data: { restoredUsersCount: number };
      }>(response);
      
      alert(`Company restored successfully. ${data.data.restoredUsersCount} user(s) restored.`);
      onSuccess();
      onClose();
    } catch (err) {
      setError(apiHelpers.handleError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    setError(null);

    try {
      await api.delete(`/api/companies/${company.id}`);
      alert('Company permanently deleted');
      onSuccess();
      onClose();
      setShowDeleteConfirm(false);
    } catch (err) {
      setError(apiHelpers.handleError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleMasterDelete = async () => {
    setActionLoading(true);
    setError(null);

    try {
      const response = await api.delete(`/api/companies/${company.id}/master-delete`);
      const data = apiHelpers.handleResponse<{ success: boolean; message: string; deletedUsers: number }>(response);
      
      // Handle successful deletion
      const message = data?.message || 'Company and all associated data permanently deleted';
      const deletedUsers = data?.deletedUsers || 0;
      
      alert(`✅ ${message}\n\n📊 Deleted Users: ${deletedUsers}\n\n⚠️ This action was permanent and cannot be undone.`);
      onSuccess();
      onClose();
      setShowMasterDeleteConfirm(false);
    } catch (err) {
      setError(apiHelpers.handleError(err));
      setShowMasterDeleteConfirm(false);
    } finally {
      setActionLoading(false);
    }
  };

  const isArchived = !company.is_active;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Edit Company</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-800">Error</h3>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Company Info */}
        <div className="p-6 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 bg-primary-100 rounded-full flex items-center justify-center">
              <Building2 className="w-6 h-6 text-primary-700" />
            </div>
            <div className="flex-1">
              <div className="text-lg font-semibold text-gray-900">
                {company.name}
              </div>
              {company.domain && (
                <div className="text-sm text-gray-500">{company.domain}</div>
              )}
              <div className="text-xs text-gray-400">
                Created {new Date(company.created_at).toLocaleDateString()}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className={clsx(
                'px-3 py-1 text-xs font-semibold rounded-full',
                isArchived
                  ? 'bg-red-100 text-red-800'
                  : 'bg-green-100 text-green-800'
              )}>
                {isArchived ? 'Inactive' : 'Active'}
              </span>
              {company.hipaa_compliant && (
                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                  HIPAA
                </span>
              )}
            </div>
          </div>

          {/* Company Stats */}
          <div className="mt-4 grid grid-cols-4 gap-4 p-4 bg-white rounded-lg border border-gray-200">
            <div className="text-center">
              <div className="text-xs text-gray-600">Total Users</div>
              <div className="text-lg font-bold text-gray-900">{company.total_users}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-600">Active Users</div>
              <div className="text-lg font-bold text-green-600">{company.active_users}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-600">This Month</div>
              <div className="text-lg font-bold text-blue-600">{company.logins_this_month}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-600">Last Month</div>
              <div className="text-lg font-bold text-gray-600">{company.logins_last_month}</div>
            </div>
          </div>

          {/* Admin Info */}
          {company.admin_email && (
            <div className="mt-4 p-3 bg-white rounded-lg border border-gray-200">
              <div className="text-xs text-gray-600 mb-1">Company Admin</div>
              <div className="text-sm font-medium text-gray-900">
                {company.admin_first_name} {company.admin_last_name}
              </div>
              <div className="text-xs text-gray-500">{company.admin_email}</div>
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Company Information</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Domain (optional)
              </label>
              <input
                type="text"
                value={formData.domain}
                onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                placeholder="example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Settings</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value={1}>Active</option>
                  <option value={0}>Inactive</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  HIPAA Compliant
                </label>
                <select
                  value={formData.hipaaCompliant}
                  onChange={(e) => setFormData({ ...formData, hipaaCompliant: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value={1}>Yes</option>
                  <option value={0}>No</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data Retention (days)
              </label>
              <input
                type="number"
                value={formData.dataRetentionDays}
                onChange={(e) => setFormData({ ...formData, dataRetentionDays: parseInt(e.target.value) })}
                min="1"
                max="9999"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Available Pages (Master Admin Only) */}
          {isMasterAdmin && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary-600" />
                <h3 className="text-lg font-semibold text-gray-900">Available Pages</h3>
              </div>
              <p className="text-sm text-gray-600">
                Select which pages this company can access. Users will only see pages that are enabled here.
              </p>

              {loadingPages ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                  <span className="ml-2 text-sm text-gray-500">Loading pages...</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {AVAILABLE_PAGES.map((page) => (
                    <label
                      key={page.key}
                      className={clsx(
                        'flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all',
                        enabledPages.includes(page.key)
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={enabledPages.includes(page.key)}
                        onChange={() => handlePageToggle(page.key)}
                        className="mt-1 w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                      />
                      <div>
                        <div className="font-medium text-gray-900">{page.label}</div>
                        <div className="text-xs text-gray-500">{page.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {enabledPages.length === 0 && !loadingPages && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Warning:</strong> No pages are enabled. Users (except admins with built-in access) will not be able to access any features.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200">
            <div className="flex gap-2">
              {isArchived ? (
                <button
                  type="button"
                  onClick={handleRestore}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="w-4 h-4" />
                  {actionLoading ? 'Restoring...' : 'Restore Company'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowArchiveConfirm(true)}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Archive className="w-4 h-4" />
                  Archive
                </button>
              )}
              
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              
              {/* Master Delete - Only for Master Admin */}
              {isMasterAdmin && (
                <button
                  type="button"
                  onClick={() => setShowMasterDeleteConfirm(true)}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-2 border-red-500"
                >
                  <Skull className="w-4 h-4" />
                  Master Delete
                </button>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>

        {/* Archive Confirmation Dialog */}
        {showArchiveConfirm && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <AlertTriangle className="w-8 h-8 text-yellow-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Archive Company?
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    This will archive <strong>{company.name}</strong> and all users <strong>except the company admin</strong>. 
                    The admin will remain active to manage restoration.
                  </p>
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
                    <p className="text-xs text-yellow-800">
                      <strong>Note:</strong> Approximately {company.active_users - 1} user(s) will be archived and unable to login.
                    </p>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setShowArchiveConfirm(false)}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      disabled={actionLoading}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleArchive}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {actionLoading ? 'Archiving...' : 'Archive Company'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <AlertTriangle className="w-8 h-8 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Delete Company Permanently?
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    This will permanently delete <strong>{company.name}</strong> and all associated data. 
                    This action cannot be undone.
                  </p>
                  <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
                    <p className="text-xs text-red-800 mb-2">
                      <strong>Warning:</strong> Deletion will be prevented if:
                    </p>
                    <ul className="text-xs text-red-800 list-disc list-inside space-y-1">
                      <li>Company has ANY users ({company.total_users} total, including admin)</li>
                      <li>Company has audit logs (required for compliance)</li>
                      <li><strong>Recommendation:</strong> Use "Archive" instead for active companies</li>
                    </ul>
                    <p className="text-xs text-red-800 mt-2">
                      <strong>Note:</strong> All users must be permanently deleted first, and audit logs will prevent deletion for compliance reasons.
                    </p>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      disabled={actionLoading}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {actionLoading ? 'Deleting...' : 'Delete Permanently'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MASTER DELETE Confirmation Dialog (Master Admin Only) */}
        {showMasterDeleteConfirm && isMasterAdmin && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-black border-4 border-red-500 rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <Skull className="w-12 h-12 text-red-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                    <span className="text-red-500">⚠️ MASTER DELETE</span>
                  </h3>
                  <p className="text-sm text-gray-300 mb-4">
                    This will <strong className="text-red-400">PERMANENTLY DELETE</strong> company <strong className="text-white">{company.name}</strong> and <strong className="text-red-400">ALL ASSOCIATED DATA</strong>:
                  </p>
                  <div className="bg-red-900 bg-opacity-40 border-2 border-red-500 rounded p-3 mb-4">
                    <p className="text-xs font-bold text-red-300 mb-2">
                      ☠️ WHAT WILL BE DELETED (NO RECOVERY):
                    </p>
                    <ul className="text-xs text-gray-200 list-disc list-inside space-y-1">
                      <li><strong>{company.total_users} user(s)</strong> including the admin</li>
                      <li><strong>ALL audit logs</strong> (compliance will be lost)</li>
                      <li><strong>ALL email events</strong> (history will be lost)</li>
                      <li><strong>ALL sessions, permissions, preferences</strong></li>
                      <li><strong>ALL company analytics and metrics</strong></li>
                    </ul>
                    <p className="text-xs font-bold text-red-300 mt-3">
                      ⚠️ BYPASSES ALL SAFEGUARDS - FOR TEST CLEANUP ONLY
                    </p>
                  </div>
                  <div className="bg-yellow-900 bg-opacity-40 border-2 border-yellow-500 rounded p-3 mb-4">
                    <p className="text-xs font-bold text-yellow-300">
                      🔥 THIS ACTION CANNOT BE UNDONE
                    </p>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setShowMasterDeleteConfirm(false)}
                      className="px-4 py-2 border-2 border-gray-500 text-white rounded-lg hover:bg-gray-800 transition-colors"
                      disabled={actionLoading}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleMasterDelete}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-2 border-red-400 font-bold"
                    >
                      {actionLoading ? 'DELETING EVERYTHING...' : '☠️ MASTER DELETE'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

