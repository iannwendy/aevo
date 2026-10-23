const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../../utils/prisma');
const { authMiddleware, optionalAuth, adminOnly, signResetToken } = require('../../middleware/auth');
const { CLIENT_URL } = require('../../config/passport');
const { generateOrderNumber } = require('../../utils/helpers');
const { sendOrderConfirmationEmail } = require('../../services/mailer');
const { publishDomainEvent } = require('../../utils/eventBus');

const guestCredentialsByOrderNumber = new Map();
const GUEST_CREDENTIALS_TTL_MS = 15 * 60 * 1000;
const GUEST_CREDENTIALS_MAX_ENTRIES = 500;

function storeGuestCredentials(orderNumber, credentials) {
  if (!orderNumber || !credentials) return;
  const now = Date.now();
  for (const [key, entry] of guestCredentialsByOrderNumber.entries()) {
    if (!entry || entry.expiresAt <= now) {
      guestCredentialsByOrderNumber.delete(key);
    }
  }
  while (guestCredentialsByOrderNumber.size >= GUEST_CREDENTIALS_MAX_ENTRIES) {
    const oldestKey = guestCredentialsByOrderNumber.keys().next().value;
    if (!oldestKey) break;
    guestCredentialsByOrderNumber.delete(oldestKey);
  }
  guestCredentialsByOrderNumber.set(orderNumber, {
    credentials,
    expiresAt: now + GUEST_CREDENTIALS_TTL_MS,
  });
}

function getGuestCredentials(orderNumber) {
  if (!orderNumber) return null;
  const entry = guestCredentialsByOrderNumber.get(orderNumber);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    guestCredentialsByOrderNumber.delete(orderNumber);
    return null;
  }
  return entry.credentials;
}

function generateGuestPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += chars[crypto.randomInt(0, chars.length)];
  }
  return `Aevo${suffix}`;
}

const PAYMENT_METHODS = ['cod', 'bank_transfer', 'card', 'momo'];
const VALID_ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'SHIPPING', 'DELIVERED', 'CANCELLED'];

// Points are worth 1,000 VND each; 100 points = 100,000 VND.
const POINT_VALUE = 1000;

// Loyalty earn rate: 10% in points (1,000,000 VND = 100 points -> 1 point per 10,000 VND).
const EARN_DIVISOR = 10000;

const FREE_SHIPPING_THRESHOLD = 20000000;
const SHIPPING_FEE = 30000;
const EXPRESS_SHIPPING_FEE = 50000;
const TAX_RATE = 0.1;

function roundVnd(amount) {
  return Math.round(amount);
}

const ORDER_DETAIL_INCLUDE = {
  user: { select: { id: true, email: true, fullName: true } },
  items: {
    include: {
      variant: {
        include: {
          product: {
            include: {
              images: { orderBy: { position: 'asc' }, take: 1 },
            },
          },
        },
      },
    },
  },
  statusHistory: { orderBy: { createdAt: 'desc' } },
  shippingAddress: true,
  discountCode: true,
  payments: true,
};

function enrichOrder(order, extra = {}) {
  if (!order) return order;
  const items = (order.items || []).map((item) => ({
    ...item,
    total: item.total !== undefined ? item.total : (Number(item.price) || 0) * (Number(item.quantity) || 1),
  }));
  const earnedPoints =
    extra.earnedPoints !== undefined
      ? extra.earnedPoints
      : order.earnedPoints !== undefined
      ? order.earnedPoints
      : order.status === 'CANCELLED'
      ? 0
      : Math.floor((Number(order.totalAmount) || 0) / EARN_DIVISOR);
  const includeGuestCredentials = Boolean(extra.includeGuestCredentials);
  const autoCreatedAccount =
    extra.autoCreatedAccount ||
    order.autoCreatedAccount ||
    (includeGuestCredentials ? getGuestCredentials(order.orderNumber) : null) ||
    null;

  return {
    ...order,
    items,
    loyaltyDiscount: (order.usedLoyaltyPoints || 0) * POINT_VALUE,
    earnedPoints,
    ...(autoCreatedAccount && { autoCreatedAccount }),
  };
}

