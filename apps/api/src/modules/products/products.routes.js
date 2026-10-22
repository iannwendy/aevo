const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authMiddleware, adminOnly } = require('../../middleware/auth');

const prisma = new PrismaClient();

function computeReviewStats(reviews = []) {
  const ratings = reviews.filter((r) => typeof r.rating === 'number' && r.rating >= 1 && r.rating <= 5);
  const avg = ratings.length
    ? Number((ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1))
    : 0;
  const ratingDistribution = {
    5: ratings.filter((r) => r.rating === 5).length,
    4: ratings.filter((r) => r.rating === 4).length,
    3: ratings.filter((r) => r.rating === 3).length,
    2: ratings.filter((r) => r.rating === 2).length,
    1: ratings.filter((r) => r.rating === 1).length,
  };
  return {
    averageRating: avg,
    reviewCount: reviews.length,
    ratingCount: ratings.length,
    ratingDistribution,
  };
}

function formatProductListItem(p) {
  const stats = computeReviewStats(p.reviews || []);
  const primaryImage = p.images?.find((img) => img.isPrimary) || p.images?.[0] || null;
  const lowestVariant = p.variants?.[0] || null;
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    brand: p.brand,
    description: p.description,
    categoryId: p.categoryId,
    category: p.category?.name || null,
    categorySlug: p.category?.slug || null,
    categoryObj: p.category || null,
    price: lowestVariant?.price ?? p.minPrice ?? 0,
    comparePrice: lowestVariant?.comparePrice ?? null,
    minPrice: p.minPrice ?? lowestVariant?.price ?? 0,
    image: primaryImage?.url || null,
    images: p.images || [],
    variants: p.variants || [],
    tags: (p.tags || []).map((t) => t.tag || t),
    averageRating: stats.averageRating,
    reviewCount: stats.reviewCount,
    ratingCount: stats.ratingCount,
    inStock: (p.variants || []).some((v) => v.inventory > 0),
    isNewArrival: p.isNewArrival,
    isBestSeller: p.isBestSeller,
    createdAt: p.createdAt,
  };
}

