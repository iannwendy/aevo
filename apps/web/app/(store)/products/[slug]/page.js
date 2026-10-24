import { cache } from 'react';
import { cookies } from 'next/headers';
import SiteHeader from '../../../../components/SiteHeader';
import SiteFooter from '../../../../components/SiteFooter';
import ProductDetailClient from '../../../../components/product/ProductDetailClient';
import {
  LOCALE_COOKIE_NAME,
  normalizeLocale,
  translate,
  formatAevoTitle,
} from '../../../../lib/i18n/dictionaries';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || process.env.CLIENT_URL || 'http://localhost:3000';
const API_URL =
  process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const fetchProductBySlugSafe = cache(async (slug) => {
  try {
    const res = await fetch(`${API_URL}/api/products/slug/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    });
    if (res.status === 404) return { product: null, notFound: true };
    if (!res.ok) return { product: null, notFound: false };
    return { product: await res.json(), notFound: false };
  } catch {
    return { product: null, notFound: false };
  }
});

function extractProductTagNames(product) {
  const rawTags = product?.tagList || product?.tags || [];
  return rawTags
    .map((t) => {
      if (typeof t === 'string') return t;
      if (t?.tag?.name) return t.tag.name;
      if (t?.name) return t.name;
      return '';
    })
    .filter(Boolean);
}

export async function generateMetadata({ params }) {
  const cookieStore = cookies();
  const locale = normalizeLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  const slug = params?.slug;
  const { product, notFound } = slug
    ? await fetchProductBySlugSafe(slug)
    : { product: null, notFound: false };
  if (!product) {
    return {
      title: formatAevoTitle(
        translate(locale, notFound ? 'pageTitles.productNotFound' : 'pageTitles.productDetails')
      ),
      robots: {
        index: false,
        follow: false,
      },
    };
  }
  const title = formatAevoTitle(product.name);
  const description = product.description?.split('\n')?.[0] || 'Built for your workflow.';
  const tagNames = extractProductTagNames(product);
  const categoryName =
    typeof product.category === 'string' ? product.category : product.category?.name || '';
  const keywords = [
    product.name,
    product.brand,
    categoryName,
    ...tagNames,
    'AEVO',
  ].filter(Boolean);
  const images = (product.images || [])
    .map((img) => (typeof img === 'string' ? img : img?.url))
    .filter(Boolean)
    .map((url) => ({ url, alt: product.name }));

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: `/products/${product.slug}`,
    },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/products/${product.slug}`,
      siteName: 'AEVO',
      locale: locale === 'vi' ? 'vi_VN' : 'en_US',
      type: 'website',
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: images.map((i) => i.url),
    },
  };
}

export default async function ProductDetailPage({ params }) {
  const slug = params?.slug;
  const { product: initialProduct, notFound } = slug
    ? await fetchProductBySlugSafe(slug)
    : { product: null, notFound: false };

  let jsonLd = null;
  if (initialProduct) {
    const activeVariants = (initialProduct.variants || []).filter((v) => v.isActive !== false);
    const prices = activeVariants.map((v) => Number(v.price) || 0).filter((p) => p > 0);
    const lowPrice = prices.length ? Math.min(...prices) : initialProduct.minPrice || initialProduct.price || 0;
    const highPrice = prices.length ? Math.max(...prices) : lowPrice;
    const totalStock = activeVariants.reduce((sum, v) => sum + (Number(v.inventory) || 0), 0);
    const categoryName =
      typeof initialProduct.category === 'string'
        ? initialProduct.category
        : initialProduct.category?.name || 'Hardware';
    const categorySlug =
      typeof initialProduct.category === 'object' && initialProduct.category?.slug
        ? initialProduct.category.slug
        : 'laptops';
    const tagNames = extractProductTagNames(initialProduct);

    const productSchema = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: initialProduct.name,
      description: initialProduct.description,
      sku: activeVariants[0]?.sku || initialProduct.slug,
      image: (initialProduct.images || [])
        .map((img) => (typeof img === 'string' ? img : img?.url))
        .filter(Boolean),
      brand: {
        '@type': 'Brand',
        name: initialProduct.brand || 'AEVO',
      },
      category: categoryName,
      keywords: tagNames.join(', '),
      offers: {
        '@type': activeVariants.length > 1 ? 'AggregateOffer' : 'Offer',
        url: `${SITE_URL}/products/${initialProduct.slug}`,
        priceCurrency: 'VND',
        price: lowPrice,
        lowPrice,
        highPrice,
        offerCount: Math.max(1, activeVariants.length),
        availability:
          totalStock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      },
      ...(Number(initialProduct.reviewCount) > 0 && Number(initialProduct.averageRating) > 0
        ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: initialProduct.averageRating,
              reviewCount: initialProduct.reviewCount,
              bestRating: 5,
              worstRating: 1,
            },
          }
        : {}),
    };

    const breadcrumbSchema = {
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
        {
          '@type': 'ListItem',
          position: 3,
          name: categoryName,
          item: `${SITE_URL}/products?category=${encodeURIComponent(categorySlug)}`,
        },
        {
          '@type': 'ListItem',
          position: 4,
          name: initialProduct.name,
          item: `${SITE_URL}/products/${initialProduct.slug}`,
        },
      ],
    };

    jsonLd = [productSchema, breadcrumbSchema];
  }

  return (
    <main className="min-h-screen flex flex-col justify-between">
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <SiteHeader />
      <ProductDetailClient
        slug={slug}
        initialProduct={initialProduct}
        initialNotFound={notFound}
      />
      <SiteFooter />
    </main>
  );
}
