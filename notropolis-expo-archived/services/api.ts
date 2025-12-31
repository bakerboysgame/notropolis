import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
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
  async (requestConfig: InternalAxiosRequestConfig) => {
    const token = await tokenStorage.getToken();
    if (token && requestConfig.headers) {
      requestConfig.headers.Authorization = `Bearer ${token}`;
    }
    return requestConfig;
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

// Types
export interface ApiResponse<T = unknown> {
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

  handleError: (error: unknown): string => {
    if (error && typeof error === 'object') {
      const axiosError = error as { response?: { data?: { error?: string } }; message?: string };
      if (axiosError.response?.data?.error) {
        return axiosError.response.data.error;
      }
      if (axiosError.message) {
        return axiosError.message;
      }
    }
    return 'An unexpected error occurred';
  },
};

// API endpoints (for reference)
export const endpoints = {
  auth: {
    login: '/api/auth/login',
    logout: '/api/auth/logout',
    me: '/api/auth/me',
    magicLinkRequest: '/api/auth/magic-link/request',
    magicLinkVerify: '/api/auth/magic-link/verify',
    magicLinkVerifyCode: '/api/auth/magic-link/verify-code',
    passwordResetRequest: '/api/auth/password-reset/request',
  },
  health: '/api/health',
} as const;
