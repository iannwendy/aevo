import { cookies } from 'next/headers';
import SiteHeader from '../../../components/SiteHeader';
import SiteFooter from '../../../components/SiteFooter';
import CartClient from '../../../components/cart/CartClient';
import {
  LOCALE_COOKIE_NAME,
  normalizeLocale,
  translate,
  formatAevoTitle,
} from '../../../lib/i18n/dictionaries';

const API_URL =
  process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function fetchInitialCart() {
  try {
    const cookieStore = cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');

    if (!cookieHeader) return null;

    const res = await fetch(`${API_URL}/api/cart`, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata() {
  const cookieStore = cookies();
  const locale = normalizeLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  return {
    title: formatAevoTitle(translate(locale, 'pageTitles.cart')),
    description: 'Review your selected computing hardware and proceed to checkout.',
  };
}

export default async function CartPage() {
  const initialCart = await fetchInitialCart();

  return (
    <main className="min-h-screen flex flex-col justify-between">
      <SiteHeader />
      <CartClient initialCart={initialCart} />
      <SiteFooter />
    </main>
  );
}
