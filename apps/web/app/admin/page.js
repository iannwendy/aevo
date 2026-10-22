'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import {
  Users,
  UserPlus,
  ShoppingBag,
  TrendingUp,
  DollarSign,
  Layers,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  PieChart as PieChartIcon,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import AdminShell from '../../components/admin/AdminShell';
import { analyticsApi } from '../../lib/api';
import { formatPrice } from '../../lib/utils';
import { getChartTheme } from '../../lib/theme-config';
import { useI18n } from '../../lib/i18n';

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

export default function AdminDashboardPage() {
  const { t, locale, catName } = useI18n();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Simple Dashboard state
  const [simpleData, setSimpleData] = useState({
    totalUsers: 0,
    newUsers: 0,
    totalOrders: 0,
    revenue: 0,
    profit: 0,
    bestSellers: [],
    recentOrders: [],
  });
  const [simpleLoading, setSimpleLoading] = useState(true);

  // Advanced Dashboard state (default: 'year' per requirement.md)
  const [period, setPeriod] = useState('year');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [chartInterval, setChartInterval] = useState('month');
  const [advancedData, setAdvancedData] = useState({
    summary: {
      orderCount: 0,
      revenue: 0,
      profit: 0,
      productsSold: 0,
      avgOrderValue: 0,
    },
    comparison: {
      revenueChange: 0,
      profitChange: 0,
      orderCountChange: 0,
      productsSoldChange: 0,
    },
    revenueByMonth: [],
    timeSeries: [],
    comparativeByInterval: { year: [], quarter: [], month: [], week: [] },
    productTypes: [],
    topProducts: [],
  });
  const [advLoading, setAdvLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadSimpleDashboard = useCallback(async () => {
    try {
      setSimpleLoading(true);
      const res = await analyticsApi.getSimpleDashboard();
      if (res.data) {
        setSimpleData(res.data);
      }
    } catch (err) {
      // Keep default state when unauthenticated or error
    } finally {
      setSimpleLoading(false);
    }
  }, []);

  const loadAdvancedDashboard = useCallback(
    async (selectedPeriod, customStart, customEnd) => {
      try {
        setAdvLoading(true);
        const params = { period: selectedPeriod };
        if (customStart) params.startDate = customStart;
        if (customEnd) params.endDate = customEnd;
        const res = await analyticsApi.getAdvancedDashboard(params);
        if (res.data) {
          setAdvancedData(res.data);
        }
      } catch (err) {
        // Keep default state when unauthenticated or error
      } finally {
        setAdvLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadSimpleDashboard();
  }, [loadSimpleDashboard]);

  useEffect(() => {
    if (period !== 'custom') {
      loadAdvancedDashboard(period, '', '');
    }
  }, [period, loadAdvancedDashboard]);

  const handleApplyCustomRange = (e) => {
    e.preventDefault();
    loadAdvancedDashboard('custom', startDate, endDate);
  };

  const chartTheme = getChartTheme(mounted ? resolvedTheme : 'light');

  const activeComparativeSeries =
    advancedData.comparativeByInterval?.[chartInterval]?.length > 0
      ? advancedData.comparativeByInterval[chartInterval]
      : advancedData.revenueByMonth || [];

  const bestSellersChartData = (simpleData.bestSellers || []).map((item) => ({
    name:
      item.productName?.length > 22
        ? `${item.productName.slice(0, 22)}…`
        : item.productName,
    fullName: item.productName,
    units: item._sum?.quantity ?? item.quantitySold ?? 0,
    revenue: item.revenue || 0,
  }));

  return (
    <AdminShell>
      <div className="space-y-10" data-testid="admin-dashboard-page">
        {/* Page Heading */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-6">
          <div>
            <p className="text-caption font-mono uppercase tracking-widest text-secondary">
              {t('admin.overviewEyebrow')}
            </p>
            <h1 className="text-h1 font-display mt-1">{t('admin.dashboardTitle')}</h1>
            <p className="text-body text-secondary mt-1">{t('admin.dashboardSubtitle')}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link href="/admin/products/new" className="btn-primary text-small px-4 py-2.5 h-auto">
              + {t('admin.addProductBtn')}
            </Link>
            <Link href="/admin/orders" className="btn-secondary text-small px-4 py-2.5 h-auto">
              {t('admin.navOrders')}
            </Link>
          </div>
        </div>

        {/* ================================================================ */}
        {/* 1. SIMPLE DASHBOARD SECTION                                      */}
        {/* ================================================================ */}
        <section aria-labelledby="simple-dashboard-heading" data-testid="simple-dashboard-section">
          <div className="flex items-center justify-between mb-4">
            <h2
              id="simple-dashboard-heading"
              className="text-h3 font-display font-medium text-ink"
            >
              {t('admin.simpleSectionTitle')}
            </h2>
            {simpleLoading && (
              <span className="text-caption font-mono text-secondary">Syncing metrics…</span>
            )}
          </div>

          {/* 4 KPI Cards */}
          <div
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6"
            data-testid="simple-kpi-grid"
          >
            <div
              className="surface-card p-6 flex flex-col justify-between hover-lift animate-slide-up stagger-1"
              data-testid="kpi-total-users"
            >
              <div className="flex items-center justify-between text-secondary">
                <span className="text-caption font-mono uppercase tracking-wider">
                  {t('admin.kpiTotalUsers')}
                </span>
                <Users size={18} strokeWidth={1.75} />
              </div>
              <div className="mt-4">
                <p className="text-3xl font-display font-medium tabular-nums text-ink">
                  {simpleData.totalUsers.toLocaleString()}
                </p>
                <p className="text-caption text-secondary mt-1">
                  Registered customer & admin accounts
                </p>
              </div>
            </div>

            <div
              className="surface-card p-6 flex flex-col justify-between hover-lift animate-slide-up stagger-2"
              data-testid="kpi-new-users"
            >
              <div className="flex items-center justify-between text-secondary">
                <span className="text-caption font-mono uppercase tracking-wider">
                  {t('admin.kpiNewUsers30d')}
                </span>
                <UserPlus size={18} strokeWidth={1.75} />
              </div>
              <div className="mt-4">
                <p className="text-3xl font-display font-medium tabular-nums text-ink">
                  +{simpleData.newUsers.toLocaleString()}
                </p>
                <p className="text-caption text-success mt-1">Joined in the last 30 days</p>
              </div>
            </div>

            <div
              className="surface-card p-6 flex flex-col justify-between hover-lift animate-slide-up stagger-3"
              data-testid="kpi-total-orders"
            >
              <div className="flex items-center justify-between text-secondary">
                <span className="text-caption font-mono uppercase tracking-wider">
                  {t('admin.kpiTotalOrders')}
                </span>
                <ShoppingBag size={18} strokeWidth={1.75} />
              </div>
              <div className="mt-4">
                <p className="text-3xl font-display font-medium tabular-nums text-ink">
                  {simpleData.totalOrders.toLocaleString()}
                </p>
                <p className="text-caption text-secondary mt-1">All-time store orders</p>
              </div>
            </div>

            <div
              className="surface-card p-6 flex flex-col justify-between hover-lift animate-slide-up stagger-4"
              data-testid="kpi-total-revenue"
            >
              <div className="flex items-center justify-between text-secondary">
                <span className="text-caption font-mono uppercase tracking-wider">
                  {t('admin.kpiTotalRevenue')}
                </span>
                <DollarSign size={18} strokeWidth={1.75} />
              </div>
              <div className="mt-4">
                <p className="text-2xl sm:text-3xl font-display font-medium tabular-nums text-ink">
                  {formatPrice(simpleData.revenue)}
                </p>
                <p className="text-caption text-secondary mt-1">
                  Est. profit: {formatPrice(simpleData.revenue * 0.2)}
                </p>
              </div>
            </div>
          </div>

          {/* Best Sellers Chart + Recent Orders */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Best Selling Products Chart & List */}
            <div
              className="lg:col-span-6 surface-card p-6 flex flex-col justify-between min-w-0"
              data-testid="best-sellers-chart"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-body font-medium text-ink flex items-center gap-2">
                    <BarChart3 size={18} className="text-secondary" />
                    <span>{t('admin.bestSellersChartTitle')}</span>
                  </h3>
                  <span className="text-caption font-mono text-secondary">Top 5</span>
                </div>

                {mounted && bestSellersChartData.length > 0 && (
                  <div className="h-60 w-full mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={bestSellersChartData}
                        margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
                      >
                        <CartesianGrid {...chartTheme.cartesianGrid} />
                        <XAxis dataKey="name" {...chartTheme.axis} />
                        <YAxis allowDecimals={false} {...chartTheme.axis} />
                        <Tooltip
                          contentStyle={chartTheme.tooltip.contentStyle}
                          labelStyle={chartTheme.tooltip.labelStyle}
                          itemStyle={chartTheme.tooltip.itemStyle}
                          cursor={chartTheme.tooltip.cursor}
                        />
                        <Bar
                          dataKey="units"
                          name="Units Sold"
                          fill={chartTheme.series.primary}
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div className="space-y-2.5 mt-2">
                  {(simpleData.bestSellers || []).map((item, idx) => {
                    const qty = item._sum?.quantity ?? item.quantitySold ?? 0;
                    return (
                      <div
                        key={item.productId || idx}
                        className="flex items-center justify-between py-2 border-b border-border/60 last:border-0 text-small"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-surface-muted border border-border font-mono text-caption flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="font-medium text-ink truncate">
                            {item.productName}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 shrink-0 font-mono text-caption">
                          <span className="text-secondary">{qty} sold</span>
                          {item.revenue > 0 && (
                            <span className="text-ink font-medium">
                              {formatPrice(item.revenue)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {(!simpleData.bestSellers || simpleData.bestSellers.length === 0) && (
                    <p className="text-small text-secondary py-6 text-center">
                      No product sales recorded yet.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Recent Orders Table */}
            <div
              className="lg:col-span-6 surface-card p-6 flex flex-col justify-between min-w-0"
              data-testid="recent-orders-table"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-body font-medium text-ink">{t('admin.recentOrdersTitle')}</h3>
                  <Link
                    href="/admin/orders"
                    className="text-caption font-medium text-secondary hover:text-ink transition-colors"
                  >
                    {t('admin.viewAllOrders')}
                  </Link>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border text-caption font-mono uppercase text-secondary">
                        <th className="py-2.5 pr-3">Order</th>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 pl-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 text-small">
                      {(simpleData.recentOrders || []).slice(0, 6).map((order) => (
                        <tr key={order.id} className="table-row-interactive">
                          <td className="py-3 pr-3 font-mono text-caption">
                            <Link
                              href={`/admin/orders/${order.id}`}
                              className="text-ink font-medium hover:underline"
                            >
                              {order.orderNumber}
                            </Link>
                          </td>
                          <td className="py-3 px-3 truncate max-w-[160px]">
                            <p className="text-ink font-medium truncate">
                              {order.user?.fullName || order.guestName || 'Guest'}
                            </p>
                            <p className="text-caption text-secondary truncate">
                              {order.user?.email || order.guestEmail || ''}
                            </p>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-pill border text-[11px] font-mono uppercase ${getStatusBadgeClass(
                                order.status
                              )}`}
                            >
                              {order.status}
                            </span>
                          </td>
                          <td className="py-3 pl-3 text-right font-mono text-caption tabular-nums text-ink">
                            {formatPrice(order.totalAmount)}
                          </td>
                        </tr>
                      ))}
                      {(!simpleData.recentOrders || simpleData.recentOrders.length === 0) && (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-secondary">
                            No recent orders found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* 2. ADVANCED DASHBOARD SECTION                                    */}
        {/* ================================================================ */}
        <section
          aria-labelledby="advanced-dashboard-heading"
          className="pt-8 border-t border-border"
          data-testid="advanced-dashboard-section"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <div>
              <h2
                id="advanced-dashboard-heading"
                className="text-h3 font-display font-medium text-ink"
              >
                {t('admin.advancedSectionTitle')}
              </h2>
              <p className="text-small text-secondary mt-0.5">
                Track orders sold, revenue, profit, units sold, and hardware category mix across time intervals.
              </p>
            </div>

            {/* Period Selector */}
            <div
              className="flex flex-wrap items-center gap-1.5 bg-surface border border-border rounded-xl p-1.5"
              data-testid="advanced-period-selector"
            >
              {[
                { id: 'year', label: t('admin.periodYear') },
                { id: 'quarter', label: t('admin.periodQuarter') },
                { id: 'month', label: t('admin.periodMonth') },
                { id: 'week', label: t('admin.periodWeek') },
                { id: 'custom', label: t('admin.periodCustom') },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`period-btn-${item.id}`}
                  aria-pressed={period === item.id}
                  onClick={() => setPeriod(item.id)}
                  className={`px-3 py-1.5 rounded-lg text-caption font-mono transition-all duration-200 active:scale-95 ${
                    period === item.id
                      ? 'bg-primary text-primary-foreground font-medium shadow-xs'
                      : 'text-secondary hover:text-ink hover:bg-surface-muted'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Range Picker */}
          {period === 'custom' && (
            <form
              onSubmit={handleApplyCustomRange}
              data-testid="advanced-custom-date-form"
              className="surface-card p-4 mb-6 flex flex-wrap items-end gap-4"
            >
              <div>
                <label className="block text-caption font-mono uppercase text-secondary mb-1">
                  {t('admin.startDate')}
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input-field h-10 py-1.5 text-small"
                />
              </div>
              <div>
                <label className="block text-caption font-mono uppercase text-secondary mb-1">
                  {t('admin.endDate')}
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="input-field h-10 py-1.5 text-small"
                />
              </div>
              <button type="submit" className="btn-primary h-10 px-5 text-small">
                <Calendar size={15} className="mr-1.5" />
                {t('admin.applyRange')}
              </button>
            </form>
          )}

          {/* Advanced Timeframe KPI Cards */}
          <div
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6"
            data-testid="advanced-kpi-grid"
          >
            <div className="surface-card p-6 hover-lift" data-testid="adv-kpi-orders">
              <div className="flex items-center justify-between text-secondary">
                <span className="text-caption font-mono uppercase tracking-wider">
                  {t('admin.advOrdersSold')}
                </span>
                <ShoppingBag size={18} />
              </div>
              <p className="text-3xl font-display font-medium tabular-nums text-ink mt-3">
                {(advancedData.summary?.orderCount || 0).toLocaleString()}
              </p>
              <p className="text-caption text-secondary mt-1">
                Avg. Order: {formatPrice(advancedData.summary?.avgOrderValue || 0)}
              </p>
            </div>

            <div className="surface-card p-6 hover-lift" data-testid="adv-kpi-revenue">
              <div className="flex items-center justify-between text-secondary">
                <span className="text-caption font-mono uppercase tracking-wider">
                  {t('admin.advTotalRevenue')}
                </span>
                <TrendingUp size={18} />
              </div>
              <p className="text-2xl sm:text-3xl font-display font-medium tabular-nums text-ink mt-3">
                {formatPrice(advancedData.summary?.revenue || 0)}
              </p>
              <div className="flex items-center gap-1.5 text-caption mt-1">
                {(advancedData.comparison?.revenueChange || 0) >= 0 ? (
                  <span className="inline-flex items-center text-success font-mono">
                    <ArrowUpRight size={14} />
                    +{Number(advancedData.comparison?.revenueChange || 0).toFixed(1)}%
                  </span>
                ) : (
                  <span className="inline-flex items-center text-danger font-mono">
                    <ArrowDownRight size={14} />
                    {Number(advancedData.comparison?.revenueChange || 0).toFixed(1)}%
                  </span>
                )}
                <span className="text-secondary">{t('admin.vsPreviousPeriod')}</span>
              </div>
            </div>

            <div className="surface-card p-6 hover-lift" data-testid="adv-kpi-profit">
              <div className="flex items-center justify-between text-secondary">
                <span className="text-caption font-mono uppercase tracking-wider">
                  {t('admin.advOverallProfit')}
                </span>
                <DollarSign size={18} />
              </div>
              <p className="text-2xl sm:text-3xl font-display font-medium tabular-nums text-ink mt-3">
                {formatPrice(advancedData.summary?.profit || 0)}
              </p>
              <p className="text-caption text-secondary mt-1">
                20% hardware gross margin
              </p>
            </div>

            <div className="surface-card p-6 hover-lift" data-testid="adv-kpi-units">
              <div className="flex items-center justify-between text-secondary">
                <span className="text-caption font-mono uppercase tracking-wider">
                  {t('admin.advProductsSold')}
                </span>
                <Layers size={18} />
              </div>
              <p className="text-3xl font-display font-medium tabular-nums text-ink mt-3">
                {(advancedData.summary?.productsSold || 0).toLocaleString()}
              </p>
              <p className="text-caption text-secondary mt-1">
                Across {(advancedData.productTypes || []).length} hardware categories
              </p>
            </div>
          </div>

          {/* Comparative Interval Switcher + Charts */}
          <div className="space-y-6" data-testid="advanced-comparative-charts">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-caption font-mono uppercase tracking-wider text-secondary">
                {t('admin.breakdownIntervalLabel')}
              </span>
              <div className="flex flex-wrap items-center gap-1.5 bg-surface border border-border rounded-xl p-1">
                {[
                  { id: 'year', label: t('admin.intervalByYear') },
                  { id: 'quarter', label: t('admin.intervalByQuarter') },
                  { id: 'month', label: t('admin.intervalByMonth') },
                  { id: 'week', label: t('admin.intervalByWeek') },
                ].map((intv) => (
                  <button
                    key={intv.id}
                    type="button"
                    onClick={() => setChartInterval(intv.id)}
                    className={`px-3 py-1 rounded-lg text-caption font-mono transition-colors ${
                      chartInterval === intv.id
                        ? 'bg-primary text-primary-foreground'
                        : 'text-secondary hover:text-ink'
                    }`}
                  >
                    {intv.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Chart 1: Comparative Revenue & Profit */}
              <div className="surface-card p-6">
                <h3 className="text-body font-medium text-ink mb-4">
                  {t('admin.comparativeChartTitle')} ({chartInterval.toUpperCase()})
                </h3>
                {mounted && activeComparativeSeries.length > 0 ? (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={activeComparativeSeries}
                        margin={{ top: 10, right: 16, left: 0, bottom: 8 }}
                      >
                        <CartesianGrid {...chartTheme.cartesianGrid} />
                        <XAxis dataKey="label" {...chartTheme.axis} />
                        <YAxis {...chartTheme.axis} />
                        <Tooltip
                          contentStyle={chartTheme.tooltip.contentStyle}
                          labelStyle={chartTheme.tooltip.labelStyle}
                          itemStyle={chartTheme.tooltip.itemStyle}
                          cursor={chartTheme.tooltip.cursor}
                          formatter={(val) => formatPrice(Number(val) || 0)}
                        />
                        <Legend />
                        <Bar
                          dataKey="revenue"
                          name="Revenue (VND)"
                          fill={chartTheme.series.primary}
                          radius={[6, 6, 0, 0]}
                        />
                        <Bar
                          dataKey="profit"
                          name="Profit (VND)"
                          fill={chartTheme.series.accent}
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-small text-secondary py-12 text-center">
                    {advLoading
                      ? 'Loading comparative revenue & profit chart…'
                      : 'No orders recorded in this timeframe.'}
                  </p>
                )}
              </div>

              {/* Chart 2: Products Sold & Orders Count */}
              <div className="surface-card p-6">
                <h3 className="text-body font-medium text-ink mb-4">
                  {t('admin.unitsChartTitle')} ({chartInterval.toUpperCase()})
                </h3>
                {mounted && activeComparativeSeries.length > 0 ? (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={activeComparativeSeries}
                        margin={{ top: 10, right: 16, left: 0, bottom: 8 }}
                      >
                        <CartesianGrid {...chartTheme.cartesianGrid} />
                        <XAxis dataKey="label" {...chartTheme.axis} />
                        <YAxis allowDecimals={false} {...chartTheme.axis} />
                        <Tooltip
                          contentStyle={chartTheme.tooltip.contentStyle}
                          labelStyle={chartTheme.tooltip.labelStyle}
                          itemStyle={chartTheme.tooltip.itemStyle}
                          cursor={chartTheme.tooltip.cursor}
                        />
                        <Legend />
                        <Bar
                          dataKey="productsSold"
                          name="Products Sold (Units)"
                          fill={chartTheme.series.primary}
                          radius={[6, 6, 0, 0]}
                        />
                        <Bar
                          dataKey="orders"
                          name="Orders Count"
                          fill={chartTheme.series.accent}
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-small text-secondary py-12 text-center">
                    {advLoading
                      ? 'Loading unit volume chart…'
                      : 'No product sales recorded in this timeframe.'}
                  </p>
                )}
              </div>
            </div>

            {/* Product Types Sold (Category Breakdown) & Top Products in Period */}
            <div
              className="grid grid-cols-1 lg:grid-cols-12 gap-6"
              data-testid="product-types-mix"
            >
              <div className="lg:col-span-6 surface-card p-6 min-w-0">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-body font-medium text-ink flex items-center gap-2">
                    <PieChartIcon size={18} className="text-secondary" />
                    <span>{t('admin.productMixTitle')}</span>
                  </h3>
                </div>

                <div className="space-y-3">
                  {(advancedData.productTypes || []).map((cat) => (
                    <div
                      key={cat.categorySlug}
                      className="p-3.5 rounded-xl bg-surface-muted border border-border"
                    >
                      <div className="flex items-center justify-between text-small mb-1.5">
                        <span className="font-medium text-ink">
                          {catName(cat.categorySlug || cat.categoryName)}
                        </span>
                        <span className="font-mono text-caption text-ink">
                          {cat.productsSold} units ({cat.sharePercent}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-border overflow-hidden mb-2">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${Math.min(100, Math.max(4, cat.sharePercent || 0))}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-caption font-mono text-secondary">
                        <span>Revenue: {formatPrice(cat.revenue)}</span>
                        <span>Profit: {formatPrice(cat.profit)}</span>
                      </div>
                    </div>
                  ))}
                  {(!advancedData.productTypes || advancedData.productTypes.length === 0) && (
                    <p className="text-small text-secondary py-8 text-center">
                      No category breakdown data for this period.
                    </p>
                  )}
                </div>
              </div>

              <div className="lg:col-span-6 surface-card p-6 min-w-0">
                <h3 className="text-body font-medium text-ink mb-4">
                  Top-Selling Hardware in Selected Period
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border text-caption font-mono uppercase text-secondary">
                        <th className="py-2 pr-3">Product</th>
                        <th className="py-2 px-3 text-right">Units</th>
                        <th className="py-2 pl-3 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 text-small">
                      {(advancedData.topProducts || []).map((prod, idx) => (
                        <tr key={prod.productId || idx} className="table-row-interactive">
                          <td className="py-2.5 pr-3">
                            <p className="font-medium text-ink truncate max-w-[240px]">
                              {prod.productName}
                            </p>
                            <p className="text-caption text-secondary">
                              {catName(prod.categorySlug || prod.categoryName)}
                            </p>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-caption tabular-nums">
                            {prod._sum?.quantity ?? prod.quantitySold ?? 0}
                          </td>
                          <td className="py-2.5 pl-3 text-right font-mono text-caption tabular-nums text-ink">
                            {formatPrice(prod.revenue || 0)}
                          </td>
                        </tr>
                      ))}
                      {(!advancedData.topProducts || advancedData.topProducts.length === 0) && (
                        <tr>
                          <td colSpan={3} className="py-8 text-center text-secondary">
                            No product sales in this period.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
