/**
 * AEVO Adaptive Dark Mode — Semantic Theme Tokens & Recharts / Admin Primitives
 * Reference: docs/darkmode.md Sections 2, 3 & 6.3
 */

export const LIGHT_THEME_TOKENS = {
  bg: '#F5F5F3',
  surface: '#FFFFFF',
  surfaceMuted: '#F0F0EE',
  text: '#171717',
  textMuted: '#737373',
  border: '#E5E5E3',
  primary: '#171717',
  primaryForeground: '#FFFFFF',
  accent: '#52665C',
  focus: '#52665C',
  danger: '#B42318',
  success: '#237A4B',
  warning: '#946200',
};

export const DARK_THEME_TOKENS = {
  bg: '#111214',
  surface: '#1C1D20',
  surfaceMuted: '#25262A',
  text: '#F5F5F3',
  textMuted: '#A3A7AD',
  border: '#333438',
  primary: '#F5F5F3',
  primaryForeground: '#171717',
  accent: '#9DB7A5',
  focus: '#A9C4B3',
  danger: '#FF8A80',
  success: '#70D8A0',
  warning: '#F0C674',
};

export function getThemeTokens(resolvedTheme = 'light') {
  return resolvedTheme === 'dark' ? DARK_THEME_TOKENS : LIGHT_THEME_TOKENS;
}

/**
 * Returns Recharts-compatible configuration objects for axes, grid lines,
 * tooltips, legends, and data series in Light or Dark mode.
 */
export function getChartTheme(resolvedTheme = 'light') {
  const isDark = resolvedTheme === 'dark';
  const tokens = getThemeTokens(resolvedTheme);

  return {
    isDark,
    tokens,
    cartesianGrid: {
      stroke: tokens.border,
      strokeDasharray: '3 3',
      vertical: false,
    },
    axis: {
      stroke: tokens.textMuted,
      tick: {
        fill: tokens.textMuted,
        fontSize: 12,
        fontFamily: 'var(--font-mono), monospace',
      },
      axisLine: {
        stroke: tokens.border,
      },
      tickLine: {
        stroke: tokens.border,
      },
    },
    tooltip: {
      contentStyle: {
        backgroundColor: tokens.surface,
        borderColor: tokens.border,
        color: tokens.text,
        borderRadius: '12px',
        boxShadow: 'none',
      },
      labelStyle: {
        color: tokens.textMuted,
        fontFamily: 'var(--font-mono), monospace',
        fontSize: '12px',
      },
      itemStyle: {
        color: tokens.text,
        fontSize: '13px',
      },
      cursor: {
        fill: tokens.surfaceMuted,
        opacity: isDark ? 0.45 : 0.6,
      },
    },
    series: {
      primary: tokens.primary,
      accent: tokens.accent,
      muted: tokens.textMuted,
      success: tokens.success,
      warning: tokens.warning,
      danger: tokens.danger,
    },
    table: {
      containerClass: 'bg-surface border border-border rounded-card overflow-hidden',
      headerRowClass: 'border-b border-border bg-surface-muted text-secondary font-mono text-caption uppercase',
      bodyRowClass: 'border-b border-border/60 hover:bg-surface-muted transition-colors',
      monoCellClass: 'font-mono text-ink tabular-nums',
    },
  };
}
