const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { optionalAuth } = require('../../middleware/auth');

const prisma = new PrismaClient();

// Get reviews for a product
router.get('/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;

    const reviews = await prisma.review.findMany({
      where: { productId },
      include: {
        user: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate average rating
    const ratings = reviews.filter((r) => r.rating);
    const avgRating = ratings.length
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
      : 0;

    res.json({
      reviews,
      averageRating: avgRating.toFixed(1),
      totalReviews: reviews.length,
      ratingDistribution: {
        5: ratings.filter((r) => r.rating === 5).length,
        4: ratings.filter((r) => r.rating === 4).length,
        3: ratings.filter((r) => r.rating === 3).length,
        2: ratings.filter((r) => r.rating === 2).length,
        1: ratings.filter((r) => r.rating === 1).length,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Create review (comment - guest allowed, rating - login required)
router.post('/', optionalAuth, async (req, res) => {
  try {
    const { productId, rating, comment, guestName } = req.body;

    // Rating requires login
    if (rating && !req.user) {
      return res.status(401).json({ error: 'Login required to rate products' });
    }

    // Validate rating
    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Comment requires either login or guest name
    if (!comment) {
      return res.status(400).json({ error: 'Comment is required' });
    }

    const review = await prisma.review.create({
      data: {
        productId,
        userId: req.user?.id,
        guestName: req.user ? undefined : guestName || 'Guest',
        rating,
        comment,
      },
      include: {
        user: { select: { id: true, fullName: true } },
      },
    });

    // Emit realtime event
    const io = req.app.get('io');
    if (io) {
      io.to(`product-${productId}`).emit('new-review', review);
    }

    res.status(201).json(review);
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ error: 'Failed to create review' });
  }
});

// Update review
router.put('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    const existing = await prisma.review.findUnique({ where: { id } });

    if (!existing) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Only author or admin can update
    if (req.user && existing.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const review = await prisma.review.update({
      where: { id },
      data: {
        ...(rating && { rating }),
        ...(comment && { comment }),
      },
      include: {
        user: { select: { id: true, fullName: true } },
      },
    });

    res.json(review);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update review' });
  }
});

// Delete review
router.delete('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.review.findUnique({ where: { id } });

    if (!existing) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Only author or admin can delete
    if (req.user && existing.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.review.delete({ where: { id } });

    res.json({ message: 'Review deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

module.exports = router;
