import { useState, useEffect } from 'react';
import { X, UserPlus, Building2, User, Mail, AlertCircle, CheckCircle, Shield } from 'lucide-react';
import { api, apiHelpers, CustomRole, RolesResponse } from '../../services/api';
import { clsx } from 'clsx';

interface Company {
  id: string;
  name: string;
  created_at: string;
  hipaa_compliant: boolean;
}

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultCompanyId?: string;
}

export function AddUserModal({ isOpen, onClose, onSuccess, defaultCompanyId }: AddUserModalProps) {
  const [formData, setFormData] = useState({
    companyId: '',
    userName: '',
    userEmail: '',
    role: 'user' // Default role
  });
  const [companies, setCompanies] = useState<Company[]>([]);
  const [availableRoles, setAvailableRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Default built-in roles (fallback)
  const defaultBuiltinRoles: CustomRole[] = [
    { role_name: 'admin', display_name: 'Admin', description: 'Company administrator', is_builtin: true },
    { role_name: 'user', display_name: 'User', description: 'Regular user', is_builtin: true },
    { role_name: 'analyst', display_name: 'Analyst', description: 'Data analyst', is_builtin: true },
    { role_name: 'viewer', display_name: 'Viewer', description: 'Read-only access', is_builtin: true }
  ];

  // Fetch roles for a specific company (or current user's company if no companyId)
  const fetchRoles = async (companyId?: string) => {
    try {
      setRolesLoading(true);
      // Pass company_id to get roles for that specific company (master_admin only)
      const url = companyId ? `/api/company/roles?company_id=${companyId}` : '/api/company/roles';
      const response = await api.get<{ success: boolean; data: RolesResponse }>(url);
      if (response.data.success && response.data.data) {
        // Combine built-in and custom roles, excluding master_admin
        const allRoles = [
          ...(response.data.data.builtin_roles || []).filter(r => r.role_name !== 'master_admin'),
          ...(response.data.data.custom_roles || [])
        ];
        setAvailableRoles(allRoles);
        // Reset role to 'user' if the current role isn't in the new list
        const roleExists = allRoles.some(r => r.role_name === formData.role);
        if (!roleExists) {
          setFormData(prev => ({ ...prev, role: 'user' }));
        }
      }
    } catch (err) {
      console.error('Failed to fetch roles:', err);
      // Fall back to default roles if fetch fails
      setAvailableRoles(defaultBuiltinRoles);
    } finally {
      setRolesLoading(false);
    }
  };

  // Fetch companies and roles on modal open
  useEffect(() => {
    if (isOpen) {
      if (defaultCompanyId) {
        // If default company is provided, set it and don't fetch companies
        setFormData(prev => ({ ...prev, companyId: defaultCompanyId }));
        setCompaniesLoading(false);
        // Fetch roles for the company admin's company
        fetchRoles();
      } else {
        fetchCompanies();
        // For master admin, start with default roles until they select a company
        setAvailableRoles(defaultBuiltinRoles);
      }
    }
  }, [isOpen, defaultCompanyId]);

  // When master admin selects a company, fetch that company's roles
  useEffect(() => {
    if (isOpen && !defaultCompanyId && formData.companyId) {
      // Master admin selected a company - fetch that company's custom roles
      fetchRoles(formData.companyId);
    }
  }, [formData.companyId]);

  const fetchCompanies = async () => {
    try {
      setCompaniesLoading(true);
      const response = await api.get('/api/companies');
      const data = apiHelpers.handleResponse<Company[]>(response);
      setCompanies(data);
    } catch (err) {
      console.error('Failed to fetch companies:', err);
      setError('Failed to load companies');
    } finally {
      setCompaniesLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/api/users/invite', formData);
      apiHelpers.handleResponse<{
        userId: string;
        userName: string;
        userEmail: string;
        companyName: string;
        invitationExpires: string;
      }>(response);

      setSuccess(true);

      // Wait a moment to show success message
      setTimeout(() => {
        onSuccess();
        handleClose();
      }, 2000);
    } catch (err) {
      setError(apiHelpers.handleError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({ companyId: '', userName: '', userEmail: '', role: 'user' });
      setError(null);
      setSuccess(false);
      onClose();
    }
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const isFormValid = () => {
    return (
      (defaultCompanyId || formData.companyId.trim() !== '') &&
      formData.userName.trim() !== '' &&
      formData.userEmail.trim() !== '' &&
      isValidEmail(formData.userEmail)
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Add User</h2>
                <p className="text-sm text-gray-600">Invite a user to join a company</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={loading}
              className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Success Message */}
            {success && (
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-900">User Invited!</p>
                  <p className="text-sm text-green-700">Invitation email sent successfully.</p>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-900">Error</p>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}

            {/* Company Selection - Only show for master admins (no default company) */}
            {!defaultCompanyId && (
              <div>
                <label htmlFor="companyId" className="block text-sm font-medium text-gray-700 mb-2">
                  Company <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <select
                    id="companyId"
                    value={formData.companyId}
                    onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                    disabled={loading || success || companiesLoading}
                    className={clsx(
                      'w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent',
                      'disabled:bg-gray-100 disabled:cursor-not-allowed',
                      formData.companyId && 'border-gray-300'
                    )}
                    required
                  >
                    <option value="">Select a company...</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>
                {companiesLoading && (
                  <p className="mt-1 text-sm text-gray-500">Loading companies...</p>
                )}
              </div>
            )}

            {/* User Name */}
            <div>
              <label htmlFor="userName" className="block text-sm font-medium text-gray-700 mb-2">
                User Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  id="userName"
                  value={formData.userName}
                  onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                  disabled={loading || success}
                  placeholder="John Doe"
                  className={clsx(
                    'w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent',
                    'disabled:bg-gray-100 disabled:cursor-not-allowed',
                    formData.userName && 'border-gray-300'
                  )}
                  required
                />
              </div>
            </div>

            {/* User Email */}
            <div>
              <label htmlFor="userEmail" className="block text-sm font-medium text-gray-700 mb-2">
                User Email <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  id="userEmail"
                  value={formData.userEmail}
                  onChange={(e) => setFormData({ ...formData, userEmail: e.target.value })}
                  disabled={loading || success}
                  placeholder="user@example.com"
                  className={clsx(
                    'w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent',
                    'disabled:bg-gray-100 disabled:cursor-not-allowed',
                    formData.userEmail && isValidEmail(formData.userEmail) && 'border-gray-300',
                    formData.userEmail && !isValidEmail(formData.userEmail) && 'border-red-300'
                  )}
                  required
                />
              </div>
              {formData.userEmail && !isValidEmail(formData.userEmail) && (
                <p className="mt-1 text-sm text-red-600">Please enter a valid email address</p>
              )}
            </div>

            {/* Role Selection */}
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                Role <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <select
                  id="role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  disabled={loading || success || rolesLoading}
                  className={clsx(
                    'w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent',
                    'disabled:bg-gray-100 disabled:cursor-not-allowed',
                    formData.role && 'border-gray-300'
                  )}
                  required
                >
                  {availableRoles.map((role) => (
                    <option key={role.role_name} value={role.role_name}>
                      {role.display_name}
                    </option>
                  ))}
                </select>
              </div>
              {rolesLoading && (
                <p className="mt-1 text-sm text-gray-500">Loading roles...</p>
              )}
            </div>

            {/* Info Box */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">
                <strong>Note:</strong> An invitation email will be sent to the user with instructions to set up their account.
                The invitation expires in 72 hours.
              </p>
            </div>

            {/* Footer */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || success || !isFormValid() || companiesLoading}
                className={clsx(
                  'flex-1 px-4 py-2 rounded-lg transition-colors font-medium',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  success
                    ? 'bg-green-600 text-white'
                    : 'bg-primary-600 text-white hover:bg-primary-700'
                )}
              >
                {loading ? 'Sending...' : success ? 'Invited!' : 'Send Invitation'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
