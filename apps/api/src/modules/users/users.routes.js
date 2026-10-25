const express = require('express');
const router = express.Router();
const prisma = require('../../utils/prisma');
const { authMiddleware, adminOnly } = require('../../middleware/auth');
const { deleteSessionState } = require('../../utils/redis');

const MAX_ADDRESSES_PER_USER = 25;

function hasExcessiveAddressLength({ fullName, phone, address, ward, district, city }) {
  return (
    String(fullName || '').length > 120 ||
    String(phone || '').length > 30 ||
    String(address || '').length > 300 ||
    String(ward || '').length > 120 ||
    String(district || '').length > 120 ||
    String(city || '').length > 120
  );
}

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

    if (hasExcessiveAddressLength({ fullName, phone, address, ward, district, city })) {
      return res.status(400).json({
        error: 'One or more address fields exceed maximum length',
      });
    }

    const existingCount = await prisma.address.count({
      where: { userId: req.user.id },
    });

    if (existingCount >= MAX_ADDRESSES_PER_USER) {
      return res.status(400).json({
        error: `Maximum of ${MAX_ADDRESSES_PER_USER} saved addresses allowed per account`,
      });
    }

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

    if (hasExcessiveAddressLength({ fullName, phone, address, ward, district, city })) {
      return res.status(400).json({
        error: 'One or more address fields exceed maximum length',
      });
    }

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
          addresses: {
            where: { isDefault: true },
            take: 1,
          },
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
    const { fullName, email, role, isActive, loyaltyPoints, phone, address, ward, city } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: { id },
      include: { addresses: true },
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (id === req.user.id) {
      if (isActive === false) {
        return res.status(400).json({ error: 'Cannot deactivate your own admin account' });
      }
      if (role !== undefined && role !== 'ADMIN') {
        return res.status(400).json({ error: 'Cannot demote your own admin account' });
      }
    }

    // Spec II.1: "The system has only one administrator, who is pre-created."
    if (role === 'ADMIN' && existingUser.role !== 'ADMIN') {
      return res.status(400).json({
        error: 'The system has only one pre-created administrator account',
      });
    }

    const updatedFullName =
      fullName !== undefined && String(fullName).trim()
        ? String(fullName).trim().slice(0, 120)
        : existingUser.fullName;

    const cleanEmail =
      email !== undefined && String(email).trim()
        ? String(email).trim().toLowerCase()
        : undefined;

    await prisma.user.update({
      where: { id },
      data: {
        ...(fullName !== undefined &&
          String(fullName).trim() && { fullName: updatedFullName }),
        ...(cleanEmail && { email: cleanEmail }),
        ...(role !== undefined &&
          role === 'CUSTOMER' &&
          id !== req.user.id && { role: 'CUSTOMER' }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        ...(loyaltyPoints !== undefined &&
          Number.isFinite(Number(loyaltyPoints)) && {
            loyaltyPoints: Math.min(100000000, Math.max(0, parseInt(loyaltyPoints, 10) || 0)),
          }),
      },
    });

    const cleanPhone = typeof phone === 'string' ? phone.trim() : undefined;
    const cleanAddress = typeof address === 'string' ? address.trim() : undefined;
    const cleanWard = typeof ward === 'string' && ward.trim() ? ward.trim() : undefined;
    const cleanCity = typeof city === 'string' && city.trim() ? city.trim() : undefined;

    if (cleanPhone !== undefined || cleanAddress !== undefined || cleanWard !== undefined || cleanCity !== undefined) {
      const defaultAddr =
        existingUser.addresses.find((a) => a.isDefault) || existingUser.addresses[0];
      if (defaultAddr) {
        await prisma.address.update({
          where: { id: defaultAddr.id },
          data: {
            fullName: updatedFullName,
            ...(cleanPhone !== undefined && { phone: cleanPhone }),
            ...(cleanAddress !== undefined && cleanAddress && { address: cleanAddress }),
            ...(cleanWard !== undefined && { ward: cleanWard, district: null }),
            ...(cleanCity !== undefined && { city: cleanCity }),
            isDefault: true,
          },
        });
      } else if (cleanPhone || cleanAddress) {
        await prisma.address.create({
          data: {
            userId: id,
            fullName: updatedFullName,
            phone: cleanPhone || '',
            address: cleanAddress || 'Thành phố Hồ Chí Minh',
            ward: cleanWard || null,
            district: null,
            city: cleanCity || 'Thành phố Hồ Chí Minh',
            isDefault: true,
          },
        });
      }
    }

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
      },
    });

    res.json(user);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Email is already in use by another account' });
    }
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

    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot ban your own admin account' });
    }

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

    deleteSessionState(`auth:${id}`).catch(() => {});

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
