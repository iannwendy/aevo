const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authMiddleware, adminOnly } = require('../../middleware/auth');

const prisma = new PrismaClient();

// Validate discount code
router.get('/validate/:code', async (req, res) => {
  try {
    const { code } = req.params;

    const discount = await prisma.discount.findUnique({
      where: { code: code.toUpperCase() },
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

    res.json({
      code: discount.code,
      discountType: discount.discountType,
      discountValue: discount.discountValue,
      description: discount.description,
      remainingUses: discount.maxUses - discount.usedCount,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to validate discount code' });
  }
});

// Get all discounts (admin)
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const discounts = await prisma.discount.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        usageHistory: {
          take: 5,
          orderBy: { usedAt: 'desc' },
          include: { order: true },
        },
        _count: { select: { orders: true } },
      },
    });

    res.json(discounts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch discounts' });
  }
});

// Create discount (admin)
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { code, description, discountType, discountValue, maxUses = 10 } = req.body;

    // Validate code format (5 chars alphanumeric)
    const codeRegex = /^[A-Z0-9]{5}$/;
    if (!codeRegex.test(code.toUpperCase())) {
      return res.status(400).json({ error: 'Code must be exactly 5 alphanumeric characters' });
    }

    // Check max uses (max 10 as per requirement)
    if (maxUses > 10) {
      return res.status(400).json({ error: 'Maximum usage limit is 10' });
    }

    // Check if code exists
    const existing = await prisma.discount.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (existing) {
      return res.status(400).json({ error: 'Code already exists' });
    }

    const discount = await prisma.discount.create({
      data: {
        code: code.toUpperCase(),
        description,
        discountType,
        discountValue,
        maxUses,
      },
    });

    res.status(201).json(discount);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create discount code' });
  }
});

// Update discount (admin)
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive, maxUses } = req.body;

    if (maxUses && maxUses > 10) {
      return res.status(400).json({ error: 'Maximum usage limit is 10' });
    }

    const discount = await prisma.discount.update({
      where: { id },
      data: {
        ...(isActive !== undefined && { isActive }),
        ...(maxUses && { maxUses }),
      },
    });

    res.json(discount);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update discount' });
  }
});

// Delete discount (admin)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.discount.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({ message: 'Discount deactivated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete discount' });
  }
});

module.exports = router;
