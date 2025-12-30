import { config } from '../config/environment';

/**
 * Hook to access feature flags
 * Feature flags can be toggled via the config/environment.ts file
 */
export function useFeatureFlags() {
  return {
    // Authentication features
    magicLinkEnabled: config.FEATURES.MAGIC_LINK,
    twoFactorEnabled: config.FEATURES.TWO_FACTOR,

    // Management features
    companyManagementEnabled: config.FEATURES.COMPANY_MANAGEMENT,
    auditLoggingEnabled: config.FEATURES.AUDIT_LOGGING,

    // Helper to check any feature
    isEnabled: (feature: keyof typeof config.FEATURES) => config.FEATURES[feature],
  };
}

// Export feature flags directly for non-hook usage (e.g., in API calls)
export const featureFlags = config.FEATURES;
