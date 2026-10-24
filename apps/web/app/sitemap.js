export const dynamic = 'force-dynamic';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || process.env.CLIENT_URL || 'http://localhost:3000';
const API_URL =
  process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function fetchJsonSafe(path) {
  try {
    const res = await fetch(`${API_URL}${path}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function sitemap() {
  const now = new Date();
  const entries = [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/products`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
  ];

  const [categoriesData, productsData] = await Promise.all([
    fetchJsonSafe('/api/categories'),
    fetchJsonSafe('/api/products?limit=500'),
  ]);

  const categories = Array.isArray(categoriesData) ? categoriesData : [];
  for (const cat of categories) {
    if (cat?.slug) {
      entries.push({
        url: `${SITE_URL}/products?category=${encodeURIComponent(cat.slug)}`,
        lastModified: cat.updatedAt ? new Date(cat.updatedAt) : now,
        changeFrequency: 'daily',
        priority: 0.8,
      });
    }
  }

  const products = Array.isArray(productsData?.products) ? productsData.products : [];
  for (const product of products) {
    if (product?.slug) {
      entries.push({
        url: `${SITE_URL}/products/${encodeURIComponent(product.slug)}`,
        lastModified: product.updatedAt ? new Date(product.updatedAt) : now,
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }
  }

  return entries;
}
