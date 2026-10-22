const express = require('express');
const router = express.Router();
const prisma = require('../../utils/prisma');
const { authMiddleware, optionalAuth, adminOnly } = require('../../middleware/auth');
const { generateOrderNumber } = require('../../utils/helpers');
const { sendOrderConfirmationEmail } = require('../../services/mailer');

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

    if (!req.user && !shippingAddress.email) {
      return res.status(400).json({ error: 'Email is required for guest checkout' });
    }

    const sessionId = req.cookies?.sessionId || req.body?.sessionId;

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
      const hydrated = [];
      for (const di of directItems) {
        const variant = await prisma.productVariant.findUnique({
          where: { id: di.variantId },
          include: { product: true },
        });
        if (!variant) {
          return res.status(404).json({ error: 'Product variant not found' });
        }
        hydrated.push({
          variantId: variant.id,
          quantity: Number(di.quantity) || 1,
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
      const qty = Number(item.quantity) || 1;

      if (!variant || variant.inventory < qty) {
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

    // Earn 10% of order merchandise value in points (1,000,000 VND = 100 points)
    const netMerchandiseSpend = Math.max(0, afterDiscount - loyaltyDiscount);
    const pointsToEarn = Math.floor(netMerchandiseSpend / EARN_DIVISOR);

    const orderNumber = generateOrderNumber();

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
        });
        if (!guestUser) {
          guestUser = await tx.user.create({
            data: {
              email: normalizedGuestEmail,
              fullName: String(shippingAddress.fullName).trim(),
              role: 'CUSTOMER',
              loyaltyPoints: 0,
            },
          });
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

    // Confirmation email (fire and forget)
    const emailTo = req.user?.email || shippingAddress.email;
    if (emailTo) {
      sendOrderConfirmationEmail(
        emailTo,
        req.user?.fullName || shippingAddress.fullName,
        {
          ...order,
          paymentMethod,
        }
      ).catch((error) => console.error('Order confirmation email failed:', error));
    }

    res.status(201).json({
      ...order,
      loyaltyDiscount,
      earnedPoints: pointsToEarn,
    });
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

    res.json(orders);
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

    res.json({
      ...order,
      loyaltyDiscount: (order.usedLoyaltyPoints || 0) * POINT_VALUE,
    });
  } catch (error) {
    console.error('Lookup order by number error:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Admin: Get all orders (must be declared before '/:id')
router.get('/admin/all', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, startDate, endDate } = req.query;

    const where = {};

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.createdAt = {
        ...(startDate && { gte: new Date(startDate) }),
        ...(endDate && { lte: new Date(endDate) }),
      };
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
      orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.max(1, Math.ceil(total / limitNum)),
      },
    });
  } catch (error) {
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
    const isOwner = req.user && order.userId === req.user.id;
    const isGuestOrder = Boolean(order.guestEmail);

    if (!isAdmin && !isOwner && !isGuestOrder) {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      return res.status(403).json({ error: 'Not authorized to view this order' });
    }

    res.json({
      ...order,
      loyaltyDiscount: (order.usedLoyaltyPoints || 0) * POINT_VALUE,
    });
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

    const order = await prisma.order.update({
      where: { id },
      data: {
        status,
        statusHistory: {
          create: {
            status,
            note: note || `Status changed to ${status}`,
          },
        },
      },
      include: ORDER_DETAIL_INCLUDE,
    });

    res.json(order);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

module.exports = router;
