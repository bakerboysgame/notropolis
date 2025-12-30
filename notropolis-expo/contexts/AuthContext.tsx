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
    } catch (err) {
      console.error('Auth initialization failed:', err);
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
    } catch (err: unknown) {
      const errorMessage = apiHelpers.handleError(err);
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
    } catch (err: unknown) {
      const errorMessage = apiHelpers.handleError(err);
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
    } catch (err: unknown) {
      const errorMessage = apiHelpers.handleError(err);
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
    } catch (err: unknown) {
      const errorMessage = apiHelpers.handleError(err);
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
    } catch (err: unknown) {
      const errorMessage = apiHelpers.handleError(err);
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
    } catch (err: unknown) {
      const errorMessage = apiHelpers.handleError(err);
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
