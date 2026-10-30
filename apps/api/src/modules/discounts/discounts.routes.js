const express = require('express');
const router = express.Router();
const prisma = require('../../utils/prisma');
const { authMiddleware, adminOnly } = require('../../middleware/auth');

const CODE_REGEX = /^[A-Z0-9]{5}$/;

// Validate discount code (public — used during checkout)
router.get('/validate/:code', async (req, res) => {
  try {
    const rawCode = String(req.params.code || '').trim().toUpperCase();
    if (!rawCode) {
      return res.status(400).json({ error: 'Discount code is required' });
    }

    const discount = await prisma.discount.findUnique({
      where: { code: rawCode },
    });

    if (!discount) {
      return res.status(404).json({ error: 'Invalid discount code' });
    }

    if (!discount.isActive) {
      return res.status(400).json({ error: 'Discount code is no longer active' });
    }

    if (discount.usedCount >= discount.maxUses) {
      return res.status(400).json({ error: 'Discount code has reached its usage limit' });
    }

    const subtotalParam = Number(req.query.subtotal);
    let discountAmount = null;
    if (!Number.isNaN(subtotalParam) && subtotalParam > 0) {
      if (discount.discountType === 'percentage') {
        discountAmount = Math.round(subtotalParam * (discount.discountValue / 100));
      } else {
        discountAmount = Math.min(discount.discountValue, subtotalParam);
      }
    }

    res.json({
      id: discount.id,
      code: discount.code,
      discountType: discount.discountType,
      discountValue: discount.discountValue,
      description: discount.description,
      maxUses: discount.maxUses,
      usedCount: discount.usedCount,
      remainingUses: discount.maxUses - discount.usedCount,
      ...(discountAmount !== null && { discountAmount }),
    });
  } catch (error) {
    console.error('Validate discount error:', error);
    res.status(500).json({ error: 'Failed to validate discount code' });
  }
});

const DISCOUNT_ADMIN_INCLUDE = {
  usageHistory: {
    orderBy: { usedAt: 'desc' },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          discountAmount: true,
          status: true,
          guestName: true,
          guestEmail: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      },
    },
  },
  orders: {
    where: { status: { not: 'CANCELLED' } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      orderNumber: true,
      totalAmount: true,
      discountAmount: true,
      status: true,
      guestName: true,
      guestEmail: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
  },
  _count: { select: { orders: { where: { status: { not: 'CANCELLED' } } } } },
};

// Get all discounts (admin)
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const discounts = await prisma.discount.findMany({
      orderBy: { createdAt: 'desc' },
      include: DISCOUNT_ADMIN_INCLUDE,
    });

    res.json(discounts);
  } catch (error) {
    console.error('Get discounts error:', error);
    res.status(500).json({ error: 'Failed to fetch discounts' });
  }
});

// Get single discount detail with orders where applied (admin)
router.get('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const discount = await prisma.discount.findFirst({
      where: {
        OR: [{ id }, { code: String(id).trim().toUpperCase() }],
      },
      include: DISCOUNT_ADMIN_INCLUDE,
    });

    if (!discount) {
      return res.status(404).json({ error: 'Discount not found' });
    }

    res.json(discount);
  } catch (error) {
    console.error('Get discount detail error:', error);
    res.status(500).json({ error: 'Failed to fetch discount detail' });
  }
});

// Create discount (admin)
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const {
      code,
      description,
      discountType = 'percentage',
      discountValue,
      maxUses = 10,
    } = req.body;

    const normalizedCode = String(code || '').trim().toUpperCase();

    // Validate code format (strictly 5 chars alphanumeric per requirement.md)
    if (!CODE_REGEX.test(normalizedCode)) {
      return res
        .status(400)
        .json({ error: 'Code must be exactly 5 alphanumeric characters' });
    }

    const parsedMaxUses = Number(maxUses);
    if (!Number.isInteger(parsedMaxUses) || parsedMaxUses < 1 || parsedMaxUses > 10) {
      return res
        .status(400)
        .json({ error: 'Maximum usage limit must be between 1 and 10' });
    }

    const parsedValue = Number(discountValue);
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      return res.status(400).json({ error: 'Discount value must be greater than 0' });
    }

    if (!['percentage', 'fixed'].includes(discountType)) {
      return res
        .status(400)
        .json({ error: 'Discount type must be percentage or fixed' });
    }

    if (discountType === 'percentage' && parsedValue > 100) {
      return res
        .status(400)
        .json({ error: 'Percentage discount cannot exceed 100%' });
    }

    if (description !== undefined && String(description || '').length > 500) {
      return res
        .status(400)
        .json({ error: 'Discount description exceeds maximum allowed length (500 characters)' });
    }

    const existing = await prisma.discount.findUnique({
      where: { code: normalizedCode },
    });

    if (existing) {
      return res.status(400).json({ error: 'Code already exists' });
    }

    const discount = await prisma.discount.create({
      data: {
        code: normalizedCode,
        description: description || null,
        discountType,
        discountValue: parsedValue,
        maxUses: parsedMaxUses,
      },
    });

    res.status(201).json(discount);
  } catch (error) {
    console.error('Create discount error:', error);
    res.status(500).json({ error: 'Failed to create discount code' });
  }
});

// Update discount (admin)
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive, maxUses, description, discountValue, discountType } = req.body;

    if (description !== undefined && String(description || '').length > 500) {
      return res
        .status(400)
        .json({ error: 'Discount description exceeds maximum allowed length (500 characters)' });
    }

    if (maxUses !== undefined) {
      const parsedMax = Number(maxUses);
      if (!Number.isInteger(parsedMax) || parsedMax < 1 || parsedMax > 10) {
        return res
          .status(400)
          .json({ error: 'Maximum usage limit must be between 1 and 10' });
      }
    }

    if (discountType !== undefined && !['percentage', 'fixed'].includes(discountType)) {
      return res
        .status(400)
        .json({ error: 'Discount type must be percentage or fixed' });
    }

    if (discountValue !== undefined) {
      const parsedVal = Number(discountValue);
      if (!Number.isFinite(parsedVal) || parsedVal <= 0) {
        return res.status(400).json({ error: 'Discount value must be greater than 0' });
      }
      if ((discountType === 'percentage' || discountType === undefined) && parsedVal > 100) {
        const existing = await prisma.discount.findUnique({ where: { id } });
        const effectiveType = discountType || existing?.discountType || 'percentage';
        if (effectiveType === 'percentage' && parsedVal > 100) {
          return res
            .status(400)
            .json({ error: 'Percentage discount cannot exceed 100%' });
        }
      }
    }

    const discount = await prisma.discount.update({
      where: { id },
      data: {
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        ...(maxUses !== undefined && { maxUses: Number(maxUses) }),
        ...(description !== undefined && { description }),
        ...(discountValue !== undefined && { discountValue: Number(discountValue) }),
        ...(discountType !== undefined && { discountType }),
      },
    });

    res.json(discount);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Discount not found' });
    }
    res.status(500).json({ error: 'Failed to update discount' });
  }
});

// Delete / Deactivate discount (admin)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    const updated = await prisma.discount.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({ message: 'Discount deactivated', ...updated, discount: updated });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Discount not found' });
    }
    res.status(500).json({ error: 'Failed to delete discount' });
  }
});

module.exports = router;
