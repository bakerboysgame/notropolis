/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        // Primary Green - Notropolis brand color
        primary: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',  // Main brand green
          600: '#059669',
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
        },
        // Neutral grays for dark theme
        neutral: {
          0: '#FFFFFF',
          50: '#FAFAFA',
          100: '#F5F5F5',
          200: '#E5E5E5',
          300: '#D4D4D4',
          400: '#A3A3A3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
          950: '#0A0A0A',
        },
        // Game-specific colors
        game: {
          cash: '#10B981',
          offshore: '#6366F1',
          prison: '#EF4444',
          hospital: '#F59E0B',
          level: '#8B5CF6',
        },
      },
      backgroundColor: {
        'dark-primary': '#0A0A0A',
        'dark-secondary': '#171717',
        'dark-elevated': '#262626',
      },
      textColor: {
        'dark-primary': '#FFFFFF',
        'dark-secondary': '#A3A3A3',
        'dark-muted': '#525252',
      },
      borderColor: {
        'dark-default': '#262626',
        'dark-focus': '#10B981',
      },
      boxShadow: {
        'glow': '0 0 20px rgba(16, 185, 129, 0.3)',
        'glow-strong': '0 0 30px rgba(16, 185, 129, 0.5)',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
        'gradient-dark': 'linear-gradient(180deg, #171717 0%, #0A0A0A 100%)',
        'gradient-glow': 'radial-gradient(circle at center, rgba(16, 185, 129, 0.15) 0%, transparent 70%)',
      },
    },
  },
  plugins: [],
}
