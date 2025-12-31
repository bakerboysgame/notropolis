import { useState } from 'react';
import { Monitor, Smartphone, Globe, Clock, Trash2, LogOut } from 'lucide-react';
import { useSessions } from '../../hooks/useSessions';

export function ActiveSessions() {
  const { sessions, loading, error, deleteSession, deleteAllSessions } = useSessions();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);

  const handleDeleteSession = async (sessionId: string, isCurrent: boolean) => {
    if (isCurrent) {
      const confirmed = window.confirm(
        'This will log you out of this device. Continue?'
      );
      if (!confirmed) return;
    }

    setDeletingId(sessionId);
    const result = await deleteSession(sessionId);

    if (result.success && isCurrent) {
      // Current session deleted - redirect to login
      window.location.href = '/login';
    }

    setDeletingId(null);
  };

  const handleDeleteAll = async () => {
    const confirmed = window.confirm(
      `This will log you out of ${sessions.filter(s => !s.is_current).length} other device(s). Continue?`
    );
    if (!confirmed) return;

    setDeletingAll(true);
    await deleteAllSessions();
    setDeletingAll(false);
  };

  const getDeviceIcon = (deviceInfo: string) => {
    const lower = deviceInfo.toLowerCase();
    if (lower.includes('mobile') || lower.includes('iphone') || lower.includes('android')) {
      return <Smartphone className="w-5 h-5" />;
    }
    return <Monitor className="w-5 h-5" />;
  };

  const formatLastActive = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow border border-neutral-200 dark:border-neutral-800">
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-0">Active Sessions</h2>
        </div>
        <div className="p-6">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
            <p className="text-neutral-500 dark:text-neutral-400 mt-2">Loading sessions...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow border border-neutral-200 dark:border-neutral-800">
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-0">Active Sessions</h2>
        </div>
        <div className="p-6">
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  const otherSessions = sessions.filter(s => !s.is_current);

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-lg shadow border border-neutral-200 dark:border-neutral-800">
      <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-0">Active Sessions</h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              Manage devices where you're currently logged in. You can revoke access from any device.
            </p>
          </div>
          {otherSessions.length > 0 && (
            <button
              onClick={handleDeleteAll}
              disabled={deletingAll}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              {deletingAll ? 'Logging out...' : 'Log Out All Other Sessions'}
            </button>
          )}
        </div>
      </div>

      <div className="p-6">
        <div className="space-y-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`p-4 rounded-lg border ${
                session.is_current
                  ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-600'
                  : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className={`mt-1 ${session.is_current ? 'text-primary-600 dark:text-primary-400' : 'text-neutral-500 dark:text-neutral-400'}`}>
                    {getDeviceIcon(session.device_info)}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className={`font-medium ${session.is_current ? 'text-primary-900 dark:text-primary-300' : 'text-neutral-900 dark:text-neutral-0'}`}>
                        {session.device_info || 'Unknown Device'}
                      </p>
                      {session.is_current && (
                        <span className="px-2 py-0.5 text-xs bg-primary-600 text-white rounded">
                          Current Session
                        </span>
                      )}
                    </div>

                    <div className={`flex items-center gap-4 text-sm ${session.is_current ? 'text-primary-700 dark:text-primary-400' : 'text-neutral-600 dark:text-neutral-400'}`}>
                      <span className="flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        {session.ip_address}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatLastActive(session.last_active_at)}
                      </span>
                    </div>

                    <p className={`text-xs mt-1 ${session.is_current ? 'text-primary-600 dark:text-primary-500' : 'text-neutral-500 dark:text-neutral-500'}`}>
                      Signed in on {new Date(session.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteSession(session.id, session.is_current)}
                  disabled={deletingId === session.id}
                  className="ml-4 p-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                  title={session.is_current ? 'Log out of this device' : 'Revoke access'}
                >
                  {deletingId === session.id ? (
                    <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {sessions.length === 0 && (
          <p className="text-center text-neutral-500 dark:text-neutral-400 py-8">No active sessions found.</p>
        )}
      </div>
    </div>
  );
}
