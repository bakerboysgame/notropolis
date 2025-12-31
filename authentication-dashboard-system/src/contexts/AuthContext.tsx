import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, apiHelpers, LoginResponse, User, Company, MagicLinkResponse } from '../services/api';

// Auth context types
interface AuthContextType {
  // State
  user: User | null;
  company: Company | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  login: (email: string, password: string) => Promise<LoginResponse>;
  loginWithTwoFactor: (email: string, password: string, twoFactorToken: string) => Promise<LoginResponse>;
  requestMagicLink: (email: string) => Promise<MagicLinkResponse>;
  verifyMagicLink: (token: string) => Promise<LoginResponse>;
  verifyMagicLinkCode: (email: string, code: string) => Promise<void>;
  request2FACode: (userId: string, email: string) => Promise<{ message: string }>;
  verify2FACode: (userId: string, code: string) => Promise<void>;
  setAuthenticating: (value: boolean) => void;
  logout: () => void;
  signup: (data: SignupData) => Promise<LoginResponse>;
  forgotPassword: (email: string) => Promise<{ message: string }>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
  // TOTP methods
  setupTOTP: () => Promise<{ secret: string; qrCode: string; recoveryCodes: string[] }>;
  verifyTOTPSetup: (code: string) => Promise<void>;
  disableTOTP: () => Promise<void>;
  getTOTPStatus: () => Promise<{ enabled: boolean; recoveryCodesRemaining: number }>;
}

interface SignupData {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
}

// Create context
const AuthContext = createContext<AuthContextType | null>(null);

