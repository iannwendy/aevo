const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { optionalAuth } = require('../../middleware/auth');

const prisma = new PrismaClient();

// Get or create cart
router.get('/', optionalAuth, async (req, res) => {
  try {
    let cart;

    if (req.user) {
      // Get user's cart
      cart = await prisma.cart.findUnique({
        where: { userId: req.user.id },
        include: {
          items: {
            include: {
              variant: {
                include: {
                  product: {
                    include: {
                      images: { where: { isPrimary: true }, take: 1 },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!cart) {
        cart = await prisma.cart.create({
          data: { userId: req.user.id },
          include: { items: true },
        });
      }
    } else {
      // Get guest cart from session
      const sessionId = req.cookies.sessionId || req.body.sessionId;

      if (sessionId) {
        cart = await prisma.cart.findUnique({
          where: { sessionId },
          include: {
            items: {
              include: {
                variant: {
                  include: {
                    product: {
                      include: {
                        images: { where: { isPrimary: true }, take: 1 },
                      },
                    },
                  },
                },
              },
            },
          },
        });
      }

      if (!cart) {
        // Create new guest cart
        const newSessionId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        cart = await prisma.cart.create({
          data: { sessionId: newSessionId },
          include: { items: true },
        });

        // Set session cookie
        res.cookie('sessionId', newSessionId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        });
      }
    }

    // Calculate totals
    const subtotal = cart.items.reduce(
      (sum, item) => sum + item.variant.price * item.quantity,
      0
    );

    res.json({
      ...cart,
      subtotal,
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

// Add item to cart
router.post('/items', optionalAuth, async (req, res) => {
  try {
    const { variantId, quantity = 1 } = req.body;
    const sessionId = req.cookies.sessionId;

    // Get or create cart
    let cart;
    if (req.user) {
      cart = await prisma.cart.findUnique({
        where: { userId: req.user.id },
      });

      if (!cart) {
        cart = await prisma.cart.create({
          data: { userId: req.user.id },
        });
      }
    } else {
      let currentSessionId = sessionId || req.body.sessionId;
      if (!currentSessionId) {
        currentSessionId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
        res.cookie('sessionId', currentSessionId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 30 * 24 * 60 * 60 * 1000,
        });
      }

      cart = await prisma.cart.findUnique({
        where: { sessionId: currentSessionId },
      });

      if (!cart) {
        cart = await prisma.cart.create({
          data: { sessionId: currentSessionId },
        });
      }
    }

    // Check variant exists and has inventory
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: true },
    });

    if (!variant) {
      return res.status(404).json({ error: 'Product variant not found' });
    }

    if (variant.inventory < quantity) {
      return res.status(400).json({ error: 'Insufficient inventory' });
    }

    // Check if item already in cart
    const existingItem = await prisma.cartItem.findFirst({
      where: { cartId: cart.id, variantId },
    });

    if (existingItem) {
      // Update quantity
      const newQuantity = existingItem.quantity + quantity;

      if (newQuantity > variant.inventory) {
        return res.status(400).json({
          error: `Only ${variant.inventory} items available`
        });
      }

      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQuantity },
      });
    } else {
      // Add new item
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          variantId,
          quantity,
        },
      });
    }

    // Return updated cart
    const updatedCart = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: {
                  include: {
                    images: { where: { isPrimary: true }, take: 1 },
                  },
                },
              },
            },
          },
        },
      },
    });

    const subtotal = updatedCart.items.reduce(
      (sum, item) => sum + item.variant.price * item.quantity,
      0
    );

    res.json({
      ...updatedCart,
      subtotal,
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ error: 'Failed to add to cart' });
  }
});

// Update cart item quantity
router.put('/items/:itemId', optionalAuth, async (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;

    const cartItem = await prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { variant: true },
    });

    if (!cartItem) {
      return res.status(404).json({ error: 'Item not found in cart' });
    }

    if (quantity > cartItem.variant.inventory) {
      return res.status(400).json({
        error: `Only ${cartItem.variant.inventory} items available`
      });
    }

    if (quantity <= 0) {
      await prisma.cartItem.delete({ where: { id: itemId } });
    } else {
      await prisma.cartItem.update({
        where: { id: itemId },
        data: { quantity },
      });
    }

    res.json({ message: 'Cart updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update cart' });
  }
});

// Remove item from cart
router.delete('/items/:itemId', optionalAuth, async (req, res) => {
  try {
    const { itemId } = req.params;

    await prisma.cartItem.delete({
      where: { id: itemId },
    });

    res.json({ message: 'Item removed from cart' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove item' });
  }
});

// Clear cart
router.delete('/', optionalAuth, async (req, res) => {
  try {
    const sessionId = req.cookies.sessionId;

    if (req.user) {
      await prisma.cart.delete({
        where: { userId: req.user.id },
      });

      await prisma.cart.create({
        data: { userId: req.user.id },
      });
    } else if (sessionId) {
      await prisma.cartItem.deleteMany({
        where: { cart: { sessionId } },
      });
    }

    res.json({ message: 'Cart cleared' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear cart' });
  }
});

module.exports = router;
