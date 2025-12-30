// Environment configuration for Multi-Tenant SaaS Dashboard Template
// Update these values for your specific application
export const config = {
  // API Configuration
  // In production, set VITE_API_BASE_URL in your environment
  API_BASE_URL: (import.meta as any).env?.VITE_API_BASE_URL || 'https://api.your-domain.com',

  // Application Configuration
  // Customize these for your application
  APP_NAME: (import.meta as any).env?.VITE_APP_NAME || 'Your App',
  APP_VERSION: (import.meta as any).env?.VITE_APP_VERSION || '1.0.0',
  APP_DESCRIPTION: (import.meta as any).env?.VITE_APP_DESCRIPTION || 'Multi-tenant SaaS Dashboard',

  // Environment
  ENVIRONMENT: (import.meta as any).env?.VITE_ENVIRONMENT || 'development',

  // Feature flags - Enable/disable features for your deployment
  FEATURES: {
    MAGIC_LINK: true,           // Passwordless login via email
    TWO_FACTOR: true,           // Email-based 2FA (mandatory for password login)
    TOTP: true,                 // Optional authenticator app 2FA
    COMPANY_MANAGEMENT: true,   // Multi-tenant company management
    AUDIT_LOGGING: true,        // Comprehensive audit logging
    ROLE_MANAGEMENT: true,      // Custom role and page access management
  },

  // Brand colors - Customize for your brand
  COLORS: {
    PRIMARY: '#0194F9',  // Main brand color
    WHITE: '#FFFFFF',
    GRAY: '#666666',
  }
} as const;
