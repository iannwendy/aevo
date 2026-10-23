'use client';

import { useEffect, useState, useCallback, Fragment } from 'react';
import Link from 'next/link';
import {
  TicketPercent,
  Plus,
  Sparkles,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';
import AdminShell from '../../../components/admin/AdminShell';
import { discountsApi } from '../../../lib/api';
import { formatPrice } from '../../../lib/utils';
import { useI18n } from '../../../lib/i18n';

function generateRandom5CharCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = new Uint32Array(5);
  globalThis.crypto.getRandomValues(bytes);
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

export default function AdminDiscountsPage() {
  const { t, locale } = useI18n();

  const [discounts, setDiscounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedDiscountId, setExpandedDiscountId] = useState(null);

  // Create form state
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState('percentage');
  const [discountValue, setDiscountValue] = useState('10');
  const [maxUses, setMaxUses] = useState('10');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const loadDiscounts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await discountsApi.getAll();
      if (Array.isArray(res.data)) {
        setDiscounts(res.data);
      }
    } catch {
      // Keep default state when unauthenticated
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDiscounts();
  }, [loadDiscounts]);

  const handleCreateDiscount = async (e) => {
    e.preventDefault();
    setFeedback(null);

    const normalizedCode = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{5}$/.test(normalizedCode)) {
      setFeedback({
        type: 'error',
        message: 'Code must be Phono/Alphanumeric and strictly 5 characters (A-Z, 0-9).',
      });
      return;
    }

    const parsedMax = Number(maxUses);
    if (!Number.isInteger(parsedMax) || parsedMax < 1 || parsedMax > 10) {
      setFeedback({
        type: 'error',
        message: 'Maximum usage limit must be between 1 and 10.',
      });
      return;
    }

    try {
      setCreating(true);
      await discountsApi.create({
        code: normalizedCode,
        discountType,
        discountValue: Number(discountValue),
        maxUses: parsedMax,
        description: description.trim() || undefined,
      });
      setCode('');
      setDescription('');
      setFeedback({
        type: 'success',
        message: `Discount code ${normalizedCode} created (max ${parsedMax} uses, no expiration).`,
      });
      loadDiscounts();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.error || 'Failed to create discount code.',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDeactivate = async (discount) => {
    setFeedback(null);
    try {
      await discountsApi.delete(discount.id);
      setFeedback({
        type: 'success',
        message: `Code ${discount.code} deactivated (isActive = false).`,
      });
      loadDiscounts();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.error || 'Could not deactivate discount.',
      });
    }
  };

  const handleReactivate = async (discount) => {
    setFeedback(null);
    try {
      await discountsApi.update(discount.id, { isActive: true });
      setFeedback({
        type: 'success',
        message: `Code ${discount.code} reactivated.`,
      });
      loadDiscounts();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.error || 'Could not reactivate discount.',
      });
    }
  };

  return (
    <AdminShell>
      <div className="space-y-8" data-testid="admin-discounts-page">
        {/* Header */}
        <div className="border-b border-border pb-6">
          <p className="text-caption font-mono uppercase tracking-widest text-secondary">
            {t('admin.discountsEyebrow')}
          </p>
          <h1 className="text-h1 font-display mt-1">{t('admin.discountsTitle')}</h1>
          <p className="text-body text-secondary mt-1">{t('admin.discountsSubtitle')}</p>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            data-testid="discount-feedback"
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

        {/* Create Discount Code Form (5 chars alphanumeric, max 10 uses, no expiration) */}
        <div className="surface-card p-6" data-testid="admin-create-discount-card">
          <h2 className="text-h3 font-display font-medium text-ink mb-4 flex items-center gap-2">
            <TicketPercent size={20} className="text-secondary" />
            <span>{t('admin.createDiscountTitle')}</span>
          </h2>

          <form
            onSubmit={handleCreateDiscount}
            className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end"
            data-testid="admin-discount-form"
          >
            <div className="md:col-span-3">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-caption font-mono uppercase text-secondary">
                  Code (5 Chars) *
                </label>
                <button
                  type="button"
                  onClick={() => setCode(generateRandom5CharCode())}
                  className="text-[11px] font-mono text-accent hover:underline inline-flex items-center gap-1"
                >
                  <Sparkles size={11} />
                  Generate
                </button>
              </div>
              <input
                type="text"
                maxLength={5}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g., SAVE5"
                data-testid="discount-code-input"
                className="input-field h-11 font-mono uppercase tracking-widest text-small"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-caption font-mono uppercase text-secondary mb-1.5">
                Discount Type
              </label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value)}
                data-testid="discount-type-select"
                className="input-field h-11 text-small"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed (VND)</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-caption font-mono uppercase text-secondary mb-1.5">
                Discount Value *
              </label>
              <input
                type="number"
                min="1"
                required
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                data-testid="discount-value-input"
                className="input-field h-11 font-mono text-small"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-caption font-mono uppercase text-secondary mb-1.5">
                Usage Limit (Max 10) *
              </label>
              <input
                type="number"
                min="1"
                max="10"
                required
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                data-testid="discount-max-uses-input"
                className="input-field h-11 font-mono text-small"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-caption font-mono uppercase text-secondary mb-1.5">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., VIP Workstation Promo"
                className="input-field h-11 text-small"
              />
            </div>

            <div className="md:col-span-12 flex items-center justify-between pt-2">
              <p className="text-caption text-secondary font-mono">
                Format: 5 alphanumeric chars · Max 10 uses · No expiration date.
              </p>
              <button
                type="submit"
                disabled={creating}
                data-testid="create-discount-submit-btn"
                className="btn-primary h-11 px-6 text-small"
              >
                <Plus size={16} className="mr-1.5" />
                {creating ? 'Creating Code…' : 'Create Discount Code'}
              </button>
            </div>
          </form>
        </div>

        {/* Discount Codes Table */}
        <div className="surface-card overflow-hidden" data-testid="admin-discounts-table">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-caption font-mono uppercase text-secondary">
                  <th className="py-3.5 px-4">{t('admin.thCode')}</th>
                  <th className="py-3.5 px-4">{t('admin.thDiscountValue')}</th>
                  <th className="py-3.5 px-4">{t('admin.thUsage')}</th>
                  <th className="py-3.5 px-4">{t('admin.thCreatedTime')}</th>
                  <th className="py-3.5 px-4">{t('admin.thAppliedOrders')}</th>
                  <th className="py-3.5 px-4">{t('admin.thStatus')}</th>
                  <th className="py-3.5 px-4 text-right">{t('admin.thActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-small">
                {discounts.map((discount) => {
                  const appliedOrders =
                    discount.orders?.length > 0
                      ? discount.orders
                      : (discount.usageHistory || [])
                          .map((u) => u.order)
                          .filter(Boolean);
                  const isExpanded = expandedDiscountId === discount.id;
                  const isExhausted = discount.usedCount >= discount.maxUses;

                  return (
                    <Fragment key={discount.id}>
                      <tr
                        className="table-row-interactive"
                        data-testid={`admin-discount-row-${discount.code}`}
                      >
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center px-3 py-1 rounded-lg bg-surface-muted border border-border font-mono font-medium tracking-widest text-ink">
                            {discount.code}
                          </span>
                          {discount.description && (
                            <p className="text-caption text-secondary mt-1">
                              {discount.description}
                            </p>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-ink font-medium">
                          {discount.discountType === 'percentage'
                            ? `${discount.discountValue}% OFF`
                            : `-${formatPrice(discount.discountValue)}`}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="max-w-[160px]">
                            <div className="flex justify-between font-mono text-caption mb-1">
                              <span className="text-ink font-medium">
                                {discount.usedCount} / {discount.maxUses}
                              </span>
                              <span className="text-secondary">
                                {Math.max(0, discount.maxUses - discount.usedCount)} left
                              </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-border overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ease-out ${
                                  isExhausted ? 'bg-warning' : 'bg-primary'
                                }`}
                                style={{
                                  width: `${Math.min(
                                    100,
                                    (discount.usedCount / Math.max(1, discount.maxUses)) * 100
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-caption text-secondary">
                          {discount.createdAt
                            ? new Date(discount.createdAt).toLocaleString(
                                locale === 'vi' ? 'vi-VN' : 'en-US'
                              )
                            : '—'}
                        </td>
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedDiscountId(isExpanded ? null : discount.id)
                            }
                            data-testid={`toggle-discount-orders-${discount.code}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-muted border border-border font-mono text-caption text-ink hover:border-ink/40"
                          >
                            <span>{appliedOrders.length} order(s)</span>
                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </button>
                        </td>
                        <td className="py-3.5 px-4">
                          {!discount.isActive ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-pill border border-danger/30 bg-danger/10 text-danger text-[11px] font-mono uppercase">
                              Deactivated
                            </span>
                          ) : isExhausted ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-pill border border-warning/30 bg-warning/10 text-warning text-[11px] font-mono uppercase">
                              Exhausted
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-pill border border-success/30 bg-success/10 text-success text-[11px] font-mono uppercase">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {discount.isActive ? (
                            <button
                              type="button"
                              onClick={() => handleDeactivate(discount)}
                              data-testid={`deactivate-discount-btn-${discount.code}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-surface text-caption font-medium text-danger hover:border-danger/40 btn-interactive"
                            >
                              <Trash2 size={13} />
                              <span>Deactivate</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleReactivate(discount)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-surface text-caption font-medium text-success hover:border-success/40 btn-interactive"
                            >
                              <RotateCcw size={13} />
                              <span>Activate</span>
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Expandable list of orders where this coupon was applied */}
                      {isExpanded && (
                        <tr className="bg-surface-muted/60 animate-fade-in">
                          <td colSpan={7} className="p-4">
                            <p className="text-caption font-mono uppercase text-secondary mb-2">
                              Orders Using Coupon {discount.code} ({appliedOrders.length})
                            </p>
                            {appliedOrders.length > 0 ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                {appliedOrders.map((ord) => (
                                  <div
                                    key={ord.id}
                                    className="p-3 rounded-xl bg-surface border border-border flex items-center justify-between gap-3 text-caption font-mono"
                                  >
                                    <div>
                                      <Link
                                        href={`/admin/orders/${ord.id}`}
                                        className="font-medium text-ink hover:underline"
                                      >
                                        {ord.orderNumber}
                                      </Link>
                                      <p className="text-secondary mt-0.5">
                                        {ord.user?.fullName || ord.guestName || 'Customer'} ·{' '}
                                        {ord.createdAt
                                          ? new Date(ord.createdAt).toLocaleDateString()
                                          : ''}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-success">
                                        -{formatPrice(ord.discountAmount || 0)}
                                      </p>
                                      <p className="text-ink">
                                        Total: {formatPrice(ord.totalAmount || 0)}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-small text-secondary">
                                No orders have applied this discount code yet.
                              </p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}

                {!loading && discounts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-secondary">
                      No discount codes created yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
