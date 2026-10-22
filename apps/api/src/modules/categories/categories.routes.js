const express = require('express');
const router = express.Router();
const prisma = require('../../utils/prisma');
const { authMiddleware, adminOnly } = require('../../middleware/auth');
const { isSafeImageUrl } = require('../../utils/security');

// Get all active categories
router.get('/', async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { products: { where: { isActive: true } } },
        },
      },
    });

    res.json(
      categories.map((c) => ({
        ...c,
        productCount: c._count?.products ?? 0,
      }))
    );
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get single category (by ID or slug) with products
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const category = await prisma.category.findFirst({
      where: {
        isActive: true,
        OR: [{ id }, { slug: id.toLowerCase() }],
      },
      include: {
        products: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          include: {
            category: true,
            variants: {
              where: { isActive: true },
              orderBy: { price: 'asc' },
            },
            images: {
              orderBy: { position: 'asc' },
            },
          },
        },
      },
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({
      ...category,
      products: category.products.map((p) => {
        const primary = p.images?.find((img) => img.isPrimary) || p.images?.[0] || null;
        const lowest = p.variants?.[0] || null;
        return {
          ...p,
          category: category.name,
          categorySlug: category.slug,
          price: lowest?.price ?? p.minPrice ?? 0,
          comparePrice: lowest?.comparePrice ?? null,
          image: primary?.url || null,
        };
      }),
    });
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
});

// Admin: Create category
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, description, image } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    if (image && !isSafeImageUrl(image)) {
      return res.status(400).json({ error: 'Invalid or unsafe image URL' });
    }

    const cleanName = String(name).trim();
    const slug = cleanName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]/g, '');

    const category = await prisma.category.create({
      data: {
        name: cleanName,
        slug,
        description: description || null,
        image: image || null,
      },
    });

    res.status(201).json(category);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Category already exists' });
    }
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// Admin: Update category
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, image, isActive } = req.body;

    const data = {};
    if (name !== undefined) {
      const cleanName = String(name).trim();
      if (!cleanName) {
        return res.status(400).json({ error: 'Category name cannot be empty' });
      }
      data.name = cleanName;
      data.slug = cleanName
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]/g, '');
    }
    if (description !== undefined) data.description = description;
    if (image !== undefined) {
      if (image && !isSafeImageUrl(image)) {
        return res.status(400).json({ error: 'Invalid or unsafe image URL' });
      }
      data.image = image;
    }
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    const category = await prisma.category.update({
      where: { id },
      data,
    });

    res.json(category);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// Admin: Delete category (soft delete)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.category.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({ message: 'Category deleted' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

module.exports = router;