async function listProductsHandler(req, res) {
  try {
    const {
      page = 1,
      limit = 12,
      category,
      brand,
      minPrice,
      maxPrice,
      tag,
      minRating,
      inStock,
      isNewArrival,
      isBestSeller,
      sort = 'newest',
      search,
      q,
    } = req.query;

    const searchQuery = (search ?? q ?? '').toString().trim();
    const andConditions = [{ isActive: true }];

    // Category filter (supports slug or comma-separated slugs)
    if (category) {
      const catSlugs = String(category)
        .split(',')
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean);
      if (catSlugs.length === 1) {
        andConditions.push({
          OR: [
            { category: { slug: { equals: catSlugs[0], mode: 'insensitive' } } },
            { categoryId: catSlugs[0] },
          ],
        });
      } else if (catSlugs.length > 1) {
        andConditions.push({
          category: { slug: { in: catSlugs } },
        });
      }
    }

    // Brand filter (multi-select, case-insensitive)
    if (brand) {
      const brands = String(brand)
        .split(',')
        .map((b) => b.trim())
        .filter(Boolean);
      if (brands.length > 0) {
        andConditions.push({
          OR: brands.map((b) => ({ brand: { equals: b, mode: 'insensitive' } })),
        });
      }
    }

    // Price filter (minPrice / maxPrice)
    const parsedMinPrice = minPrice !== undefined && minPrice !== '' ? Number(minPrice) : null;
    const parsedMaxPrice = maxPrice !== undefined && maxPrice !== '' ? Number(maxPrice) : null;
    if (
      (parsedMinPrice !== null && !Number.isNaN(parsedMinPrice)) ||
      (parsedMaxPrice !== null && !Number.isNaN(parsedMaxPrice))
    ) {
      const priceFilter = {};
      if (parsedMinPrice !== null && !Number.isNaN(parsedMinPrice)) {
        priceFilter.gte = parsedMinPrice;
      }
      if (parsedMaxPrice !== null && !Number.isNaN(parsedMaxPrice)) {
        priceFilter.lte = parsedMaxPrice;
      }
      andConditions.push({ minPrice: priceFilter });
    }

    // Tag filter (3rd+ filter criterion)
    if (tag) {
      const tagSlugs = String(tag)
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      if (tagSlugs.length > 0) {
        andConditions.push({
          tags: {
            some: {
              tag: { slug: { in: tagSlugs } },
            },
          },
        });
      }
    }

    // Stock availability filter
    if (inStock === 'true' || inStock === '1') {
      andConditions.push({
        variants: {
          some: { isActive: true, inventory: { gt: 0 } },
        },
      });
    }

    // New arrival / Best seller flags
    if (isNewArrival === 'true' || isNewArrival === '1') {
      andConditions.push({ isNewArrival: true });
    }
    if (isBestSeller === 'true' || isBestSeller === '1') {
      andConditions.push({ isBestSeller: true });
    }

    // Keyword search across name, description, brand
    if (searchQuery) {
      andConditions.push({
        OR: [
          { name: { contains: searchQuery, mode: 'insensitive' } },
          { description: { contains: searchQuery, mode: 'insensitive' } },
          { brand: { contains: searchQuery, mode: 'insensitive' } },
        ],
      });
    }

    const where = andConditions.length === 1 ? andConditions[0] : { AND: andConditions };

    // Sorting
    let orderBy;
    switch (sort) {
      case 'price_asc':
        orderBy = [{ minPrice: 'asc' }, { name: 'asc' }];
        break;
      case 'price_desc':
        orderBy = [{ minPrice: 'desc' }, { name: 'asc' }];
        break;
      case 'name_asc':
        orderBy = { name: 'asc' };
        break;
      case 'name_desc':
        orderBy = { name: 'desc' };
        break;
      case 'best-selling':
        orderBy = [{ isBestSeller: 'desc' }, { createdAt: 'desc' }];
        break;
      case 'newest':
      default:
        orderBy = { createdAt: 'desc' };
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 12));
    const parsedMinRating = minRating !== undefined && minRating !== '' ? Number(minRating) : null;

    const include = {
      category: true,
      variants: {
        where: { isActive: true },
        orderBy: { price: 'asc' },
      },
      images: {
        orderBy: { position: 'asc' },
      },
      tags: {
        include: { tag: true },
      },
      reviews: {
        select: { rating: true },
      },
    };

    // When minRating filter is active, filter by computed rating before paginating
    if (parsedMinRating !== null && !Number.isNaN(parsedMinRating) && parsedMinRating > 0) {
      const allMatches = await prisma.product.findMany({
        where,
        orderBy,
        include,
      });
      const formattedAll = allMatches
        .map(formatProductListItem)
        .filter((item) => item.averageRating >= parsedMinRating);
      const total = formattedAll.length;
      const skip = (pageNum - 1) * limitNum;
      const paged = formattedAll.slice(skip, skip + limitNum);

      return res.json({
        products: paged,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.max(1, Math.ceil(total / limitNum)),
        },
      });
    }

    const skip = (pageNum - 1) * limitNum;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limitNum,
        include,
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      products: products.map(formatProductListItem),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.max(1, Math.ceil(total / limitNum)),
      },
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
}

// Get all products with filtering, sorting, pagination
router.get('/', listProductsHandler);

// Search products endpoint (alias for GET /products?search=...)
router.get('/search', listProductsHandler);

// Get available filter metadata (brands, tags, price bounds)
router.get('/filters', async (req, res) => {
  try {
    const [products, tags] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true },
        select: { brand: true, minPrice: true },
      }),
      prisma.productTag.findMany({
        orderBy: { name: 'asc' },
      }),
    ]);

    const brandMap = new Map();
    let min = Infinity;
    let max = 0;

    for (const p of products) {
      if (p.brand) {
        const key = p.brand.toLowerCase();
        if (!brandMap.has(key)) {
          brandMap.set(key, p.brand);
        }
      }
      if (typeof p.minPrice === 'number') {
        if (p.minPrice < min) min = p.minPrice;
        if (p.minPrice > max) max = p.minPrice;
      }
    }

    const brands = Array.from(brandMap.values()).sort((a, b) => a.localeCompare(b));

    res.json({
      brands,
      tags,
      priceRange: {
        min: min === Infinity ? 0 : min,
        max,
      },
    });
  } catch (error) {
    console.error('Get product filters error:', error);
    res.status(500).json({ error: 'Failed to fetch product filters' });
  }
});

