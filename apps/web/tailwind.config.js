/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // AEVO Adaptive Semantic Tokens (Light default + Dark optional)
        canvas: 'rgb(var(--aevo-bg-rgb) / <alpha-value>)',
        bg: 'rgb(var(--aevo-bg-rgb) / <alpha-value>)',
        surface: 'rgb(var(--aevo-surface-rgb) / <alpha-value>)',
        'surface-muted': 'rgb(var(--aevo-surface-muted-rgb) / <alpha-value>)',
        ink: 'rgb(var(--aevo-text-rgb) / <alpha-value>)',
        'text-main': 'rgb(var(--aevo-text-rgb) / <alpha-value>)',
        secondary: 'rgb(var(--aevo-text-muted-rgb) / <alpha-value>)',
        'text-muted': 'rgb(var(--aevo-text-muted-rgb) / <alpha-value>)',
        border: 'rgb(var(--aevo-border-rgb) / <alpha-value>)',
        primary: 'rgb(var(--aevo-primary-rgb) / <alpha-value>)',
        'primary-foreground': 'rgb(var(--aevo-primary-fg-rgb) / <alpha-value>)',
        sage: 'rgb(var(--aevo-accent-rgb) / <alpha-value>)',
        accent: 'rgb(var(--aevo-accent-rgb) / <alpha-value>)',
        focus: 'rgb(var(--aevo-focus-rgb) / <alpha-value>)',
        danger: 'rgb(var(--aevo-danger-rgb) / <alpha-value>)',
        success: 'rgb(var(--aevo-success-rgb) / <alpha-value>)',
        warning: 'rgb(var(--aevo-warning-rgb) / <alpha-value>)',
        // Static AEVO Brand Palette References
        titanium: '#A3A7AD',
        obsidian: '#171717',
        porcelain: '#F5F5F3',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Geist', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'monospace'],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      borderRadius: {
        '4xl': '2rem',
        card: '1rem',
        pill: '9999px',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-in': 'slideIn 0.28s ease-out',
        'scale-in': 'scaleIn 0.22s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
