# Stage 7: TickAdminPage Shell

## Objective
Create the main TickAdminPage component with tab navigation, header, and loading states.

## Dependencies
`[Requires: Stage 6 complete]` (Types and API service)

## Complexity
**Low** — Single page component with tab structure, follows existing patterns

## Files to Create

### `authentication-dashboard-system/src/pages/admin/TickAdminPage.tsx`
Main page component with tabs for History and Settings.

## Implementation Details

### Component Structure

```
TickAdminPage
├── Header (icon, title, description, refresh button)
├── Tab Navigation (History | Settings)
├── Tab Content
│   ├── History Tab → [See: Stage 8]
│   └── Settings Tab → [See: Stage 9]
└── Loading/Error States
```

### Full Component Code

```tsx
// authentication-dashboard-system/src/pages/admin/TickAdminPage.tsx

import React, { useState, useEffect } from 'react';
import { Clock, RefreshCw, AlertCircle, Shield } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

// Placeholder components - will be replaced in Stage 8 & 9
const TickHistoryTab = ({ onRefresh }: { onRefresh: () => void }) => (
  <div className="p-8 text-center text-gray-500 dark:text-gray-400">
    History tab placeholder - [See: Stage 8]
  </div>
);

const TickSettingsTab = ({ onRefresh }: { onRefresh: () => void }) => (
  <div className="p-8 text-center text-gray-500 dark:text-gray-400">
    Settings tab placeholder - [See: Stage 9]
  </div>
);

type TabType = 'history' | 'settings';

const TickAdminPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('history');
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Check for master admin access
  const isMasterAdmin = user?.role === 'master_admin';

  useEffect(() => {
    // Simulate initial load
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    showToast('Refreshing data...', 'info');
  };

  // Access denied for non-master admins
  if (!isMasterAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center p-8">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Access Denied
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            This page is only accessible to master administrators.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Clock className="w-8 h-8 text-purple-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Tick System
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Monitor tick history for view real-time game metrics, and configure tick settings
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Status indicator */}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Running every 10 min
            </span>
          </div>
          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('history')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'history'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Tick History
            </span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'settings'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Tick Settings
            </span>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <RefreshCw className="w-8 h-8 text-purple-600 animate-spin" />
          </div>
        ) : (
          <>
            {activeTab === 'history' && (
              <TickHistoryTab key={`history-${refreshKey}`} onRefresh={handleRefresh} />
            )}
            {activeTab === 'settings' && (
              <TickSettingsTab key={`settings-${refreshKey}`} onRefresh={handleRefresh} />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TickAdminPage;
```

### Key Features

1. **Master Admin Check**: Shows access denied for non-master admins
2. **Tab Navigation**: Purple accent color, smooth transitions
3. **Refresh Button**: Triggers refresh in child components via key prop
4. **Status Indicator**: Shows tick is running (green pulse)
5. **Loading State**: Spinner while loading
6. **Dark Mode Support**: All elements have dark mode variants

### Styling Patterns Used

Following [Ref: src/pages/ModerationAdminPage.tsx]:

| Element | Classes |
|---------|---------|
| Page container | `p-6 max-w-7xl mx-auto` |
| Header icon | `w-8 h-8 text-purple-600` |
| Title | `text-2xl font-bold text-gray-900 dark:text-white` |
| Subtitle | `text-sm text-gray-600 dark:text-gray-400 mt-1` |
| Tab active | `border-purple-500 text-purple-600` |
| Tab inactive | `border-transparent text-gray-500 hover:text-gray-700` |
| Content card | `bg-white dark:bg-gray-800 rounded-lg shadow` |
| Button primary | `bg-purple-600 text-white rounded-lg hover:bg-purple-700` |

## Database Changes

None — frontend only

## Test Cases

### Test 1: Page Renders for Master Admin
```typescript
// Login as master admin
// Navigate to /admin/tick
// Expected: Page loads with header and tabs
```

### Test 2: Access Denied for Non-Admin
```typescript
// Login as regular user
// Navigate to /admin/tick
// Expected: Access denied message with shield icon
```

### Test 3: Tab Switching
```typescript
// Click "Tick Settings" tab
// Expected: Settings tab content shows
// Click "Tick History" tab
// Expected: History tab content shows
```

### Test 4: Refresh Button
```typescript
// Click Refresh button
// Expected: Toast shows "Refreshing data..."
// Tab content re-renders (via key change)
```

### Test 5: Loading State
```typescript
// Initial page load
// Expected: Spinner shows briefly, then content
```

## Acceptance Checklist

- [ ] `src/pages/admin/TickAdminPage.tsx` created
- [ ] Page checks for master_admin role
- [ ] Access denied shown for non-admins
- [ ] Header displays with Clock icon
- [ ] Two tabs: History and Settings
- [ ] Tab switching works correctly
- [ ] Refresh button triggers refresh
- [ ] Loading spinner shows on initial load
- [ ] Dark mode styling works
- [ ] Follows existing admin page patterns

## Deployment

```bash
cd authentication-dashboard-system
npm run build
# Verify build succeeds
```

## Handoff Notes

- Page shell is ready for tab content components
- [See: Stage 8] will replace TickHistoryTab placeholder
- [See: Stage 9] will replace TickSettingsTab placeholder
- [See: Stage 10] will add routing and sidebar link
- The `refreshKey` prop triggers child component re-fetch
- onRefresh callback allows children to trigger parent refresh
- Follow the same tab pattern for consistent UX
