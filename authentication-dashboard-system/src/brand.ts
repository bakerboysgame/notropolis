/**
 * Notropolis Brand Guidelines
 *
 * Brand Colors: Green, Black, White
 *
 * This file serves as the single source of truth for all brand-related
 * values used throughout the Notropolis application.
 */

export const brand = {
  name: 'Notropolis',
  tagline: 'Build your empire',

  colors: {
    // Primary Green - Main brand color for CTAs, links, and accents
    primary: {
      50: '#ECFDF5',   // Very light green - subtle backgrounds
      100: '#D1FAE5',  // Light green - hover backgrounds
      200: '#A7F3D0',  // Soft green - disabled states
      300: '#6EE7B7',  // Medium light - borders
      400: '#34D399',  // Bright green - hover states
      500: '#10B981',  // Emerald - PRIMARY BRAND COLOR
      600: '#059669',  // Dark green - pressed states
      700: '#047857',  // Darker green - text on light bg
      800: '#065F46',  // Very dark green - headings
      900: '#064E3B',  // Deepest green - emphasis
    },

    // Neutral - Blacks, grays, and whites for backgrounds and text
    neutral: {
      0: '#FFFFFF',    // Pure white - primary text on dark
      50: '#FAFAFA',   // Off-white - secondary text on dark
      100: '#F5F5F5',  // Light gray - tertiary text on dark
      200: '#E5E5E5',  // Border on light mode
      300: '#D4D4D4',  // Disabled text
      400: '#A3A3A3',  // Muted text
      500: '#737373',  // Secondary text on light
      600: '#525252',  // Primary text on light
      700: '#404040',  // Borders on dark
      800: '#262626',  // Elevated surfaces (cards, modals)
      900: '#171717',  // Secondary background
      950: '#0A0A0A',  // Primary background
    },

    // Semantic colors for feedback and states
    semantic: {
      success: '#10B981',  // Same as primary-500
      warning: '#F59E0B',  // Amber
      error: '#EF4444',    // Red
      info: '#3B82F6',     // Blue
    },

    // Game-specific colors
    game: {
      cash: '#10B981',      // Green for money
      offshore: '#6366F1',  // Indigo for offshore accounts
      prison: '#EF4444',    // Red for prison status
      hospital: '#F59E0B',  // Amber for hospital status
      level: '#8B5CF6',     // Purple for XP/levels
    },
  },

  // CSS custom properties for easy use
  cssVariables: {
    '--color-primary': '#10B981',
    '--color-primary-light': '#34D399',
    '--color-primary-dark': '#059669',
    '--color-bg-primary': '#0A0A0A',
    '--color-bg-secondary': '#171717',
    '--color-bg-elevated': '#262626',
    '--color-text-primary': '#FFFFFF',
    '--color-text-secondary': '#A3A3A3',
    '--color-text-muted': '#525252',
    '--color-border': '#262626',
    '--color-border-focus': '#10B981',
  },

  // Typography
  fonts: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
    mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
  },

  // Border radius values
  radius: {
    sm: '0.25rem',   // 4px
    md: '0.5rem',    // 8px
    lg: '0.75rem',   // 12px
    xl: '1rem',      // 16px
    full: '9999px',  // Pill shape
  },

  // Common gradients
  gradients: {
    primary: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    dark: 'linear-gradient(180deg, #171717 0%, #0A0A0A 100%)',
    glow: 'radial-gradient(circle at center, rgba(16, 185, 129, 0.15) 0%, transparent 70%)',
  },

  // Box shadows
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.5)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
    glow: '0 0 20px rgba(16, 185, 129, 0.3)',
    glowStrong: '0 0 30px rgba(16, 185, 129, 0.5)',
  },
} as const;

// Type exports for TypeScript usage
export type BrandColors = typeof brand.colors;
export type PrimaryColor = keyof typeof brand.colors.primary;
export type NeutralColor = keyof typeof brand.colors.neutral;

// Helper function to get CSS variable string
export function getCssVar(name: keyof typeof brand.cssVariables): string {
  return brand.cssVariables[name];
}

// Default export
export default brand;
