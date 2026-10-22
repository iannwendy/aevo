import SiteHeader from '../../../../components/SiteHeader';
import SiteFooter from '../../../../components/SiteFooter';
import ProductDetailClient from '../../../../components/product/ProductDetailClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function fetchProductBySlugSafe(slug) {
  try {
    const res = await fetch(`${API_URL}/api/products/slug/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const slug = params?.slug;
  const product = slug ? await fetchProductBySlugSafe(slug) : null;
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
  const initialProduct = slug ? await fetchProductBySlugSafe(slug) : null;

  return (
    <main className="min-h-screen flex flex-col justify-between">
      <SiteHeader />
      <ProductDetailClient slug={slug} initialProduct={initialProduct} />
      <SiteFooter />
    </main>
  );
}
