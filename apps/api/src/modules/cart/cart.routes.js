const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const prisma = require('../../utils/prisma');
const { optionalAuth } = require('../../middleware/auth');
const { setSessionState } = require('../../utils/redis');

const FREE_SHIPPING_THRESHOLD = 20000000;
const SHIPPING_FEE = 30000;
const TAX_RATE = 0.1;

const CART_INCLUDE = {
  items: {
    orderBy: { createdAt: 'asc' },
    include: {
      variant: {
        include: {
          product: {
            include: {
              category: true,
              images: { orderBy: { position: 'asc' } },
            },
          },
        },
      },
    },
  },
};

function formatCartResponse(cart) {
  const items = (cart?.items || []).map((item) => {
    const product = item.variant?.product;
    const primaryImage =
      product?.images?.find((img) => img.isPrimary)?.url ||
      product?.images?.[0]?.url ||
      null;
    return {
      ...item,
      lineTotal: (item.variant?.price || 0) * item.quantity,
      productImage: primaryImage,
    };
  });

  const subtotal = items.reduce(
    (sum, item) => sum + (item.variant?.price || 0) * item.quantity,
    0
  );
  const shippingFee =
    subtotal === 0 ? 0 : subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const taxAmount = Math.round(subtotal * TAX_RATE);
  const total = subtotal + shippingFee + taxAmount;
  const itemCount = items.reduce((sum, item) => sum + (item.quantity || 0), 0);

  return {
    id: cart?.id,
    userId: cart?.userId || null,
    sessionId: cart?.sessionId || null,
    items,
    itemCount,
    subtotal,
    shippingFee,
    taxAmount,
    total,
  };
}

function setSessionCookie(res, sessionId) {
  const isSecure = Boolean(res.req?.secure || res.req?.headers?.['x-forwarded-proto'] === 'https');
  res.cookie('sessionId', sessionId, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });
}

function readCallerSessionId(req) {
  const raw = req.cookies?.sessionId || req.body?.sessionId || req.query?.sessionId;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 && trimmed.length <= 128 ? trimmed : null;
}

function isCallerCartOwner(req, cart) {
  if (!cart) return false;
  const cookieSessionId = readCallerSessionId(req);
  if (req.user && cart.userId === req.user.id) return true;
  if (cookieSessionId && cart.sessionId === cookieSessionId) return true;
  return false;
}

