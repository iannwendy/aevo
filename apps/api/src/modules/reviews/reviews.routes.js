const express = require('express');
const router = express.Router();
const prisma = require('../../utils/prisma');
const { optionalAuth } = require('../../middleware/auth');
const { rateLimit } = require('../../middleware/rateLimit');
const { publishSocketEvent } = require('../../utils/redis');
const { publishDomainEvent } = require('../../utils/eventBus');
const {
  enrichReviewWithSentiment,
  computeSentimentSummary,
} = require('../../utils/sentiment');

function buildReviewStats(reviews = []) {
  const ratings = reviews.filter((r) => typeof r.rating === 'number' && r.rating >= 1 && r.rating <= 5);
  const avgRating = ratings.length
    ? Number((ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1))
    : 0;

  return {
    averageRating: avgRating,
    totalReviews: reviews.length,
    ratingCount: ratings.length,
    ratingDistribution: {
      5: ratings.filter((r) => r.rating === 5).length,
      4: ratings.filter((r) => r.rating === 4).length,
      3: ratings.filter((r) => r.rating === 3).length,
      2: ratings.filter((r) => r.rating === 2).length,
      1: ratings.filter((r) => r.rating === 1).length,
    },
  };
}

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

    const enrichedReviews = reviews.map(enrichReviewWithSentiment);
    const stats = buildReviewStats(enrichedReviews);
    const sentimentSummary = computeSentimentSummary(enrichedReviews);

    res.json({
      reviews: enrichedReviews,
      ...stats,
      sentimentSummary,
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Create review (comment - guest allowed, rating - login required)
router.post(
  '/',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 40, message: 'Too many review submissions' }),
  optionalAuth,
  async (req, res) => {
  try {
    const { productId, rating, comment, guestName } = req.body;

    if (!productId || typeof productId !== 'string') {
      return res.status(400).json({ error: 'Product ID is required' });
    }

    const hasRating = rating !== undefined && rating !== null && rating !== '';

    // Rating requires login
    if (hasRating && !req.user) {
      return res.status(401).json({ error: 'Login required to rate products' });
    }

    // Validate rating (1-5 integer)
    let parsedRating = null;
    if (hasRating) {
      parsedRating = Number(rating);
      if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
      }
    }

    // Comment is required when no star rating is submitted; bounded to 2000 characters
    const cleanComment = comment ? String(comment).trim() : '';
    if (!cleanComment && !parsedRating) {
      return res.status(400).json({ error: 'Comment is required' });
    }
    if (cleanComment.length > 2000) {
      return res.status(400).json({ error: 'Comment must not exceed 2000 characters' });
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.isActive) {
      return res.status(404).json({ error: 'Product not found' });
    }

    let isVerified = false;
    if (req.user) {
      const priorPurchase = await prisma.orderItem.findFirst({
        where: {
          productId,
          order: {
            userId: req.user.id,
            status: { not: 'CANCELLED' },
          },
        },
      });
      isVerified = Boolean(priorPurchase);
    }

    const cleanGuestName =
      guestName && String(guestName).trim()
        ? String(guestName).trim().slice(0, 100)
        : 'Guest';

    const review = await prisma.review.create({
      data: {
        productId,
        userId: req.user?.id || null,
        guestName: req.user ? null : cleanGuestName,
        rating: parsedRating,
        comment: cleanComment,
        isVerified,
      },
      include: {
        user: { select: { id: true, fullName: true } },
      },
    });

    const enrichedReview = enrichReviewWithSentiment(review);

    // Emit realtime event via Socket.IO and broadcast across instances via Redis Pub/Sub
    const io = req.app.get('io');
    if (io) {
      io.to(`product-${productId}`).emit('new-review', enrichedReview);
    }
    publishSocketEvent('new-review', `product-${productId}`, enrichedReview).catch(() => {});
    publishDomainEvent('REVIEW_SUBMITTED', {
      reviewId: enrichedReview.id,
      productId,
      rating: enrichedReview.rating,
      comment: enrichedReview.comment,
      sentiment: enrichedReview.sentiment?.label,
    }).catch(() => {});

    res.status(201).json(enrichedReview);
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ error: 'Failed to create review' });
  }
});

// Update review
router.put('/:id', optionalAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    const { rating, comment } = req.body;

    const existing = await prisma.review.findUnique({ where: { id } });

    if (!existing) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Only author or admin can update
    if (existing.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const data = {};
    if (rating !== undefined && rating !== null) {
      const parsedRating = Number(rating);
      if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
      }
      data.rating = parsedRating;
    }
    if (comment !== undefined) {
      const cleanComment = String(comment).trim();
      if (!cleanComment) {
        return res.status(400).json({ error: 'Comment cannot be empty' });
      }
      data.comment = cleanComment;
    }

    const review = await prisma.review.update({
      where: { id },
      data,
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
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;

    const existing = await prisma.review.findUnique({ where: { id } });

    if (!existing) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Only author or admin can delete
    if (existing.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.review.delete({ where: { id } });

    res.json({ message: 'Review deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

module.exports = router;
