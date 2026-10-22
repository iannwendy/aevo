'use client';

import { useI18n } from '../lib/i18n';

export default function LanguageSwitcher({ className = '' }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t('header.languageSwitcherAria')}
      data-testid="language-switcher"
      className={`inline-flex items-center rounded-lg border border-border bg-canvas p-0.5 ${className}`}
    >
      <button
        type="button"
        onClick={() => setLocale('en')}
        aria-pressed={locale === 'en'}
        data-testid="lang-btn-en"
        className={`px-2 py-1 rounded-md text-[11px] font-mono font-medium tracking-wider transition-colors focus-ring ${
          locale === 'en'
            ? 'bg-ink text-white shadow-xs'
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
        className={`px-2 py-1 rounded-md text-[11px] font-mono font-medium tracking-wider transition-colors focus-ring ${
          locale === 'vi'
            ? 'bg-ink text-white shadow-xs'
            : 'text-secondary hover:text-ink'
        }`}
      >
        VIE
      </button>
    </div>
  );
}
