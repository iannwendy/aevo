'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  MapPin,
  CreditCard,
  User,
  TicketPercent,
  Package,
} from 'lucide-react';
import AdminShell from '../../../../components/admin/AdminShell';
import { ordersApi } from '../../../../lib/api';
import { formatPrice } from '../../../../lib/utils';
import { useI18n } from '../../../../lib/i18n';
import { formatAevoTitle } from '../../../../lib/i18n/dictionaries';
import { formatVnAddress } from '../../../../components/address/VnAddressSelector';

const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'SHIPPING', 'DELIVERED', 'CANCELLED'];

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

export default function AdminOrderDetailPage({ params }) {
  const orderId = params?.id;
  const { t, locale } = useI18n();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nextStatus, setNextStatus] = useState('CONFIRMED');
  const [statusNote, setStatusNote] = useState('');
  const [updating, setUpdating] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (order?.orderNumber) {
      document.title = formatAevoTitle(t('pageTitles.orderNumber', { number: order.orderNumber }));
    } else {
      document.title = formatAevoTitle(t('pageTitles.adminOrderDetail'));
    }
  }, [order?.orderNumber, locale, t]);

  const loadOrder = useCallback(async () => {
    if (!orderId) return;
    try {
      setLoading(true);
      const res = await ordersApi.getById(orderId);
      if (res.data) {
        setOrder(res.data);
        setNextStatus(res.data.status || 'CONFIRMED');
      }
    } catch {
      // Keep null when unauthenticated or not found
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!orderId || !nextStatus) return;
    setFeedback(null);
    try {
      setUpdating(true);
      const res = await ordersApi.updateStatus(
        order?.id || orderId,
        nextStatus,
        statusNote.trim() || `Status updated to ${nextStatus}`
      );
      setOrder(res.data);
      setStatusNote('');
      setFeedback({
        type: 'success',
        message: `Order status changed to ${nextStatus}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.error || 'Failed to update order status.',
      });
    } finally {
      setUpdating(false);
    }
  };

  const buyerName =
    order?.user?.fullName ||
    order?.guestName ||
    order?.shippingAddress?.fullName ||
    'Customer';
  const buyerEmail = order?.user?.email || order?.guestEmail || '—';
  const addr = order?.shippingAddress || {};

  return (
    <AdminShell>
      <div className="space-y-8" data-testid="admin-order-detail-page">
        <div>
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-1.5 text-small text-secondary hover:text-ink transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Back to Orders</span>
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-3 border-b border-border pb-6">
            <div>
              <p className="text-caption font-mono uppercase tracking-widest text-secondary">
                {t('admin.orderDetailEyebrow')}
              </p>
              <h1 className="text-h1 font-display mt-1">
                {order?.orderNumber ? `Order ${order.orderNumber}` : `Order #${orderId}`}
              </h1>
              {order?.createdAt && (
                <p className="text-small text-secondary mt-1 font-mono">
                  Placed on{' '}
                  {new Date(order.createdAt).toLocaleString(
                    locale === 'vi' ? 'vi-VN' : 'en-US'
                  )}
                </p>
              )}
            </div>

            {order?.status && (
              <span
                data-testid="admin-order-current-status"
                className={`inline-flex items-center px-3.5 py-1.5 rounded-pill border text-caption font-mono uppercase ${getStatusBadgeClass(
                  order.status
                )}`}
              >
                {order.status}
              </span>
            )}
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            data-testid="order-status-feedback"
            className={`p-4 rounded-xl border flex items-center gap-3 text-small ${
              feedback.type === 'success'
                ? 'border-success/40 bg-success/10 text-success'
                : 'border-danger/40 bg-danger/10 text-danger'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 size={18} />
            ) : (
              <AlertCircle size={18} />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Update Order Status Form */}
        <div className="surface-card p-6 animate-slide-up" data-testid="admin-order-status-form-card">
          <h2 className="text-h3 font-display font-medium text-ink mb-4">
            {t('admin.updateOrderStatusTitle')}
          </h2>
          <form
            onSubmit={handleUpdateStatus}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end"
          >
            <div>
              <label className="block text-caption font-mono uppercase text-secondary mb-1.5">
                New Status
              </label>
              <select
                value={nextStatus}
                onChange={(e) => setNextStatus(e.target.value)}
                data-testid="admin-order-status-select"
                className="input-field h-11 text-small font-mono"
              >
                {ORDER_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-caption font-mono uppercase text-secondary mb-1.5">
                Status Update Note (Optional)
              </label>
              <input
                type="text"
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                placeholder="e.g., Dispatched via express courier"
                data-testid="admin-order-status-note"
                className="input-field h-11 text-small"
              />
            </div>

            <button
              type="submit"
              disabled={updating}
              data-testid="admin-update-status-btn"
              className="btn-primary h-11 text-small"
            >
              {updating ? 'Updating Status…' : 'Update Order Status'}
            </button>
          </form>
        </div>

        {/* Order Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Ordered Products & Financial Summary */}
          <div className="lg:col-span-8 space-y-6">
            <div className="surface-card p-6" data-testid="admin-order-items-card">
              <h2 className="text-h3 font-display font-medium text-ink mb-4 flex items-center gap-2">
                <Package size={18} className="text-secondary" />
                <span>Ordered Hardware ({(order?.items || []).length})</span>
              </h2>

              <div className="divide-y divide-border/60">
                {(order?.items || []).map((item) => (
                  <div
                    key={item.id}
                    className="py-4 flex items-center justify-between gap-4"
                  >
                    <div>
                      <p className="text-small font-medium text-ink">{item.productName}</p>
                      <p className="text-caption font-mono text-secondary mt-0.5">
                        Configuration: {item.variantName} · Qty: {item.quantity} ×{' '}
                        {formatPrice(item.price)}
                      </p>
                    </div>
                    <p className="font-mono text-small tabular-nums font-medium text-ink">
                      {formatPrice(item.price * item.quantity)}
                    </p>
                  </div>
                ))}

                {!loading && (!order?.items || order.items.length === 0) && (
                  <p className="py-6 text-small text-secondary">
                    Order items will display once loaded.
                  </p>
                )}
              </div>

              {order && (
                <div className="mt-6 pt-6 border-t border-border space-y-2.5 text-small">
                  <div className="flex justify-between text-secondary">
                    <span>Subtotal</span>
                    <span className="font-mono tabular-nums text-ink">
                      {formatPrice(order.subtotal || 0)}
                    </span>
                  </div>

                  <div className="flex justify-between text-secondary">
                    <span>
                      Discount Applied{' '}
                      {order.discountCode?.code ? `(${order.discountCode.code})` : '(None)'}
                    </span>
                    <span className="font-mono tabular-nums text-success">
                      -{formatPrice(order.discountAmount || 0)}
                    </span>
                  </div>

                  {(order.usedLoyaltyPoints || 0) > 0 && (
                    <div className="flex justify-between text-secondary">
                      <span>Loyalty Points Redeemed ({order.usedLoyaltyPoints} pts)</span>
                      <span className="font-mono tabular-nums text-success">
                        -{formatPrice((order.usedLoyaltyPoints || 0) * 1000)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between text-secondary">
                    <span>Shipping Fee</span>
                    <span className="font-mono tabular-nums text-ink">
                      {order.shippingFee === 0 ? 'Free' : formatPrice(order.shippingFee || 0)}
                    </span>
                  </div>

                  <div className="flex justify-between text-secondary">
                    <span>VAT (10%)</span>
                    <span className="font-mono tabular-nums text-ink">
                      {formatPrice(order.taxAmount || 0)}
                    </span>
                  </div>

                  <div className="pt-3 border-t border-border flex justify-between text-body font-medium text-ink">
                    <span>Total Amount</span>
                    <span className="font-mono tabular-nums">
                      {formatPrice(order.totalAmount || 0)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Status History Table (Reverse chronological order - most recent at top) */}
            <div className="surface-card p-6" data-testid="admin-order-history-card">
              <div className="mb-4">
                <h2 className="text-h3 font-display font-medium text-ink flex items-center gap-2">
                  <Clock size={18} className="text-secondary" />
                  <span>Order Status History</span>
                </h2>
                <p className="text-caption text-secondary mt-0.5">
                  Reverse chronological order (most recent status at the top).
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border text-caption font-mono uppercase text-secondary">
                      <th className="py-2.5 pr-4">Status</th>
                      <th className="py-2.5 px-4">Updated Timestamp</th>
                      <th className="py-2.5 pl-4">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 text-small">
                    {(order?.statusHistory || []).map((entry, idx) => (
                      <tr key={entry.id || idx}>
                        <td className="py-3 pr-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-pill border text-[11px] font-mono uppercase ${getStatusBadgeClass(
                              entry.status
                            )}`}
                          >
                            {entry.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-caption text-secondary">
                          {entry.createdAt
                            ? new Date(entry.createdAt).toLocaleString(
                                locale === 'vi' ? 'vi-VN' : 'en-US'
                              )
                            : '—'}
                        </td>
                        <td className="py-3 pl-4 text-ink">{entry.note || '—'}</td>
                      </tr>
                    ))}
                    {(!order?.statusHistory || order.statusHistory.length === 0) && (
                      <tr>
                        <td colSpan={3} className="py-6 text-center text-secondary">
                          No status history entries yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Buyer & Shipping Info Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            <div className="surface-card p-6 space-y-4">
              <h3 className="text-body font-medium text-ink flex items-center gap-2">
                <User size={17} className="text-secondary" />
                <span>Buyer Information</span>
              </h3>
              <div className="text-small space-y-1">
                <p className="font-medium text-ink">{buyerName}</p>
                <p className="font-mono text-caption text-secondary">{buyerEmail}</p>
                {order?.guestEmail && (
                  <span className="inline-block mt-1 px-2 py-0.5 rounded bg-surface-muted border border-border text-[11px] font-mono text-secondary">
                    Guest Checkout
                  </span>
                )}
              </div>
            </div>

            <div className="surface-card p-6 space-y-4">
              <h3 className="text-body font-medium text-ink flex items-center gap-2">
                <MapPin size={17} className="text-secondary" />
                <span>Shipping Address</span>
              </h3>
              <div className="text-small text-secondary space-y-1">
                <p className="font-medium text-ink">{addr.fullName || buyerName}</p>
                <p className="font-mono text-caption">{addr.phone || '—'}</p>
                <p>{addr.address || '—'}</p>
                <p>
                  {formatVnAddress({ ward: addr.ward, city: addr.city }) || '—'}
                </p>
              </div>
            </div>

            <div className="surface-card p-6 space-y-4">
              <h3 className="text-body font-medium text-ink flex items-center gap-2">
                <CreditCard size={17} className="text-secondary" />
                <span>Payment & Coupon</span>
              </h3>
              <div className="text-small space-y-2">
                <div className="flex justify-between">
                  <span className="text-secondary">Payment Method</span>
                  <span className="font-mono text-caption uppercase text-ink">
                    {order?.paymentMethod || 'COD'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">Coupon Applied</span>
                  <span className="font-mono text-caption text-ink">
                    {order?.discountCode?.code ? (
                      <span className="inline-flex items-center gap-1 text-accent">
                        <TicketPercent size={13} />
                        {order.discountCode.code}
                      </span>
                    ) : (
                      'No'
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
