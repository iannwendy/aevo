import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import HomeClient from '../components/home/HomeClient';

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

export default async function HomePage() {
  const [newArrivals, bestSellers, categories, laptops, components, monitors] =
    await Promise.all([
      fetchJsonSafe('/api/products/new-arrivals?limit=24'),
      fetchJsonSafe('/api/products/best-sellers?limit=24'),
      fetchJsonSafe('/api/categories'),
      fetchJsonSafe('/api/products?category=laptops&page=1&limit=4'),
      fetchJsonSafe('/api/products?category=components&page=1&limit=4'),
      fetchJsonSafe('/api/products?category=monitors&page=1&limit=4'),
    ]);

  const initialData = {
    newArrivals: Array.isArray(newArrivals) ? newArrivals : [],
    bestSellers: Array.isArray(bestSellers) ? bestSellers : [],
    categories: Array.isArray(categories) ? categories : [],
    categoryProducts: {
      laptops: laptops || { products: [], pagination: { page: 1, limit: 4, total: 0, totalPages: 1 } },
      components: components || { products: [], pagination: { page: 1, limit: 4, total: 0, totalPages: 1 } },
      monitors: monitors || { products: [], pagination: { page: 1, limit: 4, total: 0, totalPages: 1 } },
    },
  };

  return (
    <main className="min-h-screen">
      <SiteHeader />
      <HomeClient initialData={initialData} />
      <SiteFooter />
    </main>
  );
}