// Get new arrivals
router.get('/new-arrivals', async (req, res) => {
  try {
    const take = Math.max(1, Math.min(50, parseInt(req.query.limit, 10) || 8));
    const products = await prisma.product.findMany({
      where: { isActive: true, isNewArrival: true },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        category: true,
        variants: {
          where: { isActive: true },
          orderBy: { price: 'asc' },
        },
        images: {
          orderBy: { position: 'asc' },
        },
        tags: {
          include: { tag: true },
        },
        reviews: {
          select: { rating: true },
        },
      },
    });

    res.json(products.map(formatProductListItem));
  } catch (error) {
    console.error('Get new arrivals error:', error);
    res.status(500).json({ error: 'Failed to fetch new arrivals' });
  }
});

// Get best sellers
router.get('/best-sellers', async (req, res) => {
  try {
    const take = Math.max(1, Math.min(50, parseInt(req.query.limit, 10) || 8));
    const products = await prisma.product.findMany({
      where: { isActive: true, isBestSeller: true },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        category: true,
        variants: {
          where: { isActive: true },
          orderBy: { price: 'asc' },
        },
        images: {
          orderBy: { position: 'asc' },
        },
        tags: {
          include: { tag: true },
        },
        reviews: {
          select: { rating: true },
        },
      },
    });

    res.json(products.map(formatProductListItem));
  } catch (error) {
    console.error('Get best sellers error:', error);
    res.status(500).json({ error: 'Failed to fetch best sellers' });
  }
});

function formatProductDetail(product) {
  const stats = computeReviewStats(product.reviews || []);
  const lowestVariant = product.variants?.[0] || null;
  const primaryImage = product.images?.find((img) => img.isPrimary) || product.images?.[0] || null;

  return {
    ...product,
    price: lowestVariant?.price ?? product.minPrice ?? 0,
    comparePrice: lowestVariant?.comparePrice ?? null,
    image: primaryImage?.url || null,
    tagList: (product.tags || []).map((t) => t.tag || t),
    averageRating: stats.averageRating,
    reviewCount: stats.reviewCount,
    ratingCount: stats.ratingCount,
    ratingDistribution: stats.ratingDistribution,
  };
}

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
        tags: {
          include: { tag: true },
        },
        reviews: {
          include: { user: { select: { id: true, fullName: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!product || !product.isActive) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(formatProductDetail(product));
  } catch (error) {
    console.error('Get product by slug error:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
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
        tags: {
          include: { tag: true },
        },
        reviews: {
          include: { user: { select: { id: true, fullName: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!product || !product.isActive) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(formatProductDetail(product));
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Admin: Create product
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, description, brand, categoryId, isNewArrival, isBestSeller, variants, images } = req.body;

    if (!name || !description || !brand || !categoryId) {
      return res.status(400).json({ error: 'Name, description, brand and categoryId are required' });
    }

    const minPrice = variants?.length
      ? Math.min(...variants.map((v) => Number(v.price) || 0))
      : 0;

    const slugBase = name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]/g, '');

    const product = await prisma.product.create({
      data: {
        name,
        slug: slugBase,
        description,
        brand,
        categoryId,
        minPrice,
        isNewArrival: Boolean(isNewArrival),
        isBestSeller: Boolean(isBestSeller),
        variants: variants?.length
          ? {
              create: variants.map((v) => ({
                name: v.name,
                sku: v.sku,
                price: Number(v.price),
                comparePrice: v.comparePrice != null ? Number(v.comparePrice) : null,
                inventory: Number(v.inventory) || 0,
              })),
            }
          : undefined,
        images: images?.length
          ? {
              create: images.map((img, idx) => ({
                url: typeof img === 'string' ? img : img.url,
                isPrimary: idx === 0,
                position: idx,
              })),
            }
          : undefined,
      },
      include: {
        category: true,
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

    const data = {};
    if (name !== undefined) {
      data.name = name;
      data.slug = name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]/g, '');
    }
    if (description !== undefined) data.description = description;
    if (brand !== undefined) data.brand = brand;
    if (categoryId !== undefined) data.categoryId = categoryId;
    if (isNewArrival !== undefined) data.isNewArrival = Boolean(isNewArrival);
    if (isBestSeller !== undefined) data.isBestSeller = Boolean(isBestSeller);

    const product = await prisma.product.update({
      where: { id },
      data,
      include: {
        category: true,
        variants: { where: { isActive: true }, orderBy: { price: 'asc' } },
        images: { orderBy: { position: 'asc' } },
      },
    });

    res.json(product);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Admin: Delete product (soft delete)
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
