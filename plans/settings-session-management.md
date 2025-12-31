# Settings Page: Session Management UI

## Objective

Implement a session management interface on the settings page that allows users to view all their active sessions and revoke individual sessions or all sessions except the current one.

## Dependencies

**Existing endpoints (already implemented):**
- `GET /api/auth/sessions` - List user's sessions
- `DELETE /api/auth/sessions/:sessionId` - Delete single session
- `DELETE /api/auth/sessions/all` - Delete all sessions except current

**Prerequisites:**
- User must be authenticated
- Sessions are already scoped to the authenticated user (company isolation enforced)

## Complexity

**Low** - UI implementation only, all API endpoints already exist and work correctly.

## Files to Create

| File | Purpose |
|------|---------|
| `authentication-dashboard-system/src/components/settings/ActiveSessions.tsx` | Session list component |
| `authentication-dashboard-system/src/hooks/useSessions.ts` | Hook for fetching/managing sessions |

## Files to Modify

| File | Changes |
|------|---------|
| `authentication-dashboard-system/src/pages/Settings.tsx` | Add ActiveSessions component to settings page |

## Implementation Details

### Backend (Already Implemented)

The backend endpoints are already implemented and properly scoped. Verification:

```javascript
// GET /api/auth/sessions - Returns only the authenticated user's sessions
async function handleGetSessions(request, authService, db) {
  const { user } = await authService.getUserFromToken(token);

  // Query scoped to user.id - cannot see other users' sessions
  const sessions = await db.prepare(`
    SELECT id, device_info, ip_address, last_active_at, created_at,
           CASE WHEN id = ? THEN 1 ELSE 0 END as is_current
    FROM sessions
    WHERE user_id = ?
    ORDER BY last_active_at DESC
  `).bind(currentSessionId, user.id).all();

  return sessions.results;
}

// DELETE /api/auth/sessions/:sessionId - Deletes only user's session
async function handleDeleteSession(request, authService, db) {
  const { user } = await authService.getUserFromToken(token);
  const sessionId = path.split('/')[4];

  // Only deletes if session belongs to authenticated user
  await db.prepare(`
    DELETE FROM sessions
    WHERE id = ? AND user_id = ?
  `).bind(sessionId, user.id).run();
}

// DELETE /api/auth/sessions/all - Deletes all user's sessions except current
async function handleDeleteAllSessions(request, authService, db) {
  const { user } = await authService.getUserFromToken(token);
  const currentSessionId = getCurrentSessionId(token);

  // Only deletes user's own sessions, preserves current session
  await db.prepare(`
    DELETE FROM sessions
    WHERE user_id = ? AND id != ?
  `).bind(user.id, currentSessionId).run();
}
```

**Security:** All queries use `WHERE user_id = ?` - users can only manage their own sessions.

### Frontend Implementation

#### 1. Session Hook

```typescript
// src/hooks/useSessions.ts
import { useState, useEffect } from 'react';
import { api } from '../services/api';

interface Session {
  id: string;
  device_info: string;
  ip_address: string;
  last_active_at: string;
  created_at: string;
  is_current: boolean;
}

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<{ success: boolean; sessions: Session[] }>(
        '/api/auth/sessions'
      );

      if (response.data.success) {
        setSessions(response.data.sessions);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      await api.delete(`/api/auth/sessions/${sessionId}`);
      await fetchSessions(); // Refresh list
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.response?.data?.error || 'Failed to delete session'
      };
    }
  };

  const deleteAllSessions = async () => {
    try {
      await api.delete('/api/auth/sessions/all');
      await fetchSessions(); // Refresh list
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.response?.data?.error || 'Failed to delete sessions'
      };
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  return {
    sessions,
    loading,
    error,
    refetch: fetchSessions,
    deleteSession,
    deleteAllSessions,
  };
}
```

#### 2. ActiveSessions Component

