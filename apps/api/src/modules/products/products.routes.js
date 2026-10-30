const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const prisma = require('../../utils/prisma');
const { authMiddleware, adminOnly } = require('../../middleware/auth');
const { isSafeImageUrl } = require('../../utils/security');
const { publishDomainEvent } = require('../../utils/eventBus');
const { getCacheValue, setCacheValue, invalidateCacheKeys } = require('../../utils/redis');
const {
  searchProductsWithElasticsearch,
  syncSingleProductToElasticsearch,
} = require('../../utils/elasticsearch');
const {
  enrichReviewWithSentiment,
  computeSentimentSummary,
} = require('../../utils/sentiment');

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
  const totalInventory = (p.variants || []).reduce((sum, v) => sum + (v.inventory || 0), 0);
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
    totalInventory,
    isActive: p.isActive,
    isNewArrival: p.isNewArrival,
    isBestSeller: p.isBestSeller,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

async function generateUniqueSlug(name, excludeProductId = null) {
  const base =
    String(name || 'product')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]/g, '') || 'product';

  const existing = await prisma.product.findUnique({ where: { slug: base } });
  if (!existing || existing.id === excludeProductId) {
    return base;
  }
  const suffix = `${Date.now().toString(36).slice(-4)}${crypto.randomInt(0, 100)}`;
  return `${base}-${suffix}`;
}

async function recalculateProductMinPrice(tx, productId) {
  const activeVariants = await tx.productVariant.findMany({
    where: { productId, isActive: true },
    select: { price: true },
  });
  const minPrice = activeVariants.length
    ? Math.min(...activeVariants.map((v) => Number(v.price) || 0))
    : 0;
  await tx.product.update({
    where: { id: productId },
    data: { minPrice },
  });
  return minPrice;
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

    // Optional Elasticsearch path when engine=es or fuzzy=true is requested
    if (req.query.engine === 'es' || req.query.engine === 'elasticsearch' || req.query.fuzzy === 'true') {
      const esRes = await searchProductsWithElasticsearch(req.query);
      return res.json(esRes);
    }

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
        orderBy = [{ name: 'asc' }, { id: 'asc' }];
        break;
      case 'name_desc':
        orderBy = [{ name: 'desc' }, { id: 'desc' }];
        break;
      case 'best-selling':
        orderBy = [{ isBestSeller: 'desc' }, { createdAt: 'desc' }];
        break;
      case 'newest':
      default:
        orderBy = { createdAt: 'desc' };
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(500, parseInt(limit, 10) || 12));
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

