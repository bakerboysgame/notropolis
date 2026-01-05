# Stage 10: Integration

## Objective
Complete the integration by adding routing, sidebar navigation, and performing end-to-end testing.

## Dependencies
`[Requires: Stage 8 complete]` (Tick History tab)
`[Requires: Stage 9 complete]` (Tick Settings tab)

## Complexity
**Low** — Wiring existing components, no new logic

## Files to Modify

### 1. `authentication-dashboard-system/src/App.tsx`
Add route for /admin/tick.

### 2. `authentication-dashboard-system/src/components/Sidebar.tsx`
Add navigation link for Tick System.

### 3. `authentication-dashboard-system/src/pages/admin/TickAdminPage.tsx`
Final updates to import actual tab components.

### 4. `authentication-dashboard-system/worker/index.js`
Ensure all routes are registered.

## Implementation Details

### App.tsx Changes

Add the route for the Tick Admin page:

```tsx
// src/App.tsx

// Add import at top
import TickAdminPage from './pages/admin/TickAdminPage';

// Add route in the Routes section (after other admin routes)
<Route path="/admin/tick" element={
  <ProtectedRoute>
    <ProtectedPageRoute pageKey="admin_tick">
      <Layout><TickAdminPage /></Layout>
    </ProtectedPageRoute>
  </ProtectedRoute>
} />
```

**Location:** After the existing admin routes (around line 340-345)

```tsx
{/* Admin Routes - Master Admin Only */}
<Route path="/admin/maps" element={...} />
<Route path="/admin/maps/:mapId" element={...} />
<Route path="/admin/moderation" element={...} />
<Route path="/admin/assets" element={...} />

{/* ADD THIS ROUTE */}
<Route path="/admin/tick" element={
  <ProtectedRoute>
    <ProtectedPageRoute pageKey="admin_tick">
      <Layout><TickAdminPage /></Layout>
    </ProtectedPageRoute>
  </ProtectedRoute>
} />
```

### Sidebar.tsx Changes

Add navigation link for master admins:

```tsx
// src/components/Sidebar.tsx

// Add import
import { Clock } from 'lucide-react';

// In the navigation items section (around line 200), add:
if (user?.role === 'master_admin') {
  // ... existing admin items ...

  items.push({
    name: 'Tick System',
    href: '/admin/tick',
    icon: Clock,
    pageKey: 'admin_tick',
    requiresMasterAdmin: true
  });
}
```

**Full context of where to add:**

```tsx
if (user?.role === 'master_admin') {
  items.push({
    name: 'User Management',
    href: '/user-management',
    icon: Users,
    pageKey: 'user_management'
  });

  items.push({
    name: 'Map Builder',
    href: '/admin/maps',
    icon: Map,
    pageKey: 'admin_maps',
    requiresMasterAdmin: true
  });

  items.push({
    name: 'Moderation',
    href: '/admin/moderation',
    icon: Shield,
    pageKey: 'admin_moderation',
    requiresMasterAdmin: true
  });

  items.push({
    name: 'Assets',
    href: '/admin/assets',
    icon: Image,
    pageKey: 'admin_assets',
    requiresMasterAdmin: true
  });

  // ADD THIS
  items.push({
    name: 'Tick System',
    href: '/admin/tick',
    icon: Clock,
    pageKey: 'admin_tick',
    requiresMasterAdmin: true
  });
}
```

### TickAdminPage.tsx Final Updates

Replace placeholders with actual imports:

```tsx
// src/pages/admin/TickAdminPage.tsx

// Replace placeholder imports with actual components
import TickHistoryTab from '../../components/admin/TickHistoryTab';
import TickSettingsTab from '../../components/admin/TickSettingsTab';

// Remove the placeholder component definitions
// const TickHistoryTab = ... (DELETE)
// const TickSettingsTab = ... (DELETE)
```

### worker/index.js Route Registration

Verify all tick admin routes are registered:

```javascript
// worker/index.js

// Import handlers
import { handleGetTickHistory, handleGetTickDetail, handleGetTickStats } from './src/routes/admin/tick.js';
import {
  handleGetTickSettings,
  handleUpdateTickSettings,
  handleResetTickSettings,
  handleGetTickSettingsLog
} from './src/routes/admin/tickSettings.js';

// In the fetch handler, verify these routes exist:

// Tick History
if (path === '/api/admin/tick/history' && method === 'GET') {
  return handleGetTickHistory(request, authService, env, corsHeaders);
}
if (path.match(/^\/api\/admin\/tick\/history\/[^/]+$/) && method === 'GET') {
  const tickId = path.split('/').pop();
  return handleGetTickDetail(request, authService, env, corsHeaders, tickId);
}
if (path === '/api/admin/tick/stats' && method === 'GET') {
  return handleGetTickStats(request, authService, env, corsHeaders);
}

// Tick Settings
if (path === '/api/admin/tick/settings' && method === 'GET') {
  return handleGetTickSettings(request, authService, env, corsHeaders);
}
if (path === '/api/admin/tick/settings' && method === 'PUT') {
  return handleUpdateTickSettings(request, authService, env, corsHeaders);
}
if (path === '/api/admin/tick/settings/reset' && method === 'POST') {
  return handleResetTickSettings(request, authService, env, corsHeaders);
}
if (path === '/api/admin/tick/settings/log' && method === 'GET') {
  return handleGetTickSettingsLog(request, authService, env, corsHeaders);
}
```

## Database Changes

None — all migrations completed in earlier stages

## Test Cases

### End-to-End Test Suite

#### Test 1: Navigation
```
1. Login as master admin
2. Open sidebar
3. Find "Tick System" link with Clock icon
4. Click link
Expected: Navigates to /admin/tick
Expected: Page loads without errors
```