```tsx
// src/components/settings/ActiveSessions.tsx
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
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-4">Active Sessions</h2>
        <p className="text-gray-400">Loading sessions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-4">Active Sessions</h2>
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  const otherSessions = sessions.filter(s => !s.is_current);

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">Active Sessions</h2>
        {otherSessions.length > 0 && (
          <button
            onClick={handleDeleteAll}
            disabled={deletingAll}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-500 disabled:opacity-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {deletingAll ? 'Logging out...' : 'Log Out All Other Sessions'}
          </button>
        )}
      </div>

      <p className="text-gray-400 text-sm mb-6">
        Manage devices where you're currently logged in. You can revoke access from any device.
      </p>

      <div className="space-y-3">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`p-4 rounded-lg border ${
              session.is_current
                ? 'bg-blue-900/20 border-blue-600'
                : 'bg-gray-700 border-gray-600'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <div className="text-gray-400 mt-1">
                  {getDeviceIcon(session.device_info)}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-white">
                      {session.device_info || 'Unknown Device'}
                    </p>
                    {session.is_current && (
                      <span className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded">
                        Current Session
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span className="flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      {session.ip_address}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatLastActive(session.last_active_at)}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500 mt-1">
                    Signed in on {new Date(session.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleDeleteSession(session.id, session.is_current)}
                disabled={deletingId === session.id}
                className="ml-4 p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                title={session.is_current ? 'Log out of this device' : 'Revoke access'}
              >
                {deletingId === session.id ? (
                  <div className="w-5 h-5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {sessions.length === 0 && (
        <p className="text-center text-gray-500 py-8">No active sessions found.</p>
      )}
    </div>
  );
}
```

#### 3. Settings Page Integration

```tsx
// src/pages/Settings.tsx (add to existing file)
import { ActiveSessions } from '../components/settings/ActiveSessions';

export function Settings() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-white mb-8">Settings</h1>

      <div className="space-y-6">
        {/* Existing settings sections */}

        {/* Add session management */}
        <ActiveSessions />

        {/* Other settings sections */}
      </div>
    </div>
  );
}
```

## Security Considerations

### Already Implemented ✅

1. **Authentication Required:** All endpoints require valid JWT token
2. **User Scoping:** All database queries use `WHERE user_id = ?`
3. **No Cross-User Access:** Users can only see/delete their own sessions
4. **Current Session Protection:** DELETE /all preserves the current session
5. **Company Isolation:** Each user belongs to one company, sessions are isolated

### Additional Frontend Safety

1. **Confirmation Dialogs:** Prompt before deleting current session or all sessions
2. **Loading States:** Prevent double-clicks during deletion
3. **Auto-Logout:** Redirect to login when current session is deleted
4. **Error Handling:** Display user-friendly error messages

## Test Cases

| Test | Input | Expected Output |
|------|-------|-----------------|
| View sessions | GET /api/auth/sessions | List of user's sessions only |
| Delete other session | DELETE /api/auth/sessions/:id | Session removed, user stays logged in |
| Delete current session | DELETE /api/auth/sessions/:currentId | Session removed, redirect to login |
| Delete all sessions | DELETE /api/auth/sessions/all | All except current removed |
| Delete non-owned session | DELETE /api/auth/sessions/:otherId | Error or no-op (not found) |
| Unauthenticated request | Any endpoint without token | 401 Unauthorized |

## Manual Testing Steps

```bash
# 1. Login and get token
# Visit https://boss.notropolis.net/login

# 2. View sessions
curl -X GET "https://api.notropolis.net/api/auth/sessions" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected: List of sessions for your user

# 3. Login from another device/browser
# Open incognito window and login with same account

# 4. Refresh sessions list
# Should show 2 sessions

# 5. Delete specific session
curl -X DELETE "https://api.notropolis.net/api/auth/sessions/SESSION_ID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected: Session deleted, incognito window gets logged out

# 6. Delete all sessions
curl -X DELETE "https://api.notropolis.net/api/auth/sessions/all" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected: All other sessions deleted, current session preserved
```

## Deployment

No backend changes needed. Frontend only:

```bash
# Build and deploy frontend
cd authentication-dashboard-system
npm run build

CLOUDFLARE_API_TOKEN="RQeVAceZ3VT-McbFF9DnYem0ZDc8YXbnHPH8wbg_" \
CLOUDFLARE_ACCOUNT_ID="329dc0e016dd5cd512d6566d64d8aa0c" \
  npx wrangler pages deploy ./dist --project-name=notropolis-dashboard
```

## Acceptance Checklist

- [ ] Can view all active sessions on settings page
- [ ] Current session is clearly marked
- [ ] Shows device info, IP address, last active time
- [ ] Can delete individual session (with confirmation)
- [ ] Can delete all other sessions (with confirmation)
- [ ] Deleting current session logs user out
- [ ] Deleting other session doesn't affect current session
- [ ] Cannot see or delete sessions from other users
- [ ] Loading and error states display correctly
- [ ] UI is responsive and accessible

## Notes

- **No /api/cleanup/sessions needed** - this functionality is already covered by `/api/auth/sessions/all`
- **Company isolation enforced** - users can only manage their own sessions (same company)
- **Session tracking** - last_active_at updates automatically on API requests
- **Future enhancement:** Add email notification when session is revoked from another device
