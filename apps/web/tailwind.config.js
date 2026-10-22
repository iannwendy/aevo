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
        'fade-in': 'fadeIn 0.35s cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-in': 'slideIn 0.3s cubic-bezier(0.22, 1, 0.36, 1) both',
        'scale-in': 'scaleIn 0.25s cubic-bezier(0.22, 1, 0.36, 1) both',
        'page-enter': 'pageEnter 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
        'hero-reveal': 'heroReveal 0.55s cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-down': 'slideDown 0.28s cubic-bezier(0.22, 1, 0.36, 1) both',
        float: 'floatSlow 5s ease-in-out infinite',
        'badge-pop': 'badgePop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        shimmer: 'shimmer 2.2s linear infinite',
        'progress-sweep': 'progressSweep 0.65s cubic-bezier(0.22, 1, 0.36, 1) forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(100%)', opacity: '0.6' },
          '100%': { transform: 'none', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'none', opacity: '1' },
        },
        pageEnter: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'none' },
        },
        heroReveal: {
          '0%': { opacity: '0', transform: 'translateY(18px) scale(0.99)' },
          '100%': { opacity: '1', transform: 'none' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'none' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'none' },
        },
        floatSlow: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        badgePop: {
          '0%': { transform: 'scale(0.75)', opacity: '0.5' },
          '60%': { transform: 'scale(1.14)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        progressSweep: {
          '0%': { transform: 'scaleX(0)', opacity: '1' },
          '75%': { transform: 'scaleX(0.92)', opacity: '1' },
          '100%': { transform: 'scaleX(1)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};