async function resolveOrCreateCart(req, res) {
  const cookieSessionId = readCallerSessionId(req);

  if (req.user) {
    let userCart = await prisma.cart.findUnique({
      where: { userId: req.user.id },
      include: CART_INCLUDE,
    });

    if (!userCart) {
      userCart = await prisma.cart.create({
        data: { userId: req.user.id },
        include: CART_INCLUDE,
      });
    }

    // Merge guest session cart into user cart if guest cart has items
    if (cookieSessionId) {
      const guestCart = await prisma.cart.findUnique({
        where: { sessionId: cookieSessionId },
        include: { items: true },
      });

      if (guestCart && guestCart.id !== userCart.id && guestCart.items.length > 0) {
        for (const gItem of guestCart.items) {
          const variant = await prisma.productVariant.findUnique({
            where: { id: gItem.variantId },
          });
          if (!variant || variant.inventory <= 0) continue;

          const existing = userCart.items.find((i) => i.variantId === gItem.variantId);
          if (existing) {
            const mergedQty = Math.min(variant.inventory, existing.quantity + gItem.quantity);
            await prisma.cartItem.update({
              where: { id: existing.id },
              data: { quantity: mergedQty },
            });
          } else {
            const allowedQty = Math.min(variant.inventory, gItem.quantity);
            await prisma.cartItem.create({
              data: {
                cartId: userCart.id,
                variantId: gItem.variantId,
                quantity: allowedQty,
              },
            });
          }
        }
        await prisma.cartItem.deleteMany({ where: { cartId: guestCart.id } });
        userCart = await prisma.cart.findUnique({
          where: { id: userCart.id },
          include: CART_INCLUDE,
        });
      }
    }

    return userCart;
  }

  // Guest cart
  let sessionId = cookieSessionId;
  let cart = null;

  if (sessionId) {
    cart = await prisma.cart.findUnique({
      where: { sessionId },
      include: CART_INCLUDE,
    });
  }

  if (!cart) {
    sessionId =
      sessionId || `guest_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
    cart = await prisma.cart.create({
      data: { sessionId },
      include: CART_INCLUDE,
    });
    setSessionCookie(res, sessionId);
  }

  return cart;
}

// Get or create cart
router.get('/', optionalAuth, async (req, res) => {
  try {
    const cart = await resolveOrCreateCart(req, res);
    const formatted = formatCartResponse(cart);
    const sessionKey = cart.sessionId || (cart.userId ? `user_${cart.userId}` : null);
    if (sessionKey) {
      setSessionState(`cart:${sessionKey}`, {
        cartId: formatted.id,
        itemCount: formatted.itemCount,
        total: formatted.total,
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
    }
    res.json(formatted);
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

// Add item to cart
router.post('/items', optionalAuth, async (req, res) => {
  try {
    const { variantId, quantity = 1 } = req.body;
    const parsedQty = Number(quantity);

    if (!variantId) {
      return res.status(400).json({ error: 'Variant ID is required' });
    }

    if (!Number.isInteger(parsedQty) || parsedQty < 1) {
      return res.status(400).json({ error: 'Quantity must be a positive integer' });
    }

    // Check variant exists and has inventory before modifying cart
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: true },
    });

    if (!variant || !variant.isActive) {
      return res.status(404).json({ error: 'Product variant not found' });
    }

    if (variant.inventory < parsedQty) {
      return res.status(400).json({ error: 'Insufficient inventory' });
    }

    const cart = await resolveOrCreateCart(req, res);

    // Check if item already in cart
    const existingItem = await prisma.cartItem.findFirst({
      where: { cartId: cart.id, variantId },
    });

    if (existingItem) {
      const newQuantity = existingItem.quantity + parsedQty;

      if (newQuantity > variant.inventory) {
        return res.status(400).json({
          error: `Insufficient inventory: only ${variant.inventory} items available`,
        });
      }

      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQuantity },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          variantId,
          quantity: parsedQty,
        },
      });
    }

    const updatedCart = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: CART_INCLUDE,
    });

    res.json(formatCartResponse(updatedCart));
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
    const parsedQty = Number(quantity);

    if (quantity === undefined || Number.isNaN(parsedQty) || !Number.isFinite(parsedQty)) {
      return res.status(400).json({ error: 'Valid quantity is required' });
    }

    const cartItem = await prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { variant: true, cart: true },
    });

    if (!cartItem) {
      return res.status(404).json({ error: 'Item not found in cart' });
    }

    if (!isCallerCartOwner(req, cartItem.cart)) {
      return res.status(403).json({ error: 'Not authorized to access this cart item' });
    }

    if (parsedQty > cartItem.variant.inventory) {
      return res.status(400).json({
        error: `Insufficient inventory: only ${cartItem.variant.inventory} items available`,
      });
    }

    if (parsedQty <= 0) {
      await prisma.cartItem.delete({ where: { id: itemId } });
    } else {
      await prisma.cartItem.update({
        where: { id: itemId },
        data: { quantity: Math.floor(parsedQty) },
      });
    }

    const updatedCart = await prisma.cart.findUnique({
      where: { id: cartItem.cartId },
      include: CART_INCLUDE,
    });

    res.json({
      message: 'Cart updated',
      ...formatCartResponse(updatedCart),
    });
  } catch (error) {
    console.error('Update cart item error:', error);
    res.status(500).json({ error: 'Failed to update cart' });
  }
});

// Remove item from cart
router.delete('/items/:itemId', optionalAuth, async (req, res) => {
  try {
    const { itemId } = req.params;

    const cartItem = await prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: true },
    });

    if (!cartItem) {
      return res.status(404).json({ error: 'Item not found in cart' });
    }

    if (!isCallerCartOwner(req, cartItem.cart)) {
      return res.status(403).json({ error: 'Not authorized to access this cart item' });
    }

    await prisma.cartItem.delete({
      where: { id: itemId },
    });

    const updatedCart = await prisma.cart.findUnique({
      where: { id: cartItem.cartId },
      include: CART_INCLUDE,
    });

    res.json({
      message: 'Item removed from cart',
      ...formatCartResponse(updatedCart),
    });
  } catch (error) {
    console.error('Remove cart item error:', error);
    res.status(500).json({ error: 'Failed to remove item' });
  }
});

// Clear cart
router.delete('/', optionalAuth, async (req, res) => {
  try {
    const cart = await resolveOrCreateCart(req, res);
    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    const clearedCart = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: CART_INCLUDE,
    });

    res.json({
      message: 'Cart cleared',
      ...formatCartResponse(clearedCart),
    });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
});

module.exports = router;