// Create order (checkout — supports both logged-in user and guest checkout)
router.post('/', optionalAuth, async (req, res) => {
  try {
    const {
      shippingAddress,
      addressId: requestedAddressId,
      discountCode,
      usedLoyaltyPoints = 0,
      paymentMethod = 'cod',
      shippingMethod = 'standard',
      notes,
      items: directItems,
    } = req.body;

    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ error: 'Invalid payment method' });
    }

    const pointsToRedeem = Number(usedLoyaltyPoints) || 0;
    if (!Number.isInteger(pointsToRedeem) || pointsToRedeem < 0) {
      return res.status(400).json({ error: 'Invalid loyalty points' });
    }

    if (
      !shippingAddress ||
      !shippingAddress.fullName ||
      !shippingAddress.phone ||
      !shippingAddress.address
    ) {
      return res.status(400).json({ error: 'Shipping address is required' });
    }

    if (!req.user) {
      const rawGuestEmail = String(shippingAddress.email || '').trim();
      if (!rawGuestEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawGuestEmail)) {
        return res.status(400).json({ error: 'Valid email is required for guest checkout' });
      }
    }

    const sessionId = typeof (req.cookies?.sessionId || req.body?.sessionId) === 'string'
      ? (req.cookies?.sessionId || req.body?.sessionId)
      : null;

    // Resolve cart (user cart first, then guest session cart)
    let cart = null;
    if (req.user) {
      cart = await prisma.cart.findUnique({
        where: { userId: req.user.id },
        include: {
          items: {
            include: {
              variant: { include: { product: true } },
            },
          },
        },
      });
    }

    if ((!cart || cart.items.length === 0) && sessionId) {
      cart = await prisma.cart.findUnique({
        where: { sessionId },
        include: {
          items: {
            include: {
              variant: { include: { product: true } },
            },
          },
        },
      });
    }

    // Build source items from cart or fallback direct items array
    let sourceItems = cart?.items || [];
    if (sourceItems.length === 0 && Array.isArray(directItems) && directItems.length > 0) {
      const mergedMap = new Map();
      for (const di of directItems) {
        if (!di || typeof di.variantId !== 'string' || !di.variantId.trim()) {
          return res.status(400).json({ error: 'Valid variantId is required for each item' });
        }
        const rawQty = di.quantity === undefined ? 1 : Number(di.quantity);
        if (!Number.isInteger(rawQty) || rawQty < 1 || rawQty > 1000) {
          return res.status(400).json({ error: 'Item quantity must be a positive integer' });
        }
        const vId = di.variantId.trim();
        mergedMap.set(vId, (mergedMap.get(vId) || 0) + rawQty);
      }

      const hydrated = [];
      for (const [vId, totalQty] of mergedMap.entries()) {
        const variant = await prisma.productVariant.findUnique({
          where: { id: vId },
          include: { product: true },
        });
        if (!variant || !variant.isActive || !variant.product?.isActive) {
          return res.status(404).json({ error: 'Product variant not found' });
        }
        hydrated.push({
          variantId: variant.id,
          quantity: totalQty,
          variant,
        });
      }
      sourceItems = hydrated;
    }

    if (sourceItems.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Check inventory and calculate subtotal
    let subtotal = 0;
    const orderItems = [];

    for (const item of sourceItems) {
      const variant = item.variant;
      const qty = Number(item.quantity);

      if (!Number.isInteger(qty) || qty < 1) {
        return res.status(400).json({ error: 'Item quantity must be a positive integer' });
      }

      if (!variant || !variant.isActive || !variant.product?.isActive || variant.inventory < qty) {
        return res.status(400).json({
          error: `Insufficient inventory for ${variant?.product?.name || 'product'}`,
        });
      }

      subtotal += variant.price * qty;
      orderItems.push({
        productId: variant.productId,
        variantId: item.variantId,
        productName: variant.product.name,
        variantName: variant.name,
        price: variant.price,
        quantity: qty,
      });
    }

    // Validate discount code
    let discountAmount = 0;
    let discountId = null;
    let discountMaxUses = null;

    if (discountCode && String(discountCode).trim()) {
      const cleanCode = String(discountCode).trim().toUpperCase();
      const discount = await prisma.discount.findUnique({
        where: { code: cleanCode },
      });

      if (!discount || !discount.isActive) {
        return res.status(400).json({ error: 'Invalid or inactive discount code' });
      }

      if (discount.usedCount >= discount.maxUses) {
        return res
          .status(400)
          .json({ error: 'Discount code has reached its usage limit' });
      }

      discountId = discount.id;
      discountMaxUses = discount.maxUses;
      if (discount.discountType === 'percentage') {
        discountAmount = roundVnd(subtotal * (discount.discountValue / 100));
      } else {
        discountAmount = Math.min(discount.discountValue, subtotal);
      }
    }

    // Validate loyalty points against the user's balance
    if (req.user) {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { loyaltyPoints: true },
      });
      if (pointsToRedeem > (user?.loyaltyPoints || 0)) {
        return res.status(400).json({ error: 'Not enough loyalty points' });
      }
    } else if (pointsToRedeem > 0) {
      return res.status(400).json({ error: 'Loyalty points require an account' });
    }

    const afterDiscount = Math.max(0, subtotal - discountAmount);

    // Shipping fee (free over 20M VND before tax) and tax (10%)
    const baseShipping =
      shippingMethod === 'express' ? EXPRESS_SHIPPING_FEE : SHIPPING_FEE;
    const shippingFee = afterDiscount >= FREE_SHIPPING_THRESHOLD ? 0 : baseShipping;
    const taxAmount = roundVnd(afterDiscount * TAX_RATE);

    // Loyalty discount: 100 points = 100,000 VND (1 point = 1,000 VND)
    const loyaltyDiscount = Math.min(
      pointsToRedeem * POINT_VALUE,
      afterDiscount + shippingFee + taxAmount
    );

    const totalAmount = Math.max(
      0,
      afterDiscount + shippingFee + taxAmount - loyaltyDiscount
    );

    // Earn 10% of total order amount in points (1,000,000 VND = 100 points = 100,000 VND)
    const pointsToEarn = Math.floor(totalAmount / EARN_DIVISOR);

    const orderNumber = generateOrderNumber();
    let autoAccountCredentials = null;

    const order = await prisma.$transaction(async (tx) => {
      // 1. Deduct inventory atomically
      for (const item of sourceItems) {
        const result = await tx.productVariant.updateMany({
          where: { id: item.variantId, inventory: { gte: item.quantity } },
          data: { inventory: { decrement: item.quantity } },
        });
        if (result.count === 0) {
          throw Object.assign(new Error('Insufficient inventory'), { status: 400 });
        }
      }

      // 2. Claim discount usage atomically
      if (discountId) {
        const claimed = await tx.discount.updateMany({
          where: { id: discountId, usedCount: { lt: discountMaxUses } },
          data: { usedCount: { increment: 1 } },
        });
        if (claimed.count === 0) {
          throw Object.assign(
            new Error('Discount code has reached its usage limit'),
            { status: 400 }
          );
        }
      }

      // 3. Resolve target User (logged-in user OR auto-created/linked guest user per requirement.md II.1)
      let targetUserId = req.user?.id || null;
      const normalizedGuestEmail = !req.user
        ? String(shippingAddress.email).trim().toLowerCase()
        : null;

      if (!targetUserId && normalizedGuestEmail) {
        let guestUser = await tx.user.findUnique({
          where: { email: normalizedGuestEmail },
          include: { oauthAccounts: true },
        });
        if (guestUser && !guestUser.isActive) {
          throw Object.assign(new Error('Account has been banned'), { status: 403 });
        }
        if (!guestUser) {
          const tempPassword = generateGuestPassword();
          const hashedTempPassword = await bcrypt.hash(tempPassword, 10);
          guestUser = await tx.user.create({
            data: {
              email: normalizedGuestEmail,
              password: hashedTempPassword,
              fullName: String(shippingAddress.fullName).trim(),
              role: 'CUSTOMER',
              loyaltyPoints: 0,
            },
          });
          const resetJwt = signResetToken(guestUser);
          const resetTokenHash = crypto.createHash('sha256').update(resetJwt).digest('hex');
          await tx.passwordResetToken.create({
            data: {
              userId: guestUser.id,
              token: resetTokenHash,
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
          });
          autoAccountCredentials = {
            email: normalizedGuestEmail,
            temporaryPassword: tempPassword,
            resetUrl: `${CLIENT_URL}/reset-password?token=${encodeURIComponent(resetJwt)}`,
          };
        } else if (!guestUser.password && (!guestUser.oauthAccounts || guestUser.oauthAccounts.length === 0)) {
          const tempPassword = generateGuestPassword();
          const hashedTempPassword = await bcrypt.hash(tempPassword, 10);
          guestUser = await tx.user.update({
            where: { id: guestUser.id },
            data: { password: hashedTempPassword },
          });
          const resetJwt = signResetToken(guestUser);
          const resetTokenHash = crypto.createHash('sha256').update(resetJwt).digest('hex');
          await tx.passwordResetToken.create({
            data: {
              userId: guestUser.id,
              token: resetTokenHash,
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
          });
          autoAccountCredentials = {
            email: normalizedGuestEmail,
            temporaryPassword: tempPassword,
            resetUrl: `${CLIENT_URL}/reset-password?token=${encodeURIComponent(resetJwt)}`,
          };
        }
        targetUserId = guestUser.id;
      }

      // 4. Redeem loyalty points atomically
      if (pointsToRedeem > 0 && req.user) {
        const result = await tx.user.updateMany({
          where: { id: req.user.id, loyaltyPoints: { gte: pointsToRedeem } },
          data: { loyaltyPoints: { decrement: pointsToRedeem } },
        });
        if (result.count === 0) {
          throw Object.assign(new Error('Not enough loyalty points'), { status: 400 });
        }
      }

      // 5. Save or link shipping address
      let addressId = null;
      if (targetUserId) {
        if (requestedAddressId && req.user) {
          const existingAddr = await tx.address.findFirst({
            where: { id: requestedAddressId, userId: targetUserId },
          });
          if (existingAddr) {
            addressId = existingAddr.id;
          }
        }

        if (!addressId) {
          const existingAddrCount = await tx.address.count({
            where: { userId: targetUserId },
          });
          const createdAddress = await tx.address.create({
            data: {
              userId: targetUserId,
              fullName: String(shippingAddress.fullName).trim(),
              phone: String(shippingAddress.phone).trim(),
              address: String(shippingAddress.address).trim(),
              ward: shippingAddress.ward ? String(shippingAddress.ward).trim() : null,
              district: shippingAddress.district
                ? String(shippingAddress.district).trim()
                : null,
              city: shippingAddress.city
                ? String(shippingAddress.city).trim()
                : 'Ho Chi Minh City',
              isDefault: existingAddrCount === 0,
            },
          });
          addressId = createdAddress.id;
        }
      }

      // 6. Create Order with items and initial status history
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          userId: targetUserId,
          guestEmail: normalizedGuestEmail,
          guestName: !req.user ? String(shippingAddress.fullName).trim() : null,
          subtotal,
          shippingFee,
          discountAmount,
          taxAmount,
          totalAmount,
          discountCodeId: discountId,
          usedLoyaltyPoints: pointsToRedeem,
          notes: notes || null,
          addressId,
          paymentMethod,
          items: { create: orderItems },
          statusHistory: {
            create: { status: 'PENDING', note: 'Order placed' },
          },
        },
        include: ORDER_DETAIL_INCLUDE,
      });

      if (discountId) {
        await tx.discountUsage.create({
          data: { discountId, orderId: newOrder.id },
        });
      }

      await tx.payment.create({
        data: {
          orderId: newOrder.id,
          method: paymentMethod,
          amount: totalAmount,
          status: 'PENDING',
        },
      });

      if (req.user && pointsToRedeem > 0) {
        await tx.loyaltyTransaction.create({
          data: {
            userId: req.user.id,
            amount: -pointsToRedeem,
            type: 'redeem',
            orderId: newOrder.id,
            description: `Redeemed ${pointsToRedeem} points on order ${orderNumber}`,
          },
        });
      }

      if (targetUserId && pointsToEarn > 0) {
        await tx.loyaltyTransaction.create({
          data: {
            userId: targetUserId,
            amount: pointsToEarn,
            type: 'earn',
            orderId: newOrder.id,
            description: `Earned ${pointsToEarn} points from order ${orderNumber}`,
          },
        });
        await tx.user.update({
          where: { id: targetUserId },
          data: { loyaltyPoints: { increment: pointsToEarn } },
        });
      }

      // Clear cart items
      if (cart?.id) {
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      }

      return newOrder;
    });

    if (autoAccountCredentials) {
      storeGuestCredentials(order.orderNumber, autoAccountCredentials);
    }

    // Confirmation email (fire and forget)
    const emailTo = req.user?.email || shippingAddress.email;
    if (emailTo) {
      sendOrderConfirmationEmail(
        emailTo,
        req.user?.fullName || shippingAddress.fullName,
        {
          ...order,
          paymentMethod,
        },
        autoAccountCredentials
      ).catch((error) => console.error('Order confirmation email failed:', error));
    }

    // Publish asynchronous domain events over Redis Event Bus
    publishDomainEvent('ORDER_CREATED', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      totalAmount: order.totalAmount,
      status: order.status,
      productIds: orderItems.map((oi) => oi.productId),
    }).catch(() => {});

    if (order.userId && (pointsToEarn > 0 || pointsToRedeem > 0)) {
      publishDomainEvent('LOYALTY_UPDATED', {
        userId: order.userId,
        orderId: order.id,
        pointsEarned: pointsToEarn,
        pointsRedeemed: pointsToRedeem,
        pointsDelta: pointsToEarn - pointsToRedeem,
      }).catch(() => {});
    }

    res.status(201).json(
      enrichOrder(order, {
        earnedPoints: pointsToEarn,
        autoCreatedAccount: autoAccountCredentials,
      })
    );
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Get current user's orders (sorted newest first)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: ORDER_DETAIL_INCLUDE,
    });

    res.json(orders.map((o) => enrichOrder(o)));
  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Lookup order by orderNumber (supports guest order tracking and checkout success page)
