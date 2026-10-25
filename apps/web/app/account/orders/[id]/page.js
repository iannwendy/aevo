'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Clock,
  MapPin,
  CreditCard,
  CheckCircle2,
  Package,
} from 'lucide-react';
import SiteHeader from '../../../../components/SiteHeader';
import SiteFooter from '../../../../components/SiteFooter';
import { ordersApi } from '../../../../lib/api';
import { formatPrice } from '../../../../lib/utils';
import { useI18n } from '../../../../lib/i18n';
import { formatAevoTitle } from '../../../../lib/i18n/dictionaries';
import { formatVnAddress } from '../../../../components/address/VnAddressSelector';

function getStatusBadgeClass(status) {
  switch (status) {
    case 'DELIVERED':
      return 'bg-success/10 text-success border-success/30';
    case 'SHIPPING':
    case 'CONFIRMED':
      return 'bg-accent/10 text-accent border-accent/30';
    case 'CANCELLED':
      return 'bg-danger/10 text-danger border-danger/30';
    case 'PENDING':
    default:
      return 'bg-warning/10 text-warning border-warning/30';
  }
}

export default function OrderDetailPage({ params }) {
  const { locale, t } = useI18n();
  const orderId = params?.id;
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (order?.orderNumber) {
      document.title = formatAevoTitle(t('pageTitles.orderNumber', { number: order.orderNumber }));
    } else {
      document.title = formatAevoTitle(t('pageTitles.orderDetail'));
    }
  }, [order?.orderNumber, locale, t]);

  useEffect(() => {
    let active = true;
    async function loadOrder() {
      if (!orderId) return;
      try {
        setLoading(true);
        const res = await ordersApi.getById(orderId);
        if (!active) return;
        setOrder(res.data);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.error || t('orders.orderNotFoundError'));
      } finally {
        if (active) setLoading(false);
      }
    }
    loadOrder();
    return () => {
      active = false;
    };
  }, [orderId, t]);

  const statusHistory = (order?.statusHistory || [])
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const loyaltyDiscount =
    order?.loyaltyDiscount ?? (order?.usedLoyaltyPoints || 0) * 1000;

  return (
    <main className="min-h-screen flex flex-col justify-between bg-canvas">
      <SiteHeader />

      <div className="w-full container-main pt-[72px] flex-1" data-testid="order-detail-page">
        <div className="pt-6 pb-12 md:pb-16">
          <div className="mb-6">
          <Link
            href="/account/orders"
            className="inline-flex items-center gap-1.5 text-small text-secondary hover:text-ink transition-colors"
          >
            <ArrowLeft size={16} />
            <span>{t('orders.backToOrderHistory')}</span>
          </Link>
        </div>

        {loading ? (
          <div className="h-96 rounded-2xl bg-surface border border-border animate-pulse" />
        ) : error || !order ? (
          <div className="bg-surface border border-border rounded-2xl p-12 text-center max-w-xl mx-auto">
            <h1 className="text-h2 mb-2">{t('orders.couldNotLoadTitle')}</h1>
            <p className="text-small text-secondary mb-6">{error}</p>
            <Link
              href="/account/orders"
              className="inline-flex items-center px-6 py-3 rounded-xl bg-primary text-primary-foreground text-small font-medium"
            >
              {t('orders.returnToOrdersBtn')}
            </Link>
          </div>
        ) : (
          <div className="space-y-8 animate-fade-in">
            {/* Order Header */}
            <div className="bg-surface border border-border rounded-2xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-slide-up">
              <div>
                <span className="text-caption font-mono uppercase tracking-wider text-secondary">
                  {t('orders.orderDetailsEyebrow')}
                </span>
                <div className="flex flex-wrap items-center gap-3 mt-1">
                  <h1 className="text-h1 font-mono" data-testid="order-detail-number">
                    {order.orderNumber}
                  </h1>
                  <span
                    data-testid="order-detail-status"
                    className={`px-3 py-1 rounded-full text-caption font-mono uppercase border ${getStatusBadgeClass(
                      order.status
                    )}`}
                  >
                    {order.status}
                  </span>
                </div>
                <p className="text-small text-secondary mt-2">
                  {t('orders.placedOn', {
                    date: new Date(order.createdAt).toLocaleString('vi-VN'),
                  })}
                </p>
              </div>

              <div className="md:text-right">
                <span className="text-caption font-mono uppercase tracking-wider text-secondary block">
                  {t('orders.totalPaidDue')}
                </span>
                <span
                  data-testid="order-detail-total"
                  className="text-3xl font-display font-medium text-ink"
                >
                  {formatPrice(order.totalAmount)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Items & Financial Summary */}
              <div className="lg:col-span-7 space-y-8">
                {/* Order Items */}
                <section
                  data-testid="order-detail-items"
                  className="bg-surface border border-border rounded-2xl p-6"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Package size={18} className="text-ink" />
                    <h2 className="text-h3">{t('orders.orderedHardwareTitle')}</h2>
                  </div>

                  <div className="divide-y divide-border">
                    {(order.items || []).map((item) => (
                      <div
                        key={item.id}
                        data-testid="order-detail-item"
                        className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                      >
                        <div>
                          <div className="text-small font-medium text-ink">
                            {item.productName}
                          </div>
                          <div className="text-caption text-secondary mt-0.5">
                            {t('orders.variantQuantityLine', {
                              variant: item.variantName,
                              qty: item.quantity,
                              price: formatPrice(item.price),
                            })}
                          </div>
                        </div>
                        <div className="text-small font-mono font-medium text-ink shrink-0">
                          {formatPrice(item.price * item.quantity)}
                        </div>
                      </div>
                    ))}
                  </div>

                  <dl className="mt-6 pt-6 border-t border-border space-y-2.5 text-small">
                    <div className="flex justify-between">
                      <dt className="text-secondary">{t('orders.subtotal')}</dt>
                      <dd className="font-mono text-ink">{formatPrice(order.subtotal)}</dd>
                    </div>
                    {order.discountAmount > 0 && (
                      <div className="flex justify-between text-success">
                        <dt>
                          {t('orders.discount')}{' '}
                          {order.discountCode?.code ? `(${order.discountCode.code})` : ''}
                        </dt>
                        <dd className="font-mono">-{formatPrice(order.discountAmount)}</dd>
                      </div>
                    )}
                    {order.usedLoyaltyPoints > 0 && (
                      <div className="flex justify-between text-success">
                        <dt>
                          {t('orders.loyaltyRedeemed', { points: order.usedLoyaltyPoints })}
                        </dt>
                        <dd className="font-mono">-{formatPrice(loyaltyDiscount)}</dd>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <dt className="text-secondary">{t('orders.shippingFee')}</dt>
                      <dd className="font-mono text-ink">
                        {order.shippingFee === 0
                          ? t('orders.free')
                          : formatPrice(order.shippingFee)}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-secondary">{t('orders.taxVat')}</dt>
                      <dd className="font-mono text-ink">{formatPrice(order.taxAmount)}</dd>
                    </div>
                    <div className="flex justify-between pt-3 border-t border-border text-base font-medium text-ink">
                      <dt>{t('orders.total')}</dt>
                      <dd className="font-mono">{formatPrice(order.totalAmount)}</dd>
                    </div>
                  </dl>
                </section>

                {/* Shipping & Payment Information */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="bg-surface border border-border rounded-2xl p-6">
                    <div className="flex items-center gap-2 text-caption font-mono uppercase tracking-wider text-secondary mb-3">
                      <MapPin size={14} />
                      <span>{t('orders.shippingAddressLabel')}</span>
                    </div>
                    {order.shippingAddress ? (
                      <div className="text-small text-ink space-y-1">
                        <p className="font-medium">{order.shippingAddress.fullName}</p>
                        <p className="text-secondary font-mono">
                          {order.shippingAddress.phone}
                        </p>
                        <p className="text-secondary">
                          {formatVnAddress(order.shippingAddress)}
                        </p>
                      </div>
                    ) : (
                      <p className="text-small text-secondary">
                        {order.guestName || order.user?.fullName}
                      </p>
                    )}
                  </div>

                  <div className="bg-surface border border-border rounded-2xl p-6">
                    <div className="flex items-center gap-2 text-caption font-mono uppercase tracking-wider text-secondary mb-3">
                      <CreditCard size={14} />
                      <span>{t('orders.paymentMethodLabel')}</span>
                    </div>
                    <p className="text-small font-medium text-ink uppercase">
                      {order.paymentMethod || 'COD'}
                    </p>
                    {order.notes && (
                      <p className="text-caption text-secondary mt-3">
                        {t('orders.notePrefix', { note: order.notes })}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Order Status History Table & Timeline (Reverse Chronological) */}
              <div className="lg:col-span-5">
                <section
                  data-testid="order-status-history"
                  className="bg-surface border border-border rounded-2xl p-6"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Clock size={18} className="text-ink" />
                    <h2 className="text-h3">{t('orders.statusHistoryTitle')}</h2>
                  </div>
                  <p className="text-caption text-secondary mb-6">
                    {t('orders.statusHistoryDesc')}
                  </p>

                  {/* Timeline */}
                  <div className="space-y-4 mb-6">
                    {statusHistory.map((entry, idx) => (
                      <div
                        key={entry.id || idx}
                        data-testid="status-history-entry"
                        className="flex items-start gap-3"
                      >
                        <div className="mt-1">
                          <CheckCircle2
                            size={16}
                            className={idx === 0 ? 'text-ink' : 'text-secondary'}
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-small font-mono font-medium ${
                                idx === 0 ? 'text-ink' : 'text-secondary'
                              }`}
                            >
                              {entry.status}
                            </span>
                            <time className="text-caption font-mono text-secondary">
                              {new Date(entry.createdAt).toLocaleString('vi-VN')}
                            </time>
                          </div>
                          {entry.note && (
                            <p className="text-caption text-secondary mt-0.5">
                              {entry.note}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Status History Table */}
                  <div className="overflow-x-auto border-t border-border pt-4">
                    <table
                      data-testid="status-history-table"
                      className="w-full text-left text-caption"
                    >
                      <thead>
                        <tr className="border-b border-border text-secondary font-mono uppercase">
                          <th className="py-2 pr-3">{t('orders.thStatus')}</th>
                          <th className="py-2 pr-3">{t('orders.thUpdatedAt')}</th>
                          <th className="py-2">{t('orders.thNote')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {statusHistory.map((entry, idx) => (
                          <tr key={entry.id || idx} className="table-row-interactive">
                            <td className="py-2.5 pr-3 font-mono font-medium text-ink">
                              {entry.status}
                            </td>
                            <td className="py-2.5 pr-3 font-mono text-secondary">
                              {new Date(entry.createdAt).toLocaleString('vi-VN')}
                            </td>
                            <td className="py-2.5 text-secondary">
                              {entry.note || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
