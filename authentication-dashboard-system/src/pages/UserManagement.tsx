import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api, apiHelpers, User } from '../services/api';
import { Users, Search, Filter, UserPlus, Shield, Building2, Send, CheckCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { CreateCompanyModal } from '../components/modals/CreateCompanyModal';
import { EditUserModal } from '../components/modals/EditUserModal';
import { EditCompanyModal } from '../components/modals/EditCompanyModal';
import { AddUserModal } from '../components/modals/AddUserModal';

interface Company {
  id: string;
  name: string;
  domain?: string;
  is_active: boolean;
}

interface CompanyWithStats extends Company {
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

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesWithStats, setCompaniesWithStats] = useState<CompanyWithStats[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [selectedCompanyForEdit, setSelectedCompanyForEdit] = useState<CompanyWithStats | null>(null);
  const [isEditCompanyModalOpen, setIsEditCompanyModalOpen] = useState(false);
  const [showArchivedUsers, setShowArchivedUsers] = useState(false);
  const [showArchivedCompanies, setShowArchivedCompanies] = useState(false);
  const [resendingInviteUserId, setResendingInviteUserId] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);

  // Redirect if not master admin
  useEffect(() => {
    if (currentUser && currentUser.role !== 'master_admin') {
      window.location.href = '/';
    }
  }, [currentUser]);

  // Fetch companies
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const response = await api.get('/api/companies');
        const data = apiHelpers.handleResponse<Company[]>(response);
        setCompanies(data);
      } catch (err) {
        console.error('Failed to fetch companies:', err);
      }
    };

    if (currentUser?.role === 'master_admin') {
      fetchCompanies();
    }
  }, [currentUser]);

  // Fetch companies with statistics
  useEffect(() => {
    const fetchCompanyStats = async () => {
      setCompaniesLoading(true);
      try {
        const response = await api.get('/api/companies/stats');
        const data = apiHelpers.handleResponse<CompanyWithStats[]>(response);
        setCompaniesWithStats(data);
      } catch (err) {
        console.error('Failed to fetch company stats:', err);
      } finally {
        setCompaniesLoading(false);
      }
    };

    if (currentUser?.role === 'master_admin') {
      fetchCompanyStats();
    }
  }, [currentUser]);

  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // If a specific company is selected, fetch its users
        if (selectedCompany !== 'all') {
          const response = await api.get(`/api/companies/${selectedCompany}/users`);
          const data = apiHelpers.handleResponse<User[]>(response);
          setUsers(data);
        } else {
          // Fetch all users across all companies (master_admin only)
          const response = await api.get('/api/users');
          const allUsers = apiHelpers.handleResponse<User[]>(response);
          setUsers(allUsers);
        }
      } catch (err) {
        setError(apiHelpers.handleError(err));
      } finally {
        setLoading(false);
      }
    };

    if (currentUser?.role === 'master_admin' && companies.length > 0) {
      fetchUsers();
    }
  }, [currentUser, selectedCompany, companies]);

  // Filter users by search query and archived status
  const filteredUsers = users
    .filter(user => {
      // Filter by archived status
      if (!showArchivedUsers && user.deletedAt) {
        return false;
      }
      // Filter by search query
      return (
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });

  // Filter companies by archived status
  const filteredCompaniesWithStats = companiesWithStats.filter(company => {
    if (!showArchivedCompanies && !company.is_active) {
      return false;
    }
    return true;
  });

  // Get active-only counts (exclude archived)
  const activeUsers = users.filter(u => !u.deletedAt);
  const activeCompanies = companiesWithStats.filter(c => c.is_active);

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'master_admin':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'admin':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'analyst':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'viewer':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getCompanyName = (companyId: string) => {
    const company = companies.find(c => c.id === companyId);
    return company?.name || companyId;
  };

  const getCompanyStatus = (companyId: string) => {
    const company = companiesWithStats.find(c => c.id === companyId);
    return company?.is_active ?? true;
  };

  if (currentUser?.role !== 'master_admin') {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400">This page is only accessible to Master Administrators.</p>
        </div>
      </div>
    );
  }

  const handleCreateSuccess = () => {
    // Refresh companies and users
    if (currentUser?.role === 'master_admin') {
      // Refetch companies
      api.get('/api/companies').then((response) => {
        const data = apiHelpers.handleResponse<Company[]>(response);
        setCompanies(data);
      }).catch((err) => {
        console.error('Failed to fetch companies:', err);
      });
    }
  };

  const handleAddUserSuccess = () => {
    // Refetch users after adding a new user
    if (currentUser?.role === 'master_admin' && companies.length > 0) {
      if (selectedCompany !== 'all') {
        api.get(`/api/companies/${selectedCompany}/users`).then((response) => {
          const data = apiHelpers.handleResponse<User[]>(response);
          setUsers(data);
        }).catch((err) => {
          console.error('Failed to fetch users:', err);
        });
      } else {
        api.get('/api/users').then((response) => {
          const allUsers = apiHelpers.handleResponse<User[]>(response);
          setUsers(allUsers);
        }).catch((err) => {
          console.error('Failed to fetch users:', err);
        });
      }
    }
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setIsEditUserModalOpen(true);
  };

  const handleEditUserSuccess = () => {
    // Refetch users
    if (currentUser?.role === 'master_admin' && companies.length > 0) {
      if (selectedCompany !== 'all') {
        api.get(`/api/companies/${selectedCompany}/users`).then((response) => {
          const data = apiHelpers.handleResponse<User[]>(response);
          setUsers(data);
        }).catch((err) => {
          console.error('Failed to fetch users:', err);
        });
      } else {
        api.get('/api/users').then((response) => {
          const allUsers = apiHelpers.handleResponse<User[]>(response);
          setUsers(allUsers);
        }).catch((err) => {
          console.error('Failed to fetch users:', err);
        });
      }
    }
  };

  const handleEditCompany = (company: CompanyWithStats) => {
    setSelectedCompanyForEdit(company);
    setIsEditCompanyModalOpen(true);
  };

  const handleEditCompanySuccess = () => {
    // Refetch company stats and users
    if (currentUser?.role === 'master_admin') {
      api.get('/api/companies/stats').then((response) => {
        const data = apiHelpers.handleResponse<CompanyWithStats[]>(response);
        setCompaniesWithStats(data);
      }).catch((err) => {
        console.error('Failed to fetch company stats:', err);
      });

      // Also refetch regular companies list
      api.get('/api/companies').then((response) => {
        const data = apiHelpers.handleResponse<Company[]>(response);
        setCompanies(data);
      }).catch((err) => {
        console.error('Failed to fetch companies:', err);
      });

      // Refetch users if needed
      if (companies.length > 0) {
        if (selectedCompany !== 'all') {
          api.get(`/api/companies/${selectedCompany}/users`).then((response) => {
            const data = apiHelpers.handleResponse<User[]>(response);
            setUsers(data);
          }).catch((err) => {
            console.error('Failed to fetch users:', err);
          });
        } else {
          api.get('/api/users').then((response) => {
            const allUsers = apiHelpers.handleResponse<User[]>(response);
            setUsers(allUsers);
          }).catch((err) => {
            console.error('Failed to fetch users:', err);
          });
        }
      }
    }
  };

  const handleResendInvitation = async (userId: string, userEmail: string) => {
    setResendingInviteUserId(userId);
    setResendSuccess(null);

    try {
      const response = await api.post(`/api/users/${userId}/resend-invitation`);
      apiHelpers.handleResponse(response);
      setResendSuccess(userEmail);

      // Clear success message after 5 seconds
      setTimeout(() => {
        setResendSuccess(null);
      }, 5000);
    } catch (err) {
      console.error('Failed to resend invitation:', err);
      alert(apiHelpers.handleError(err));
    } finally {
      setResendingInviteUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Success Toast */}
      {resendSuccess && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50 animate-fade-in">
          <CheckCircle className="w-5 h-5" />
          <span>Invitation resent to {resendSuccess}</span>
        </div>
      )}

      {/* Create Company Modal */}
      <CreateCompanyModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Add User Modal */}
      <AddUserModal
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        onSuccess={handleAddUserSuccess}
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

      {/* Edit Company Modal */}
      {selectedCompanyForEdit && (
        <EditCompanyModal
          isOpen={isEditCompanyModalOpen}
          onClose={() => {
            setIsEditCompanyModalOpen(false);
            setSelectedCompanyForEdit(null);
          }}
          company={selectedCompanyForEdit}
          onSuccess={handleEditCompanySuccess}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <Users className="w-8 h-8 text-primary-600 dark:text-primary-400" />
            User Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage users across all companies</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddUserModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <UserPlus className="w-5 h-5" />
            Add User
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Building2 className="w-5 h-5" />
            Create Company
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search */}
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

          {/* Company Filter */}
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Companies</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Users</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{activeUsers.length}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Companies</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{activeCompanies.length}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Master Admins</div>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {activeUsers.filter(u => u.role === 'master_admin').length}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Active Users</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {activeUsers.filter(u => u.isActive).length}
          </div>
        </div>
      </div>

      {/* Show Archived Checkboxes */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-6">
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

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showArchivedCompanies}
              onChange={(e) => setShowArchivedCompanies(e.target.checked)}
              className="w-4 h-4 text-primary-600 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Show archived companies
              {companiesWithStats.filter(c => !c.is_active).length > 0 && (
                <span className="ml-1 text-gray-500 dark:text-gray-400">
                  ({companiesWithStats.filter(c => !c.is_active).length})
                </span>
              )}
            </span>
          </label>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <p className="text-red-600 mb-2">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="text-primary-600 hover:text-primary-700"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600 dark:text-gray-400">No users found</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Company
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
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                          <span className="text-primary-700 dark:text-primary-400 font-medium text-sm">
                            {user.firstName?.[0]}{user.lastName?.[0]}
                          </span>
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
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <div className="flex flex-col">
                          <span className="text-sm text-gray-900 dark:text-gray-100">
                            {user.companyName || getCompanyName(user.companyId)}
                          </span>
                          {!getCompanyStatus(user.companyId) && (
                            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                              ⚠️ Company Archived
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={clsx(
                        'px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border',
                        getRoleBadgeColor(user.role)
                      )}>
                        {user.role === 'master_admin' ? 'Master Admin' : user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span className={clsx(
                          'px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full w-fit',
                          user.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        )}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                        {!user.verified && (
                          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-amber-100 text-amber-800 w-fit">
                            Unverified
                          </span>
                        )}
                        {user.deletedAt && (
                          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800 w-fit">
                            Archived
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {user.lastLogin
                        ? new Date(user.lastLogin).toLocaleDateString()
                        : 'Never'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {/* Resend Invitation Button - only for unverified, non-archived users */}
                        {!user.verified && !user.deletedAt && (
                          <button
                            onClick={() => handleResendInvitation(user.id, user.email)}
                            disabled={resendingInviteUserId === user.id}
                            className={clsx(
                              'flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors',
                              resendingInviteUserId === user.id
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                            )}
                            title="Resend invitation email"
                          >
                            <Send className="w-3 h-3" />
                            <span>{resendingInviteUserId === user.id ? 'Sending...' : 'Resend'}</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleEditUser(user)}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          Edit
                        </button>
                        <button className="text-gray-600 hover:text-gray-900">
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Companies Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            All Companies
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Company statistics and activity overview</p>
        </div>

        {companiesLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredCompaniesWithStats.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600 dark:text-gray-400">No companies found</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Admin
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Users
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Active
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Logins This Month
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Logins Last Month
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredCompaniesWithStats.map((company) => (
                  <tr key={company.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {company.name}
                        </div>
                        {company.domain && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">{company.domain}</div>
                        )}
                        <div className="text-xs text-gray-400 dark:text-gray-500">
                          Created {new Date(company.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {company.admin_email ? (
                        <div>
                          <div className="text-sm text-gray-900 dark:text-gray-100">
                            {company.admin_first_name} {company.admin_last_name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{company.admin_email}</div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 dark:text-gray-500 italic">No admin</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {company.total_users}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                        {company.active_users}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm text-gray-900 dark:text-gray-100">
                        {company.logins_this_month}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {company.logins_last_month}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={clsx(
                        'px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full',
                        company.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      )}>
                        {company.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        onClick={() => handleEditCompany(company)}
                        className="text-primary-600 hover:text-primary-900 mr-4"
                      >
                        Edit
                      </button>
                      <button className="text-gray-600 hover:text-gray-900">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

