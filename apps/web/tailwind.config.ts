import type { Config } from 'tailwindcss';

/**
 * Design System officiel (PRD Volume 2) : clair par défaut (blanc/beige/or),
 * mode sombre dédié via la classe `dark`. Les couleurs passent par des
 * variables CSS (globals.css) pour que chaque composant soit bi-thème
 * sans dupliquer ses classes.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--c-bg)', // fond principal
        soft: 'var(--c-soft)', // sections secondaires (beige / bleu nuit)
        surface: 'var(--c-surface)', // cartes
        line: 'var(--c-line)', // bordures et séparateurs
        ink: 'var(--c-ink)', // texte principal
        muted: 'var(--c-muted)', // texte secondaire
        gold: {
          DEFAULT: '#D4AF37',
          600: '#B8962C', // hover
          soft: 'var(--c-gold-soft)', // fonds dorés discrets
        },
        success: '#22C55E',
        danger: '#EF4444',
        info: '#2563EB',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        btn: '12px', // boutons (Vol 2 §6)
        card: '20px', // cartes (Vol 2 §7)
      },
      boxShadow: {
        card: '0 2px 12px rgba(18, 18, 18, 0.06)',
        'card-hover': '0 8px 24px rgba(18, 18, 18, 0.10)',
        btn: '0 1px 4px rgba(18, 18, 18, 0.12)',
      },
    },
  },
  plugins: [],
};

export default config;
