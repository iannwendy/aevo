'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useI18n } from '../lib/i18n';
import { formatAevoTitle } from '../lib/i18n/dictionaries';

const STATIC_ROUTE_TITLE_KEYS = {
  '/': 'pageTitles.home',
  '/cart': 'pageTitles.cart',
  '/checkout': 'pageTitles.checkout',
  '/checkout/success': 'pageTitles.checkoutSuccess',
  '/login': 'pageTitles.login',
  '/register': 'pageTitles.register',
  '/forgot-password': 'pageTitles.forgotPassword',
  '/reset-password': 'pageTitles.resetPassword',
  '/logout': 'pageTitles.logout',
  '/account/profile': 'pageTitles.profile',
  '/account/addresses': 'pageTitles.addresses',
  '/account/orders': 'pageTitles.orders',
  '/admin': 'pageTitles.adminDashboard',
  '/admin/products': 'pageTitles.adminProducts',
  '/admin/orders': 'pageTitles.adminOrders',
  '/admin/users': 'pageTitles.adminUsers',
  '/admin/discounts': 'pageTitles.adminDiscounts',
};

/**
 * Global page-load progress bar and route transition wrapper.
 * Provides a top progress sweep on initial load and route navigation,
 * plus a smooth fade-in container without creating a transform containing block
 * that would interfere with fixed headers.
 */
export default function PageTransition({ children }) {
  const pathname = usePathname();
  const { locale, t } = useI18n();
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    setAnimKey((k) => k + 1);
  }, [pathname]);

  useEffect(() => {
    const titleKey = STATIC_ROUTE_TITLE_KEYS[pathname];
    if (titleKey && typeof document !== 'undefined') {
      document.title = formatAevoTitle(t(titleKey));
    }
  }, [pathname, locale, t]);

  return (
    <div data-testid="page-transition-wrapper" className="animate-fade-in">
      <div
        key={animKey}
        data-testid="page-load-progress"
        aria-hidden="true"
        className="fixed top-0 left-0 right-0 h-[2.5px] bg-primary origin-left z-[100] pointer-events-none animate-progress-sweep"
      />
      {children}
    </div>
  );
}
