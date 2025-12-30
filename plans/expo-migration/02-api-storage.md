# Stage 02: API & Storage

## Objective

Port the API client and create a storage abstraction that works on iOS, Android, and Web.

---

## Dependencies

**Requires:** [See: Stage 01] Project setup complete

---

## Complexity

**Low** - Direct port with minor changes

---

## Files to Create

| File | Purpose |
|------|---------|
| `services/storage.ts` | Secure storage abstraction |
| `services/api.ts` | API client (ported from web) |
| `config/environment.ts` | Environment configuration |

---

## Implementation Details

### 1. Storage Abstraction

```typescript
// services/storage.ts
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// SecureStore doesn't work on web, so we fall back to localStorage
const isWeb = Platform.OS === 'web';

export const storage = {
  async getItem(key: string): Promise<string | null> {
    if (isWeb) {
      return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    if (isWeb) {
      localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },

  async removeItem(key: string): Promise<void> {
    if (isWeb) {
      localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

// Convenience methods for auth token
export const tokenStorage = {
  async getToken(): Promise<string | null> {
    return storage.getItem('auth_token');
  },

  async setToken(token: string): Promise<void> {
    return storage.setItem('auth_token', token);
  },

  async clearToken(): Promise<void> {
    return storage.removeItem('auth_token');
  },
};
```

### 2. Environment Config

```typescript
// config/environment.ts
export const config = {
  // Notropolis API (same for dev and prod - backend handles CORS)
  API_BASE_URL: 'https://api.notropolis.net',
};
```

### 3. API Client

```typescript
// services/api.ts
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { config } from '../config/environment';
import { tokenStorage } from './storage';
import { router } from 'expo-router';

// Create axios instance
export const api: AxiosInstance = axios.create({
  baseURL: config.API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request interceptor - add auth token
api.interceptors.request.use(
  async (config) => {
    const token = await tokenStorage.getToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle 401
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await tokenStorage.clearToken();
      // Navigate to login
      router.replace('/login');
    }
    return Promise.reject(error);
  }
);

// Types (same as web)
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface LoginResponse {
  token?: string;
  user?: User;
  company?: Company;
  requiresTwoFactor?: boolean;
  requiresMagicLink?: boolean;
  userId?: string;
  email?: string;
  message?: string;
}

export interface User {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  companyId: string;
  companyName?: string;
  role: 'master_admin' | 'admin' | 'analyst' | 'viewer' | 'user';
  isActive: boolean;
  verified: boolean;
  twoFactorEnabled: boolean;
  magicLinkEnabled: boolean;
  phiAccessLevel: 'none' | 'limited' | 'full';
  dataClassification: 'public' | 'internal' | 'confidential' | 'restricted';
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Company {
  id: string;
  name: string;
  domain?: string;
  adminUserId?: string;
  isActive: boolean;
  dataRetentionDays: number;
  hipaaCompliant: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MagicLinkResponse {
  message: string;
}

// API helpers
export const apiHelpers = {
  handleResponse: <T>(response: AxiosResponse<ApiResponse<T>>): T => {
    if (response.data.success) {
      return response.data.data as T;
    }
    throw new Error(response.data.error || 'API request failed');
  },

  handleError: (error: any): string => {
    if (error.response?.data?.error) {
      return error.response.data.error;
    }
    if (error.message) {
      return error.message;
    }
    return 'An unexpected error occurred';
  },
};
```

---

## Database Changes

None

---

## Test Cases

| Test | Input | Expected Output |
|------|-------|-----------------|
| Set token | `tokenStorage.setToken('abc123')` | Token stored |
| Get token | `tokenStorage.getToken()` | Returns 'abc123' |
| Clear token | `tokenStorage.clearToken()` | Token removed |
| API call without token | `api.get('/api/health')` | No auth header |
| API call with token | After setToken | Auth header included |
| 401 response | Expired token | Redirects to /login |

---

## Acceptance Checklist

- [ ] `storage.ts` created with SecureStore/localStorage abstraction
- [ ] `api.ts` created with axios instance
- [ ] Token interceptor adds Authorization header
- [ ] 401 interceptor clears token and redirects
- [ ] Types match existing web types
- [ ] Works on iOS (SecureStore)
- [ ] Works on web (localStorage fallback)

---

## Deployment

```bash
# Test in dev
npx expo start

# Verify no TypeScript errors
npx tsc --noEmit
```

---

## Handoff Notes

**For Stage 03 (Auth Context):**
- `tokenStorage` ready for auth state persistence
- `api` client ready with interceptors
- Types defined: `User`, `Company`, `LoginResponse`
- `apiHelpers.handleResponse` and `handleError` ready

**Key difference from web:**
- Storage is async (must `await`)
- Token loading happens asynchronously on app start
