import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { config } from '../config/environment';

// Create axios instance with base configuration
export const api: AxiosInstance = axios.create({
  baseURL: config.API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem('token');
      delete api.defaults.headers.common['Authorization'];
      
      // Only redirect if we're not already on the login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

// API endpoints
export const endpoints = {
  // Authentication
  auth: {
    login: '/api/auth/login',
    logout: '/api/auth/logout',
    me: '/api/auth/me',
    magicLinkRequest: '/api/auth/magic-link/request',
    magicLinkVerify: '/api/auth/magic-link/verify',
    magicLink: '/api/auth/magic-link',
    passwordResetRequest: '/api/auth/password-reset/request',
    verificationRequest: '/api/auth/verification/request',
  },
  
  // Company management
  companies: {
    list: '/api/companies',
    create: '/api/companies',
    get: (id: string) => `/api/companies/${id}`,
    update: (id: string) => `/api/companies/${id}`,
    delete: (id: string) => `/api/companies/${id}`,
  },
  
  // User management
  users: {
    list: '/api/users',
    get: (id: string) => `/api/users/${id}`,
    update: (id: string) => `/api/users/${id}`,
    delete: (id: string) => `/api/users/${id}`,
  },
  
  // Permissions
  permissions: {
    getUserPermissions: (userId: string) => `/api/permissions/${userId}`,
    updateUserPermissions: (userId: string) => `/api/permissions/${userId}`,
  },
  
  // Audit logs
  audit: {
    list: '/api/audit',
    get: (id: string) => `/api/audit/${id}`,
  },
  
  // Health check
  health: '/api/health',

  // Game - Land & Buildings
  game: {
    land: {
      buy: '/api/game/land/buy',
    },
    buildings: {
      types: '/api/game/buildings/types',
      build: '/api/game/buildings/build',
      previewProfit: '/api/game/buildings/preview-profit',
    },
  },
} as const;

// API response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Authentication types
export interface LoginRequest {
  email: string;
  password: string;
  twoFactorToken?: string;
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
  companyName?: string; // From JOIN in user management
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
  deletedAt?: string | null; // For archived users
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

export interface MagicLinkRequest {
  email: string;
}

export interface MagicLinkResponse {
  message: string;
}

// Custom Role types
export interface CustomRole {
  id?: string;
  role_name: string;
  display_name: string;
  description?: string;
  base_permissions?: string[];
  is_builtin: boolean;
  user_count?: number;
  assigned_pages?: string[];
  page_count?: number;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface RolesResponse {
  builtin_roles: CustomRole[];
  custom_roles: CustomRole[];
  all_roles: CustomRole[];
}

// User Permission types
export interface UserPermission {
  id: string;
  permission: string;
  resource?: string;
  granted_by?: string;
  grantor_email?: string;
  granted_at: string;
  expires_at?: string;
  is_expired?: boolean;
}

export interface UserPermissionsResponse {
  user_id: string;
  user_email: string;
  user_role: string;
  permissions: UserPermission[];
  active_permissions: UserPermission[];
}

// API helper functions
export const apiHelpers = {
  // Handle API responses
  handleResponse: <T>(response: AxiosResponse<ApiResponse<T>>): T => {
    if (response.data.success) {
      return response.data.data as T;
    }
    throw new Error(response.data.error || 'API request failed');
  },
  
  // Handle API errors
  handleError: (error: any): string => {
    if (error.response?.data?.error) {
      return error.response.data.error;
    }
    if (error.message) {
      return error.message;
    }
    return 'An unexpected error occurred';
  },
  
  // Check if user is authenticated
  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('token');
  },
  
  // Get stored token
  getToken: (): string | null => {
    return localStorage.getItem('token');
  },
  
  // Set token
  setToken: (token: string): void => {
    localStorage.setItem('token', token);
  },
  
  // Clear token
  clearToken: (): void => {
    localStorage.removeItem('token');
  },
};

// Game types
export interface BuildingType {
  id: string;
  name: string;
  cost: number;
  base_profit: number;
  level_required: number;
  requires_license: boolean;
  adjacency_bonuses: string | Record<string, number>;
  adjacency_penalties: string | Record<string, number>;
  max_per_map: number | null;
  licenses_used?: number;
  licenses_remaining?: number;
}

export interface AdjacencyModifier {
  source: string;
  modifier: number;
}

export interface ProfitPreviewResponse {
  base_profit: number;
  final_profit: number;
  total_modifier: number;
  breakdown: AdjacencyModifier[];
}

export interface BuyLandRequest {
  company_id: string;
  tile_x: number;
  tile_y: number;
}

export interface BuyLandResponse {
  cost: number;
  remaining_cash: number;
  tile: any;
}

export interface BuildBuildingRequest {
  company_id: string;
  tile_id: string;
  building_type_id: string;
  variant?: string; // Required for building types that have variants (shop, market_stall, high_street_store)
}

export interface BuildBuildingResponse {
  building_id: string;
  profit: number;
  breakdown: AdjacencyModifier[];
  value: number;
  value_breakdown: AdjacencyModifier[];
  affected_buildings: number;
  remaining_cash: number;
}
