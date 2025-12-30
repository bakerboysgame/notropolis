import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api, apiHelpers, User, CustomRole, RolesResponse } from '../services/api';
import { Users, Search, UserPlus, Shield, Mail, Calendar, CheckCircle, XCircle, ChevronDown, Send, Key, ChevronRight, Loader2, Plus, Edit2, Trash2, Tag } from 'lucide-react';
import { clsx } from 'clsx';
import { AddUserModal } from '../components/modals/AddUserModal';
import { EditUserModal } from '../components/modals/EditUserModal';

// Roles that can have their page access configured
const CONFIGURABLE_ROLES = ['user', 'analyst', 'viewer'];

// Human-readable page names
const PAGE_DISPLAY_NAMES: Record<string, string> = {
  dashboard: 'Dashboard',
  analytics: 'Analytics',
  reports: 'Reports',
  settings: 'Settings',
};

interface RolePageAccess {
  roleName: string;
  assignedPages: string[];
  isExpanded: boolean;
  isLoading: boolean;
  isSaving: boolean;
}

export default function CompanyUserManagement() {
  const { user: currentUser, company } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [showArchivedUsers, setShowArchivedUsers] = useState(false);
  const [changingRoleUserId, setChangingRoleUserId] = useState<string | null>(null);
  const [roleChangeError, setRoleChangeError] = useState<string | null>(null);
  const [resendingInviteUserId, setResendingInviteUserId] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);

  // Role page access state
  const [companyAvailablePages, setCompanyAvailablePages] = useState<string[]>([]);
  const [rolePageAccess, setRolePageAccess] = useState<RolePageAccess[]>(
    CONFIGURABLE_ROLES.map(role => ({
      roleName: role,
      assignedPages: [],
      isExpanded: false,
      isLoading: false,
      isSaving: false,
    }))
  );
  const [roleAccessError, setRoleAccessError] = useState<string | null>(null);
  const [roleAccessSuccess, setRoleAccessSuccess] = useState<string | null>(null);

  // Custom roles state
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [builtinRoles, setBuiltinRoles] = useState<CustomRole[]>([]);
  const [customRolesLoading, setCustomRolesLoading] = useState(false);
  const [customRoleError, setCustomRoleError] = useState<string | null>(null);
  const [customRoleSuccess, setCustomRoleSuccess] = useState<string | null>(null);
  const [isCustomRoleModalOpen, setIsCustomRoleModalOpen] = useState(false);
  const [editingCustomRole, setEditingCustomRole] = useState<CustomRole | null>(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDisplayName, setNewRoleDisplayName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [newRolePermissions, setNewRolePermissions] = useState<string[]>(['read']);
  const [savingCustomRole, setSavingCustomRole] = useState(false);
  const [deletingRoleName, setDeletingRoleName] = useState<string | null>(null);

  // Fetch company available pages
  const fetchCompanyAvailablePages = useCallback(async () => {
    try {
      const response = await api.get('/api/company/available-pages');
      if (response.data.success) {
        setCompanyAvailablePages(response.data.enabled_pages || []);
      }
    } catch (err) {
      console.error('Failed to fetch company available pages:', err);
    }
  }, []);

  // Fetch role pages for a specific role
  const fetchRolePages = useCallback(async (roleName: string) => {
    setRolePageAccess(prev => prev.map(r =>
      r.roleName === roleName ? { ...r, isLoading: true } : r
    ));

    try {
      const response = await api.get(`/api/company/roles/${encodeURIComponent(roleName)}/pages`);
      if (response.data.success) {
        setRolePageAccess(prev => prev.map(r =>
          r.roleName === roleName
            ? { ...r, assignedPages: response.data.data.assigned_pages || [], isLoading: false }
            : r
        ));
      }
    } catch (err) {
      console.error(`Failed to fetch pages for role ${roleName}:`, err);
      setRolePageAccess(prev => prev.map(r =>
        r.roleName === roleName ? { ...r, isLoading: false } : r
      ));
    }
  }, []);

  // Toggle role expansion
  const toggleRoleExpansion = (roleName: string) => {
    setRolePageAccess(prev => prev.map(r => {
      if (r.roleName === roleName) {
        const newExpanded = !r.isExpanded;
        // Fetch pages when expanding for the first time
        if (newExpanded && r.assignedPages.length === 0 && !r.isLoading) {
          fetchRolePages(roleName);
        }
        return { ...r, isExpanded: newExpanded };
      }
      return r;
    }));
  };

  // Handle page checkbox change
  const handlePageToggle = (roleName: string, pageKey: string, checked: boolean) => {
    setRolePageAccess(prev => prev.map(r => {
      if (r.roleName === roleName) {
        const newPages = checked
          ? [...r.assignedPages, pageKey]
          : r.assignedPages.filter(p => p !== pageKey);
        return { ...r, assignedPages: newPages };
      }
      return r;
    }));
  };

  // Save role page access
  const saveRolePages = async (roleName: string) => {
    const roleAccess = rolePageAccess.find(r => r.roleName === roleName);
    if (!roleAccess) return;

    setRolePageAccess(prev => prev.map(r =>
      r.roleName === roleName ? { ...r, isSaving: true } : r
    ));
    setRoleAccessError(null);

    try {
      const response = await api.put(`/api/company/roles/${encodeURIComponent(roleName)}/pages`, {
        pages: roleAccess.assignedPages
      });

      if (response.data.success) {
        setRoleAccessSuccess(`Page access updated for ${roleName} role`);
        setTimeout(() => setRoleAccessSuccess(null), 3000);
      }
    } catch (err: any) {
      console.error(`Failed to save pages for role ${roleName}:`, err);
      setRoleAccessError(err.response?.data?.error || `Failed to save page access for ${roleName}`);
      // Refetch to revert
      fetchRolePages(roleName);
    } finally {
      setRolePageAccess(prev => prev.map(r =>
        r.roleName === roleName ? { ...r, isSaving: false } : r
      ));
    }
  };

  // Fetch all roles (built-in + custom)
  const fetchAllRoles = useCallback(async () => {
    setCustomRolesLoading(true);
    try {
      const response = await api.get<{ success: boolean; data: RolesResponse }>('/api/company/roles');
      if (response.data.success && response.data.data) {
        const builtinRolesData = response.data.data.builtin_roles || [];
        const fetchedCustomRoles = response.data.data.custom_roles || [];

        setBuiltinRoles(builtinRolesData);
        setCustomRoles(fetchedCustomRoles);

        // Build rolePageAccess from API data with actual assigned pages
        const allRolesForPageAccess = [
          ...builtinRolesData.filter(r => CONFIGURABLE_ROLES.includes(r.role_name)),
          ...fetchedCustomRoles
        ];

        setRolePageAccess(allRolesForPageAccess.map(role => ({
          roleName: role.role_name,
          assignedPages: role.assigned_pages || [],
          isExpanded: false,
          isLoading: false,
          isSaving: false,
        })));
      }
    } catch (err: any) {
      console.error('Failed to fetch roles:', err);
      setCustomRoleError(err.response?.data?.error || 'Failed to load roles');
    } finally {
      setCustomRolesLoading(false);
    }
  }, []);

  // Create or update custom role
  const handleSaveCustomRole = async () => {
    if (!newRoleName.trim()) {
      setCustomRoleError('Role name is required');
      return;
    }

    setSavingCustomRole(true);
    setCustomRoleError(null);

    try {
      if (editingCustomRole) {
        // Update existing role
        await api.patch(`/api/company/roles/${encodeURIComponent(editingCustomRole.role_name)}`, {
          display_name: newRoleDisplayName || newRoleName,
          description: newRoleDescription,
          base_permissions: newRolePermissions
        });
        setCustomRoleSuccess(`Role "${newRoleDisplayName || newRoleName}" updated successfully`);
      } else {
        // Create new role
        await api.post('/api/company/roles', {
          role_name: newRoleName,
          display_name: newRoleDisplayName || newRoleName,
          description: newRoleDescription,
          base_permissions: newRolePermissions
        });
        setCustomRoleSuccess(`Role "${newRoleDisplayName || newRoleName}" created successfully`);
      }

      setTimeout(() => setCustomRoleSuccess(null), 3000);
      setIsCustomRoleModalOpen(false);
      resetCustomRoleForm();
      fetchAllRoles();
    } catch (err: any) {
      console.error('Failed to save custom role:', err);
      setCustomRoleError(err.response?.data?.error || 'Failed to save role');
    } finally {
      setSavingCustomRole(false);
    }
  };

  // Delete custom role
  const handleDeleteCustomRole = async (roleName: string) => {
    if (!confirm(`Are you sure you want to delete the role "${roleName}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingRoleName(roleName);
    setCustomRoleError(null);

    try {
      await api.delete(`/api/company/roles/${encodeURIComponent(roleName)}`);
      setCustomRoleSuccess(`Role "${roleName}" deleted successfully`);
      setTimeout(() => setCustomRoleSuccess(null), 3000);
      fetchAllRoles();
    } catch (err: any) {
      console.error('Failed to delete custom role:', err);
      setCustomRoleError(err.response?.data?.error || 'Failed to delete role');
    } finally {
      setDeletingRoleName(null);
    }
  };

  // Open edit modal for custom role
  const openEditCustomRole = (role: CustomRole) => {
    setEditingCustomRole(role);
    setNewRoleName(role.role_name);
    setNewRoleDisplayName(role.display_name);
    setNewRoleDescription(role.description || '');
    setNewRolePermissions(role.base_permissions || ['read']);
    setIsCustomRoleModalOpen(true);
  };

  // Reset custom role form
  const resetCustomRoleForm = () => {
    setEditingCustomRole(null);
    setNewRoleName('');
    setNewRoleDisplayName('');
    setNewRoleDescription('');
    setNewRolePermissions(['read']);
  };

  // Handle resend invitation
  const handleResendInvitation = async (userId: string, userEmail: string) => {
    setResendingInviteUserId(userId);
    setRoleChangeError(null);

    try {
      await api.post(`/api/users/${userId}/resend-invitation`);
      setResendSuccess(`Invitation resent to ${userEmail}`);
      setTimeout(() => setResendSuccess(null), 3000);
    } catch (err: any) {
      console.error('Failed to resend invitation:', err);
      setRoleChangeError(err.response?.data?.error || 'Failed to resend invitation');
    } finally {
      setResendingInviteUserId(null);
    }
  };

  // Handle role change
  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!currentUser) return;

    setChangingRoleUserId(userId);
    setRoleChangeError(null);

    try {
      await api.patch(`/api/users/${userId}`, { role: newRole });

      // Update local state
      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, role: newRole as User['role'] } : u
      ));
    } catch (err: any) {
      console.error('Failed to change role:', err);
      setRoleChangeError(err.response?.data?.error || 'Failed to change role');
      // Revert - refetch users
      handleEditUserSuccess();
    } finally {
      setChangingRoleUserId(null);
    }
  };

  // Redirect if not admin or master admin
  useEffect(() => {
    if (currentUser && !['admin', 'master_admin'].includes(currentUser.role)) {
      window.location.href = '/';
    }
  }, [currentUser]);

  // Fetch company available pages on mount
  useEffect(() => {
    if (currentUser && ['admin', 'master_admin'].includes(currentUser.role)) {
      fetchCompanyAvailablePages();
    }
  }, [currentUser, fetchCompanyAvailablePages]);

  // Fetch all roles on mount
  useEffect(() => {
    if (currentUser && ['admin', 'master_admin'].includes(currentUser.role)) {
      fetchAllRoles();
    }
  }, [currentUser, fetchAllRoles]);

  // Fetch company users
  useEffect(() => {
    const fetchUsers = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Company admin can only see their company's users
        const response = await api.get(`/api/companies/${company?.id}/users`);
        const users = apiHelpers.handleResponse<User[]>(response);
        setUsers(users);
      } catch (err) {
        console.error('Failed to fetch users:', err);
        setError('Failed to load users');
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [currentUser]);

  const handleAddUser = () => {
    setIsAddUserModalOpen(true);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setIsEditUserModalOpen(true);
  };

  const handleAddUserSuccess = () => {
    // Refetch users after adding a new user
    if (currentUser) {
      const fetchUsers = async () => {
        try {
          const response = await api.get(`/api/companies/${company?.id}/users`);
          const users = apiHelpers.handleResponse<User[]>(response);
          setUsers(users);
        } catch (err) {
          console.error('Failed to refetch users:', err);
        }
      };
      fetchUsers();
    }
  };

  const handleEditUserSuccess = () => {
    // Refetch users after editing
    if (currentUser) {
      const fetchUsers = async () => {
        try {
          const response = await api.get(`/api/companies/${company?.id}/users`);
          const users = apiHelpers.handleResponse<User[]>(response);
          setUsers(users);
        } catch (err) {
          console.error('Failed to refetch users:', err);
        }
      };
      fetchUsers();
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'analyst':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'viewer':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'master_admin':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'user':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        // Custom roles get a primary/teal color
        return 'bg-primary-100 text-primary-800 border-primary-200';
    }
  };

  // Get display name for a role (handles custom roles)
  const getRoleDisplayName = (roleName: string) => {
    const allRoles = [...builtinRoles, ...customRoles];
    const role = allRoles.find(r => r.role_name === roleName);
    return role?.display_name || roleName.charAt(0).toUpperCase() + roleName.slice(1).replace('_', ' ');
  };

  const getStatusBadge = (user: User) => {
    if (user.deletedAt) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
          <XCircle className="w-3 h-3 mr-1" />
          Archived
        </span>
      );
    }

    if (user.isActive && user.verified) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
          <CheckCircle className="w-3 h-3 mr-1" />
          Active
        </span>
      );
    }

    if (!user.verified) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
          <Mail className="w-3 h-3 mr-1" />
          Pending
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
        Inactive
      </span>
    );
  };

  if (!currentUser || !['admin', 'master_admin'].includes(currentUser.role)) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400">This page is only accessible to Company Administrators.</p>
        </div>
      </div>
    );
  }

  // Filter users based on search query and archived status
  const filteredUsers = users.filter(user => {
    // Filter by archived status
    if (!showArchivedUsers && user.deletedAt) {
      return false;
    }

    // Filter by search query
    const searchTerm = searchQuery.toLowerCase();
    return (
      user.firstName?.toLowerCase().includes(searchTerm) ||
      user.lastName?.toLowerCase().includes(searchTerm) ||
      user.email?.toLowerCase().includes(searchTerm) ||
      user.username?.toLowerCase().includes(searchTerm) ||
      user.role?.toLowerCase().includes(searchTerm)
    );
  });

  return (
    <div className="space-y-6">
      {/* Add User Modal */}
      <AddUserModal
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        onSuccess={handleAddUserSuccess}
        defaultCompanyId={company?.id}
      />

      {/* Edit User Modal */}
      {selectedUser && (
        <EditUserModal
          isOpen={isEditUserModalOpen}
          onClose={() => {
            setIsEditUserModalOpen(false);
            setSelectedUser(null);
          }}
          user={selectedUser}
          onSuccess={handleEditUserSuccess}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <Users className="w-8 h-8 text-primary-600 dark:text-primary-400" />
            Company Users
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage users in your company</p>
        </div>
        <button
          onClick={handleAddUser}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <UserPlus className="w-5 h-5" />
          Add User
        </button>
      </div>

      {/* Show Archived Users Toggle */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showArchivedUsers}
            onChange={(e) => setShowArchivedUsers(e.target.checked)}
            className="w-4 h-4 text-primary-600 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Show archived users
            {users.filter(u => u.deletedAt).length > 0 && (
              <span className="ml-1 text-gray-500 dark:text-gray-400">
                ({users.filter(u => u.deletedAt).length})
              </span>
            )}
          </span>
        </label>
      </div>

      {/* Role Change Error Toast */}
      {roleChangeError && (
        <div className="fixed top-4 right-4 z-50 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
          <XCircle className="w-5 h-5" />
          <span>{roleChangeError}</span>
          <button
            onClick={() => setRoleChangeError(null)}
            className="ml-2 text-red-900 hover:text-red-600"
          >
            &times;
          </button>
        </div>
      )}

      {/* Success Toast */}
      {resendSuccess && (
        <div className="fixed top-4 right-4 z-50 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
          <CheckCircle className="w-5 h-5" />
          <span>{resendSuccess}</span>
          <button
            onClick={() => setResendSuccess(null)}
            className="ml-2 text-green-900 hover:text-green-600"
          >
            &times;
          </button>
        </div>
      )}

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search users by name, email, or username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading users...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-600">{error}</p>
            </div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                {searchQuery ? 'No users found matching your search.' : 'No users in your company yet.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                            <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                              {user.firstName?.charAt(0) || 'U'}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                          <div className="text-xs text-gray-400 dark:text-gray-500">@{user.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {/* Role dropdown - only show for non-archived, non-master_admin users */}
                      {user.deletedAt || user.role === 'master_admin' ? (
                        <span className={clsx(
                          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
                          getRoleBadgeColor(user.role)
                        )}>
                          {getRoleDisplayName(user.role)}
                        </span>
                      ) : (
                        <div className="relative inline-flex items-center">
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                            disabled={changingRoleUserId === user.id || user.id === currentUser?.id}
                            className={clsx(
                              'appearance-none pl-3 pr-7 py-1.5 rounded-lg text-xs font-medium border-2 cursor-pointer transition-all',
                              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1',
                              'hover:shadow-md hover:border-primary-400',
                              user.role === 'admin' ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100' :
                              user.role === 'analyst' ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100' :
                              user.role === 'viewer' ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' :
                              user.role === 'user' ? 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100' :
                              // Custom roles get primary/teal styling
                              'bg-primary-50 border-primary-200 text-primary-700 hover:bg-primary-100',
                              changingRoleUserId === user.id && 'opacity-50 cursor-wait',
                              user.id === currentUser?.id && 'opacity-60 cursor-not-allowed hover:shadow-none'
                            )}
                            title={user.id === currentUser?.id ? 'Cannot change your own role' : 'Click to change role'}
                          >
                            {/* Combine built-in roles (excluding master_admin) with custom roles */}
                            {[...builtinRoles.filter(r => r.role_name !== 'master_admin'), ...customRoles].map(role => (
                              <option key={role.role_name} value={role.role_name}>
                                {role.display_name}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className={clsx(
                            'absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none transition-colors',
                            user.role === 'admin' ? 'text-red-500' :
                            user.role === 'analyst' ? 'text-blue-500' :
                            user.role === 'viewer' ? 'text-green-500' :
                            user.role === 'user' ? 'text-gray-500' :
                            'text-primary-500'
                          )} />
                          {changingRoleUserId === user.id && (
                            <div className="absolute -right-6 top-1/2 -translate-y-1/2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(user)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {user.lastLogin ? (
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                          {new Date(user.lastLogin).toLocaleDateString()}
                        </div>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">Never</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleEditUser(user)}
                          className="text-primary-600 hover:text-primary-900 transition-colors"
                        >
                          Edit
                        </button>
                        {/* Resend Invitation button - only for pending (unverified) users */}
                        {!user.verified && !user.deletedAt && (
                          <button
                            onClick={() => handleResendInvitation(user.id, user.email)}
                            disabled={resendingInviteUserId === user.id}
                            className={clsx(
                              "flex items-center gap-1 text-yellow-600 hover:text-yellow-800 transition-colors",
                              resendingInviteUserId === user.id && "opacity-50 cursor-wait"
                            )}
                            title="Resend invitation email"
                          >
                            {resendingInviteUserId === user.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                            <span>Resend</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Role Page Access Management */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Key className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            Role Page Access
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Configure which pages each role can access. Admin and Master Admin have full access.
          </p>
        </div>

        {/* Role Access Error Toast */}
        {roleAccessError && (
          <div className="mx-4 mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg flex items-center gap-3">
            <XCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{roleAccessError}</span>
            <button
              onClick={() => setRoleAccessError(null)}
              className="ml-auto text-red-900 hover:text-red-600"
            >
              &times;
            </button>
          </div>
        )}

        {/* Role Access Success Toast */}
        {roleAccessSuccess && (
          <div className="mx-4 mt-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg flex items-center gap-3">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{roleAccessSuccess}</span>
            <button
              onClick={() => setRoleAccessSuccess(null)}
              className="ml-auto text-green-900 hover:text-green-600"
            >
              &times;
            </button>
          </div>
        )}

        {companyAvailablePages.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <Shield className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>No pages are currently enabled for your company.</p>
            <p className="text-sm mt-1">Contact your master admin to enable pages.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {rolePageAccess.map((role) => (
              <div key={role.roleName} className="p-4">
                <button
                  onClick={() => toggleRoleExpansion(role.roleName)}
                  className="w-full flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg p-2 -m-2 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <ChevronRight
                      className={clsx(
                        'w-5 h-5 text-gray-400 transition-transform',
                        role.isExpanded && 'rotate-90'
                      )}
                    />
                    <span className={clsx(
                      'inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium border',
                      role.roleName === 'user' ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300' :
                      role.roleName === 'analyst' ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300' :
                      role.roleName === 'viewer' ? 'bg-gray-50 border-gray-200 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300' :
                      // Custom roles get primary/teal color
                      'bg-primary-50 border-primary-200 text-primary-700 dark:bg-primary-900/30 dark:border-primary-700 dark:text-primary-300'
                    )}>
                      {getRoleDisplayName(role.roleName)}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {role.assignedPages.length} page{role.assignedPages.length !== 1 ? 's' : ''} assigned
                      </span>
                      {role.assignedPages.length > 0 && (
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {role.assignedPages.map(p => PAGE_DISPLAY_NAMES[p] || p).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                  {role.isLoading && (
                    <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                  )}
                </button>

                {role.isExpanded && (
                  <div className="mt-4 ml-8 space-y-4">
                    {role.isLoading ? (
                      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Loading pages...</span>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {companyAvailablePages.map((pageKey) => (
                            <label
                              key={pageKey}
                              className={clsx(
                                'flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all',
                                role.assignedPages.includes(pageKey)
                                  ? 'bg-primary-50 border-primary-300 dark:bg-primary-900/30 dark:border-primary-700'
                                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100 dark:bg-gray-700/50 dark:border-gray-600 dark:hover:bg-gray-700'
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={role.assignedPages.includes(pageKey)}
                                onChange={(e) => handlePageToggle(role.roleName, pageKey, e.target.checked)}
                                className="w-4 h-4 text-primary-600 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500"
                              />
                              <span className={clsx(
                                'text-sm font-medium',
                                role.assignedPages.includes(pageKey)
                                  ? 'text-primary-700 dark:text-primary-300'
                                  : 'text-gray-700 dark:text-gray-300'
                              )}>
                                {PAGE_DISPLAY_NAMES[pageKey] || pageKey}
                              </span>
                            </label>
                          ))}
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                          <button
                            onClick={() => saveRolePages(role.roleName)}
                            disabled={role.isSaving}
                            className={clsx(
                              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                              'bg-primary-600 text-white hover:bg-primary-700',
                              role.isSaving && 'opacity-50 cursor-wait'
                            )}
                          >
                            {role.isSaving ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-4 h-4" />
                                Save Changes
                              </>
                            )}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Custom Roles Management */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Tag className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              Custom Roles
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Create and manage custom roles for your company beyond the built-in roles.
            </p>
          </div>
          <button
            onClick={() => {
              resetCustomRoleForm();
              setIsCustomRoleModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Role
          </button>
        </div>

        {/* Custom Role Error Toast */}
        {customRoleError && (
          <div className="mx-4 mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg flex items-center gap-3">
            <XCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{customRoleError}</span>
            <button
              onClick={() => setCustomRoleError(null)}
              className="ml-auto text-red-900 hover:text-red-600"
            >
              &times;
            </button>
          </div>
        )}

        {/* Custom Role Success Toast */}
        {customRoleSuccess && (
          <div className="mx-4 mt-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg flex items-center gap-3">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{customRoleSuccess}</span>
            <button
              onClick={() => setCustomRoleSuccess(null)}
              className="ml-auto text-green-900 hover:text-green-600"
            >
              &times;
            </button>
          </div>
        )}

        {customRolesLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary-600" />
            <p className="mt-2 text-gray-500 dark:text-gray-400">Loading roles...</p>
          </div>
        ) : (
          <div className="p-4">
            {customRoles.length === 0 ? (
                <div className="p-6 text-center border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-lg">
                  <Tag className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                  <p className="text-gray-500 dark:text-gray-400">No custom roles yet.</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Create a custom role to give users specific access.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {customRoles.map((role) => (
                    <div
                      key={role.role_name}
                      className="p-4 rounded-lg border border-primary-200 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-2.5 py-1 rounded-full text-sm font-medium border bg-primary-100 border-primary-200 text-primary-700 dark:bg-primary-900/30 dark:border-primary-700 dark:text-primary-300">
                          {role.display_name}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditCustomRole(role)}
                            className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded transition-colors"
                            title="Edit role"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCustomRole(role.role_name)}
                            disabled={deletingRoleName === role.role_name || (role.user_count ?? 0) > 0}
                            className={clsx(
                              "p-1.5 rounded transition-colors",
                              (role.user_count ?? 0) > 0
                                ? "text-gray-300 dark:text-gray-600 cursor-not-allowed"
                                : "text-gray-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30"
                            )}
                            title={(role.user_count ?? 0) > 0 ? "Cannot delete: users assigned" : "Delete role"}
                          >
                            {deletingRoleName === role.role_name ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{role.description || 'No description'}</p>
                      <div className="mt-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {role.user_count} user{role.user_count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </div>
        )}
      </div>

      {/* Custom Role Modal */}
      {isCustomRoleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {editingCustomRole ? 'Edit Custom Role' : 'Create Custom Role'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role Name (ID) *
                </label>
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  disabled={!!editingCustomRole}
                  placeholder="e.g., technician"
                  className={clsx(
                    "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100",
                    editingCustomRole && "opacity-60 cursor-not-allowed"
                  )}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Lowercase, no spaces. This cannot be changed later.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={newRoleDisplayName}
                  onChange={(e) => setNewRoleDisplayName(e.target.value)}
                  placeholder="e.g., Technician"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={newRoleDescription}
                  onChange={(e) => setNewRoleDescription(e.target.value)}
                  placeholder="Describe what this role can do..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setIsCustomRoleModalOpen(false);
                  resetCustomRoleForm();
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCustomRole}
                disabled={savingCustomRole || !newRoleName.trim()}
                className={clsx(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  "bg-primary-600 text-white hover:bg-primary-700",
                  (savingCustomRole || !newRoleName.trim()) && "opacity-50 cursor-not-allowed"
                )}
              >
                {savingCustomRole ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    {editingCustomRole ? 'Update Role' : 'Create Role'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      {!loading && !error && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>
              Showing {filteredUsers.length} of {users.length} users
              {searchQuery && ` matching "${searchQuery}"`}
            </span>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                {users.filter(u => u.isActive && u.verified).length} Active
              </span>
              <span className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-yellow-500" />
                {users.filter(u => !u.verified).length} Pending
              </span>
              <span className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-500" />
                {users.filter(u => u.deletedAt).length} Archived
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
