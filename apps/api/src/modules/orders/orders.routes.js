const express = require('express');
const router = express.Router();
const prisma = require('../../utils/prisma');
const { authMiddleware, optionalAuth, adminOnly } = require('../../middleware/auth');
const { generateOrderNumber } = require('../../utils/helpers');
const { sendOrderConfirmationEmail } = require('../../services/mailer');

const PAYMENT_METHODS = ['cod', 'bank_transfer', 'card', 'momo'];

// Points are worth 1,000 VND each; 100 points = 100,000 VND.
const POINT_VALUE = 1000;

// Loyalty earn rate: 1 point per 10,000 VND spent (10% of value in VND).
const EARN_DIVISOR = 10000;

const FREE_SHIPPING_THRESHOLD = 20000000;
const SHIPPING_FEE = 30000;
const TAX_RATE = 0.1;

function roundVnd(amount) {
  return Math.round(amount);
}

// Create order (checkout)
router.post('/', optionalAuth, async (req, res) => {
  try {
    const {
      shippingAddress,
      discountCode,
      usedLoyaltyPoints = 0,
      paymentMethod = 'cod',
      notes,
    } = req.body;

    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ error: 'Invalid payment method' });
    }

    const pointsToRedeem = Number(usedLoyaltyPoints) || 0;
    if (!Number.isInteger(pointsToRedeem) || pointsToRedeem < 0) {
      return res.status(400).json({ error: 'Invalid loyalty points' });
    }

    if (!shippingAddress || !shippingAddress.fullName || !shippingAddress.phone || !shippingAddress.address) {
      return res.status(400).json({ error: 'Shipping address is required' });
    }

    const sessionId = req.cookies.sessionId;

    // Get cart (with variants and their product)
    const cart = await prisma.cart.findFirst({
      where: req.user ? { userId: req.user.id } : sessionId ? { sessionId } : { id: '__none__' },
      include: {
        items: {
          include: {
            variant: { include: { product: true } },
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    if (!req.user && !shippingAddress.email) {
      return res.status(400).json({ error: 'Email is required for guest checkout' });
    }

    // Check inventory and calculate subtotal
    let subtotal = 0;
    const orderItems = [];

    for (const item of cart.items) {
      const variant = item.variant;

      if (!variant || variant.inventory < item.quantity) {
        return res.status(400).json({
          error: `Insufficient inventory for ${variant?.product?.name || 'product'}`,
        });
      }

      subtotal += variant.price * item.quantity;
      orderItems.push({
        productId: variant.productId,
        variantId: item.variantId,
        productName: variant.product.name,
        variantName: variant.name,
        price: variant.price,
        quantity: item.quantity,
      });
    }

    // Validate discount
    let discountAmount = 0;
    let discountId = null;
    let discountMaxUses = null;

    if (discountCode) {
      const discount = await prisma.discount.findUnique({
        where: { code: String(discountCode).toUpperCase() },
      });

      if (!discount || !discount.isActive) {
        return res.status(400).json({ error: 'Invalid or expired discount code' });
      }

      // usedCount is re-checked inside the transaction below, where it is also
      // incremented atomically, so concurrent checkouts cannot exceed maxUses.
      if (discount.usedCount >= discount.maxUses) {
        return res.status(400).json({ error: 'Discount code has reached its usage limit' });
      }

      discountId = discount.id;
      discountMaxUses = discount.maxUses;
      if (discount.discountType === 'percentage') {
        discountAmount = subtotal * (discount.discountValue / 100);
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

    const afterDiscount = subtotal - discountAmount;

    // Shipping (free over 20M VND before tax) and tax (10%)
    const shippingFee = afterDiscount >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
    const taxAmount = roundVnd(afterDiscount * TAX_RATE);

    // Loyalty discount cannot push the total below zero
    const loyaltyDiscount = Math.min(pointsToRedeem * POINT_VALUE, afterDiscount + shippingFee + taxAmount);

    const totalAmount = afterDiscount + shippingFee + taxAmount - loyaltyDiscount;

    // Points earned on money actually paid (excluding shipping)
    const pointsToEarn = Math.floor((afterDiscount + taxAmount - loyaltyDiscount) / EARN_DIVISOR);

    const orderNumber = generateOrderNumber();

    const order = await prisma.$transaction(async (tx) => {
      // Deduct inventory atomically: the guarded update fails instead of
      // overselling when a concurrent checkout took the stock first.
      for (const item of cart.items) {
        const result = await tx.productVariant.updateMany({
          where: { id: item.variantId, inventory: { gte: item.quantity } },
          data: { inventory: { decrement: item.quantity } },
        });
        if (result.count === 0) {
          throw Object.assign(new Error('Insufficient inventory'), { status: 400 });
        }
      }

      // Claim a discount use atomically
      if (discountId) {
        const claimed = await tx.discount.updateMany({
          where: { id: discountId, usedCount: { lt: discountMaxUses } },
          data: { usedCount: { increment: 1 } },
        });
        if (claimed.count === 0) {
          throw Object.assign(new Error('Discount code has reached its usage limit'), { status: 400 });
        }
      }

      // Redeem loyalty points atomically: the balance check inside the
      // update prevents spending points twice from parallel checkouts.
      if (pointsToRedeem > 0) {
        const result = await tx.user.updateMany({
          where: { id: req.user.id, loyaltyPoints: { gte: pointsToRedeem } },
          data: { loyaltyPoints: { decrement: pointsToRedeem } },
        });
        if (result.count === 0) {
          throw Object.assign(new Error('Not enough loyalty points'), { status: 400 });
        }
      }

      // Create address for logged-in customers
      let addressId = null;
      if (req.user) {
        const address = await tx.address.create({
          data: {
            userId: req.user.id,
            fullName: shippingAddress.fullName,
            phone: shippingAddress.phone,
            address: shippingAddress.address,
            ward: shippingAddress.ward,
            district: shippingAddress.district,
            city: shippingAddress.city || '',
          },
        });
        addressId = address.id;
      }

      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          userId: req.user?.id,
          guestEmail: req.user ? undefined : shippingAddress.email,
          guestName: req.user ? undefined : shippingAddress.fullName,
          subtotal,
          shippingFee,
          discountAmount,
          taxAmount,
          totalAmount,
          discountCodeId: discountId,
          usedLoyaltyPoints: pointsToRedeem,
          notes,
          addressId,
          paymentMethod,
          items: { create: orderItems },
          statusHistory: {
            create: { status: 'PENDING', note: 'Order placed' },
          },
        },
        include: { items: true },
      });

      if (discountId) {
        await tx.discountUsage.create({
          data: { discountId, orderId: newOrder.id },
        });
      }

      // Payment record: COD is settled on delivery, online methods start pending.
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
            description: `Redeemed on order ${orderNumber}`,
          },
        });
      }

      if (req.user && pointsToEarn > 0) {
        await tx.loyaltyTransaction.create({
          data: {
            userId: req.user.id,
            amount: pointsToEarn,
            type: 'earn',
            orderId: newOrder.id,
            description: `Earned from order ${orderNumber}`,
          },
        });
        await tx.user.update({
          where: { id: req.user.id },
          data: { loyaltyPoints: { increment: pointsToEarn } },
        });
      }

      // Clear cart
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return newOrder;
    });

    // Confirmation email (fire and forget: ordering must not fail on SMTP)
    const emailTo = req.user?.email || shippingAddress.email;
    if (emailTo) {
      sendOrderConfirmationEmail(emailTo, req.user?.fullName || shippingAddress.fullName, {
        ...order,
        paymentMethod,
      }).catch((error) => console.error('Order confirmation email failed:', error));
    }

    res.status(201).json(order);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Get current user's orders
router.get('/', authMiddleware, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        payments: true,
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
    });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Admin: Get all orders. Must be declared before '/:id' or Express matches
// 'admin' as an id.
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
        include: {
          user: { select: { id: true, email: true, fullName: true } },
          items: true,
          payments: true,
        },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get single order (owner or admin)
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findFirst({
      where: {
        id,
        OR: [{ userId: req.user.id }, { user: { role: 'ADMIN' } }],
      },
      include: {
        items: { include: { variant: true } },
        statusHistory: { orderBy: { createdAt: 'desc' } },
        shippingAddress: true,
        discountCode: true,
        payments: true,
      },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Admin: Update order status
router.put('/:id/status', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;

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
      include: {
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
    });

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

module.exports = router;