// Auth provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [token, setToken] = useState<string | null>(apiHelpers.getToken());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      console.log('initializeAuth called - token:', !!token, 'isAuthenticating:', isAuthenticating);
      
      if (!token) {
        setLoading(false);
        return;
      }

      // Don't verify token if we're in the middle of authentication
      if (isAuthenticating) {
        console.log('Skipping auth verification - authentication in progress');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await api.get('/api/auth/me');
        const data = apiHelpers.handleResponse<{ user: User; company: Company }>(response);
        setUser(data.user);
        setCompany(data.company);
        setError(null);
      } catch (error) {
        console.error('Failed to fetch user:', error);
        // Clear auth on failure
        setUser(null);
        setCompany(null);
        setToken(null);
        apiHelpers.clearToken();
        setError(apiHelpers.handleError(error));
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, [token, isAuthenticating]);

  // Login function
  const login = async (email: string, password: string): Promise<LoginResponse> => {
    try {
      console.log('login: Starting login process');
      setLoading(true);
      setError(null);
      
      const response = await api.post('/api/auth/login', { email, password });
      const data = apiHelpers.handleResponse<LoginResponse>(response);
      
      if (data.requiresTwoFactor) {
        console.log('login: 2FA required, NOT setting isAuthenticating here');
        // Don't set isAuthenticating here - it causes LoginForm to remount
        // LoginForm will set it after updating its own state
        setLoading(false); // Stop loading spinner for login form
        return data;
      }
      
      if (data.requiresMagicLink) {
        console.log('login: Magic link required');
        setLoading(false); // Stop loading spinner for login form
        return data;
      }
      
      // Normal login success
      if (data.token && data.user) {
        apiHelpers.setToken(data.token);
        setToken(data.token);
        setUser(data.user);
        if (data.company) {
          setCompany(data.company);
        }
      }
      
      return data;
    } catch (error) {
      const errorMessage = apiHelpers.handleError(error);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Login with two-factor authentication
  const loginWithTwoFactor = async (email: string, password: string, twoFactorToken: string): Promise<LoginResponse> => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.post('/api/auth/login', { 
        email, 
        password, 
        twoFactorToken 
      });
      const data = apiHelpers.handleResponse<LoginResponse>(response);
      
      if (data.token && data.user) {
        apiHelpers.setToken(data.token);
        setToken(data.token);
        setUser(data.user);
        if (data.company) {
          setCompany(data.company);
        }
      }
      
      return data;
    } catch (error) {
      const errorMessage = apiHelpers.handleError(error);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Request magic link
  const requestMagicLink = async (email: string): Promise<MagicLinkResponse> => {
    try {
      console.log('requestMagicLink: Setting isAuthenticating to true');
      setIsAuthenticating(true);
      // Don't set loading here - it causes LoginPage to unmount LoginForm
      setError(null);
      
      const response = await api.post('/api/auth/magic-link/request', { email });
      const result = apiHelpers.handleResponse<MagicLinkResponse>(response);
      console.log('requestMagicLink: Success, isAuthenticating should be true');
      return result;
    } catch (error) {
      console.log('requestMagicLink: Error, setting isAuthenticating to false');
      const errorMessage = apiHelpers.handleError(error);
      setError(errorMessage);
      setIsAuthenticating(false);
      throw new Error(errorMessage);
    }
  };

  // Verify magic link
  const verifyMagicLink = async (token: string): Promise<LoginResponse> => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.post('/api/auth/magic-link/verify', { token });
      const data = apiHelpers.handleResponse<LoginResponse>(response);
      
      if (data.token && data.user) {
        apiHelpers.setToken(data.token);
        setToken(data.token);
        setUser(data.user);
        if (data.company) {
          setCompany(data.company);
        }
      }
      
      return data;
    } catch (error) {
      const errorMessage = apiHelpers.handleError(error);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Verify magic link code
  const verifyMagicLinkCode = async (email: string, code: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.post('/api/auth/magic-link/verify-code', { email, code });
      const data = apiHelpers.handleResponse<LoginResponse>(response);
      
      if (data.token && data.user) {
        apiHelpers.setToken(data.token);
        setToken(data.token);
        setUser(data.user);
        if (data.company) {
          setCompany(data.company);
        }
        setIsAuthenticating(false);
      }
    } catch (error) {
      const errorMessage = apiHelpers.handleError(error);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Request 2FA code via email
  const request2FACode = async (userId: string, email: string): Promise<{ message: string }> => {
    try {
      setError(null);
      
      const response = await api.post('/api/auth/2fa/request', { userId, email });
      const result = apiHelpers.handleResponse<{ message: string }>(response);
      
      return result;
    } catch (error) {
      const errorMessage = apiHelpers.handleError(error);
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  // Verify 2FA code and complete login
  const verify2FACode = async (userId: string, code: string): Promise<void> => {
    try {
      console.log('verify2FACode: Starting verification');
      setLoading(true);
      setError(null);
      
      const response = await api.post('/api/auth/2fa/verify', { userId, code });
      const data = apiHelpers.handleResponse<LoginResponse>(response);
      
      if (data.token && data.user) {
        console.log('verify2FACode: Success, setting token and user, clearing isAuthenticating');
        apiHelpers.setToken(data.token);
        setToken(data.token);
        setUser(data.user);
        if (data.company) {
          setCompany(data.company);
        }
        setIsAuthenticating(false); // Clear authentication flag
      }
    } catch (error) {
      console.log('verify2FACode: Error, keeping isAuthenticating true');
      const errorMessage = apiHelpers.handleError(error);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    apiHelpers.clearToken();
    setToken(null);
    setUser(null);
    setCompany(null);
    setError(null);
  };

  // Signup function
  const signup = async (data: SignupData): Promise<LoginResponse> => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.post('/api/auth/signup', data);
      const result = apiHelpers.handleResponse<LoginResponse>(response);
      
      if (result.token && result.user) {
        apiHelpers.setToken(result.token);
        setToken(result.token);
        setUser(result.user);
        if (result.company) {
          setCompany(result.company);
        }
      }
      
      return result;
    } catch (error) {
      const errorMessage = apiHelpers.handleError(error);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Forgot password function
  const forgotPassword = async (email: string): Promise<{ message: string }> => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.post('/api/auth/password-reset/request', { email });
      return apiHelpers.handleResponse<{ message: string }>(response);
    } catch (error) {
      const errorMessage = apiHelpers.handleError(error);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Refresh user data
  const refreshUser = async (): Promise<void> => {
    if (!token) return;
    
    try {
      const response = await api.get('/api/auth/me');
      const data = apiHelpers.handleResponse<{ user: User; company: Company }>(response);
      setUser(data.user);
      setCompany(data.company);
    } catch (error) {
      console.error('Failed to refresh user:', error);
      logout();
    }
  };

  // Clear error
  const clearError = () => {
    setError(null);
  };

  // TOTP methods
  const setupTOTP = async (): Promise<{ secret: string; qrCode: string; recoveryCodes: string[] }> => {
    try {
      setError(null);
      const response = await api.post('/api/auth/totp/setup');
      const data = apiHelpers.handleResponse<{ secret: string; qrCode: string; recoveryCodes: string[] }>(response);
      return data;
    } catch (error) {
      const errorMessage = apiHelpers.handleError(error);
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const verifyTOTPSetup = async (code: string): Promise<void> => {
    try {
      setError(null);
      const response = await api.post('/api/auth/totp/verify-setup', { code });
      apiHelpers.handleResponse(response);
    } catch (error) {
      const errorMessage = apiHelpers.handleError(error);
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const disableTOTP = async (): Promise<void> => {
    try {
      setError(null);
      const response = await api.post('/api/auth/totp/disable');
      apiHelpers.handleResponse(response);
    } catch (error) {
      const errorMessage = apiHelpers.handleError(error);
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const getTOTPStatus = async (): Promise<{ enabled: boolean; recoveryCodesRemaining: number }> => {
    try {
      setError(null);
      const response = await api.get('/api/auth/totp/status');
      const data = apiHelpers.handleResponse<{ enabled: boolean; recoveryCodesRemaining: number }>(response);
      return data;
    } catch (error) {
      const errorMessage = apiHelpers.handleError(error);
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const value: AuthContextType = {
    user,
    company,
    token,
    loading,
    error,
    login,
    loginWithTwoFactor,
    requestMagicLink,
    verifyMagicLink,
    verifyMagicLinkCode,
    request2FACode,
    verify2FACode,
    setAuthenticating: setIsAuthenticating,
    logout,
    signup,
    forgotPassword,
    refreshUser,
    clearError,
    setupTOTP,
    verifyTOTPSetup,
    disableTOTP,
    getTOTPStatus,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
