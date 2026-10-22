'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Search,
  Calendar,
  ArrowRight,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import AdminShell from '../../../components/admin/AdminShell';
import Pagination from '../../../components/product/Pagination';
import { ordersApi } from '../../../lib/api';
import { formatPrice } from '../../../lib/utils';
import { useI18n } from '../../../lib/i18n';

const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'SHIPPING', 'DELIVERED', 'CANCELLED'];

function getStatusBadge(status) {
  switch (status) {
    case 'DELIVERED':
      return {
        className: 'bg-success/10 text-success border-success/30',
        Icon: CheckCircle2,
      };
    case 'SHIPPING':
      return {
        className: 'bg-accent/10 text-accent border-accent/30',
        Icon: Truck,
      };
    case 'CONFIRMED':
      return {
        className: 'bg-accent/10 text-accent border-accent/30',
        Icon: CheckCircle2,
      };
    case 'CANCELLED':
      return {
        className: 'bg-danger/10 text-danger border-danger/30',
        Icon: XCircle,
      };
    case 'PENDING':
    default:
      return {
        className: 'bg-warning/10 text-warning border-warning/30',
        Icon: Clock,
      };
  }
}

export default function AdminOrdersPage() {
  const { t, locale } = useI18n();

  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRangePreset, setDateRangePreset] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const [feedback, setFeedback] = useState(null);

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 20,
      };
      if (statusFilter) params.status = statusFilter;
      if (searchQuery) params.search = searchQuery;

      if (dateRangePreset && dateRangePreset !== 'custom') {
        params.dateRange = dateRangePreset;
      } else if (dateRangePreset === 'custom') {
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
      }

      const res = await ordersApi.getAdminAll(params);
      if (res.data) {
        setOrders(res.data.orders || []);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
      }
    } catch {
      // Keep default state when unauthenticated
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, searchQuery, dateRangePreset, startDate, endDate]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setSearchQuery(searchInput.trim());
  };

  const handleQuickStatusUpdate = async (orderId, nextStatus) => {
    setFeedback(null);
    try {
      await ordersApi.updateStatus(
        orderId,
        nextStatus,
        `Status updated to ${nextStatus} by Administrator`
      );
      setFeedback({
        type: 'success',
        message: `Order status updated to ${nextStatus}.`,
      });
      loadOrders();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.error || 'Could not update order status.',
      });
    }
  };

  return (
    <AdminShell>
      <div className="space-y-8" data-testid="admin-orders-page">
        {/* Header */}
        <div className="border-b border-border pb-6">
          <p className="text-caption font-mono uppercase tracking-widest text-secondary">
            {t('admin.ordersEyebrow')}
          </p>
          <h1 className="text-h1 font-display mt-1">{t('admin.ordersTitle')}</h1>
          <p className="text-body text-secondary mt-1">{t('admin.ordersSubtitle')}</p>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
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

        {/* Time Range Presets + Status + Search Filters */}
        <div className="surface-card p-5 space-y-4">
          {/* Time Range Buttons (requirement.md: Today, Yesterday, This Week, This Month, Custom Date Range) */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              className="flex flex-wrap items-center gap-1.5"
              data-testid="admin-orders-time-filters"
            >
              {[
                { id: '', label: t('admin.filterAllTime') },
                { id: 'today', label: t('admin.filterToday') },
                { id: 'yesterday', label: t('admin.filterYesterday') },
                { id: 'week', label: t('admin.filterThisWeek') },
                { id: 'month', label: t('admin.filterThisMonth') },
                { id: 'custom', label: t('admin.filterCustomRange') },
              ].map((preset) => (
                <button
                  key={preset.id || 'all'}
                  type="button"
                  data-testid={`order-time-filter-${preset.id || 'all'}`}
                  onClick={() => {
                    setDateRangePreset(preset.id);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-caption font-mono transition-all duration-200 active:scale-95 ${
                    dateRangePreset === preset.id
                      ? 'bg-primary text-primary-foreground font-medium shadow-xs'
                      : 'bg-surface-muted text-secondary hover:text-ink'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-caption font-mono uppercase text-secondary">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                data-testid="admin-orders-status-filter"
                className="input-field h-10 text-small w-auto min-w-[160px]"
              >
                <option value="">All Statuses</option>
                {ORDER_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Custom Date Range Inputs */}
          {dateRangePreset === 'custom' && (
            <div
              className="pt-3 border-t border-border flex flex-wrap items-end gap-4"
              data-testid="admin-orders-custom-range"
            >
              <div>
                <label className="block text-caption font-mono uppercase text-secondary mb-1">
                  {t('admin.startDate')}
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPage(1);
                  }}
                  className="input-field h-10 text-small"
                />
              </div>
              <div>
                <label className="block text-caption font-mono uppercase text-secondary mb-1">
                  {t('admin.endDate')}
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                  className="input-field h-10 text-small"
                />
              </div>
            </div>
          )}

          {/* Search Input */}
          <form onSubmit={handleSearch} className="flex items-center gap-2 pt-2">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary"
              />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by order number (#AEVO-...), buyer name, or email…"
                data-testid="admin-orders-search-input"
                className="input-field h-10 pl-10 text-small"
              />
            </div>
            <button type="submit" className="btn-primary h-10 px-4 text-small">
              Search
            </button>
          </form>
        </div>

        {/* Orders Table (20 items per page, newest first) */}
        <div className="surface-card overflow-hidden" data-testid="admin-orders-table">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-caption font-mono uppercase text-secondary">
                  <th className="py-3.5 px-4">Order Number</th>
                  <th className="py-3.5 px-4">Buyer</th>
                  <th className="py-3.5 px-4">Date & Time</th>
                  <th className="py-3.5 px-4">Items / Discount</th>
                  <th className="py-3.5 px-4 text-right">Total Amount</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-small">
                {orders.map((order) => {
                  const { className: badgeClass, Icon: StatusIcon } = getStatusBadge(
                    order.status
                  );
                  const buyerName =
                    order.user?.fullName ||
                    order.guestName ||
                    order.shippingAddress?.fullName ||
                    'Guest Buyer';
                  const buyerEmail = order.user?.email || order.guestEmail || '';

                  return (
                    <tr
                      key={order.id}
                      className="table-row-interactive"
                      data-testid={`admin-order-row-${order.id}`}
                    >
                      <td className="py-3.5 px-4 font-mono text-caption font-medium text-ink">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="hover:underline"
                        >
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-medium text-ink">{buyerName}</p>
                        <p className="text-caption font-mono text-secondary">{buyerEmail}</p>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-caption text-secondary">
                        {order.createdAt
                          ? new Date(order.createdAt).toLocaleString(
                              locale === 'vi' ? 'vi-VN' : 'en-US'
                            )
                          : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-caption font-mono">
                        <span className="text-ink">
                          {(order.items || []).reduce((s, i) => s + i.quantity, 0)} unit(s)
                        </span>
                        {order.discountCode?.code && (
                          <span className="ml-2 px-2 py-0.5 rounded bg-accent/15 text-accent">
                            {order.discountCode.code}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-caption tabular-nums font-medium text-ink">
                        {formatPrice(order.totalAmount)}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-pill border text-[11px] font-mono uppercase ${badgeClass}`}
                          >
                            <StatusIcon size={12} />
                            <span>{order.status}</span>
                          </span>

                          <select
                            aria-label={`Change status for ${order.orderNumber}`}
                            value={order.status}
                            onChange={(e) =>
                              handleQuickStatusUpdate(order.id, e.target.value)
                            }
                            className="h-8 px-2 rounded-lg border border-border bg-surface text-caption font-mono text-ink"
                          >
                            {ORDER_STATUSES.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          data-testid={`view-order-link-${order.id}`}
                          className="group inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-surface text-caption font-medium text-ink hover:bg-surface-muted btn-interactive"
                        >
                          <span>Details</span>
                          <ArrowRight size={13} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}

                {!loading && orders.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-secondary">
                      No orders found matching the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination (20 items per page, always displayed) */}
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          limit={pagination.limit}
          onPageChange={(nextPage) => setPage(nextPage)}
          ariaLabel="Admin Orders Pagination"
        />
      </div>
    </AdminShell>
  );
}
