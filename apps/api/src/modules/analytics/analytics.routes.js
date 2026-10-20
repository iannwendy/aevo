const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authMiddleware, adminOnly } = require('../../middleware/auth');

const prisma = new PrismaClient();

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

    // Revenue (completed orders)
    const revenueResult = await prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { status: { not: 'CANCELLED' } },
    });
    const revenue = revenueResult._sum.totalAmount || 0;

    // Best selling products
    const bestSellers = await prisma.orderItem.groupBy({
      by: ['productId', 'productName'],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    });

    // Recent orders
    const recentOrders = await prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { fullName: true, email: true } },
        _count: { select: { items: true } },
      },
    });

    res.json({
      totalUsers,
      newUsers,
      totalOrders,
      revenue,
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

    // Calculate date range based on period
    const now = new Date();
    let start;

    switch (period) {
      case 'quarter':
        start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'week':
        start = new Date(now.setDate(now.getDate() - now.getDay()));
        break;
      case 'custom':
        start = startDate ? new Date(startDate) : new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'year':
      default:
        start = new Date(now.getFullYear(), 0, 1);
    }

    const end = endDate ? new Date(endDate) : new Date();

    // Orders in period
    const ordersInPeriod = await prisma.order.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { not: 'CANCELLED' },
      },
    });

    const orderCount = ordersInPeriod.length;
    const revenue = ordersInPeriod.reduce((sum, o) => sum + o.totalAmount, 0);

    // Profit (simplified - in real app, you'd track cost price)
    // For now, using a rough estimate of 20% margin
    const profit = revenue * 0.2;

    // Orders by status
    const ordersByStatus = await prisma.order.groupBy({
      by: ['status'],
      _count: true,
      where: { createdAt: { gte: start, lte: end } },
    });

    // Revenue by month
    const revenueByMonth = await prisma.order.groupBy({
      by: ['createdAt'],
      _sum: { totalAmount: true },
      where: {
        createdAt: { gte: start, lte: end },
        status: { not: 'CANCELLED' },
      },
    });

    // Group by month
    const monthlyRevenue = {};
    ordersInPeriod.forEach(order => {
      const month = order.createdAt.toISOString().slice(0, 7); // YYYY-MM
      if (!monthlyRevenue[month]) {
        monthlyRevenue[month] = { revenue: 0, orders: 0 };
      }
      monthlyRevenue[month].revenue += order.totalAmount;
      monthlyRevenue[month].orders += 1;
    });

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

    // Comparison with previous period
    const periodLength = end - start;
    const prevStart = new Date(start - periodLength);
    const prevEnd = new Date(start);

    const prevOrders = await prisma.order.findMany({
      where: {
        createdAt: { gte: prevStart, lte: prevEnd },
        status: { not: 'CANCELLED' },
      },
    });

    const prevRevenue = prevOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    res.json({
      period: { start, end },
      summary: {
        orderCount,
        revenue,
        profit,
        avgOrderValue: orderCount > 0 ? revenue / orderCount : 0,
      },
      comparison: {
        revenueChange: prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0,
      },
      ordersByStatus,
      revenueByMonth: Object.entries(monthlyRevenue).map(([month, data]) => ({
        month,
        ...data,
      })),
      topProducts: productSales,
    });
  } catch (error) {
    console.error('Advanced dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch advanced analytics' });
  }
});

module.exports = router;