// Admin: Get all products (supports active/inactive filter, search, category, pagination)
router.get('/admin/all', authMiddleware, adminOnly, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      brand,
      status = 'active', // 'active' | 'inactive' | 'all'
    } = req.query;

    const andConditions = [];
    if (status === 'active') {
      andConditions.push({ isActive: true });
    } else if (status === 'inactive') {
      andConditions.push({ isActive: false });
    }

    if (category) {
      andConditions.push({
        OR: [
          { categoryId: String(category) },
          { category: { slug: { equals: String(category).toLowerCase(), mode: 'insensitive' } } },
        ],
      });
    }

    if (brand) {
      andConditions.push({
        brand: { equals: String(brand), mode: 'insensitive' },
      });
    }

    if (search && String(search).trim()) {
      const q = String(search).trim();
      andConditions.push({
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { brand: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    const where =
      andConditions.length === 0
        ? {}
        : andConditions.length === 1
        ? andConditions[0]
        : { AND: andConditions };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(500, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
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
    console.error('Admin get products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get available filter metadata (brands, tags, price bounds)
router.get('/filters', async (req, res) => {
  try {
    const cached = await getCacheValue('products:filters');
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    const [brandRows, priceAgg, tags] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true },
        distinct: ['brand'],
        select: { brand: true },
      }),
      prisma.product.aggregate({
        where: { isActive: true },
        _min: { minPrice: true },
        _max: { minPrice: true },
      }),
      prisma.productTag.findMany({
        orderBy: { name: 'asc' },
      }),
    ]);

    const brandMap = new Map();
    for (const p of brandRows) {
      if (p.brand) {
        const key = p.brand.toLowerCase();
        if (!brandMap.has(key)) {
          brandMap.set(key, p.brand);
        }
      }
    }

    const brands = Array.from(brandMap.values()).sort((a, b) => a.localeCompare(b));
    const min = priceAgg._min?.minPrice ?? 0;
    const max = priceAgg._max?.minPrice ?? 0;

    const payload = {
      brands,
      tags,
      priceRange: {
        min,
        max,
      },
    };

    await setCacheValue('products:filters', payload, 30);
    res.setHeader('X-Cache', 'MISS');
    res.json(payload);
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
  const enrichedReviews = (product.reviews || []).map(enrichReviewWithSentiment);
  const stats = computeReviewStats(enrichedReviews);
  const sentimentSummary = computeSentimentSummary(enrichedReviews);
  const lowestVariant = product.variants?.[0] || null;
  const primaryImage = product.images?.find((img) => img.isPrimary) || product.images?.[0] || null;

  return {
    ...product,
    reviews: enrichedReviews,
    price: lowestVariant?.price ?? product.minPrice ?? 0,
    comparePrice: lowestVariant?.comparePrice ?? null,
    image: primaryImage?.url || null,
    tagList: (product.tags || []).map((t) => t.tag || t),
    averageRating: stats.averageRating,
    reviewCount: stats.reviewCount,
    ratingCount: stats.ratingCount,
    ratingDistribution: stats.ratingDistribution,
    sentimentSummary,
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

// ====================================================================
// Admin: Variant & Inventory Management (declared before '/:id')
// ====================================================================

async function updateVariantInventoryOrFields(req, res) {
  try {
    const { id: productIdParam, variantId } = req.params;
    const { name, sku, price, comparePrice, inventory, isActive } = req.body;

    const existing = await prisma.productVariant.findUnique({
      where: { id: variantId },
    });

    if (!existing || (productIdParam && existing.productId !== productIdParam)) {
      return res.status(404).json({ error: 'Product variant not found' });
    }

    if (inventory !== undefined && (!Number.isFinite(Number(inventory)) || Number(inventory) < 0)) {
      return res.status(400).json({ error: 'Inventory must be a non-negative number' });
    }

    if (price !== undefined && (!Number.isFinite(Number(price)) || Number(price) < 0)) {
      return res.status(400).json({ error: 'Variant price must be a non-negative number' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.update({
        where: { id: variantId },
        data: {
          ...(name !== undefined && { name: String(name).trim() }),
          ...(sku !== undefined && { sku: String(sku).trim() }),
          ...(price !== undefined && { price: Number(price) }),
          ...(comparePrice !== undefined && {
            comparePrice: comparePrice !== null && comparePrice !== '' ? Number(comparePrice) : null,
          }),
          ...(inventory !== undefined && { inventory: Math.max(0, parseInt(inventory, 10) || 0) }),
          ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        },
      });

      await recalculateProductMinPrice(tx, existing.productId);
      return variant;
    });

    await invalidateCacheKeys(['categories:all', 'products:filters']);
    res.json(updated);
  } catch (error) {
    console.error('Update variant error:', error);
    res.status(500).json({ error: 'Failed to update variant' });
  }
}

router.put('/variants/:variantId', authMiddleware, adminOnly, updateVariantInventoryOrFields);
router.put('/variants/:variantId/inventory', authMiddleware, adminOnly, updateVariantInventoryOrFields);

router.delete('/variants/:variantId', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { variantId } = req.params;
    const existing = await prisma.productVariant.findUnique({
      where: { id: variantId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Product variant not found' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.update({
        where: { id: variantId },
        data: { isActive: false },
      });
      await recalculateProductMinPrice(tx, existing.productId);
      return variant;
    });

    await invalidateCacheKeys(['categories:all', 'products:filters']);
    res.json({ message: 'Variant removed', isActive: false, ...updated, variant: updated });
  } catch (error) {
    console.error('Delete variant error:', error);
    res.status(500).json({ error: 'Failed to remove variant' });
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
    const {
      name,
      description,
      brand,
      categoryId,
      isNewArrival,
      isBestSeller,
      variants,
      images,
      tags,
    } = req.body;

    if (!name || !description || !brand || !categoryId) {
      return res.status(400).json({ error: 'Name, description, brand and categoryId are required' });
    }

    if (
      String(name).trim().length > 200 ||
      String(brand).trim().length > 120 ||
      String(description).trim().length > 10000
    ) {
      return res.status(400).json({ error: 'Product field exceeds maximum allowed length' });
    }

    if (Array.isArray(variants)) {
      if (variants.length > 50) {
        return res.status(400).json({ error: 'Maximum of 50 variants allowed per product' });
      }
      if (variants.length > 0 && variants.length < 2) {
        return res.status(400).json({ error: 'A product must have at least 2 variants' });
      }
      for (const v of variants) {
        const vp = Number(v?.price);
        if (!Number.isFinite(vp) || vp < 0) {
          return res.status(400).json({ error: 'Variant price must be a non-negative number' });
        }
        if (String(v?.name || '').length > 200 || String(v?.sku || '').length > 100) {
          return res.status(400).json({ error: 'Variant name or SKU exceeds maximum allowed length' });
        }
      }
    }

    if (Array.isArray(images)) {
      if (images.length > 20) {
        return res.status(400).json({ error: 'Maximum of 20 images allowed per product' });
      }
      if (images.length > 0 && images.length < 3) {
        return res.status(400).json({ error: 'A product must have at least 3 illustrative images' });
      }
      for (const img of images) {
        const rawUrl = typeof img === 'string' ? img : img?.url;
        if (!isSafeImageUrl(rawUrl)) {
          return res.status(400).json({ error: 'Invalid or unsafe image URL' });
        }
      }
    }

    const minPrice = variants?.length
      ? Math.min(...variants.map((v) => Number(v.price) || 0))
      : 0;

    const slug = await generateUniqueSlug(name);

    const parsedTags = Array.isArray(tags)
      ? tags.map((t) => String(t?.name || t || '').trim()).filter(Boolean)
      : typeof tags === 'string'
      ? tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name: String(name).trim(),
          slug,
          description: String(description).trim(),
          brand: String(brand).trim(),
          categoryId,
          minPrice,
          isNewArrival: Boolean(isNewArrival),
          isBestSeller: Boolean(isBestSeller),
          variants: variants?.length
            ? {
                create: variants.map((v, idx) => ({
                  name: String(v.name || `Configuration ${idx + 1}`).trim(),
                  sku:
                    v.sku && String(v.sku).trim()
                      ? String(v.sku).trim()
                      : `AEVO-${Date.now().toString(36).toUpperCase()}-${idx + 1}`,
                  price: Number(v.price) || 0,
                  comparePrice:
                    v.comparePrice != null && v.comparePrice !== ''
                      ? Number(v.comparePrice)
                      : null,
                  inventory: Math.max(0, parseInt(v.inventory, 10) || 0),
                })),
              }
            : undefined,
          images: images?.length
            ? {
                create: images.map((img, idx) => ({
                  url: typeof img === 'string' ? img : img.url,
                  isPrimary:
                    typeof img === 'object' && img.isPrimary !== undefined
                      ? Boolean(img.isPrimary)
                      : idx === 0,
                  position:
                    typeof img === 'object' && img.position !== undefined
                      ? Number(img.position)
                      : idx,
                })),
              }
            : undefined,
        },
      });

      if (parsedTags.length > 0) {
        const seenSlugs = new Set();
        for (const tagName of parsedTags) {
          const tagSlug = tagName
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^\w-]/g, '');
          if (!tagSlug || seenSlugs.has(tagSlug)) continue;
          seenSlugs.add(tagSlug);
          const tagRow = await tx.productTag.upsert({
            where: { slug: tagSlug },
            update: {},
            create: { name: tagName.toLowerCase(), slug: tagSlug },
          });
          await tx.productTagOnProduct.create({
            data: { productId: created.id, tagId: tagRow.id },
          });
        }
      }

      return tx.product.findUnique({
        where: { id: created.id },
        include: {
          category: true,
          variants: { where: { isActive: true }, orderBy: { price: 'asc' } },
          images: { orderBy: { position: 'asc' } },
          tags: { include: { tag: true } },
        },
      });
    });

    await invalidateCacheKeys(['categories:all', 'products:filters']);
    syncSingleProductToElasticsearch(product.id).catch(() => {});
    publishDomainEvent('PRODUCT_CREATED', {
      productId: product.id,
      name: product.name,
      slug: product.slug,
    }).catch(() => {});

    res.status(201).json(product);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Admin: Update product (including optional variants & images sync)
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      brand,
      categoryId,
      isNewArrival,
      isBestSeller,
      isActive,
      variants,
      images,
      tags,
    } = req.body;

    const existingProduct = await prisma.product.findUnique({ where: { id } });
    if (!existingProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (
      (name !== undefined && String(name).trim().length > 200) ||
      (brand !== undefined && String(brand).trim().length > 120) ||
      (description !== undefined && String(description).trim().length > 10000)
    ) {
      return res.status(400).json({ error: 'Product field exceeds maximum allowed length' });
    }

    if (Array.isArray(variants)) {
      if (variants.length > 50) {
        return res.status(400).json({ error: 'Maximum of 50 variants allowed per product' });
      }
      if (variants.length > 0 && variants.length < 2) {
        return res.status(400).json({ error: 'A product must have at least 2 variants' });
      }
      for (const v of variants) {
        if (v?.price !== undefined && (!Number.isFinite(Number(v.price)) || Number(v.price) < 0)) {
          return res.status(400).json({ error: 'Variant price must be a non-negative number' });
        }
        if (String(v?.name || '').length > 200 || String(v?.sku || '').length > 100) {
          return res.status(400).json({ error: 'Variant name or SKU exceeds maximum allowed length' });
        }
      }
    }

    if (Array.isArray(images)) {
      if (images.length > 20) {
        return res.status(400).json({ error: 'Maximum of 20 images allowed per product' });
      }
      if (images.length > 0 && images.length < 3) {
        return res.status(400).json({ error: 'A product must have at least 3 illustrative images' });
      }
      for (const img of images) {
        const rawUrl = typeof img === 'string' ? img : img?.url;
        if (!isSafeImageUrl(rawUrl)) {
          return res.status(400).json({ error: 'Invalid or unsafe image URL' });
        }
      }
    }

    const data = {};
    if (name !== undefined) {
      data.name = String(name).trim();
      if (data.name !== existingProduct.name) {
        data.slug = await generateUniqueSlug(data.name, id);
      }
    }
    if (description !== undefined) data.description = String(description).trim();
    if (brand !== undefined) data.brand = String(brand).trim();
    if (categoryId !== undefined) data.categoryId = categoryId;
    if (isNewArrival !== undefined) data.isNewArrival = Boolean(isNewArrival);
    if (isBestSeller !== undefined) data.isBestSeller = Boolean(isBestSeller);
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    const product = await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data,
      });

      // Sync images if provided
      if (Array.isArray(images)) {
        await tx.productImage.deleteMany({ where: { productId: id } });
        if (images.length > 0) {
          await tx.productImage.createMany({
            data: images.map((img, idx) => ({
              productId: id,
              url: typeof img === 'string' ? img : img.url,
              isPrimary:
                typeof img === 'object' && img.isPrimary !== undefined
                  ? Boolean(img.isPrimary)
                  : idx === 0,
              position:
                typeof img === 'object' && img.position !== undefined
                  ? Number(img.position)
                  : idx,
            })),
          });
        }
      }

      // Sync variants if provided
      if (Array.isArray(variants)) {
        const currentVariants = await tx.productVariant.findMany({
          where: { productId: id, isActive: true },
        });
        const ownedVariantIds = new Set(currentVariants.map((cv) => cv.id));
        const incomingIds = new Set(variants.map((v) => v.id).filter(Boolean));

        // Soft-deactivate removed variants
        for (const cv of currentVariants) {
          if (!incomingIds.has(cv.id)) {
            await tx.productVariant.update({
              where: { id: cv.id },
              data: { isActive: false },
            });
          }
        }

        // Update existing (only if owned by this product) or create new variants
        for (let idx = 0; idx < variants.length; idx++) {
          const v = variants[idx];
          if (v.id) {
            if (!ownedVariantIds.has(v.id)) continue;
            await tx.productVariant.update({
              where: { id: v.id },
              data: {
                ...(v.name !== undefined && { name: String(v.name).trim() }),
                ...(v.sku !== undefined && { sku: String(v.sku).trim() }),
                ...(v.price !== undefined && { price: Number(v.price) || 0 }),
                ...(v.comparePrice !== undefined && {
                  comparePrice:
                    v.comparePrice != null && v.comparePrice !== ''
                      ? Number(v.comparePrice)
                      : null,
                }),
                ...(v.inventory !== undefined && {
                  inventory: Math.max(0, parseInt(v.inventory, 10) || 0),
                }),
                isActive: v.isActive !== undefined ? Boolean(v.isActive) : true,
              },
            });
          } else {
            await tx.productVariant.create({
              data: {
                productId: id,
                name: String(v.name || `Configuration ${idx + 1}`).trim(),
                sku:
                  v.sku && String(v.sku).trim()
                    ? String(v.sku).trim()
                    : `AEVO-${Date.now().toString(36).toUpperCase()}-${idx + 1}`,
                price: Number(v.price) || 0,
                comparePrice:
                  v.comparePrice != null && v.comparePrice !== ''
                    ? Number(v.comparePrice)
                    : null,
                inventory: Math.max(0, parseInt(v.inventory, 10) || 0),
                isActive: true,
              },
            });
          }
        }

        await recalculateProductMinPrice(tx, id);
      }

      if (tags !== undefined) {
        const parsedTags = Array.isArray(tags)
          ? tags.map((t) => String(t?.name || t || '').trim()).filter(Boolean)
          : typeof tags === 'string'
          ? tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : [];
        await tx.productTagOnProduct.deleteMany({ where: { productId: id } });
        const seenSlugs = new Set();
        for (const tagName of parsedTags) {
          const tagSlug = tagName
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^\w-]/g, '');
          if (!tagSlug || seenSlugs.has(tagSlug)) continue;
          seenSlugs.add(tagSlug);
          const tagRow = await tx.productTag.upsert({
            where: { slug: tagSlug },
            update: {},
            create: { name: tagName.toLowerCase(), slug: tagSlug },
          });
          await tx.productTagOnProduct.create({
            data: { productId: id, tagId: tagRow.id },
          });
        }
      }

      return tx.product.findUnique({
        where: { id },
        include: {
          category: true,
          variants: { where: { isActive: true }, orderBy: { price: 'asc' } },
          images: { orderBy: { position: 'asc' } },
          tags: { include: { tag: true } },
        },
      });
    });

    await invalidateCacheKeys(['categories:all', 'products:filters']);
    syncSingleProductToElasticsearch(product.id).catch(() => {});
    publishDomainEvent('PRODUCT_UPDATED', {
      productId: product.id,
      name: product.name,
      slug: product.slug,
    }).catch(() => {});

    res.json(product);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Admin: Add a variant to a product
