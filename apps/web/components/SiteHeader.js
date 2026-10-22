'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { cartApi } from '../lib/api';

const NAV_LINKS = [
  { href: '/products', label: 'Shop' },
  { href: '/products?category=laptops', label: 'Laptops' },
  { href: '/products?category=components', label: 'Components' },
  { href: '/products?category=monitors', label: 'Monitors' },
];

export default function SiteHeader() {
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
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface/80 backdrop-blur-md border-b border-border">
      <div className="container-main h-[72px] flex items-center justify-between">
        <Link
          href="/"
          className="text-2xl font-display font-medium tracking-tight focus-ring rounded-lg"
        >
          aevo.
        </Link>

        <nav className="hidden md:flex items-center gap-8" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-small font-medium hover:text-secondary transition-colors focus-ring rounded"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <Link
            href="/products"
            className="text-small font-medium hover:text-secondary transition-colors focus-ring rounded"
          >
            Search
          </Link>
          <Link
            href="/account/profile"
            className="text-small font-medium hover:text-secondary transition-colors focus-ring rounded"
          >
            Account
          </Link>
          <Link
            href="/cart"
            data-testid="header-cart-link"
            className="text-small font-medium hover:text-secondary transition-colors focus-ring rounded inline-flex items-center gap-1.5"
          >
            <span>Cart</span>
            <span
              data-testid="header-cart-count"
              className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-ink text-white text-[11px] font-mono"
            >
              {cartCount}
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
