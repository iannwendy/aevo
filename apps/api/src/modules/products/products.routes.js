const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authMiddleware, optionalAuth, adminOnly } = require('../../middleware/auth');

const prisma = new PrismaClient();

// Get all products with filtering, sorting, pagination
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      category,
      brand,
      minPrice,
      maxPrice,
      sort = 'newest',
      search,
    } = req.query;

    const where = { isActive: true };

    // Category filter
    if (category) {
      where.category = { slug: category };
    }

    // Brand filter
    if (brand) {
      const brands = brand.split(',');
      where.brand = { in: brands };
    }

    // Price filter
    if (minPrice || maxPrice) {
      where.variants = {
        some: {
          price: {
            ...(minPrice && { gte: parseFloat(minPrice) }),
            ...(maxPrice && { lte: parseFloat(maxPrice) }),
          },
        },
      };
    }

    // Search
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Sorting
    let orderBy = {};
    switch (sort) {
      case 'price_asc':
        orderBy = { variants: { _min: { price: 'asc' } } };
        break;
      case 'price_desc':
        orderBy = { variants: { _min: { price: 'desc' } } };
        break;
      case 'name_asc':
        orderBy = { name: 'asc' };
        break;
      case 'name_desc':
        orderBy = { name: 'desc' };
        break;
      case 'best-selling':
        orderBy = { isBestSeller: 'desc' };
        break;
      case 'newest':
      default:
        orderBy = { createdAt: 'desc' };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: parseInt(limit),
        include: {
          category: true,
          variants: {
            where: { isActive: true },
            orderBy: { price: 'asc' },
          },
          images: {
            where: { isPrimary: true },
            take: 1,
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        brand: p.brand,
        category: p.category?.name,
        price: p.variants[0]?.price || 0,
        comparePrice: p.variants[0]?.comparePrice,
        image: p.images[0]?.url,
        isNewArrival: p.isNewArrival,
        isBestSeller: p.isBestSeller,
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get single product by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        variants: {
          where: { isActive: true },
          orderBy: { price: 'asc' },
        },
        images: {
          orderBy: { position: 'asc' },
        },
        reviews: {
          include: { user: { select: { fullName: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Calculate average rating
    const ratings = product.reviews.filter((r) => r.rating);
    const avgRating = ratings.length
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
      : 0;

    res.json({
      ...product,
      averageRating: avgRating,
      reviewCount: ratings.length,
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Get product by slug
router.get('/slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        category: true,
        variants: {
          where: { isActive: true },
          orderBy: { price: 'asc' },
        },
        images: {
          orderBy: { position: 'asc' },
        },
        reviews: {
          include: { user: { select: { fullName: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const ratings = product.reviews.filter((r) => r.rating);
    const avgRating = ratings.length
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
      : 0;

    res.json({
      ...product,
      averageRating: avgRating,
      reviewCount: ratings.length,
    });
  } catch (error) {
    console.error('Get product by slug error:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Get new arrivals
router.get('/new-arrivals', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true, isNewArrival: true },
      take: 8,
      include: {
        category: true,
        variants: {
          where: { isActive: true },
          orderBy: { price: 'asc' },
        },
        images: {
          where: { isPrimary: true },
          take: 1,
        },
      },
    });

    res.json(
      products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        brand: p.brand,
        category: p.category?.name,
        price: p.variants[0]?.price || 0,
        comparePrice: p.variants[0]?.comparePrice,
        image: p.images[0]?.url,
      }))
    );
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch new arrivals' });
  }
});

// Get best sellers
router.get('/best-sellers', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true, isBestSeller: true },
      take: 8,
      include: {
        category: true,
        variants: {
          where: { isActive: true },
          orderBy: { price: 'asc' },
        },
        images: {
          where: { isPrimary: true },
          take: 1,
        },
      },
    });

    res.json(
      products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        brand: p.brand,
        category: p.category?.name,
        price: p.variants[0]?.price || 0,
        comparePrice: p.variants[0]?.comparePrice,
        image: p.images[0]?.url,
      }))
    );
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch best sellers' });
  }
});

// Admin: Create product
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, description, brand, categoryId, isNewArrival, isBestSeller, variants, images } = req.body;

    const product = await prisma.product.create({
      data: {
        name,
        slug: name.toLowerCase().replace(/\s+/g, '-').replace(/[^w-]/g, ''),
        description,
        brand,
        categoryId,
        isNewArrival: isNewArrival || false,
        isBestSeller: isBestSeller || false,
        variants: variants?.length ? {
          create: variants.map((v) => ({
            name: v.name,
            sku: v.sku,
            price: v.price,
            comparePrice: v.comparePrice,
            inventory: v.inventory || 0,
          })),
        } : undefined,
        images: images?.length ? {
          create: images.map((img, idx) => ({
            url: img.url,
            isPrimary: idx === 0,
            position: idx,
          })),
        } : undefined,
      },
      include: {
        variants: true,
        images: true,
      },
    });

    res.status(201).json(product);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Admin: Update product
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, brand, categoryId, isNewArrival, isBestSeller } = req.body;

    const product = await prisma.product.update({
      where: { id },
      data: {
        name,
        slug: name.toLowerCase().replace(/\s+/g, '-').replace(/[^w-]/g, ''),
        description,
        brand,
        categoryId,
        isNewArrival,
        isBestSeller,
      },
    });

    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Admin: Delete product
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({ message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

module.exports = router;
