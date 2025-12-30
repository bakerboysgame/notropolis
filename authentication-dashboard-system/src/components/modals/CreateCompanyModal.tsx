import { useState } from 'react';
import { X, Building2, User, Mail, AlertCircle, CheckCircle, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { api, apiHelpers } from '../../services/api';
import { clsx } from 'clsx';

// Available pages that can be enabled for companies
const AVAILABLE_PAGES = [
  { key: 'dashboard', label: 'Dashboard', description: 'Main dashboard with overview metrics' },
  { key: 'analytics', label: 'Analytics', description: 'Detailed analytics and reporting' },
  { key: 'reports', label: 'Reports', description: 'Generate and export reports' },
  { key: 'settings', label: 'Settings', description: 'Company and user settings' },
];

interface CreateCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateCompanyModal({ isOpen, onClose, onSuccess }: CreateCompanyModalProps) {
  const [formData, setFormData] = useState({
    companyName: '',
    adminName: '',
    adminEmail: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Available pages state - default to all pages enabled
  const [enabledPages, setEnabledPages] = useState<string[]>(AVAILABLE_PAGES.map(p => p.key));
  const [showPagesSection, setShowPagesSection] = useState(false);

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
      const response = await api.post('/api/companies/create-with-admin', formData);
      const data = apiHelpers.handleResponse<{
        companyId: string;
        companyName: string;
        adminEmail: string;
        invitationExpires: string;
      }>(response);

      // Set up available pages for the new company
      if (data.companyId && enabledPages.length > 0) {
        try {
          await api.put(`/api/companies/${data.companyId}/available-pages`, { pages: enabledPages });
        } catch (pageErr) {
          console.error('Failed to set available pages:', pageErr);
          // Don't fail the whole operation if pages fail to set
        }
      }

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
      setFormData({ companyName: '', adminName: '', adminEmail: '' });
      setError(null);
      setSuccess(false);
      setEnabledPages(AVAILABLE_PAGES.map(p => p.key)); // Reset to all enabled
      setShowPagesSection(false);
      onClose();
    }
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const isFormValid = () => {
    return (
      formData.companyName.trim() !== '' &&
      formData.adminName.trim() !== '' &&
      formData.adminEmail.trim() !== '' &&
      isValidEmail(formData.adminEmail)
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
                <Building2 className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Create Company</h2>
                <p className="text-sm text-gray-600">Invite an admin to manage the company</p>
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
                  <p className="text-sm font-medium text-green-900">Company Created!</p>
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

            {/* Company Name */}
            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-2">
                Company Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  id="companyName"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  disabled={loading || success}
                  placeholder="Acme Corporation"
                  className={clsx(
                    'w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent',
                    'disabled:bg-gray-100 disabled:cursor-not-allowed',
                    formData.companyName && 'border-gray-300'
                  )}
                  required
                />
              </div>
            </div>

            {/* Admin Name */}
            <div>
              <label htmlFor="adminName" className="block text-sm font-medium text-gray-700 mb-2">
                Admin Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  id="adminName"
                  value={formData.adminName}
                  onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                  disabled={loading || success}
                  placeholder="John Doe"
                  className={clsx(
                    'w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent',
                    'disabled:bg-gray-100 disabled:cursor-not-allowed',
                    formData.adminName && 'border-gray-300'
                  )}
                  required
                />
              </div>
            </div>

            {/* Admin Email */}
            <div>
              <label htmlFor="adminEmail" className="block text-sm font-medium text-gray-700 mb-2">
                Admin Email <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  id="adminEmail"
                  value={formData.adminEmail}
                  onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                  disabled={loading || success}
                  placeholder="admin@example.com"
                  className={clsx(
                    'w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent',
                    'disabled:bg-gray-100 disabled:cursor-not-allowed',
                    formData.adminEmail && isValidEmail(formData.adminEmail) && 'border-gray-300',
                    formData.adminEmail && !isValidEmail(formData.adminEmail) && 'border-red-300'
                  )}
                  required
                />
              </div>
              {formData.adminEmail && !isValidEmail(formData.adminEmail) && (
                <p className="mt-1 text-sm text-red-600">Please enter a valid email address</p>
              )}
            </div>

            {/* Available Pages (Collapsible) */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setShowPagesSection(!showPagesSection)}
                disabled={loading || success}
                className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">Available Pages</span>
                  <span className="text-xs text-gray-500">({enabledPages.length} of {AVAILABLE_PAGES.length} enabled)</span>
                </div>
                {showPagesSection ? (
                  <ChevronUp className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                )}
              </button>

              {showPagesSection && (
                <div className="p-3 border-t border-gray-200 space-y-3">
                  <p className="text-xs text-gray-600">
                    Select which pages this company can access. By default, all pages are enabled.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {AVAILABLE_PAGES.map((page) => (
                      <label
                        key={page.key}
                        className={clsx(
                          'flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-all text-sm',
                          enabledPages.includes(page.key)
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300',
                          (loading || success) && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={enabledPages.includes(page.key)}
                          onChange={() => handlePageToggle(page.key)}
                          disabled={loading || success}
                          className="mt-0.5 w-3.5 h-3.5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                        />
                        <div>
                          <div className="font-medium text-gray-900 text-xs">{page.label}</div>
                          <div className="text-xs text-gray-500 leading-tight">{page.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>

                  {enabledPages.length === 0 && (
                    <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                      <strong>Warning:</strong> No pages enabled. Users won't be able to access any features.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Info Box */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">
                <strong>Note:</strong> An invitation email will be sent to the admin with a link to set their password. 
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
                disabled={loading || success || !isFormValid()}
                className={clsx(
                  'flex-1 px-4 py-2 rounded-lg transition-colors font-medium',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  success
                    ? 'bg-green-600 text-white'
                    : 'bg-primary-600 text-white hover:bg-primary-700'
                )}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    Creating...
                  </span>
                ) : success ? (
                  'Created!'
                ) : (
                  'Create & Send Invitation'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

