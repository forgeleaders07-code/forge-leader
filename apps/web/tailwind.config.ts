import type { Config } from 'tailwindcss';

/**
 * Identité visuelle "La Forge" : fond charbon profond, accents braise/or.
 * Premium, sombre, lisible sur mobile (PRD §7 Accessibilité).
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        forge: {
          950: '#0a0a0c',
          900: '#121216',
          800: '#1c1c22',
          700: '#2a2a33',
          500: '#55555f',
          300: '#a3a3ad',
          100: '#e7e7ec',
        },
        ember: {
          600: '#d97706',
          500: '#f59e0b',
          400: '#fbbf24',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
