import Link from 'next/link';
import { cookies, headers } from 'next/headers';
import {
  CheckCircle2,
  Package,
  MapPin,
  CreditCard,
  Mail,
  Sparkles,
  ArrowRight,
  Clock,
} from 'lucide-react';
import SiteHeader from '../../../../components/SiteHeader';
import SiteFooter from '../../../../components/SiteFooter';
import { formatPrice } from '../../../../lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function fetchOrderDetails(searchParams) {
  const ref =
    searchParams?.orderNumber ||
    searchParams?.orderId ||
    searchParams?.id ||
    null;

  if (!ref) return null;

  try {
    const cookieStore = cookies();
    const headerStore = headers();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');
    const authHeader = headerStore.get('authorization');

    const reqHeaders = {};
    if (cookieHeader) reqHeaders.Cookie = cookieHeader;
    if (authHeader) reqHeaders.Authorization = authHeader;

    const endpoint =
      ref.startsWith('AEVO-') || ref.startsWith('ORD-')
        ? `${API_URL}/api/orders/number/${encodeURIComponent(ref)}`
        : `${API_URL}/api/orders/${encodeURIComponent(ref)}`;

    const res = await fetch(endpoint, {
      headers: reqHeaders,
      cache: 'no-store',
    });

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export const metadata = {
  title: 'Order Confirmed — AEVO Store',
  description: 'Your precision hardware order has been received and confirmed.',
};

export default async function CheckoutSuccessPage({ searchParams }) {
  const order = await fetchOrderDetails(searchParams);
  const shippingAddr = order?.shippingAddress || order?.address || {};

  return (
    <main className="min-h-screen flex flex-col justify-between">
      <SiteHeader />

      <div className="pt-[72px] flex-1" data-testid="order-success-page">
        <div className="container-main py-12 md:py-16">
          <div className="max-w-[820px] mx-auto">
            {/* Success Banner */}
            <div className="bg-surface border border-border rounded-card p-8 md:p-10 mb-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-pill bg-success/10 text-success flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" strokeWidth={1.75} />
                </div>
                <div className="flex-1">
                  <span className="text-caption font-mono uppercase tracking-widest text-success">
                    ORDER CONFIRMED
                  </span>
                  <h1 className="text-h1 mt-1">Thank you for your order.</h1>
                  <p className="text-body text-secondary mt-2">
                    Your hardware selection has been reserved and your invoice has been generated.
                  </p>

                  {order ? (
                    <div className="mt-6 pt-6 border-t border-border grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <span className="text-caption font-mono uppercase tracking-wider text-secondary block">
                          ORDER NUMBER
                        </span>
                        <span
                          className="font-mono text-[16px] font-medium text-ink mt-1 block"
                          data-testid="success-order-number"
                        >
                          {order.orderNumber}
                        </span>
                      </div>
                      <div>
                        <span className="text-caption font-mono uppercase tracking-wider text-secondary block">
                          DATE & TIME
                        </span>
                        <span className="font-mono text-[14px] text-ink mt-1 block">
                          {new Date(order.createdAt).toLocaleString('vi-VN')}
                        </span>
                      </div>
                      <div>
                        <span className="text-caption font-mono uppercase tracking-wider text-secondary block">
                          CURRENT STATUS
                        </span>
                        <span
                          className="inline-flex items-center gap-1.5 font-mono text-[12px] uppercase tracking-wider px-2.5 py-0.5 rounded-pill bg-accent/10 text-accent mt-1"
                          data-testid="success-order-status"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          {order.status}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-6 pt-6 border-t border-border">
                      <p className="text-body text-secondary">
                        Order Reference:{' '}
                        <span
                          className="font-mono text-ink font-medium"
                          data-testid="success-order-number"
                        >
                          {searchParams?.orderNumber || searchParams?.id || 'CONFIRMED'}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Email & Loyalty Notice */}
              <div className="mt-6 pt-6 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-[13px] text-secondary">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-ink shrink-0" />
                  <span>
                    Confirmation details dispatched to{' '}
                    <strong className="text-ink font-medium">
                      {shippingAddr.email || order?.user?.email || 'your email address'}
                    </strong>
                  </span>
                </div>
                {(order?.earnedPoints > 0 || order?.earnedLoyaltyPoints > 0) && (
                  <div
                    className="flex items-center gap-1.5 font-mono text-success"
                    data-testid="success-earned-points"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>
                      +{order.earnedPoints || order.earnedLoyaltyPoints} Loyalty Points Earned
                    </span>
                  </div>
                )}
              </div>
            </div>

            {order ? (
              <div className="space-y-8" data-testid="success-order-details">
                {/* Order Items */}
                <section className="border border-border rounded-card p-6 md:p-8 bg-bg">
                  <div className="flex items-center gap-2 pb-4 border-b border-border mb-4">
                    <Package className="w-4 h-4 text-secondary" />
                    <h2 className="text-caption font-mono uppercase tracking-wider text-secondary">
                      ORDERED HARDWARE ({order.items?.length || 0})
                    </h2>
                  </div>

                  <div className="divide-y divide-border" data-testid="success-order-items">
                    {(order.items || []).map((item) => (
                      <div
                        key={item.id}
                        className="py-4 flex items-center justify-between gap-4"
                        data-testid="success-order-item"
                      >
                        <div>
                          <p className="text-[15px] font-medium text-ink">
                            {item.productName}
                          </p>
                          <p className="text-[13px] font-mono text-secondary mt-0.5">
                            Variant: {item.variantName} · Qty: {item.quantity} ×{' '}
                            {formatPrice(item.price)}
                          </p>
                        </div>
                        <div className="font-mono text-[15px] font-medium text-ink">
                          {formatPrice(item.total)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Financial Breakdown */}
                  <div className="mt-6 pt-6 border-t border-border space-y-2.5 text-[14px]">
                    <div className="flex justify-between">
                      <span className="text-secondary">Subtotal</span>
                      <span className="font-mono text-ink" data-testid="success-subtotal">
                        {formatPrice(order.subtotal)}
                      </span>
                    </div>
                    {order.discountAmount > 0 && (
                      <div className="flex justify-between text-success">
                        <span>
                          Discount
                          {order.discountCode
                            ? ` (${order.discountCode.code || order.discountCode})`
                            : ''}
                        </span>
                        <span className="font-mono" data-testid="success-discount">
                          -{formatPrice(order.discountAmount)}
                        </span>
                      </div>
                    )}
                    {order.loyaltyDiscount > 0 && (
                      <div className="flex justify-between text-success">
                        <span>Loyalty Points ({order.usedLoyaltyPoints} pts)</span>
                        <span className="font-mono" data-testid="success-loyalty-discount">
                          -{formatPrice(order.loyaltyDiscount)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-secondary">Shipping Fee</span>
                      <span className="font-mono text-ink">
                        {order.shippingFee === 0 ? 'FREE' : formatPrice(order.shippingFee)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary">VAT (10%)</span>
                      <span className="font-mono text-ink">
                        {formatPrice(order.taxAmount)}
                      </span>
                    </div>
                    <div className="pt-3 border-t border-border flex justify-between items-baseline">
                      <span className="font-medium text-ink">Total Paid / Due</span>
                      <span
                        className="font-mono text-[22px] font-semibold text-ink"
                        data-testid="success-total"
                      >
                        {formatPrice(order.totalAmount)}
                      </span>
                    </div>
                  </div>
                </section>

                {/* Shipping & Payment Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <section className="border border-border rounded-card p-6 bg-bg">
                    <div className="flex items-center gap-2 pb-3 border-b border-border mb-4">
                      <MapPin className="w-4 h-4 text-secondary" />
                      <h2 className="text-caption font-mono uppercase tracking-wider text-secondary">
                        DELIVERY DESTINATION
                      </h2>
                    </div>
                    <div className="text-[14px] space-y-1 text-ink">
                      <p className="font-medium">{shippingAddr.fullName}</p>
                      <p className="font-mono text-[13px] text-secondary">
                        {shippingAddr.phone}
                      </p>
                      <p className="text-secondary mt-2">
                        {[
                          shippingAddr.address,
                          shippingAddr.ward,
                          shippingAddr.district,
                          shippingAddr.city,
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    </div>
                  </section>

                  <section className="border border-border rounded-card p-6 bg-bg">
                    <div className="flex items-center gap-2 pb-3 border-b border-border mb-4">
                      <CreditCard className="w-4 h-4 text-secondary" />
                      <h2 className="text-caption font-mono uppercase tracking-wider text-secondary">
                        PAYMENT & TIMELINE
                      </h2>
                    </div>
                    <div className="text-[14px] space-y-2">
                      <div className="flex justify-between">
                        <span className="text-secondary">Payment Method</span>
                        <span className="font-mono uppercase text-ink">
                          {order.paymentMethod || 'COD'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-secondary">Status History</span>
                        <span className="font-mono text-ink">
                          {order.statusHistory?.length || 1} event(s)
                        </span>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            ) : null}

            {/* Action Buttons */}
            <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
              <Link
                href="/account/orders"
                className="px-6 py-3 rounded-pill border border-border text-[14px] font-medium text-ink hover:border-ink transition-colors"
              >
                View Order History
              </Link>
              <Link
                href="/products"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-pill bg-ink text-bg text-[14px] font-medium hover:bg-accent transition-colors"
              >
                <span>Continue Shopping</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
