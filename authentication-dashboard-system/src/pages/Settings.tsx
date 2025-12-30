import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiHelpers } from '../services/api';
import { Smartphone, Monitor, XCircle, Shield, AlertTriangle, Lock, Key, LogOut } from 'lucide-react';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { TOTPSetup } from '../components/auth/TOTPSetup';
import { Modal } from '../components/ui/Modal';
import { SetPasswordModal } from '../components/modals/SetPasswordModal';

interface Session {
  id: string;
  user_id: string;
  created_at: string;
  expires_at: string;
  is_mobile: number;
  last_activity: string | null;
  user_agent?: string;
  ip_address?: string;
  browser?: string;
  os?: string;
  device_name?: string;
}

export default function Settings() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [showTOTPSetup, setShowTOTPSetup] = useState(false);
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpLoading, setTotpLoading] = useState(false);
  const [recoveryCodesRemaining, setRecoveryCodesRemaining] = useState(0);
  const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [passwordStatusLoading, setPasswordStatusLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const { showToast } = useToast();
  const { getTOTPStatus, disableTOTP, logout } = useAuth();
  const { twoFactorEnabled } = useFeatureFlags();

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      showToast('Failed to logout', 'error');
      setLoggingOut(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    fetchTOTPStatus();
    checkPasswordStatus();
  }, []);

  const checkPasswordStatus = async () => {
    try {
      setPasswordStatusLoading(true);
      // Get password status from /api/auth/me
      const response = await api.get('/api/auth/me');
      const data = apiHelpers.handleResponse<{ user: any; company: any; hasPassword: boolean }>(response);

      // Set password status from API response
      setHasPassword(data.hasPassword ?? true); // Default to true if not provided (backwards compatibility)
    } catch (error) {
      console.error('Failed to check password status:', error);
      setHasPassword(true); // Default to true on error
    } finally {
      setPasswordStatusLoading(false);
    }
  };

  const fetchTOTPStatus = async () => {
    try {
      const status = await getTOTPStatus();
      setTotpEnabled(status.enabled);
      setRecoveryCodesRemaining(status.recoveryCodesRemaining);
    } catch (error) {
      console.error('Failed to fetch TOTP status:', error);
    }
  };

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/auth/sessions');
      const data = apiHelpers.handleResponse<Session[]>(response);
      // Sort by oldest activity first (oldest created_at first)
      const sorted = data.sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      setSessions(sorted);
      setError(null);
    } catch (err) {
      setError('Failed to load active sessions');
      console.error('Failed to fetch sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const suffix = ['th', 'st', 'nd', 'rd'][day % 10 > 3 ? 0 : (day % 100 - day % 10 !== 10 ? day % 10 : 0)];

    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).replace(/^(\d+)/, `${day}${suffix}`);
  };

  const handleEndSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to end this session? You will need to log in again on that device.')) {
      return;
    }

    try {
      setDeletingSessionId(sessionId);
      await api.delete(`/api/auth/sessions/${sessionId}`);
      showToast('Session ended successfully', 'success');
      // Remove the session from the list
      setSessions(sessions.filter(s => s.id !== sessionId));
    } catch (err) {
      showToast('Failed to end session', 'error');
      console.error('Failed to delete session:', err);
    } finally {
      setDeletingSessionId(null);
    }
  };

  const handleDeleteAllSessions = async () => {
    if (!confirm('WARNING: This will log you out of ALL devices (including this one). You will need to log in again. Are you sure?')) {
      return;
    }

    try {
      setLoading(true);
      await api.delete('/api/auth/sessions/all');

      // CRITICAL: Clear the token from localStorage immediately
      apiHelpers.clearToken();

      showToast('All sessions ended. Logging you out...', 'success');

      // Wait a moment for the user to see the message, then redirect to login
      setTimeout(() => {
        window.location.href = '/login';
      }, 1500);
    } catch (err) {
      showToast('Failed to end all sessions', 'error');
      console.error('Failed to delete all sessions:', err);
      setLoading(false);
    }
  };

  const handleTOTPSetupSuccess = async () => {
    setShowTOTPSetup(false);
    await fetchTOTPStatus();
    showToast('Authenticator app enabled successfully!', 'success');
  };

  const handleDisableTOTP = async () => {
    if (!confirm('Are you sure you want to disable authenticator app 2FA? You will still have email-based 2FA enabled.')) {
      return;
    }

    try {
      setTotpLoading(true);
      await disableTOTP();
      await fetchTOTPStatus();
      showToast('Authenticator app disabled successfully', 'success');
    } catch (err) {
      showToast('Failed to disable authenticator app', 'error');
      console.error('Failed to disable TOTP:', err);
    } finally {
      setTotpLoading(false);
    }
  };

  const handlePasswordUpdateSuccess = () => {
    setHasPassword(true);
    showToast(hasPassword ? 'Password changed successfully!' : 'Password set successfully!', 'success');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-0">Settings</h1>
        <p className="text-neutral-600 dark:text-neutral-400">Manage your account settings and active sessions</p>
      </div>

      {/* Active Sessions */}
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow border border-neutral-200 dark:border-neutral-800">
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-0">Active Sessions</h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                Manage and monitor your active login sessions across all devices
              </p>
            </div>
            {sessions.length > 1 && (
              <button
                onClick={handleDeleteAllSessions}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <XCircle className="w-4 h-4" />
                <span>End All Sessions</span>
              </button>
            )}
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
              <p className="text-neutral-500 dark:text-neutral-400 mt-2">Loading sessions...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-500">{error}</p>
              <button
                onClick={fetchSessions}
                className="mt-4 text-primary-500 hover:text-primary-400 font-medium"
              >
                Try Again
              </button>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-neutral-500 dark:text-neutral-400">No active sessions found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-800">
                <thead>
                  <tr>
                    <th className="px-6 py-3 bg-neutral-50 dark:bg-neutral-800 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                      Device
                    </th>
                    <th className="px-6 py-3 bg-neutral-50 dark:bg-neutral-800 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                      Activity
                    </th>
                    <th className="px-6 py-3 bg-neutral-50 dark:bg-neutral-800 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-neutral-900 divide-y divide-neutral-200 dark:divide-neutral-800">
                  {sessions.map((session) => (
                    <tr key={session.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {session.is_mobile ? (
                            <Smartphone className="w-5 h-5 text-primary-500 mr-3 flex-shrink-0" />
                          ) : (
                            <Monitor className="w-5 h-5 text-primary-500 mr-3 flex-shrink-0" />
                          )}
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-0 truncate">
                              {session.device_name || (session.is_mobile ? 'Mobile Device' : 'Desktop Browser')}
                            </span>
                            {session.browser && session.os && (
                              <span className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                                {session.browser} on {session.os}
                              </span>
                            )}
                            {session.ip_address && (
                              <span className="text-xs text-neutral-400 dark:text-neutral-500 truncate" title={session.ip_address}>
                                {session.ip_address}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-700 dark:text-neutral-300">
                        {formatDate(session.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleEndSession(session.id)}
                          disabled={deletingSessionId === session.id}
                          className="text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title="End this session"
                        >
                          {deletingSessionId === session.id ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600"></div>
                          ) : (
                            <XCircle className="w-5 h-5" />
                          )}
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

      {/* Two-Factor Authentication */}
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow border border-neutral-200 dark:border-neutral-800">
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-0">Two-Factor Authentication (2FA)</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
            Enhanced security for your account
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* Email-based 2FA - Always Enabled */}
          <div className="flex items-start justify-between p-4 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg
                  className="w-6 h-6 text-primary-600 dark:text-primary-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-primary-900 dark:text-primary-300">
                  Email-based 2FA: Always Enabled
                </h3>
                <p className="mt-1 text-sm text-primary-700 dark:text-primary-400">
                  Every login requires a 6-digit code sent to your email. This is mandatory for all users to ensure maximum security.
                </p>
                <p className="mt-2 text-xs text-primary-600 dark:text-primary-500">
                  Automatically enabled - Cannot be disabled - Protects your account
                </p>
              </div>
            </div>
          </div>

          {/* Authenticator App 2FA - Optional Upgrade (only if feature enabled) */}
          {twoFactorEnabled && (
            <div className={`flex items-start justify-between p-4 border rounded-lg ${
              totpEnabled ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800' : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
            }`}>
              <div className="flex items-start flex-1">
                <div className="flex-shrink-0">
                  <Shield className={`w-6 h-6 ${totpEnabled ? 'text-primary-600 dark:text-primary-400' : 'text-neutral-400'}`} />
                </div>
                <div className="ml-3 flex-1">
                  <h3 className={`text-sm font-medium ${totpEnabled ? 'text-primary-900 dark:text-primary-300' : 'text-neutral-900 dark:text-neutral-0'}`}>
                    Authenticator App {totpEnabled ? '(Enabled)' : '(Optional)'}
                  </h3>
                  <p className={`mt-1 text-sm ${totpEnabled ? 'text-primary-700 dark:text-primary-400' : 'text-neutral-600 dark:text-neutral-400'}`}>
                    {totpEnabled
                      ? 'You can use your authenticator app for faster 2FA verification instead of email codes.'
                      : 'Add an extra layer of security by using an authenticator app like Google Authenticator or Authy.'
                    }
                  </p>
                  {totpEnabled && recoveryCodesRemaining > 0 && (
                    <p className="mt-2 text-xs text-primary-600">
                      {recoveryCodesRemaining} recovery code{recoveryCodesRemaining !== 1 ? 's' : ''} remaining
                    </p>
                  )}
                  {totpEnabled && recoveryCodesRemaining === 0 && (
                    <p className="mt-2 text-xs text-yellow-600 flex items-center">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      No recovery codes remaining - consider regenerating them
                    </p>
                  )}
                </div>
              </div>
              <div className="ml-4">
                {totpEnabled ? (
                  <button
                    onClick={handleDisableTOTP}
                    disabled={totpLoading}
                    className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {totpLoading ? 'Disabling...' : 'Disable'}
                  </button>
                ) : (
                  <button
                    onClick={() => setShowTOTPSetup(true)}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-400 rounded-lg transition-colors"
                  >
                    Enable
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Information Box */}
          <div className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="w-5 h-5 text-neutral-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                  How 2FA Works
                </h3>
                <div className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                  <ul className="list-disc list-inside space-y-1">
                    <li>Enter your email and password as usual</li>
                    <li>We'll send a 6-digit code to your email</li>
                    <li>Enter the code to complete your login</li>
                    <li>Codes expire after 10 minutes for security</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Password Management */}
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow border border-neutral-200 dark:border-neutral-800">
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-0">Password Management</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
            Manage your password for account login
          </p>
        </div>

        <div className="p-6">
          {passwordStatusLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500"></div>
              <span className="ml-2 text-neutral-600 dark:text-neutral-400">Loading password status...</span>
            </div>
          ) : (
            <div className={`flex items-start justify-between p-4 border rounded-lg ${
              hasPassword ? 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700' : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
            }`}>
              <div className="flex items-start flex-1">
                <div className="flex-shrink-0">
                  {hasPassword ? (
                    <Lock className="w-6 h-6 text-neutral-600 dark:text-neutral-400" />
                  ) : (
                    <Key className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                  )}
                </div>
                <div className="ml-3 flex-1">
                  <h3 className={`text-sm font-medium ${hasPassword ? 'text-neutral-900 dark:text-neutral-0' : 'text-yellow-900 dark:text-yellow-300'}`}>
                    {hasPassword ? 'Password Set' : 'No Password Set'}
                  </h3>
                  <p className={`mt-1 text-sm ${hasPassword ? 'text-neutral-600 dark:text-neutral-400' : 'text-yellow-700 dark:text-yellow-400'}`}>
                    {hasPassword
                      ? 'Your account has a password configured. You can change it at any time.'
                      : 'You haven\'t set a password yet. Set one now to enable password-based login in addition to magic links.'
                    }
                  </p>
                  {!hasPassword && (
                    <>
                      <p className="mt-2 text-xs text-yellow-600">
                        Magic link login will continue to work even after setting a password
                      </p>
                      <p className="mt-1 text-xs text-yellow-700 font-semibold">
                        Note: Email 2FA is required for all logins, with or without a password
                      </p>
                    </>
                  )}
                </div>
              </div>
              <div className="ml-4">
                <button
                  onClick={() => setShowSetPasswordModal(true)}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-400 rounded-lg transition-colors"
                >
                  {hasPassword ? 'Change Password' : 'Set Password'}
                </button>
              </div>
            </div>
          )}

          {/* Information Box */}
          <div className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 mt-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="w-5 h-5 text-neutral-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                  About Passwords & Security
                </h3>
                <div className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                  <ul className="list-disc list-inside space-y-1">
                    <li>Passwords must be at least 8 characters long</li>
                    <li>You can login with either password or magic link</li>
                    <li>Changing your password will not end existing sessions</li>
                    <li>Setting a password is optional but recommended</li>
                    <li><strong>Email 2FA is mandatory for all logins (with or without password)</strong></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Account Information */}
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow border border-neutral-200 dark:border-neutral-800">
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-0">Account Information</h2>
        </div>
        <div className="p-6">
          <p className="text-neutral-600 dark:text-neutral-400">
            Account settings and preferences will be available here soon.
          </p>
        </div>
      </div>

      {/* Logout Section */}
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow border border-neutral-200 dark:border-neutral-800">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-0">Sign Out</h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                Sign out of your account on this device
              </p>
            </div>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex items-center space-x-2 px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loggingOut ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              <span>{loggingOut ? 'Signing out...' : 'Sign Out'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* TOTP Setup Modal */}
      {showTOTPSetup && (
        <Modal
          isOpen={showTOTPSetup}
          onClose={() => setShowTOTPSetup(false)}
          title="Setup Authenticator App"
        >
          <TOTPSetup
            onSuccess={handleTOTPSetupSuccess}
            onCancel={() => setShowTOTPSetup(false)}
          />
        </Modal>
      )}

      {/* Set/Change Password Modal */}
      <SetPasswordModal
        isOpen={showSetPasswordModal}
        onClose={() => setShowSetPasswordModal(false)}
        hasExistingPassword={hasPassword}
        onSuccess={handlePasswordUpdateSuccess}
      />
    </div>
  );
}
