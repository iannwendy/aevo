'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Package,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Search,
  Clock,
} from 'lucide-react';
import SiteHeader from '../../../components/SiteHeader';
import SiteFooter from '../../../components/SiteFooter';
import { fetchProfile } from '../../../lib/auth-client';
import { ordersApi, loyaltyApi } from '../../../lib/api';
import { formatPrice } from '../../../lib/utils';
import { useI18n } from '../../../lib/i18n';

function getStatusBadgeClass(status) {
  switch (status) {
    case 'DELIVERED':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'SHIPPING':
      return 'bg-blue-50 text-blue-800 border-blue-200';
    case 'CONFIRMED':
      return 'bg-indigo-50 text-indigo-800 border-indigo-200';
    case 'CANCELLED':
      return 'bg-red-50 text-red-800 border-red-200';
    case 'PENDING':
    default:
      return 'bg-amber-50 text-amber-800 border-amber-200';
  }
}

export default function AccountOrdersPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [authStatus, setAuthStatus] = useState('loading');
  const [orders, setOrders] = useState([]);
  const [loyaltyPoints, setLoyaltyPoints] = useState({ points: 0, value: 0 });
  const [loyaltyHistory, setLoyaltyHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lookupInput, setLookupInput] = useState('');

  useEffect(() => {
    let active = true;
    async function init() {
      const prof = await fetchProfile();
      if (!active) return;

      if (prof.status === 'ok' && prof.user) {
        setAuthStatus('ready');
        try {
          setLoading(true);
          const [ordersRes, pointsRes, histRes] = await Promise.all([
            ordersApi.getAll(),
            loyaltyApi.getPoints(),
            loyaltyApi.getHistory(),
          ]);
          if (!active) return;
          setOrders(Array.isArray(ordersRes.data) ? ordersRes.data : []);
          if (pointsRes.data) setLoyaltyPoints(pointsRes.data);
          if (Array.isArray(histRes.data)) setLoyaltyHistory(histRes.data);
        } catch (err) {
          console.error('Failed to load orders/loyalty:', err);
        } finally {
          if (active) setLoading(false);
        }
      } else {
        setAuthStatus('signed-out');
        setLoading(false);
      }
    }
    init();
    return () => {
      active = false;
    };
  }, []);

  const handleOrderLookup = (e) => {
    e.preventDefault();
    const cleaned = lookupInput.trim().toUpperCase();
    if (!cleaned) return;
    router.push(`/account/orders/${encodeURIComponent(cleaned)}`);
  };

  return (
    <main className="min-h-screen flex flex-col justify-between bg-canvas">
      <SiteHeader />

      <div className="pt-[72px] container-main py-10 md:py-14 flex-1" data-testid="orders-history-page">
        <div className="mb-6">
          <Link
            href="/account/profile"
            className="inline-flex items-center gap-1.5 text-small text-secondary hover:text-ink transition-colors"
          >
            <ArrowLeft size={16} />
            <span>{t('orders.backToAccount')}</span>
          </Link>
        </div>

        {/* Account Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 pb-6 mb-8 border-b border-border">
          <Link
            href="/account/profile"
            className="px-4 py-2 rounded-xl border border-border bg-surface text-small font-medium text-secondary hover:text-ink"
          >
            {t('orders.tabProfileSecurity')}
          </Link>
          <Link
            href="/account/addresses"
            className="px-4 py-2 rounded-xl border border-border bg-surface text-small font-medium text-secondary hover:text-ink"
          >
            {t('orders.tabDeliveryAddresses')}
          </Link>
          <Link
            href="/account/orders"
            className="px-4 py-2 rounded-xl bg-ink text-white text-small font-medium"
          >
            {t('orders.tabOrderHistoryLoyalty')}
          </Link>
        </div>

        {/* Order Number Lookup Bar (works for both Guest & Member) */}
        <div className="bg-surface border border-border rounded-2xl p-6 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-display font-medium text-ink">
              {t('orders.trackByOrderNumberTitle')}
            </h2>
            <p className="text-caption text-secondary mt-0.5">
              {t('orders.trackByOrderNumberDesc')}
            </p>
          </div>
          <form onSubmit={handleOrderLookup} className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <input
                type="text"
                value={lookupInput}
                onChange={(e) => setLookupInput(e.target.value)}
                placeholder={t('orders.trackPlaceholder')}
                data-testid="order-lookup-input"
                className="w-full h-11 pl-9 pr-3 rounded-xl border border-border bg-canvas text-small font-mono uppercase text-ink placeholder:text-secondary focus-ring"
              />
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary"
              />
            </div>
            <button
              type="submit"
              data-testid="order-lookup-button"
              className="h-11 px-5 rounded-xl bg-ink text-white text-small font-medium hover:bg-ink/90 transition-colors shrink-0"
            >
              {t('orders.trackBtn')}
            </button>
          </form>
        </div>

        {authStatus === 'signed-out' ? (
          <div className="bg-surface border border-border rounded-2xl p-10 max-w-xl">
            <h1 className="text-h2 mb-2">{t('orders.signInTitle')}</h1>
            <p className="text-small text-secondary mb-6">{t('orders.signInDesc')}</p>
            <Link
              href="/login?next=%2Faccount%2Forders"
              className="inline-flex items-center px-6 py-3 rounded-xl bg-ink text-white text-small font-medium"
            >
              {t('orders.signInBtn')}
            </Link>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Loyalty Points Overview */}
            <section data-testid="loyalty-section">
              <div className="bg-surface border border-border rounded-2xl p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-5">
                  <div className="inline-flex items-center gap-1.5 text-caption font-mono uppercase tracking-wider text-sage mb-2">
                    <Sparkles size={13} />
                    <span>{t('orders.loyaltyProgramBadge')}</span>
                  </div>
                  <h2 className="text-h2">
                    <span data-testid="loyalty-points-balance">{loyaltyPoints.points}</span>{' '}
                    {t('orders.pointsUnit')}
                  </h2>
                  <p className="text-small text-secondary mt-1">
                    {t('orders.redeemableValuePrefix')}{' '}
                    <strong className="text-ink font-medium" data-testid="loyalty-points-value">
                      {formatPrice(loyaltyPoints.value)}
                    </strong>{' '}
                    {t('orders.redeemableFormula')}
                  </p>
                  <p className="text-caption text-secondary mt-3">
                    {t('orders.loyaltyEarnExplanation')}
                  </p>
                </div>

                <div className="lg:col-span-7 border-t lg:border-t-0 lg:border-l border-border pt-6 lg:pt-0 lg:pl-8">
                  <h3 className="text-caption font-mono uppercase tracking-wider text-secondary mb-3">
                    {t('orders.recentTransactionsTitle')}
                  </h3>
                  {loyaltyHistory.length === 0 ? (
                    <p className="text-small text-secondary">
                      {t('orders.noTransactionsYet')}
                    </p>
                  ) : (
                    <div
                      data-testid="loyalty-history-list"
                      className="space-y-2 max-h-44 overflow-y-auto pr-1"
                    >
                      {loyaltyHistory.map((tx) => (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between text-small py-2 border-b border-border/60 last:border-0"
                        >
                          <div>
                            <p className="text-ink font-medium">{tx.description}</p>
                            <span className="text-caption font-mono text-secondary">
                              {new Date(tx.createdAt).toLocaleDateString('vi-VN')}
                            </span>
                          </div>
                          <span
                            className={`font-mono font-medium ${
                              tx.amount > 0 ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                          >
                            {tx.amount > 0 ? `+${tx.amount}` : tx.amount} pts
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Purchase History List */}
            <section>
              <div className="mb-6">
                <h1 className="text-h1">{t('orders.purchaseHistoryTitle')}</h1>
                <p className="text-small text-secondary mt-1">
                  {t('orders.purchaseHistoryDesc')}
                </p>
              </div>

              {loading ? (
                <div className="space-y-4">
                  {[1, 2].map((n) => (
                    <div
                      key={n}
                      className="h-44 rounded-2xl bg-surface border border-border animate-pulse"
                    />
                  ))}
                </div>
              ) : orders.length === 0 ? (
                <div className="bg-surface border border-border rounded-2xl p-12 text-center">
                  <Package size={28} className="mx-auto text-secondary mb-3" />
                  <h2 className="text-h3 mb-1">{t('orders.noOrdersTitle')}</h2>
                  <p className="text-small text-secondary mb-6">
                    {t('orders.noOrdersDesc')}
                  </p>
                  <Link
                    href="/products"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-ink text-white text-small font-medium"
                  >
                    {t('orders.exploreHardwareBtn')}
                    <ArrowRight size={16} />
                  </Link>
                </div>
              ) : (
                <div data-testid="orders-list" className="space-y-4">
                  {orders.map((order) => (
                    <article
                      key={order.id}
                      data-testid="order-card"
                      className="bg-surface border border-border rounded-2xl p-6 transition-all hover:border-ink/40"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
                        <div>
                          <div className="flex items-center gap-3">
                            <span
                              data-testid="order-card-number"
                              className="font-mono font-medium text-base text-ink"
                            >
                              {order.orderNumber}
                            </span>
                            <span
                              data-testid="order-card-status"
                              className={`px-2.5 py-0.5 rounded-full text-caption font-mono uppercase border ${getStatusBadgeClass(
                                order.status
                              )}`}
                            >
                              {order.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-caption font-mono text-secondary mt-1">
                            <Clock size={12} />
                            <span>
                              {t('orders.placedOn', {
                                date: new Date(order.createdAt).toLocaleString('vi-VN'),
                              })}
                            </span>
                          </div>
                        </div>

                        <div className="sm:text-right">
                          <span className="text-caption font-mono uppercase text-secondary block">
                            {t('orders.totalAmount')}
                          </span>
                          <span
                            data-testid="order-card-total"
                            className="text-lg font-display font-medium text-ink"
                          >
                            {formatPrice(order.totalAmount)}
                          </span>
                        </div>
                      </div>

                      {/* Order Items Summary */}
                      <div className="py-4 space-y-2">
                        {(order.items || []).map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between text-small"
                          >
                            <span className="text-ink">
                              <strong>{item.productName}</strong>{' '}
                              <span className="text-secondary">
                                ({item.variantName}) × {item.quantity}
                              </span>
                            </span>
                            <span className="font-mono text-secondary">
                              {formatPrice(item.price * item.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="pt-4 border-t border-border/60 flex items-center justify-between">
                        <span className="text-caption font-mono text-secondary uppercase">
                          {t('orders.paymentPrefix', {
                            method: order.paymentMethod?.toUpperCase(),
                          })}
                        </span>
                        <Link
                          href={`/account/orders/${order.id}`}
                          data-testid={`view-order-${order.orderNumber}`}
                          className="inline-flex items-center gap-1.5 text-small font-medium text-ink hover:text-secondary transition-colors"
                        >
                          <span>{t('orders.viewDetailsAndHistory')}</span>
                          <ArrowRight size={15} />
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      <SiteFooter />
    </main>
  );
}
