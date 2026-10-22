const express = require('express');
const router = express.Router();
const prisma = require('../../utils/prisma');
const { authMiddleware, adminOnly } = require('../../middleware/auth');

// ====================================================================
// Customer Delivery Addresses (/api/users/addresses)
// Must be declared BEFORE '/:id' so Express does not match 'addresses' as a user ID.
// ====================================================================

// Get current user's addresses
router.get('/addresses', authMiddleware, async (req, res) => {
  try {
    const addresses = await prisma.address.findMany({
      where: { userId: req.user.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    res.json(addresses);
  } catch (error) {
    console.error('List addresses error:', error);
    res.status(500).json({ error: 'Failed to fetch addresses' });
  }
});

// Add new delivery address
router.post('/addresses', authMiddleware, async (req, res) => {
  try {
    const {
      fullName,
      phone,
      address,
      ward = null,
      district = null,
      city = 'Ho Chi Minh City',
      isDefault,
    } = req.body;

    if (!fullName || !String(fullName).trim() || !phone || !String(phone).trim() || !address || !String(address).trim()) {
      return res.status(400).json({
        error: 'Full name, phone, and street address are required',
      });
    }

    const existingCount = await prisma.address.count({
      where: { userId: req.user.id },
    });

    const shouldBeDefault = existingCount === 0 || Boolean(isDefault);

    const created = await prisma.$transaction(async (tx) => {
      if (shouldBeDefault) {
        await tx.address.updateMany({
          where: { userId: req.user.id },
          data: { isDefault: false },
        });
      }

      return tx.address.create({
        data: {
          userId: req.user.id,
          fullName: String(fullName).trim(),
          phone: String(phone).trim(),
          address: String(address).trim(),
          ward: ward ? String(ward).trim() : null,
          district: district ? String(district).trim() : null,
          city: city ? String(city).trim() : 'Ho Chi Minh City',
          isDefault: shouldBeDefault,
        },
      });
    });

    res.status(201).json(created);
  } catch (error) {
    console.error('Create address error:', error);
    res.status(500).json({ error: 'Failed to create address' });
  }
});

// Update delivery address
router.put('/addresses/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, phone, address, ward, district, city, isDefault } = req.body;

    const existing = await prisma.address.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Address not found' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (isDefault === true) {
        await tx.address.updateMany({
          where: { userId: req.user.id, id: { not: id } },
          data: { isDefault: false },
        });
      }

      return tx.address.update({
        where: { id },
        data: {
          ...(fullName !== undefined && { fullName: String(fullName).trim() }),
          ...(phone !== undefined && { phone: String(phone).trim() }),
          ...(address !== undefined && { address: String(address).trim() }),
          ...(ward !== undefined && { ward: ward ? String(ward).trim() : null }),
          ...(district !== undefined && { district: district ? String(district).trim() : null }),
          ...(city !== undefined && { city: String(city).trim() }),
          ...(isDefault !== undefined && { isDefault: Boolean(isDefault) }),
        },
      });
    });

    res.json(updated);
  } catch (error) {
    console.error('Update address error:', error);
    res.status(500).json({ error: 'Failed to update address' });
  }
});

// Set default delivery address
router.put('/addresses/:id/default', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.address.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Address not found' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.address.updateMany({
        where: { userId: req.user.id },
        data: { isDefault: false },
      });

      return tx.address.update({
        where: { id },
        data: { isDefault: true },
      });
    });

    res.json(updated);
  } catch (error) {
    console.error('Set default address error:', error);
    res.status(500).json({ error: 'Failed to set default address' });
  }
});

// Delete delivery address
router.delete('/addresses/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.address.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Address not found' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.address.delete({ where: { id } });

      if (existing.isDefault) {
        const nextDefault = await tx.address.findFirst({
          where: { userId: req.user.id },
          orderBy: { createdAt: 'desc' },
        });
        if (nextDefault) {
          await tx.address.update({
            where: { id: nextDefault.id },
            data: { isDefault: true },
          });
        }
      }
    });

    res.json({ message: 'Address deleted' });
  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({ error: 'Failed to delete address' });
  }
});

// ====================================================================
// Admin User Management (/api/users)
// ====================================================================

// Get all users (admin)
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, role, status } = req.query;

    const where = {};
    if (search && String(search).trim()) {
      const q = String(search).trim();
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { fullName: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (role && ['CUSTOMER', 'ADMIN'].includes(String(role).toUpperCase())) {
      where.role = String(role).toUpperCase();
    }
    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'banned' || status === 'inactive') {
      where.isActive = false;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          isActive: true,
          loyaltyPoints: true,
          createdAt: true,
          _count: { select: { orders: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.max(1, Math.ceil(total / limitNum)),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get single user (admin)
router.get('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        loyaltyPoints: true,
        createdAt: true,
        addresses: true,
        orders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { orders: true } },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update user (admin)
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, role, isActive, loyaltyPoints } = req.body;

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(fullName !== undefined && String(fullName).trim() && { fullName: String(fullName).trim() }),
        ...(role !== undefined && ['CUSTOMER', 'ADMIN'].includes(role) && { role }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        ...(loyaltyPoints !== undefined &&
          !Number.isNaN(Number(loyaltyPoints)) && {
            loyaltyPoints: Math.max(0, parseInt(loyaltyPoints, 10) || 0),
          }),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        loyaltyPoints: true,
        createdAt: true,
      },
    });

    res.json(user);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Ban user (admin)
router.put('/:id/ban', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
      },
    });

    res.json({ message: 'User banned', ...user, user });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

// Unban user (admin)
router.put('/:id/unban', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.update({
      where: { id },
      data: { isActive: true },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
      },
    });

    res.json({ message: 'User unbanned', ...user, user });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

module.exports = router;
