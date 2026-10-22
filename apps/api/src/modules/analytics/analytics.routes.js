const express = require('express');
const router = express.Router();
const prisma = require('../../utils/prisma');
const { authMiddleware, adminOnly } = require('../../middleware/auth');

function getIsoWeekLabel(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function getQuarterLabel(date) {
  const q = Math.floor(date.getMonth() / 3) + 1;
  return `${date.getFullYear()}-Q${q}`;
}

// Simple Dashboard
router.get('/simple', authMiddleware, adminOnly, async (req, res) => {
  try {
    // Total users
    const totalUsers = await prisma.user.count();

    // New users (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newUsers = await prisma.user.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    });

    // Total orders
    const totalOrders = await prisma.order.count();

    // Revenue (non-cancelled orders)
    const revenueResult = await prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { status: { not: 'CANCELLED' } },
    });
    const revenue = revenueResult._sum.totalAmount || 0;
    const profit = revenue * 0.2;

    // Best selling products (from non-cancelled orders)
    const rawBestSellers = await prisma.orderItem.groupBy({
      by: ['productId', 'productName'],
      _sum: { quantity: true, price: true },
      where: {
        order: { status: { not: 'CANCELLED' } },
      },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    });

    // Calculate accurate revenue per best-selling product
    const bestSellerIds = rawBestSellers.map((b) => b.productId);
    const bestSellerItems = bestSellerIds.length
      ? await prisma.orderItem.findMany({
          where: {
            productId: { in: bestSellerIds },
            order: { status: { not: 'CANCELLED' } },
          },
          select: { productId: true, price: true, quantity: true },
        })
      : [];

    const revenueByProduct = {};
    for (const item of bestSellerItems) {
      revenueByProduct[item.productId] =
        (revenueByProduct[item.productId] || 0) + item.price * item.quantity;
    }

    const bestSellers = rawBestSellers.map((item) => {
      const quantitySold = item._sum?.quantity || 0;
      const productRevenue = revenueByProduct[item.productId] || 0;
      return {
        productId: item.productId,
        productName: item.productName,
        _sum: { quantity: quantitySold },
        quantitySold,
        revenue: productRevenue,
        profit: productRevenue * 0.2,
      };
    });

    // Recent orders
    const recentOrders = await prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        _count: { select: { items: true } },
      },
    });

    res.json({
      totalUsers,
      newUsers,
      totalOrders,
      revenue,
      profit,
      bestSellers,
      recentOrders,
    });
  } catch (error) {
    console.error('Simple dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Advanced Dashboard
router.get('/advanced', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { period = 'year', startDate, endDate } = req.query;

    const now = new Date();
    let start;
    let end = new Date(now);

    switch (period) {
      case 'quarter':
        start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1, 0, 0, 0, 0);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        break;
      case 'week':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
        break;
      case 'custom':
        start = startDate
          ? new Date(startDate)
          : new Date(now.getFullYear(), now.getMonth() - 1, now.getDate(), 0, 0, 0, 0);
        break;
      case 'year':
      default:
        start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        break;
    }

    if (startDate) {
      const parsedStart = new Date(startDate);
      if (!Number.isNaN(parsedStart.getTime())) {
        start = parsedStart;
      }
    }

    if (endDate) {
      const parsedEnd = new Date(endDate);
      if (!Number.isNaN(parsedEnd.getTime())) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(String(endDate).trim())) {
          parsedEnd.setUTCHours(23, 59, 59, 999);
        }
        end = parsedEnd;
      }
    }

    // Orders in period with items and product categories
    const ordersInPeriod = await prisma.order.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { not: 'CANCELLED' },
      },
      include: {
        items: {
          include: {
            product: {
              include: { category: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const orderCount = ordersInPeriod.length;
    const revenue = ordersInPeriod.reduce((sum, o) => sum + o.totalAmount, 0);
    // Profit = 20% margin estimate
    const profit = revenue * 0.2;
    const productsSold = ordersInPeriod.reduce(
      (sum, o) => sum + (o.items || []).reduce((s, item) => s + item.quantity, 0),
      0
    );

    // Orders by status (including cancelled for status distribution chart)
    const ordersByStatus = await prisma.order.groupBy({
      by: ['status'],
      _count: true,
      where: { createdAt: { gte: start, lte: end } },
    });

    // Group by month, quarter, week, year, and day for comparative charts
    const monthlyMap = {};
    const quarterlyMap = {};
    const weeklyMap = {};
    const yearlyMap = {};
    const dailyMap = {};
    const categoryMap = {};
    const productMap = {};

    ordersInPeriod.forEach((order) => {
      const d = new Date(order.createdAt);
      const monthKey = d.toISOString().slice(0, 7); // YYYY-MM
      const dayKey = d.toISOString().slice(0, 10); // YYYY-MM-DD
      const quarterKey = getQuarterLabel(d); // YYYY-Q#
      const weekKey = getIsoWeekLabel(d); // YYYY-W##
      const yearKey = String(d.getFullYear());

      const orderUnits = (order.items || []).reduce((s, it) => s + it.quantity, 0);
      const orderProfit = order.totalAmount * 0.2;

      const accumulate = (map, key) => {
        if (!map[key]) {
          map[key] = { revenue: 0, profit: 0, orders: 0, productsSold: 0 };
        }
        map[key].revenue += order.totalAmount;
        map[key].profit += orderProfit;
        map[key].orders += 1;
        map[key].productsSold += orderUnits;
      };

      accumulate(monthlyMap, monthKey);
      accumulate(quarterlyMap, quarterKey);
      accumulate(weeklyMap, weekKey);
      accumulate(yearlyMap, yearKey);
      accumulate(dailyMap, dayKey);

      const seenCategoriesInOrder = new Set();
      for (const item of order.items || []) {
        const cat = item.product?.category;
        const catKey = cat?.slug || 'uncategorized';
        const catName = cat?.name || 'Hardware';
        const itemRevenue = item.price * item.quantity;
        const itemProfit = itemRevenue * 0.2;

        if (!categoryMap[catKey]) {
          categoryMap[catKey] = {
            categoryId: cat?.id || catKey,
            categorySlug: catKey,
            categoryName: catName,
            productsSold: 0,
            revenue: 0,
            profit: 0,
            orderCount: 0,
          };
        }
        categoryMap[catKey].productsSold += item.quantity;
        categoryMap[catKey].revenue += itemRevenue;
        categoryMap[catKey].profit += itemProfit;
        if (!seenCategoriesInOrder.has(catKey)) {
          seenCategoriesInOrder.add(catKey);
          categoryMap[catKey].orderCount += 1;
        }

        if (!productMap[item.productId]) {
          productMap[item.productId] = {
            productId: item.productId,
            productName: item.productName,
            categoryName: catName,
            categorySlug: catKey,
            quantitySold: 0,
            revenue: 0,
            profit: 0,
            orderCount: 0,
          };
        }
        productMap[item.productId].quantitySold += item.quantity;
        productMap[item.productId].revenue += itemRevenue;
        productMap[item.productId].profit += itemProfit;
        productMap[item.productId].orderCount += 1;
      }
    });

    const revenueByMonth = Object.entries(monthlyMap).map(([month, data]) => ({
      month,
      label: month,
      ...data,
    }));

    const toSeries = (map) =>
      Object.entries(map).map(([label, data]) => ({
        label,
        period: label,
        ...data,
      }));

    let timeSeries;
    if (period === 'week') {
      timeSeries = toSeries(dailyMap);
    } else if (period === 'month') {
      timeSeries = toSeries(dailyMap);
    } else if (period === 'quarter') {
      timeSeries = toSeries(monthlyMap);
    } else {
      timeSeries = toSeries(monthlyMap);
    }

    const productTypes = Object.values(categoryMap)
      .sort((a, b) => b.productsSold - a.productsSold)
      .map((c) => ({
        ...c,
        sharePercent:
          productsSold > 0 ? Number(((c.productsSold / productsSold) * 100).toFixed(1)) : 0,
      }));

    // Top products
    const productSales = await prisma.orderItem.groupBy({
      by: ['productId', 'productName'],
      _sum: { quantity: true },
      _count: true,
      where: {
        order: {
          createdAt: { gte: start, lte: end },
          status: { not: 'CANCELLED' },
        },
      },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10,
    });

    const topProducts = productSales.map((p) => {
      const extra = productMap[p.productId] || {};
      const qty = p._sum?.quantity || 0;
      return {
        ...p,
        quantitySold: qty,
        revenue: extra.revenue || 0,
        profit: extra.profit || 0,
        categoryName: extra.categoryName || 'Hardware',
        categorySlug: extra.categorySlug || 'hardware',
      };
    });

    // Comparison with previous period
    const periodLength = Math.max(86400000, end.getTime() - start.getTime());
    const prevStart = new Date(start.getTime() - periodLength);
    const prevEnd = new Date(start.getTime());

    const prevOrders = await prisma.order.findMany({
      where: {
        createdAt: { gte: prevStart, lte: prevEnd },
        status: { not: 'CANCELLED' },
      },
      include: {
        items: { select: { quantity: true } },
      },
    });

    const prevOrderCount = prevOrders.length;
    const prevRevenue = prevOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const prevProfit = prevRevenue * 0.2;
    const prevProductsSold = prevOrders.reduce(
      (sum, o) => sum + (o.items || []).reduce((s, item) => s + item.quantity, 0),
      0
    );

    const pctChange = (curr, prev) => (prev > 0 ? ((curr - prev) / prev) * 100 : 0);

    res.json({
      period: { type: period, start, end },
      summary: {
        orderCount,
        revenue,
        profit,
        productsSold,
        avgOrderValue: orderCount > 0 ? revenue / orderCount : 0,
      },
      comparison: {
        revenueChange: pctChange(revenue, prevRevenue),
        profitChange: pctChange(profit, prevProfit),
        orderCountChange: pctChange(orderCount, prevOrderCount),
        productsSoldChange: pctChange(productsSold, prevProductsSold),
        previousPeriod: {
          start: prevStart,
          end: prevEnd,
          orderCount: prevOrderCount,
          revenue: prevRevenue,
          profit: prevProfit,
          productsSold: prevProductsSold,
        },
      },
      ordersByStatus,
      revenueByMonth,
      timeSeries,
      comparativeByInterval: {
        year: toSeries(yearlyMap),
        quarter: toSeries(quarterlyMap),
        month: toSeries(monthlyMap),
        week: toSeries(weeklyMap),
      },
      productTypes,
      topProducts,
    });
  } catch (error) {
    console.error('Advanced dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch advanced analytics' });
  }
});

module.exports = router;
