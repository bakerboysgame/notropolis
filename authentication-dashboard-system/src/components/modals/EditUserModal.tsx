import { useState, useEffect } from 'react';
import { X, Save, Archive, RotateCcw, Trash2, AlertTriangle, Send, CheckCircle, Mail, Key, Plus, Clock, Loader2, Shield } from 'lucide-react';
import { api, apiHelpers, User, UserPermission, UserPermissionsResponse, CustomRole, RolesResponse } from '../../services/api';
import { clsx } from 'clsx';

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onSuccess: () => void;
}

export function EditUserModal({ isOpen, onClose, user, onSuccess }: EditUserModalProps) {
  const [formData, setFormData] = useState<{
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    isActive: number;
    phiAccessLevel: string;
    dataClassification: string;
  }>({
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    email: user.email || '',
    role: user.role || 'user',
    isActive: user.isActive ? 1 : 0,
    phiAccessLevel: user.phiAccessLevel || 'none',
    dataClassification: user.dataClassification || 'public',
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [resendingInvite, setResendingInvite] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<'details' | 'permissions'>('details');

  // Permissions state
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsError, setPermissionsError] = useState<string | null>(null);
  const [showAddPermission, setShowAddPermission] = useState(false);
  const [newPermission, setNewPermission] = useState('');
  const [newPermissionResource, setNewPermissionResource] = useState('');
  const [newPermissionExpiry, setNewPermissionExpiry] = useState('');
  const [savingPermission, setSavingPermission] = useState(false);
  const [revokingPermissionId, setRevokingPermissionId] = useState<string | null>(null);

  // Roles state
  const [availableRoles, setAvailableRoles] = useState<CustomRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);

  // Check if user is pending invitation (unverified)
  const isPendingInvitation = !user.verified;

  // Update formData when user prop changes
  useEffect(() => {
    if (isOpen && user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        role: user.role || 'user',
        isActive: user.isActive ? 1 : 0,
        phiAccessLevel: user.phiAccessLevel || 'none',
        dataClassification: user.dataClassification || 'public',
      });
      // Reset to details tab when switching users
      setActiveTab('details');
      // Reset permissions state
      setPermissions([]);
    }
  }, [isOpen, user.id]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const updateData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        role: formData.role,
        isActive: formData.isActive,
        phiAccessLevel: formData.phiAccessLevel,
        dataClassification: formData.dataClassification,
      };

      await api.patch(`/api/users/${user.id}`, updateData);
      
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
      await api.post(`/api/users/${user.id}/archive`);
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
      await api.post(`/api/users/${user.id}/restore`);
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
      await api.delete(`/api/users/${user.id}`);
      onSuccess();
      onClose();
      setShowDeleteConfirm(false);
    } catch (err) {
      setError(apiHelpers.handleError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleResendInvitation = async () => {
    setResendingInvite(true);
    setError(null);
    setResendSuccess(false);

    try {
      await api.post(`/api/users/${user.id}/resend-invitation`);
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 5000);
    } catch (err) {
      setError(apiHelpers.handleError(err));
    } finally {
      setResendingInvite(false);
    }
  };

  // Fetch user permissions
  const fetchPermissions = async () => {
    setPermissionsLoading(true);
    setPermissionsError(null);

    try {
      const response = await api.get<{ success: boolean; data: UserPermissionsResponse }>(`/api/users/${user.id}/permissions`);
      if (response.data.success && response.data.data) {
        setPermissions(response.data.data.permissions || []);
      }
    } catch (err) {
      setPermissionsError(apiHelpers.handleError(err));
    } finally {
      setPermissionsLoading(false);
    }
  };

  // Grant permission
  const handleGrantPermission = async () => {
    if (!newPermission.trim()) {
      setPermissionsError('Permission type is required');
      return;
    }

    setSavingPermission(true);
    setPermissionsError(null);

    try {
      await api.post(`/api/users/${user.id}/permissions`, {
        permission: newPermission,
        resource: newPermissionResource || undefined,
        expires_at: newPermissionExpiry || undefined
      });

      // Reset form and refresh
      setNewPermission('');
      setNewPermissionResource('');
      setNewPermissionExpiry('');
      setShowAddPermission(false);
      fetchPermissions();
    } catch (err) {
      setPermissionsError(apiHelpers.handleError(err));
    } finally {
      setSavingPermission(false);
    }
  };

  // Revoke permission
  const handleRevokePermission = async (permissionId: string) => {
    if (!confirm('Are you sure you want to revoke this permission?')) {
      return;
    }

    setRevokingPermissionId(permissionId);
    setPermissionsError(null);

    try {
      await api.delete(`/api/users/${user.id}/permissions/${permissionId}`);
      fetchPermissions();
    } catch (err) {
      setPermissionsError(apiHelpers.handleError(err));
    } finally {
      setRevokingPermissionId(null);
    }
  };

  // Fetch roles for the dropdown
  // If user has a companyId, fetch roles for that company (for master_admin editing other companies' users)
  const fetchRoles = async () => {
    try {
      setRolesLoading(true);
      // Pass the user's company ID to get roles for their company (useful for master_admin)
      const url = user.companyId ? `/api/company/roles?company_id=${user.companyId}` : '/api/company/roles';
      const response = await api.get<{ success: boolean; data: RolesResponse }>(url);
      if (response.data.success && response.data.data) {
        // Combine built-in and custom roles
        const allRoles = [
          ...(response.data.data.builtin_roles || []),
          ...(response.data.data.custom_roles || [])
        ];

        setAvailableRoles(allRoles);
      }
    } catch (err) {
      console.error('Failed to fetch roles:', err);
      // Fall back to default roles if fetch fails
      const defaultRoles: CustomRole[] = [
        { role_name: 'master_admin', display_name: 'Master Admin', description: 'System administrator', is_builtin: true },
        { role_name: 'admin', display_name: 'Admin', description: 'Company administrator', is_builtin: true },
        { role_name: 'user', display_name: 'User', description: 'Regular user', is_builtin: true },
        { role_name: 'analyst', display_name: 'Analyst', description: 'Data analyst', is_builtin: true },
        { role_name: 'viewer', display_name: 'Viewer', description: 'Read-only access', is_builtin: true }
      ];

      setAvailableRoles(defaultRoles);
    } finally {
      setRolesLoading(false);
    }
  };

  // Fetch roles when modal opens or user changes
  useEffect(() => {
    if (isOpen) {
      fetchRoles();
    }
  }, [isOpen, user.id]);

  // Fetch permissions when tab changes to permissions
  useEffect(() => {
    if (activeTab === 'permissions' && isOpen) {
      fetchPermissions();
    }
  }, [activeTab, isOpen]);

  // Archived = has deletedAt timestamp (soft deleted), NOT based on isActive
  // Invited users have isActive=false but are NOT archived
  const isArchived = !!user.deletedAt;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Edit User</h2>
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

        {/* User Info */}
        <div className="p-6 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-primary-700 font-medium text-lg">
                {user.firstName?.[0]}{user.lastName?.[0]}
              </span>
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900">
                {user.firstName} {user.lastName}
              </div>
              <div className="text-sm text-gray-500">@{user.username}</div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className={clsx(
                'px-3 py-1 text-xs font-semibold rounded-full flex items-center gap-1',
                isArchived
                  ? 'bg-red-100 text-red-800'
                  : isPendingInvitation
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-green-100 text-green-800'
              )}>
                {isPendingInvitation && <Mail className="w-3 h-3" />}
                {isArchived ? 'Archived' : isPendingInvitation ? 'Pending Invitation' : 'Active'}
              </span>
            </div>
          </div>
        </div>

        {/* Resend Invitation Section - Only show for pending users */}
        {isPendingInvitation && !isArchived && (
          <div className="mx-6 mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-yellow-600" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">Invitation Pending</p>
                  <p className="text-xs text-yellow-600">This user hasn't accepted their invitation yet.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleResendInvitation}
                disabled={resendingInvite || resendSuccess}
                className={clsx(
                  "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium",
                  resendSuccess
                    ? "bg-green-600 text-white"
                    : "bg-yellow-600 text-white hover:bg-yellow-700",
                  (resendingInvite || resendSuccess) && "opacity-75 cursor-not-allowed"
                )}
              >
                {resendingInvite ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Sending...
                  </>
                ) : resendSuccess ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Invitation Sent!
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Resend Invitation
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={clsx(
                "px-6 py-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === 'details'
                  ? "border-primary-500 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              User Details
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('permissions')}
              className={clsx(
                "px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                activeTab === 'permissions'
                  ? "border-primary-500 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              <Key className="w-4 h-4" />
              Permissions
            </button>
          </div>
        </div>

        {/* Details Tab */}
        {activeTab === 'details' && (
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* Role & Status */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Role & Status</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    disabled={rolesLoading}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100"
                  >
                    {availableRoles.map((role) => (
                      <option key={role.role_name} value={role.role_name}>
                        {role.display_name}
                      </option>
                    ))}
                  </select>
                </div>
                {rolesLoading && (
                  <p className="mt-1 text-xs text-gray-500">Loading roles...</p>
                )}
              </div>

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
            </div>
          </div>

          {/* PHI Access & Data Classification */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Security & Access</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  PHI Access Level
                </label>
                <select
                  value={formData.phiAccessLevel}
                  onChange={(e) => setFormData({ ...formData, phiAccessLevel: e.target.value as 'none' | 'limited' | 'full' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="none">None</option>
                  <option value="limited">Limited</option>
                  <option value="full">Full</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data Classification
                </label>
                <select
                  value={formData.dataClassification}
                  onChange={(e) => setFormData({ ...formData, dataClassification: e.target.value as 'public' | 'internal' | 'confidential' | 'restricted' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="public">Public</option>
                  <option value="internal">Internal</option>
                  <option value="confidential">Confidential</option>
                  <option value="restricted">Restricted</option>
                </select>
              </div>
            </div>
          </div>

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
                  {actionLoading ? 'Restoring...' : 'Restore User'}
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
        )}

        {/* Permissions Tab */}
        {activeTab === 'permissions' && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">User Permissions</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Grant specific permissions to this user beyond their role-based access.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddPermission(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Permission
              </button>
            </div>

            {/* Error Message */}
            {permissionsError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-red-600">{permissionsError}</p>
                </div>
                <button onClick={() => setPermissionsError(null)} className="text-red-600 hover:text-red-800">&times;</button>
              </div>
            )}

            {/* Add Permission Form */}
            {showAddPermission && (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-4">
                <h4 className="font-medium text-gray-900">Grant New Permission</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Permission Type *
                    </label>
                    <select
                      value={newPermission}
                      onChange={(e) => setNewPermission(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">Select permission...</option>
                      <option value="page_access">Page Access</option>
                      <option value="view_data">View Data</option>
                      <option value="export_data">Export Data</option>
                      <option value="manage_users">Manage Users</option>
                      <option value="view_audit_logs">View Audit Logs</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Resource (optional)
                    </label>
                    <input
                      type="text"
                      value={newPermissionResource}
                      onChange={(e) => setNewPermissionResource(e.target.value)}
                      placeholder="e.g., dashboard, reports"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Expires (optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={newPermissionExpiry}
                      onChange={(e) => setNewPermissionExpiry(e.target.value)}
                      min={new Date().toISOString().slice(0, 16)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddPermission(false);
                      setNewPermission('');
                      setNewPermissionResource('');
                      setNewPermissionExpiry('');
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleGrantPermission}
                    disabled={savingPermission || !newPermission}
                    className={clsx(
                      "flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors",
                      (savingPermission || !newPermission) && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {savingPermission ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Granting...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Grant Permission
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Permissions List */}
            {permissionsLoading ? (
              <div className="py-8 text-center">
                <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary-600" />
                <p className="mt-2 text-gray-500">Loading permissions...</p>
              </div>
            ) : permissions.length === 0 ? (
              <div className="py-8 text-center border-2 border-dashed border-gray-200 rounded-lg">
                <Key className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                <p className="text-gray-500">No custom permissions granted.</p>
                <p className="text-sm text-gray-400 mt-1">
                  This user only has access based on their role: <span className="font-medium">{user.role}</span>
                </p>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Permission</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Resource</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Granted By</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expires</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {permissions.map((perm) => (
                      <tr key={perm.id} className={perm.is_expired ? 'bg-gray-50 opacity-60' : ''}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 text-xs font-medium bg-primary-100 text-primary-700 rounded">
                              {perm.permission.replace(/_/g, ' ')}
                            </span>
                            {perm.is_expired && (
                              <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded">Expired</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {perm.resource || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {perm.grantor_email || 'System'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {perm.expires_at ? (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(perm.expires_at).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-gray-400">Never</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleRevokePermission(perm.id)}
                            disabled={revokingPermissionId === perm.id}
                            className={clsx(
                              "text-red-600 hover:text-red-800 text-sm font-medium",
                              revokingPermissionId === perm.id && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            {revokingPermissionId === perm.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              'Revoke'
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Close button */}
            <div className="flex justify-end pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}

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
                    Archive User?
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    This will archive <strong>{user.firstName} {user.lastName}</strong> and prevent them from logging in or receiving emails. They can be restored later.
                  </p>
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
                      {actionLoading ? 'Archiving...' : 'Archive User'}
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
                    Delete User Permanently?
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    This will permanently delete <strong>{user.firstName} {user.lastName}</strong>. This action cannot be undone.
                  </p>
                  <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
                    <p className="text-xs text-red-800">
                      <strong>Warning:</strong> If this user is a company admin with other active users, deletion will be prevented.
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
      </div>
    </div>
  );
}

