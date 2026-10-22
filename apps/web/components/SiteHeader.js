'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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

  return (
    <header
      data-testid="site-header"
      className="fixed top-0 left-0 right-0 z-50 bg-surface/80 backdrop-blur-md border-b border-border"
    >
      <div className="container-main h-[72px] flex items-center justify-between gap-4">
        <Link
          href="/"
          className="text-2xl font-display font-medium tracking-tight text-ink focus-ring rounded-lg shrink-0"
        >
          aevo.
        </Link>

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
    </header>
  );
}
