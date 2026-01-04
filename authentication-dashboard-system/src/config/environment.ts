// Environment configuration for Notropolis Game Dashboard
// Update these values for your specific application

// Warn if API URL is not configured in production
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
if (!apiBaseUrl && import.meta.env.PROD) {
  console.warn('[Config] VITE_API_BASE_URL not set. Using fallback. Set this in your environment for production.');
}

export const config = {
  // API Configuration
  // In production, set VITE_API_BASE_URL in your environment
  API_BASE_URL: apiBaseUrl || 'https://api.notropolis.net',

  // Application Configuration
  // Customize these for your application
  APP_NAME: import.meta.env.VITE_APP_NAME || 'Notropolis',
  APP_VERSION: import.meta.env.VITE_APP_VERSION || '1.0.0',
  APP_DESCRIPTION: import.meta.env.VITE_APP_DESCRIPTION || 'Notropolis Game Dashboard',

  // Environment
  ENVIRONMENT: import.meta.env.VITE_ENVIRONMENT || 'development',

  // Feature flags - Enable/disable features for your deployment
  FEATURES: {
    MAGIC_LINK: true,           // Passwordless login via email
    TWO_FACTOR: true,           // 2FA support (optional - users can enable TOTP in settings)
    TOTP: true,                 // Optional authenticator app 2FA
    COMPANY_MANAGEMENT: true,   // Multi-tenant company management
    AUDIT_LOGGING: true,        // Comprehensive audit logging
    ROLE_MANAGEMENT: true,      // Custom role and page access management
  },

  // Brand colors - Customize for your brand
  COLORS: {
    PRIMARY: '#0194F9',  // Main brand color - update to Notropolis brand color if needed
    WHITE: '#FFFFFF',
    GRAY: '#666666',
  }
} as const;
