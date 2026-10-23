import { Suspense } from 'react';
import SiteHeader from '../../../components/SiteHeader';
import SiteFooter from '../../../components/SiteFooter';
import CatalogClient from '../../../components/product/CatalogClient';

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

export const metadata = {
  title: 'AEVO',
  description: 'Explore curated computing essentials, workstations, components, and displays.',
};

export default async function ProductsCatalogPage({ searchParams = {} }) {
  const qs = new URLSearchParams();
  for (const [key, val] of Object.entries(searchParams || {})) {
    if (val !== undefined && val !== null && val !== '') {
      qs.set(key, Array.isArray(val) ? val.join(',') : String(val));
    }
  }
  if (!qs.has('limit')) {
    qs.set('limit', '12');
  }

  const [productsData, categoriesData, filterMetaData] = await Promise.all([
    fetchJsonSafe(`/api/products?${qs.toString()}`),
    fetchJsonSafe('/api/categories'),
    fetchJsonSafe('/api/products/filters'),
  ]);

  const initialData = {
    products: productsData?.products || [],
    pagination: productsData?.pagination || {
      page: Number(searchParams?.page) || 1,
      limit: 12,
      total: productsData?.products?.length || 0,
      totalPages: 1,
    },
    categories: Array.isArray(categoriesData) ? categoriesData : [],
    filterMeta: filterMetaData || null,
  };

  return (
    <main className="min-h-screen flex flex-col justify-between">
      <SiteHeader />
      <Suspense
        fallback={
          <div className="pt-[72px] container-main py-16">
            <div className="h-96 rounded-2xl bg-surface border border-border animate-pulse" />
          </div>
        }
      >
        <CatalogClient initialData={initialData} initialQuery={searchParams} />
      </Suspense>
      <SiteFooter />
    </main>
  );
}
