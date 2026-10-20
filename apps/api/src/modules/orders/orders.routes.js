const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authMiddleware, optionalAuth, adminOnly } = require('../../middleware/auth');
const { generateOrderNumber } = require('../../../utils/helpers');

const prisma = new PrismaClient();

// Create order (checkout)
router.post('/', optionalAuth, async (req, res) => {
  try {
    const {
      shippingAddress,
      discountCode,
      usedLoyaltyPoints = 0,
      paymentMethod = 'cod',
    } = req.body;

    const sessionId = req.cookies.sessionId;

    // Get cart
    let cart;
    if (req.user) {
      cart = await prisma.cart.findUnique({
        where: { userId: req.user.id },
        include: {
          items: {
            include: {
              variant: true,
            },
          },
        },
      });
    } else if (sessionId) {
      cart = await prisma.cart.findUnique({
        where: { sessionId },
        include: {
          items: {
            include: {
              variant: true,
            },
          },
        },
      });
    }

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Check inventory and calculate totals
    let subtotal = 0;
    const orderItems = [];

    for (const item of cart.items) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: item.variantId },
        include: { product: true },
      });

      if (!variant || variant.inventory < item.quantity) {
        return res.status(400).json({
          error: `Insufficient inventory for ${variant?.product?.name || 'product'}`
        });
      }

      subtotal += variant.price * item.quantity;
      orderItems.push({
        variantId: item.variantId,
        productName: variant.product.name,
        variantName: variant.name,
        price: variant.price,
        quantity: item.quantity,
        productId: variant.productId,
      });
    }

    // Apply discount
    let discountAmount = 0;
    let discountCodeId = null;

    if (discountCode) {
      const discount = await prisma.discount.findUnique({
        where: { code: discountCode.toUpperCase() },
      });

      if (discount && discount.isActive && discount.usedCount < discount.maxUses) {
        discountCodeId = discount.id;
        if (discount.discountType === 'percentage') {
          discountAmount = subtotal * (discount.discountValue / 100);
        } else {
          discountAmount = Math.min(discount.discountValue, subtotal);
        }
      }
    }

    // Calculate loyalty points to earn (10%)
    const pointsToEarn = Math.floor((subtotal - discountAmount) / 1000); // 10% = points/1000

    // Calculate shipping (free over 20M VND)
    const shippingFee = subtotal - discountAmount >= 20000000 ? 0 : 30000;

    // Calculate tax (10%)
    const taxAmount = Math.round((subtotal - discountAmount) * 0.1);

    // Apply loyalty points (100 points = 100,000 VND)
    const loyaltyDiscount = usedLoyaltyPoints * 1000;
    const totalAmount = subtotal - discountAmount + shippingFee + taxAmount - loyaltyDiscount;

    // Create address if logged in
    let addressId = null;
    if (req.user && shippingAddress) {
      const address = await prisma.address.create({
        data: {
          userId: req.user.id,
          fullName: shippingAddress.fullName,
          phone: shippingAddress.phone,
          address: shippingAddress.address,
          ward: shippingAddress.ward,
          district: shippingAddress.district,
          city: shippingAddress.city,
        },
      });
      addressId = address.id;
    }

    // Generate order number
    const orderNumber = generateOrderNumber();

    // Create order with transaction
    const order = await prisma.$transaction(async (tx) => {
      // Deduct inventory
      for (const item of cart.items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: {
            inventory: {
              decrement: item.quantity,
            },
          },
        });
      }

      // Update discount usage
      if (discountCodeId) {
        await tx.discount.update({
          where: { id: discountCodeId },
          data: {
            usedCount: { increment: 1 },
          },
        });

        await tx.discountUsage.create({
          data: {
            discountId: discountCodeId,
            orderId: orderNumber,
          },
        });
      }

      // Create order
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          userId: req.user?.id,
          guestEmail: req.user ? undefined : shippingAddress?.email,
          guestName: req.user ? undefined : shippingAddress?.fullName,
          subtotal,
          shippingFee,
          discountAmount,
          taxAmount,
          totalAmount,
          discountCodeId,
          usedLoyaltyPoints,
          addressId,
          items: {
            create: orderItems,
          },
          statusHistory: {
            create: {
              status: 'PENDING',
              note: 'Order placed',
            },
          },
        },
        include: {
          items: true,
          statusHistory: { orderBy: { createdAt: 'desc' } },
        },
      });

      // Create loyalty transaction (earn points)
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

        // Update user points
        await tx.user.update({
          where: { id: req.user.id },
          data: {
            loyaltyPoints: { increment: pointsToEarn },
          },
        });
      }

      // Redeem loyalty points
      if (req.user && usedLoyaltyPoints > 0) {
        await tx.loyaltyTransaction.create({
          data: {
            userId: req.user.id,
            amount: -usedLoyaltyPoints,
            type: 'redeem',
            orderId: newOrder.id,
            description: `Redeemed on order ${orderNumber}`,
          },
        });

        await tx.user.update({
          where: { id: req.user.id },
          data: {
            loyaltyPoints: { decrement: usedLoyaltyPoints },
          },
        });
      }

      // Clear cart
      await tx.cartItem.deleteMany({
        where: { cartId: cart.id },
      });

      // Create account for guest if email provided
      if (!req.user && shippingAddress?.email) {
        const existingUser = await tx.user.findUnique({
          where: { email: shippingAddress.email },
        });

        if (!existingUser) {
          // Note: In production, send password via email
          // For now, just link order to email
        }
      }

      return newOrder;
    });

    res.status(201).json(order);
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Get user's orders
router.get('/', authMiddleware, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { variant: true } },
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
    });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get single order
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findFirst({
      where: {
        id,
        OR: [
          { userId: req.user.id },
          { user: { role: 'ADMIN' } },
        ],
      },
      include: {
        items: { include: { variant: true } },
        statusHistory: { orderBy: { createdAt: 'desc' } },
        shippingAddress: true,
        discountCode: true,
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

// Admin: Get all orders
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

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
        include: {
          user: { select: { id: true, email: true, fullName: true } },
          items: true,
        },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
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
