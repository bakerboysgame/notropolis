# Stage 07: Navigation & Protected Routes

## Objective

Set up protected route navigation so authenticated routes redirect to login when unauthenticated.

---

## Dependencies

**Requires:** [See: Stage 06] All auth screens complete

---

## Complexity

**Low** - Expo Router layout with auth check

---

## Files to Create

| File | Purpose |
|------|---------|
| `app/(authenticated)/_layout.tsx` | Auth guard for protected routes |
| `app/(authenticated)/home.tsx` | Placeholder home screen |

---

## Files to Modify

| File | Changes |
|------|---------|
| `app/_layout.tsx` | Ensure proper screen config |

---

## Implementation Details

### Protected Routes Layout

```tsx
// app/(authenticated)/_layout.tsx
import { Stack, Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';

export default function AuthenticatedLayout() {
  const { user, isInitialized } = useAuth();

  // Show loading while checking auth
  if (!isInitialized) {
    return (
      <View className="flex-1 items-center justify-center bg-neutral-950">
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Redirect href="/login" />;
  }

  // User is authenticated, render protected routes
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="home" />
    </Stack>
  );
}
```

### Placeholder Home Screen

```tsx
// app/(authenticated)/home.tsx
import { View, Text, TouchableOpacity } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { router } from 'expo-router';

export default function HomeScreen() {
  const { user, company, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <View className="flex-1 bg-neutral-950 p-6">
      {/* Header */}
      <View className="pt-12 pb-6">
        <Text className="text-2xl font-bold text-white">Notropolis</Text>
        <Text className="text-neutral-400 mt-1">Welcome back!</Text>
      </View>

      {/* User Info Card */}
      <View className="bg-neutral-900 rounded-lg p-4 mb-6">
        <Text className="text-neutral-400 text-sm">Logged in as</Text>
        <Text className="text-white text-lg font-semibold mt-1">
          {user?.email}
        </Text>
        {company && (
          <Text className="text-neutral-500 text-sm mt-1">
            {company.name}
          </Text>
        )}
      </View>

      {/* User Details */}
      <View className="bg-neutral-900 rounded-lg p-4 mb-6">
        <Text className="text-neutral-400 text-sm mb-3">Account Details</Text>

        <View className="flex-row justify-between py-2 border-b border-neutral-800">
          <Text className="text-neutral-400">Username</Text>
          <Text className="text-white">{user?.username}</Text>
        </View>

        <View className="flex-row justify-between py-2 border-b border-neutral-800">
          <Text className="text-neutral-400">Role</Text>
          <Text className="text-white capitalize">{user?.role?.replace('_', ' ')}</Text>
        </View>

        <View className="flex-row justify-between py-2 border-b border-neutral-800">
          <Text className="text-neutral-400">2FA</Text>
          <Text className={user?.twoFactorEnabled ? 'text-green-400' : 'text-neutral-500'}>
            {user?.twoFactorEnabled ? 'Enabled' : 'Disabled'}
          </Text>
        </View>

        <View className="flex-row justify-between py-2">
          <Text className="text-neutral-400">Verified</Text>
          <Text className={user?.verified ? 'text-green-400' : 'text-yellow-400'}>
            {user?.verified ? 'Yes' : 'No'}
          </Text>
        </View>
      </View>

      {/* Placeholder for future content */}
      <View className="flex-1 items-center justify-center">
        <Text className="text-neutral-600 text-center">
          Game features coming soon...{'\n'}
          Stage 08 Complete
        </Text>
      </View>

      {/* Logout Button */}
      <TouchableOpacity
        onPress={handleLogout}
        className="bg-red-500/20 border border-red-500/50 rounded-lg py-3 items-center"
      >
        <Text className="text-red-400 font-medium">Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}
```

### Update Root Layout

```tsx
// app/_layout.tsx
import { Stack } from 'expo-router';
import { AuthProvider } from '../contexts/AuthContext';
import "../global.css";

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="magic-link" />
        <Stack.Screen name="two-factor" />
        <Stack.Screen name="(authenticated)" />
      </Stack>
    </AuthProvider>
  );
}
```

---

## Database Changes

None

---

## Test Cases

| Test | Input | Expected Output |
|------|-------|-----------------|
| Direct /home access (logged out) | URL navigation | Redirect to /login |
| Direct /home access (logged in) | URL navigation | Shows home screen |
| Login success | Complete login flow | Arrives at home |
| Logout | Click sign out | Redirect to login |
| Token expiry | Token expires | Redirect to login on next action |
| App restart (logged in) | Close and reopen | Still on home |
| App restart (logged out) | Close and reopen | On login |

---

## Acceptance Checklist

- [ ] `(authenticated)` group protected by layout
- [ ] Unauthenticated access redirects to /login
- [ ] Authenticated access shows content
- [ ] Home screen displays user info
- [ ] Logout clears state and redirects
- [ ] Auth persists across app restart
- [ ] Works on iOS
- [ ] Works on Android
- [ ] Works on Web

---

## Deployment

```bash
npx expo start
# Full flow test:
# 1. Start app (should redirect to login)
# 2. Log in
# 3. Verify on home screen
# 4. Close app completely
# 5. Reopen - should still be on home
# 6. Log out
# 7. Try to access /home directly - should redirect to login
```

---

## Handoff Notes

**Migration complete!**

The basic auth flow now works:
- Login with password
- Login with magic link
- 2FA verification
- Protected routes
- Logout

**Next steps (outside this plan):**
- Add game features (map, buildings, etc.)
- Add settings page
- Add profile editing
- Style refinements
- App icons and splash screen
- Production deployment
