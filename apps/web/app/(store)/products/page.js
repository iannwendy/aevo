import { Suspense } from 'react';
import { cookies } from 'next/headers';
import SiteHeader from '../../../components/SiteHeader';
import SiteFooter from '../../../components/SiteFooter';
import CatalogClient from '../../../components/product/CatalogClient';
import {
  LOCALE_COOKIE_NAME,
  normalizeLocale,
  translate,
  localizeCategoryName,
  formatAevoTitle,
} from '../../../lib/i18n/dictionaries';

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

export async function generateMetadata({ searchParams = {} }) {
  const cookieStore = cookies();
  const locale = normalizeLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  const rawCategory = searchParams?.category;
  const category = Array.isArray(rawCategory) ? rawCategory[0] : rawCategory;
  const pageName = category
    ? localizeCategoryName(category, locale)
    : translate(locale, 'pageTitles.shop');
  const title = formatAevoTitle(pageName);
  const description =
    'Explore curated computing essentials, workstations, components, and displays.';
  const canonicalPath = category
    ? `/products?category=${encodeURIComponent(category)}`
    : '/products';
  return {
    title,
    description,
    keywords: [
      'AEVO',
      pageName,
      category || 'hardware',
      'laptops',
      'components',
      'monitors',
      'peripherals',
      'storage',
    ],
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}${canonicalPath}`,
      siteName: 'AEVO',
      locale: locale === 'vi' ? 'vi_VN' : 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

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

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'AEVO Hardware Catalog',
      url: `${SITE_URL}/products`,
      description: 'Explore curated computing essentials, workstations, components, and displays.',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: `${SITE_URL}/`,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Store',
          item: `${SITE_URL}/products`,
        },
      ],
    },
  ];

  return (
    <main className="min-h-screen flex flex-col justify-between">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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