#### Test 2: Non-Admin Access
```
1. Login as regular user
2. Navigate to /admin/tick directly
Expected: Access denied message
Expected: Shield icon with "This page is only accessible to master administrators"
```

#### Test 3: History Tab Full Flow
```
1. Navigate to /admin/tick
2. Verify History tab is active by default
3. Check stats cards show data
4. Check charts render
5. Scroll to table, verify ticks listed
6. Click on a tick row
7. Verify modal opens with company stats
8. Close modal
9. Change period to "Last 7 Days"
10. Verify data updates
11. Navigate to page 2 of table
12. Verify pagination works
```

#### Test 4: Settings Tab Full Flow
```
1. Click "Tick Settings" tab
2. Verify settings form loads
3. Expand "Profit Settings" category
4. Change "Earning Threshold" from 6 to 8
5. Verify yellow highlight and unsaved warning
6. Click "Save Changes"
7. Verify toast shows success
8. Refresh page
9. Verify setting persisted as 8
10. Click "Change Log" sub-tab
11. Verify change appears in log
12. Click "Reset All to Defaults"
13. Confirm dialog
14. Verify settings reset
```

#### Test 5: Settings Take Effect
```
1. Change a visible setting (e.g., tax_rate_town to 0.25)
2. Save changes
3. Wait for next tick (or trigger manually)
4. Check tick_history or company_statistics
5. Verify new tax rate applied
```

#### Test 6: Error Handling
```
1. Disconnect network
2. Try to refresh data
3. Verify error message shows
4. Reconnect network
5. Click "Retry"
6. Verify data loads
```

#### Test 7: Dark Mode
```
1. Toggle dark mode in app
2. Navigate to /admin/tick
3. Verify all elements have proper dark styling
4. Check History tab charts
5. Check Settings tab form
6. Verify no white/unthemed elements
```

### API Verification

```bash
# Get auth token
TOKEN="your-master-admin-token"
BASE="https://notropolis-api.your-domain.workers.dev"

# Test all endpoints
curl -H "Authorization: Bearer $TOKEN" "$BASE/api/admin/tick/history?limit=5"
curl -H "Authorization: Bearer $TOKEN" "$BASE/api/admin/tick/stats?period=24h"
curl -H "Authorization: Bearer $TOKEN" "$BASE/api/admin/tick/settings"
curl -H "Authorization: Bearer $TOKEN" "$BASE/api/admin/tick/settings/log"

# Test update
curl -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"fire_damage_base": 10}' "$BASE/api/admin/tick/settings"
```

## Acceptance Checklist

### Routing & Navigation
- [ ] Route `/admin/tick` added to App.tsx
- [ ] Sidebar shows "Tick System" link for master admins
- [ ] Link has Clock icon
- [ ] Non-admins see access denied

### History Tab
- [ ] Stats cards display correctly
- [ ] Charts render with data
- [ ] Table shows tick history
- [ ] Pagination works
- [ ] Period selector updates data
- [ ] Row click opens modal
- [ ] Modal shows company stats
- [ ] Modal closes properly

### Settings Tab
- [ ] Settings load from API
- [ ] Categories expand/collapse
- [ ] Slider and number inputs work
- [ ] Changed values highlighted
- [ ] Unsaved warning appears
- [ ] Save persists changes
- [ ] Discard reverts changes
- [ ] Reset to defaults works
- [ ] Change log displays history

### Backend Integration
- [ ] All API endpoints respond correctly
- [ ] Tick processor reads from DB settings
- [ ] Settings changes take effect on next tick
- [ ] Change log entries created on save

### Quality
- [ ] No console errors
- [ ] Dark mode works throughout
- [ ] Loading states display
- [ ] Error states display
- [ ] Toasts show for actions

## Deployment

### 1. Deploy Migrations (if not already done)
```bash
cd authentication-dashboard-system
npx wrangler d1 execute notropolis-database --remote --file=migrations/0054_create_tick_settings.sql
npx wrangler d1 execute notropolis-database --remote --file=migrations/0055_create_tick_settings_log.sql
```

### 2. Deploy Worker
```bash
cd authentication-dashboard-system/worker
npx wrangler deploy
```

### 3. Deploy Frontend
```bash
cd authentication-dashboard-system
npm run build
npm run deploy
```

### 4. Verify Deployment
```bash
# Check worker logs
wrangler tail

# Test API endpoints
curl -H "Authorization: Bearer $TOKEN" \
  "https://notropolis-api.your-domain.workers.dev/api/admin/tick/settings"

# Visit frontend
open https://notropolis-dashboard.pages.dev/admin/tick
```

## Handoff Notes

### Feature Complete
The Tick Admin Page is now fully functional with:
- History tab showing tick statistics and drill-down
- Settings tab for configuring all game parameters
- Change logging for audit trail
- Tick processor reading settings from database

### Future Enhancements (Out of Scope)
- Manual tick triggering
- Per-map settings overrides
- Real-time tick progress
- Export to CSV
- Mobile responsive layout

### Maintenance Notes
- Settings are cached per-tick (not across ticks)
- Defaults in `tickSettings.js` must match migration
- SETTING_DEFINITIONS in `types/tick.ts` must match backend validation
- New settings require updates to:
  1. Migration (add column with default)
  2. Backend DEFAULT_SETTINGS and validation
  3. Frontend SETTING_DEFINITIONS
  4. Tick processor usage

### Known Limitations
- company_statistics shows last snapshot, not historical per-tick data
- Charts aggregate by hour, may miss individual tick details
- Reset to defaults affects all settings at once
