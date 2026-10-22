'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useI18n } from '../lib/i18n';

const THEME_OPTIONS = [
  { value: 'light', labelKey: 'header.themeLight', Icon: Sun },
  { value: 'dark', labelKey: 'header.themeDark', Icon: Moon },
  { value: 'system', labelKey: 'header.themeSystem', Icon: Monitor },
];

export function ThemeSwitcher({ className = '', compact = false, fullWidth = false }) {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // AEVO default rule: Light Mode is the default when no prior selection exists.
  const activeTheme = mounted ? theme || 'light' : 'light';

  return (
    <fieldset
      role="group"
      aria-label={t('header.themeSwitcherAria')}
      data-testid="theme-switcher"
      className={`${
        fullWidth ? 'grid grid-cols-3 w-full' : 'inline-flex items-center'
      } gap-1 rounded-xl border border-border bg-canvas p-1 m-0 min-w-0 ${className}`}
    >
      {THEME_OPTIONS.map(({ value, labelKey, Icon }) => {
        const isSelected = activeTheme === value;
        const label = t(labelKey);
        return (
          <button
            key={value}
            type="button"
            aria-pressed={isSelected}
            aria-label={label}
            title={label}
            data-testid={`theme-btn-${value}`}
            onClick={() => setTheme(value)}
            className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-medium tracking-wider transition-all duration-200 active:scale-95 focus-ring ${
              isSelected
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-secondary hover:text-ink hover:bg-surface/60'
            }`}
          >
            <Icon
              size={13}
              aria-hidden="true"
              className={`transition-transform duration-200 ${isSelected ? 'scale-110' : ''}`}
            />
            <span className={compact ? 'sr-only' : fullWidth ? 'inline' : 'hidden sm:inline'}>
              {label}
            </span>
          </button>
        );
      })}
    </fieldset>
  );
}

export default ThemeSwitcher;
