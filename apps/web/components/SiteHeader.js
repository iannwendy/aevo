'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { cartApi } from '../lib/api';
import { useI18n } from '../lib/i18n';
import SettingsMenu from './SettingsMenu';

const NAV_LINKS = [
  { href: '/products', key: 'header.shop' },
  { href: '/products?category=laptops', key: 'header.laptops' },
  { href: '/products?category=components', key: 'header.components' },
  { href: '/products?category=monitors', key: 'header.monitors' },
];

export default function SiteHeader() {
  const { t } = useI18n();
  const [cartCount, setCartCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadCartCount() {
      try {
        const res = await cartApi.getCart();
        if (!active) return;
        const count = (res.data?.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
        setCartCount(count);
      } catch {
        // Ignore cart fetch errors on initial header load
      }
    }

    loadCartCount();

    const handleCartUpdated = (e) => {
      if (typeof e?.detail?.count === 'number') {
        setCartCount(e.detail.count);
      } else {
        loadCartCount();
      }
    };

    window.addEventListener('aevo:cart-updated', handleCartUpdated);
    return () => {
      active = false;
      window.removeEventListener('aevo:cart-updated', handleCartUpdated);
    };
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  return (
    <header
      data-testid="site-header"
      className="fixed top-0 left-0 right-0 z-50 bg-surface/80 backdrop-blur-md border-b border-border"
    >
      <div className="container-main h-[72px] flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            data-testid="mobile-menu-toggle"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation-drawer"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl border border-border bg-surface text-ink hover:bg-surface-muted transition-colors focus-ring"
          >
            {mobileMenuOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>
          <Link
            href="/"
            className="text-2xl font-display font-medium tracking-tight text-ink focus-ring rounded-lg shrink-0"
          >
            aevo.
          </Link>
        </div>

        <nav className="hidden lg:flex items-center gap-8" aria-label={t('header.primaryNavAria')}>
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-small font-medium text-ink hover:text-secondary transition-colors focus-ring rounded"
            >
              {t(link.key)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3 sm:gap-5">
          <Link
            href="/products"
            className="hidden sm:inline-block text-small font-medium text-ink hover:text-secondary transition-colors focus-ring rounded"
          >
            {t('header.search')}
          </Link>
          <Link
            href="/account/profile"
            className="text-small font-medium text-ink hover:text-secondary transition-colors focus-ring rounded"
          >
            {t('header.account')}
          </Link>
          <Link
            href="/cart"
            data-testid="header-cart-link"
            className="text-small font-medium text-ink hover:text-secondary transition-colors focus-ring rounded inline-flex items-center gap-1.5"
          >
            <span>{t('header.cart')}</span>
            <span
              data-testid="header-cart-count"
              className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-mono"
            >
              {cartCount}
            </span>
          </Link>
          <SettingsMenu />
        </div>
      </div>

      {mobileMenuOpen && (
        <nav
          id="mobile-navigation-drawer"
          data-testid="mobile-menu-drawer"
          aria-label={t('header.primaryNavAria')}
          className="lg:hidden border-t border-border bg-surface shadow-lg"
        >
          <div className="container-main py-4 flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2.5 rounded-xl text-small font-medium text-ink hover:bg-surface-muted transition-colors focus-ring"
              >
                {t(link.key)}
              </Link>
            ))}
            <div className="mt-2 pt-2 border-t border-border flex items-center justify-between px-3 py-1.5">
              <Link
                href="/account/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="text-small font-medium text-secondary hover:text-ink transition-colors"
              >
                {t('header.account')}
              </Link>
              <Link
                href="/cart"
                onClick={() => setMobileMenuOpen(false)}
                className="text-small font-medium text-secondary hover:text-ink transition-colors"
              >
                {t('header.cart')} ({cartCount})
              </Link>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
