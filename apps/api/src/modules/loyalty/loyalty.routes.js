const express = require('express');
const router = express.Router();
const prisma = require('../../utils/prisma');
const { authMiddleware } = require('../../middleware/auth');

// Get loyalty points balance and VND value (100 points = 100,000 VND)
router.get('/points', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { loyaltyPoints: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      points: user.loyaltyPoints,
      value: user.loyaltyPoints * 1000, // 100 points = 100,000 VND
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch loyalty points' });
  }
});

// Get loyalty transaction history
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const transactions = await prisma.loyaltyTransaction.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            createdAt: true,
          },
        },
      },
    });

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch loyalty history' });
  }
});

module.exports = router;
