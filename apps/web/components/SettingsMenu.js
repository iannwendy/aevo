'use client';

import { useEffect, useRef, useState } from 'react';
import { SlidersHorizontal, SunMoon, Globe } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import ThemeSwitcher from './ThemeSwitcher';
import LanguageSwitcher from './LanguageSwitcher';

/**
 * Compact Settings / Preferences Popover Menu.
 * Groups Theme (Light / Dark / System) and Language (ENG / VIE) into a single
 * minimal icon trigger button on the Header and Auth pages.
 */
export default function SettingsMenu({ className = '' }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`} data-testid="settings-menu">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t('header.settingsMenuAria')}
        title={t('header.settingsMenuAria')}
        data-testid="settings-menu-trigger"
        className={`w-9 h-9 rounded-xl border transition-all duration-200 hover:-translate-y-0.5 active:scale-95 inline-flex items-center justify-center focus-ring ${
          open
            ? 'border-ink bg-surface-muted text-ink shadow-sm'
            : 'border-border bg-surface hover:bg-surface-muted text-secondary hover:text-ink'
        }`}
      >
        <SlidersHorizontal
          size={16}
          aria-hidden="true"
          className={`transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        />
      </button>

      <div
        role="dialog"
        aria-label={t('header.settingsMenuAria')}
        data-testid="settings-menu-panel"
        className={`absolute right-0 top-full mt-2 w-72 rounded-2xl border border-border bg-surface p-4 shadow-xl z-50 transition-all duration-200 ease-out origin-top-right ${
          open
            ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto visible'
            : 'opacity-0 scale-95 -translate-y-1 pointer-events-none invisible'
        }`}
      >
        {/* Theme Section */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-secondary">
            <SunMoon size={13} aria-hidden="true" />
            <span>{t('header.themeSwitcherAria')}</span>
          </div>
          <ThemeSwitcher fullWidth />
        </div>

        <div className="my-3.5 border-t border-border" />

        {/* Language Section */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-secondary">
            <Globe size={13} aria-hidden="true" />
            <span>{t('header.languageLabel')}</span>
          </div>
          <LanguageSwitcher fullWidth />
        </div>
      </div>
    </div>
  );
}
