'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  normalizeLocale,
  translate,
  localizeCategoryName,
  localizeCategoryDescription,
  localizeCategorySubtitle,
} from './dictionaries';

const I18nContext = createContext(null);

function readCookieLocale() {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${LOCALE_COOKIE_NAME}=`));
  if (!match) return null;
  return normalizeLocale(decodeURIComponent(match.split('=')[1] || ''));
}

function writeClientLocale(locale) {
  const normalized = normalizeLocale(locale);
  if (typeof document !== 'undefined') {
    document.cookie = `${LOCALE_COOKIE_NAME}=${normalized}; path=/; max-age=31536000; SameSite=Lax`;
    if (document.documentElement) {
      document.documentElement.lang = normalized;
    }
  }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LOCALE_COOKIE_NAME, normalized);
    } catch {
      // Ignore storage quota / privacy errors
    }
  }
}

export function I18nProvider({ initialLocale = DEFAULT_LOCALE, children }) {
  const [locale, setLocaleState] = useState(() => normalizeLocale(initialLocale));

  useEffect(() => {
    const cookieLocale = readCookieLocale();
    let storedLocale = null;
    try {
      storedLocale = window.localStorage.getItem(LOCALE_COOKIE_NAME);
    } catch {
      storedLocale = null;
    }
    const resolved = normalizeLocale(cookieLocale || storedLocale || initialLocale);
    if (resolved !== locale) {
      setLocaleState(resolved);
    }
    writeClientLocale(resolved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = useCallback((nextLocale) => {
    const normalized = normalizeLocale(nextLocale);
    setLocaleState(normalized);
    writeClientLocale(normalized);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('aevo:locale-changed', { detail: { locale: normalized } })
      );
    }
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === 'en' ? 'vi' : 'en');
  }, [locale, setLocale]);

  const t = useCallback(
    (key, params) => translate(locale, key, params),
    [locale]
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      toggleLocale,
      t,
      catName: (slugOrName) => localizeCategoryName(slugOrName, locale),
      catDesc: (slug, fallback) => localizeCategoryDescription(slug, fallback, locale),
      catSubtitle: (slug, fallback) => localizeCategorySubtitle(slug, fallback, locale),
    }),
    [locale, setLocale, toggleLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      toggleLocale: () => {},
      t: (key, params) => translate(DEFAULT_LOCALE, key, params),
      catName: (slugOrName) => localizeCategoryName(slugOrName, DEFAULT_LOCALE),
      catDesc: (slug, fallback) => localizeCategoryDescription(slug, fallback, DEFAULT_LOCALE),
      catSubtitle: (slug, fallback) => localizeCategorySubtitle(slug, fallback, DEFAULT_LOCALE),
    };
  }
  return ctx;
}

export {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  normalizeLocale,
  translate,
  localizeCategoryName,
  localizeCategoryDescription,
  localizeCategorySubtitle,
};
