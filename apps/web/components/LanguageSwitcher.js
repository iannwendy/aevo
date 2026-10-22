'use client';

import { useI18n } from '../lib/i18n';

export default function LanguageSwitcher({ className = '', fullWidth = false }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t('header.languageSwitcherAria')}
      data-testid="language-switcher"
      className={`${
        fullWidth ? 'grid grid-cols-2 w-full' : 'inline-flex items-center'
      } gap-1 rounded-xl border border-border bg-canvas p-1 ${className}`}
    >
      <button
        type="button"
        onClick={() => setLocale('en')}
        aria-pressed={locale === 'en'}
        data-testid="lang-btn-en"
        className={`inline-flex items-center justify-center px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-medium tracking-wider transition-colors focus-ring ${
          locale === 'en'
            ? 'bg-primary text-primary-foreground shadow-xs'
            : 'text-secondary hover:text-ink'
        }`}
      >
        ENG
      </button>
      <button
        type="button"
        onClick={() => setLocale('vi')}
        aria-pressed={locale === 'vi'}
        data-testid="lang-btn-vi"
        className={`inline-flex items-center justify-center px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-medium tracking-wider transition-colors focus-ring ${
          locale === 'vi'
            ? 'bg-primary text-primary-foreground shadow-xs'
            : 'text-secondary hover:text-ink'
        }`}
      >
        VIE
      </button>
    </div>
  );
}
