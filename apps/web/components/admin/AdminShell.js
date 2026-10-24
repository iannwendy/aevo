'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingBag,
  TicketPercent,
  ArrowUpRight,
  Menu,
  X,
  ShieldAlert,
} from 'lucide-react';
import { fetchProfile, postLogout } from '../../lib/auth-client';
import { useI18n } from '../../lib/i18n';
import SettingsMenu from '../SettingsMenu';

const ADMIN_NAV_ITEMS = [
  {
    href: '/admin',
    key: 'admin.navDashboard',
    testId: 'admin-nav-dashboard',
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: '/admin/products',
    key: 'admin.navProducts',
    testId: 'admin-nav-products',
    icon: Package,
    exact: false,
  },
  {
    href: '/admin/users',
    key: 'admin.navUsers',
    testId: 'admin-nav-users',
    icon: Users,
    exact: false,
  },
  {
    href: '/admin/orders',
    key: 'admin.navOrders',
    testId: 'admin-nav-orders',
    icon: ShoppingBag,
    exact: false,
  },
  {
    href: '/admin/discounts',
    key: 'admin.navDiscounts',
    testId: 'admin-nav-discounts',
    icon: TicketPercent,
    exact: false,
  },
];

export default function AdminShell({ children }) {
  const pathname = usePathname() || '/admin';
  const { t } = useI18n();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authState, setAuthState] = useState({ status: 'loading', user: null });

  useEffect(() => {
    let active = true;
    fetchProfile().then(async (res) => {
      if (!active) return;
      if (res.status === 'ok' && res.user) {
        setAuthState({ status: 'authenticated', user: res.user });
      } else {
        setAuthState({ status: 'unauthenticated', user: null });
        try {
          await postLogout();
        } catch {
          // ignore
        }
        if (typeof window !== 'undefined') {
          const nextTarget = `${window.location.pathname}${window.location.search}`;
          window.location.replace(`/login?next=${encodeURIComponent(nextTarget || '/admin')}`);
        }
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const isActiveLink = (item) => {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  return (
    <div
      className="min-h-screen bg-canvas text-ink flex flex-col overflow-x-hidden"
      data-testid="admin-shell"
    >
      {/* Top Header */}
      <header className="sticky top-0 z-40 h-[72px] bg-surface/90 backdrop-blur-md border-b border-border">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 h-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              data-testid="admin-mobile-menu-toggle"
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle admin navigation"
              className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl border border-border bg-surface text-ink hover:bg-surface-muted focus-ring transition-all duration-200 active:scale-90"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            <Link
              href="/admin"
              className="inline-flex items-center gap-2.5 focus-ring rounded-lg transition-transform duration-200 hover:scale-[1.03] active:scale-[0.97]"
            >
              <span className="text-2xl font-display font-medium tracking-tight text-ink">
                aevo.
              </span>
              <span className="px-2.5 py-0.5 rounded-pill bg-primary text-primary-foreground font-mono text-[11px] uppercase tracking-wider">
                Control
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {authState.user && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-muted border border-border text-caption">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="font-medium text-ink">{authState.user.fullName}</span>
                <span className="font-mono text-secondary uppercase">
                  ({authState.user.role})
                </span>
              </div>
            )}

            <Link
              href="/"
              data-testid="admin-storefront-link"
              className="group inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-surface text-small font-medium text-ink hover:bg-surface-muted btn-interactive focus-ring"
            >
              <span>{t('admin.backToStore')}</span>
              <ArrowUpRight size={15} className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>

            <SettingsMenu />
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="max-w-[1440px] w-full mx-auto flex-1 flex flex-col lg:flex-row">
        {/* Desktop Sidebar */}
        <aside
          data-testid="admin-sidebar"
          aria-label="Admin Navigation"
          className="hidden lg:flex lg:w-64 shrink-0 flex-col border-r border-border bg-surface/50 p-6"
        >
          <div className="text-caption font-mono uppercase tracking-widest text-secondary mb-3 px-3">
            {t('admin.brandControl')}
          </div>
          <nav className="space-y-1.5">
            {ADMIN_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActiveLink(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-testid={item.testId}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-small font-medium transition-all duration-200 active:scale-[0.98] focus-ring ${
                    active
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-secondary hover:text-ink hover:bg-surface-muted hover:translate-x-1'
                  }`}
                >
                  <Icon size={18} strokeWidth={1.75} />
                  <span>{t(item.key)}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto pt-6 border-t border-border">
            <p className="text-caption text-secondary leading-relaxed">
              AEVO — Premium Computing, Refined.
            </p>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div
            data-testid="admin-mobile-menu-drawer"
            className="lg:hidden border-b border-border bg-surface px-4 py-4 space-y-1.5 animate-slide-down"
          >
            {ADMIN_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActiveLink(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-small font-medium transition-all duration-200 active:scale-[0.98] ${
                    active
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-secondary hover:text-ink hover:bg-surface-muted'
                  }`}
                >
                  <Icon size={18} strokeWidth={1.75} />
                  <span>{t(item.key)}</span>
                </Link>
              );
            })}
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-8 lg:p-10 min-w-0">
          {authState.status === 'unauthenticated' ? (
            <div
              data-testid="admin-unauthenticated-warning"
              className="p-6 rounded-xl border border-border bg-surface text-ink flex flex-wrap items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <ShieldAlert size={20} className="text-danger" />
                <div>
                  <p className="text-small font-medium">{t('admin.adminAccessRequired')}</p>
                  <p className="text-caption text-secondary">{t('admin.adminAccessDesc')}</p>
                </div>
              </div>
              <Link
                href={`/login?next=${encodeURIComponent(pathname)}`}
                className="btn-primary text-small px-4 py-2 h-auto"
              >
                {t('admin.signInAsAdmin')}
              </Link>
            </div>
          ) : authState.status === 'authenticated' && authState.user?.role !== 'ADMIN' ? (
            <div
              data-testid="admin-access-warning"
              className="mb-6 p-4 rounded-xl border border-danger/40 bg-danger/10 text-danger flex flex-wrap items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <ShieldAlert size={20} />
                <div>
                  <p className="text-small font-medium">{t('admin.adminAccessRequired')}</p>
                  <p className="text-caption opacity-90">{t('admin.adminAccessDesc')}</p>
                </div>
              </div>
              <Link href="/login" className="btn-primary text-small px-4 py-2 h-auto">
                {t('admin.signInAsAdmin')}
              </Link>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