router.get('/number/:orderNumber', optionalAuth, async (req, res) => {
  try {
    const rawNumber = String(req.params.orderNumber || '').trim().toUpperCase();
    const order = await prisma.order.findUnique({
      where: { orderNumber: rawNumber },
      include: ORDER_DETAIL_INCLUDE,
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // If a non-admin logged-in user attempts to inspect a different user's order (including guest orders), reject
    const isAdmin = req.user?.role === 'ADMIN';
    const isOwner =
      req.user &&
      (order.userId === req.user.id ||
        (order.guestEmail &&
          req.user.email &&
          order.guestEmail.toLowerCase() === req.user.email.toLowerCase()));

    if (req.user && !isAdmin && !isOwner) {
      return res.status(403).json({ error: 'Not authorized to view this order' });
    }
    if (!req.user && !order.guestEmail) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    res.json(
      enrichOrder(order, {
        includeGuestCredentials: !req.user || isOwner,
      })
    );
  } catch (error) {
    console.error('Lookup order by number error:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Admin: Get all orders (must be declared before '/:id')
router.get('/admin/all', authMiddleware, adminOnly, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      startDate,
      endDate,
      dateRange,
      timeRange,
      search,
    } = req.query;

    const where = {};

    if (status && VALID_ORDER_STATUSES.includes(String(status).toUpperCase())) {
      where.status = String(status).toUpperCase();
    }

    const rangePreset = String(dateRange || timeRange || '').toLowerCase();
    const now = new Date();
    let computedStart = null;
    let computedEnd = null;

    if (rangePreset === 'today') {
      computedStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      computedEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (rangePreset === 'yesterday') {
      computedStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
      computedEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
    } else if (rangePreset === 'week' || rangePreset === 'this_week') {
      const day = now.getDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      computedStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - diffToMonday,
        0,
        0,
        0,
        0
      );
      computedEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (rangePreset === 'month' || rangePreset === 'this_month') {
      computedStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      computedEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    }

    if (startDate) {
      const parsedStart = new Date(startDate);
      if (!Number.isNaN(parsedStart.getTime())) {
        computedStart = parsedStart;
      }
    }

    if (endDate) {
      const parsedEnd = new Date(endDate);
      if (!Number.isNaN(parsedEnd.getTime())) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(String(endDate).trim())) {
          parsedEnd.setUTCHours(23, 59, 59, 999);
        }
        computedEnd = parsedEnd;
      }
    }

    if (computedStart || computedEnd) {
      where.createdAt = {
        ...(computedStart && { gte: computedStart }),
        ...(computedEnd && { lte: computedEnd }),
      };
    }

    if (search && String(search).trim()) {
      const q = String(search).trim();
      where.OR = [
        { orderNumber: { contains: q, mode: 'insensitive' } },
        { guestName: { contains: q, mode: 'insensitive' } },
        { guestEmail: { contains: q, mode: 'insensitive' } },
        { user: { fullName: { contains: q, mode: 'insensitive' } } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        include: ORDER_DETAIL_INCLUDE,
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      orders: orders.map((o) => enrichOrder(o)),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.max(1, Math.ceil(total / limitNum)),
      },
    });
  } catch (error) {
    console.error('Admin get orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get single order by ID or orderNumber (owner, admin, or guest order lookup)
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findFirst({
      where: {
        OR: [{ id }, { orderNumber: id.toUpperCase() }],
      },
      include: ORDER_DETAIL_INCLUDE,
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const isAdmin = req.user?.role === 'ADMIN';
    const isOwner =
      req.user &&
      (order.userId === req.user.id ||
        (order.guestEmail &&
          req.user.email &&
          order.guestEmail.toLowerCase() === req.user.email.toLowerCase()));
    const isGuestOrder = Boolean(order.guestEmail);

    if (req.user && !isAdmin && !isOwner) {
      return res.status(403).json({ error: 'Not authorized to view this order' });
    }

    if (!req.user && !isGuestOrder) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    res.json(
      enrichOrder(order, {
        includeGuestCredentials: !req.user || isOwner,
      })
    );
  } catch (error) {
    console.error('Get order detail error:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Admin: Update order status
router.put('/:id/status', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;

    if (!status || !VALID_ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid order status' });
    }

    const existingOrder = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existingOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (existingOrder.status === 'CANCELLED' && status !== 'CANCELLED') {
      return res.status(400).json({ error: 'Cannot change status of a cancelled order' });
    }

    const order = await prisma.$transaction(async (tx) => {
      // If transitioning to CANCELLED for the first time, restore stock, discount usage & loyalty points
      if (status === 'CANCELLED' && existingOrder.status !== 'CANCELLED') {
        // 1. Restore variant inventory
        for (const item of existingOrder.items || []) {
          if (item.variantId && item.quantity > 0) {
            await tx.productVariant.updateMany({
              where: { id: item.variantId },
              data: { inventory: { increment: item.quantity } },
            });
          }
        }

        // 2. Release discount usage if a coupon was applied
        if (existingOrder.discountCodeId) {
          await tx.discount.updateMany({
            where: { id: existingOrder.discountCodeId, usedCount: { gt: 0 } },
            data: { usedCount: { decrement: 1 } },
          });
          await tx.discountUsage.deleteMany({
            where: { orderId: existingOrder.id },
          });
        }

        // 3. Reverse loyalty points (refund redeemed points & claw back earned points)
        if (existingOrder.userId) {
          const orderTxns = await tx.loyaltyTransaction.findMany({
            where: { orderId: existingOrder.id, userId: existingOrder.userId },
          });
          const earnedOnOrder = orderTxns
            .filter((t) => t.type === 'earn' && t.amount > 0)
            .reduce((sum, t) => sum + t.amount, 0);
          const redeemedOnOrder = existingOrder.usedLoyaltyPoints || 0;
          const netDelta = redeemedOnOrder - earnedOnOrder;

          if (netDelta !== 0) {
            const currentUser = await tx.user.findUnique({
              where: { id: existingOrder.userId },
              select: { loyaltyPoints: true },
            });
            if (currentUser) {
              const updatedPoints = Math.max(0, (currentUser.loyaltyPoints || 0) + netDelta);
              await tx.user.update({
                where: { id: existingOrder.userId },
                data: { loyaltyPoints: updatedPoints },
              });
            }
          }

          if (redeemedOnOrder > 0) {
            await tx.loyaltyTransaction.create({
              data: {
                userId: existingOrder.userId,
                orderId: existingOrder.id,
                amount: redeemedOnOrder,
                type: 'refund',
                description: `Refunded ${redeemedOnOrder} redeemed points from cancelled order ${existingOrder.orderNumber}`,
              },
            });
          }

          if (earnedOnOrder > 0) {
            await tx.loyaltyTransaction.create({
              data: {
                userId: existingOrder.userId,
                orderId: existingOrder.id,
                amount: -earnedOnOrder,
                type: 'reversal',
                description: `Reversed ${earnedOnOrder} earned points from cancelled order ${existingOrder.orderNumber}`,
              },
            });
          }
        }
      }

      const cleanNote =
        typeof note === 'string' && note.trim()
          ? note.trim().slice(0, 500)
          : `Status changed to ${status}`;

      return tx.order.update({
        where: { id },
        data: {
          status,
          ...(status === 'CANCELLED' &&
            existingOrder.status !== 'CANCELLED' &&
            existingOrder.discountCodeId && { discountCodeId: null }),
          statusHistory: {
            create: {
              status,
              note: cleanNote,
            },
          },
        },
        include: ORDER_DETAIL_INCLUDE,
      });
    });

    publishDomainEvent(
      status === 'CANCELLED' ? 'ORDER_CANCELLED' : 'ORDER_STATUS_CHANGED',
      {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        productIds: (existingOrder.items || []).map((i) => i.productId),
      }
    ).catch(() => {});

    res.json(enrichOrder(order));
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Order not found' });
    }
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

module.exports = router;
