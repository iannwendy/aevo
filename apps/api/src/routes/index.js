const express = require('express');
const router = express.Router();

// Import module routes
const authRoutes = require('../modules/auth/auth.routes');
const userRoutes = require('../modules/users/users.routes');
const productRoutes = require('../modules/products/products.routes');
const categoryRoutes = require('../modules/categories/categories.routes');
const cartRoutes = require('../modules/cart/cart.routes');
const orderRoutes = require('../modules/orders/orders.routes');
const discountRoutes = require('../modules/discounts/discounts.routes');
const reviewRoutes = require('../modules/reviews/reviews.routes');
const loyaltyRoutes = require('../modules/loyalty/loyalty.routes');
const analyticsRoutes = require('../modules/analytics/analytics.routes');

// Public routes
router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);
router.use('/discounts', discountRoutes);
router.use('/reviews', reviewRoutes);
router.use('/loyalty', loyaltyRoutes);

// Protected routes
router.use('/users', userRoutes);
router.use('/analytics', analyticsRoutes);

module.exports = router;
