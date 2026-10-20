const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../../middleware/auth');

const prisma = new PrismaClient();

// Get loyalty points
router.get('/points', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { loyaltyPoints: true },
    });

    res.json({
      points: user.loyaltyPoints,
      value: user.loyaltyPoints * 1000, // 100 points = 100,000 VND
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch loyalty points' });
  }
});

// Get loyalty history
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const transactions = await prisma.loyaltyTransaction.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch loyalty history' });
  }
});

module.exports = router;
