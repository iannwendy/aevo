import SiteHeader from '../../../../components/SiteHeader';
import SiteFooter from '../../../../components/SiteFooter';
import ProductDetailClient from '../../../../components/product/ProductDetailClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function fetchProductBySlugSafe(slug) {
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
}

export async function generateMetadata({ params }) {
  const slug = params?.slug;
  const { product } = slug ? await fetchProductBySlugSafe(slug) : { product: null };
  if (!product) {
    return {
      title: 'Product Details — AEVO Store',
    };
  }
  return {
    title: `${product.name} — AEVO Store`,
    description: product.description?.split('\n')?.[0] || 'Built for your workflow.',
  };
}

export default async function ProductDetailPage({ params }) {
  const slug = params?.slug;
  const { product: initialProduct, notFound } = slug
    ? await fetchProductBySlugSafe(slug)
    : { product: null, notFound: false };

  return (
    <main className="min-h-screen flex flex-col justify-between">
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