router.post('/:id/variants', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, sku, price, comparePrice, inventory = 0 } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Variant name and price are required' });
    }

    if (!Number.isFinite(Number(price)) || Number(price) < 0) {
      return res.status(400).json({ error: 'Variant price must be a non-negative number' });
    }

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const created = await prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.create({
        data: {
          productId: id,
          name: String(name).trim(),
          sku:
            sku && String(sku).trim()
              ? String(sku).trim()
              : `AEVO-${Date.now().toString(36).toUpperCase()}`,
          price: Number(price) || 0,
          comparePrice:
            comparePrice != null && comparePrice !== '' ? Number(comparePrice) : null,
          inventory: Math.max(0, parseInt(inventory, 10) || 0),
          isActive: true,
        },
      });

      await recalculateProductMinPrice(tx, id);
      return variant;
    });

    await invalidateCacheKeys(['categories:all', 'products:filters']);
    res.status(201).json(created);
  } catch (error) {
    console.error('Add variant error:', error);
    res.status(500).json({ error: 'Failed to add variant' });
  }
});

// Admin: Update a variant on a product
router.put('/:id/variants/:variantId', authMiddleware, adminOnly, updateVariantInventoryOrFields);
router.put('/:id/variants/:variantId/inventory', authMiddleware, adminOnly, updateVariantInventoryOrFields);

// Admin: Remove a variant from a product
router.delete('/:id/variants/:variantId', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id, variantId } = req.params;
    const existing = await prisma.productVariant.findFirst({
      where: { id: variantId, productId: id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Product variant not found' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.update({
        where: { id: variantId },
        data: { isActive: false },
      });
      await recalculateProductMinPrice(tx, id);
      return variant;
    });

    await invalidateCacheKeys(['categories:all', 'products:filters']);
    res.json({ message: 'Variant removed', isActive: false, ...updated, variant: updated });
  } catch (error) {
    console.error('Delete product variant error:', error);
    res.status(500).json({ error: 'Failed to remove variant' });
  }
});

// Admin: Delete product (soft delete -> isActive = false)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    const updated = await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    await invalidateCacheKeys(['categories:all', 'products:filters']);
    syncSingleProductToElasticsearch(updated.id).catch(() => {});
    publishDomainEvent('PRODUCT_DELETED', {
      productId: updated.id,
    }).catch(() => {});

    res.json({
      message: 'Product deleted',
      id: updated.id,
      isActive: updated.isActive,
      product: updated,
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

module.exports = router;
