# Stage 03: Auth Context

## Objective

Port the AuthContext to React Native with async storage support.

---

## Dependencies

**Requires:** [See: Stage 02] API & Storage complete

---

## Complexity

**Medium** - Async initialization, state management

---

## Files to Create

| File | Purpose |
|------|---------|
| `contexts/AuthContext.tsx` | Auth state management |

---

## Files to Modify

| File | Changes |
|------|---------|
| `app/_layout.tsx` | Wrap with AuthProvider |

---

## Implementation Details

### Auth Context

```typescript
// contexts/AuthContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, apiHelpers, LoginResponse, User, Company, MagicLinkResponse } from '../services/api';
import { tokenStorage } from '../services/storage';

interface AuthContextType {
  // State
  user: User | null;
  company: Company | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  isInitialized: boolean;

  // Actions
  login: (email: string, password: string) => Promise<LoginResponse>;
  loginWithTwoFactor: (email: string, password: string, twoFactorToken: string) => Promise<LoginResponse>;
  requestMagicLink: (email: string) => Promise<MagicLinkResponse>;
  verifyMagicLinkCode: (email: string, code: string) => Promise<void>;
  request2FACode: (userId: string, email: string) => Promise<{ message: string }>;
  verify2FACode: (userId: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize auth state from storage on mount
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      const storedToken = await tokenStorage.getToken();

      if (!storedToken) {
        setIsInitialized(true);
        return;
      }

      setToken(storedToken);

      // Verify token with server
      const response = await api.get('/api/auth/me');
      const data = apiHelpers.handleResponse<{ user: User; company: Company }>(response);

      setUser(data.user);
      setCompany(data.company);
    } catch (error) {
      console.error('Auth initialization failed:', error);
      // Clear invalid token
      await tokenStorage.clearToken();
      setToken(null);
      setUser(null);
      setCompany(null);
    } finally {
      setIsInitialized(true);
    }
  };

  const login = async (email: string, password: string): Promise<LoginResponse> => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.post('/api/auth/login', { email, password });
      const data = apiHelpers.handleResponse<LoginResponse>(response);

      // Check if 2FA required
      if (data.requiresTwoFactor) {
        return data;
      }

      // Check if magic link required
      if (data.requiresMagicLink) {
        return data;
      }

      // Normal login success
      if (data.token && data.user) {
        await tokenStorage.setToken(data.token);
        setToken(data.token);
        setUser(data.user);
        if (data.company) {
          setCompany(data.company);
        }
      }

      return data;
    } catch (error: any) {
      const errorMessage = apiHelpers.handleError(error);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const loginWithTwoFactor = async (
    email: string,
    password: string,
    twoFactorToken: string
  ): Promise<LoginResponse> => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.post('/api/auth/login', {
        email,
        password,
        twoFactorToken,
      });
      const data = apiHelpers.handleResponse<LoginResponse>(response);

      if (data.token && data.user) {
        await tokenStorage.setToken(data.token);
        setToken(data.token);
        setUser(data.user);
        if (data.company) {
          setCompany(data.company);
        }
      }

      return data;
    } catch (error: any) {
      const errorMessage = apiHelpers.handleError(error);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const requestMagicLink = async (email: string): Promise<MagicLinkResponse> => {
    try {
      setError(null);

      const response = await api.post('/api/auth/magic-link/request', { email });
      return apiHelpers.handleResponse<MagicLinkResponse>(response);
    } catch (error: any) {
      const errorMessage = apiHelpers.handleError(error);
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const verifyMagicLinkCode = async (email: string, code: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.post('/api/auth/magic-link/verify-code', { email, code });
      const data = apiHelpers.handleResponse<LoginResponse>(response);

      if (data.token && data.user) {
        await tokenStorage.setToken(data.token);
        setToken(data.token);
        setUser(data.user);
        if (data.company) {
          setCompany(data.company);
        }
      }
    } catch (error: any) {
      const errorMessage = apiHelpers.handleError(error);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const request2FACode = async (userId: string, email: string): Promise<{ message: string }> => {
    try {
      setError(null);

      const response = await api.post('/api/auth/2fa/request', { userId, email });
      return apiHelpers.handleResponse<{ message: string }>(response);
    } catch (error: any) {
      const errorMessage = apiHelpers.handleError(error);
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const verify2FACode = async (userId: string, code: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.post('/api/auth/2fa/verify', { userId, code });
      const data = apiHelpers.handleResponse<LoginResponse>(response);

      if (data.token && data.user) {
        await tokenStorage.setToken(data.token);
        setToken(data.token);
        setUser(data.user);
        if (data.company) {
          setCompany(data.company);
        }
      }
    } catch (error: any) {
      const errorMessage = apiHelpers.handleError(error);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    await tokenStorage.clearToken();
    setToken(null);
    setUser(null);
    setCompany(null);
    setError(null);
  };

  const clearError = () => {
    setError(null);
  };

  const value: AuthContextType = {
    user,
    company,
    token,
    loading,
    error,
    isInitialized,
    login,
    loginWithTwoFactor,
    requestMagicLink,
    verifyMagicLinkCode,
    request2FACode,
    verify2FACode,
    logout,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
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
| Initial load (no token) | Fresh app start | isInitialized=true, user=null |
| Initial load (valid token) | Token in storage | user populated from /me |
| Initial load (invalid token) | Expired token | Token cleared, user=null |
| Login success | Valid credentials | Token stored, user set |
| Login 2FA required | 2FA user | Returns requiresTwoFactor |
| Login magic link required | Magic link user | Returns requiresMagicLink |
| Logout | Call logout() | Token cleared, user null |

---

## Acceptance Checklist

- [ ] AuthContext created with all methods
- [ ] AuthProvider wraps app in _layout.tsx
- [ ] Token loaded from storage on app start
- [ ] Token verified with /api/auth/me
- [ ] Invalid tokens cleared automatically
- [ ] Login stores token and sets user
- [ ] 2FA flow returns correct response
- [ ] Magic link flow returns correct response
- [ ] Logout clears all state
- [ ] isInitialized flag prevents premature redirects

---

## Deployment

```bash
npx expo start
# Test auth state persistence by:
# 1. Login
# 2. Close app
# 3. Reopen - should still be logged in
```

---

## Handoff Notes

**For Stage 04 (Login Screen):**
- `useAuth()` hook ready
- `login()` returns response with requiresTwoFactor/requiresMagicLink flags
- `isInitialized` - wait for this before showing login/home
- `loading` - for button states
- `error` - for error display

**Key difference from web:**
- `isInitialized` added because storage is async
- Must wait for initialization before routing decisions
