'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Minus,
  Plus,
  Trash2,
  ArrowRight,
  ShoppingBag,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { cartApi } from '../../lib/api';
import { FALLBACK_PRODUCT_IMAGE, formatPrice, handleImageError } from '../../lib/utils';
import { useI18n } from '../../lib/i18n';

const FREE_SHIPPING_THRESHOLD = 20000000;

export default function CartClient({ initialCart }) {
  const { t } = useI18n();
  const [cart, setCart] = useState(
    initialCart || {
      items: [],
      itemCount: 0,
      subtotal: 0,
      shippingFee: 0,
      taxAmount: 0,
      total: 0,
    }
  );
  const [loading, setLoading] = useState(!initialCart);
  const [updatingItemId, setUpdatingItemId] = useState(null);
  const [error, setError] = useState(null);

  const broadcastCartCount = (cartData) => {
    if (typeof window === 'undefined') return;
    const count =
      typeof cartData?.itemCount === 'number'
        ? cartData.itemCount
        : (cartData?.items || []).reduce((s, i) => s + (i.quantity || 0), 0);
    window.dispatchEvent(new CustomEvent('aevo:cart-updated', { detail: { count } }));
  };

  useEffect(() => {
    let active = true;
    async function loadCart() {
      try {
        if (!initialCart) setLoading(true);
        const res = await cartApi.getCart();
        if (!active) return;
        setCart(res.data);
        broadcastCartCount(res.data);
        setError(null);
      } catch (err) {
        if (!active) return;
        console.error('Failed to load cart:', err);
        setError(t('cart.loadError'));
      } finally {
        if (active) setLoading(false);
      }
    }
    loadCart();
    return () => {
      active = false;
    };
  }, [initialCart, t]);

  const handleUpdateQuantity = async (item, nextQty) => {
    if (!item || updatingItemId) return;
    const maxStock = item.variant?.inventory ?? 99;
    if (nextQty > maxStock) {
      setError(
        t('cart.maxStockError', {
          max: maxStock,
          name: item.variant?.product?.name || 'this item',
        })
      );
      return;
    }

    setUpdatingItemId(item.id);
    setError(null);
    try {
      if (nextQty <= 0) {
        const res = await cartApi.removeItem(item.id);
        setCart(res.data);
        broadcastCartCount(res.data);
      } else {
        const res = await cartApi.updateItem(item.id, { quantity: nextQty });
        setCart(res.data);
        broadcastCartCount(res.data);
      }
    } catch (err) {
      const msg = err?.response?.data?.error || t('cart.updateError');
      setError(msg);
    } finally {
      setUpdatingItemId(null);
    }
  };

  const handleRemoveItem = async (itemId) => {
    if (!itemId || updatingItemId) return;
    setUpdatingItemId(itemId);
    setError(null);
    try {
      const res = await cartApi.removeItem(itemId);
      setCart(res.data);
      broadcastCartCount(res.data);
    } catch (err) {
      const msg = err?.response?.data?.error || t('cart.removeError');
      setError(msg);
    } finally {
      setUpdatingItemId(null);
    }
  };

  const handleClearCart = async () => {
    setUpdatingItemId('clear-all');
    setError(null);
    try {
      const res = await cartApi.clearCart();
      setCart(res.data);
      broadcastCartCount(res.data);
    } catch {
      setError(t('cart.clearError'));
    } finally {
      setUpdatingItemId(null);
    }
  };

  const items = [...(cart?.items || [])].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
  const subtotal =
    cart?.subtotal ??
    items.reduce((sum, i) => sum + (i.variant?.price || 0) * i.quantity, 0);
  const shippingFee =
    cart?.shippingFee ??
    (subtotal === 0 ? 0 : subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : 30000);
  const taxAmount = cart?.taxAmount ?? Math.round(subtotal * 0.1);
  const total = cart?.total ?? subtotal + shippingFee + taxAmount;

  return (
    <div className="pt-[72px]" data-testid="cart-page">
      <div className="container-main py-10 md:py-14">
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="text-caption font-mono uppercase tracking-wider text-secondary mb-4"
        >
          <Link href="/" className="hover:text-ink transition-colors">
            {t('cart.breadcrumbHome')}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-ink">{t('cart.breadcrumbCart')}</span>
        </nav>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-8 border-b border-border">
          <div>
            <h1 className="text-h1">{t('cart.title')}</h1>
            <p className="text-body text-secondary mt-2">
              {t('cart.subtitle')}
            </p>
          </div>

          {items.length > 0 && (
            <button
              type="button"
              onClick={handleClearCart}
              disabled={updatingItemId === 'clear-all'}
              data-testid="cart-clear-button"
              className="text-small text-secondary hover:text-danger transition-colors inline-flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Trash2 size={15} />
              <span>{t('cart.clearSelection')}</span>
            </button>
          )}
        </div>

        {error && (
          <div
            data-testid="cart-error"
            className="mt-6 p-4 rounded-xl border border-danger/30 bg-danger/10 text-danger text-small"
          >
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 pt-8">
            <div className="lg:col-span-8 space-y-4">
              {[1, 2].map((n) => (
                <div
                  key={n}
                  className="h-36 rounded-2xl bg-surface border border-border animate-pulse"
                />
              ))}
            </div>
            <div className="lg:col-span-4 h-80 rounded-2xl bg-surface border border-border animate-pulse" />
          </div>
        ) : items.length === 0 ? (
          <div
            data-testid="cart-empty-state"
            className="mt-10 bg-surface border border-border rounded-2xl p-12 md:p-16 text-center max-w-2xl mx-auto animate-scale-in"
          >
            <div className="w-14 h-14 rounded-2xl bg-canvas border border-border flex items-center justify-center mx-auto mb-5 animate-float">
              <ShoppingBag size={24} className="text-secondary" />
            </div>
            <h2 className="text-h2 mb-2">{t('cart.emptyTitle')}</h2>
            <p className="text-small text-secondary mb-8 max-w-md mx-auto">
              {t('cart.emptyDesc')}
            </p>
            <Link
              href="/products"
              data-testid="cart-empty-explore-cta"
              className="group inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3.5 rounded-xl font-medium text-small hover:bg-primary/90 btn-interactive"
            >
              {t('cart.exploreCollection')}
              <ArrowRight size={18} className="transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 pt-8">
            {/* Cart Items List */}
            <div className="lg:col-span-8 space-y-4" data-testid="cart-items-list">
              {items.map((item) => {
                const product = item.variant?.product;
                const imageUrl =
                  item.productImage ||
                  product?.images?.find((i) => i.isPrimary)?.url ||
                  product?.images?.[0]?.url ||
                  FALLBACK_PRODUCT_IMAGE;
                const unitPrice = item.variant?.price || 0;
                const lineTotal = unitPrice * item.quantity;
                const maxStock = item.variant?.inventory ?? 99;
                const isBusy = updatingItemId === item.id;

                return (
                  <article
                    key={item.id}
                    data-testid="cart-item"
                    className="group bg-surface border border-border rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row gap-5 transition-all duration-300 hover:border-ink/30 hover:shadow-sm animate-slide-up"
                  >
                    <Link
                      href={`/products/${product?.slug || ''}`}
                      className="w-full sm:w-32 aspect-[4/3] rounded-xl overflow-hidden bg-white p-2 border border-border shrink-0 block"
                    >
                      <img
                        src={imageUrl}
                        alt={product?.name || 'Product'}
                        onError={handleImageError}
                        className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                      />
                    </Link>

                    <div className="flex-1 flex flex-col justify-between">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <span className="text-caption font-mono uppercase tracking-wider text-secondary">
                            {product?.brand || 'AEVO'} · SKU: {item.variant?.sku}
                          </span>
                          <Link
                            href={`/products/${product?.slug || ''}`}
                            className="block mt-1"
                          >
                            <h3
                              data-testid="cart-item-name"
                              className="text-lg font-display font-medium text-ink hover:text-secondary transition-colors"
                            >
                              {product?.name}
                            </h3>
                          </Link>
                          <p
                            data-testid="cart-item-variant"
                            className="text-small text-secondary mt-0.5"
                          >
                            {t('cart.configurationPrefix', { name: item.variant?.name || '' })}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          disabled={isBusy}
                          data-testid={`cart-item-remove-${item.id}`}
                          aria-label={`Remove ${product?.name}`}
                          className="p-2 rounded-lg text-secondary hover:text-danger hover:bg-canvas transition-all duration-150 hover:scale-110 active:scale-90"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>

                      <div className="mt-4 pt-4 border-t border-border/60 flex flex-wrap items-center justify-between gap-4">
                        {/* Quantity Stepper */}
                        <div className="flex items-center gap-3">
                          <div className="inline-flex items-center rounded-xl border border-border bg-canvas h-10 px-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateQuantity(item, item.quantity - 1)
                              }
                              disabled={isBusy || item.quantity <= 1}
                              data-testid={`cart-item-decrease-${item.id}`}
                              aria-label="Decrease quantity"
                              className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-ink hover:bg-surface active:scale-90 transition-all duration-150 disabled:opacity-40 disabled:active:scale-100"
                            >
                              <Minus size={14} />
                            </button>
                            <span
                              key={item.quantity}
                              data-testid={`cart-item-quantity-${item.id}`}
                              className="w-10 text-center text-small font-mono font-medium text-ink animate-scale-in"
                            >
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateQuantity(item, item.quantity + 1)
                              }
                              disabled={isBusy || item.quantity >= maxStock}
                              data-testid={`cart-item-increase-${item.id}`}
                              aria-label="Increase quantity"
                              className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-ink hover:bg-surface active:scale-90 transition-all duration-150 disabled:opacity-40 disabled:active:scale-100"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          <span className="text-caption font-mono text-secondary">
                            {t('cart.inStockCount', { count: maxStock })}
                          </span>
                        </div>

                        {/* Unit & Line Price */}
                        <div className="text-right">
                          <div
                            data-testid={`cart-item-total-${item.id}`}
                            className="text-base font-medium text-ink"
                          >
                            {formatPrice(lineTotal)}
                          </div>
                          {item.quantity > 1 && (
                            <div className="text-caption text-secondary">
                              {t('cart.eachPrice', { price: formatPrice(unitPrice) })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Order Summary Panel */}
            <aside className="lg:col-span-4" data-testid="cart-summary">
              <div className="bg-surface border border-border rounded-2xl p-6 sticky top-24 space-y-6">
                <h2 className="text-h3">{t('cart.orderSummary')}</h2>

                <dl className="space-y-3 text-small border-b border-border pb-5">
                  <div className="flex items-center justify-between">
                    <dt className="text-secondary">{t('cart.subtotal')}</dt>
                    <dd
                      data-testid="cart-subtotal"
                      className="font-medium text-ink"
                    >
                      {formatPrice(subtotal)}
                    </dd>
                  </div>

                  <div className="flex items-center justify-between">
                    <dt className="text-secondary">{t('cart.shippingFee')}</dt>
                    <dd
                      data-testid="cart-shipping"
                      className="font-medium text-ink"
                    >
                      {shippingFee === 0 ? t('cart.free') : formatPrice(shippingFee)}
                    </dd>
                  </div>

                  <div className="flex items-center justify-between">
                    <dt className="text-secondary">{t('cart.estimatedTax')}</dt>
                    <dd data-testid="cart-tax" className="font-medium text-ink">
                      {formatPrice(taxAmount)}
                    </dd>
                  </div>
                </dl>

                <div className="flex items-baseline justify-between">
                  <span className="text-base font-medium text-ink">
                    {t('cart.estimatedTotal')}
                  </span>
                  <span
                    data-testid="cart-total"
                    className="text-2xl font-display font-medium text-ink"
                  >
                    {formatPrice(total)}
                  </span>
                </div>

                {subtotal < FREE_SHIPPING_THRESHOLD && (
                  <p className="text-caption text-secondary bg-canvas border border-border rounded-xl p-3">
                    {t('cart.freeShippingHintPrefix')}{' '}
                    <strong className="text-ink font-medium">
                      {formatPrice(FREE_SHIPPING_THRESHOLD - subtotal)}
                    </strong>{' '}
                    {t('cart.freeShippingHintSuffix')}
                  </p>
                )}

                <div className="space-y-3">
                  <Link
                    href="/checkout"
                    data-testid="cart-checkout-cta"
                    className="group w-full h-12 rounded-xl bg-primary text-primary-foreground font-medium text-small hover:bg-primary/90 btn-interactive inline-flex items-center justify-center gap-2"
                  >
                    <span>{t('cart.checkout')}</span>
                    <ArrowRight size={18} className="transition-transform duration-200 group-hover:translate-x-1" />
                  </Link>

                  <Link
                    href="/products"
                    className="w-full h-11 rounded-xl border border-border bg-surface hover:bg-canvas text-ink font-medium text-small btn-interactive inline-flex items-center justify-center"
                  >
                    {t('cart.continueShopping')}
                  </Link>
                </div>

                <div className="pt-4 border-t border-border space-y-2 text-caption text-secondary">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={14} className="text-ink shrink-0" />
                    <span>{t('cart.loyaltyHighlight')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Truck size={14} className="text-ink shrink-0" />
                    <span>{t('cart.discountHighlight')}</span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
