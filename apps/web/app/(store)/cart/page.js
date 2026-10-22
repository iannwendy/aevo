import { cookies } from 'next/headers';
import SiteHeader from '../../../components/SiteHeader';
import SiteFooter from '../../../components/SiteFooter';
import CartClient from '../../../components/cart/CartClient';

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

export const metadata = {
  title: 'Your Selection (Cart) — AEVO Store',
  description: 'Review your selected computing hardware and proceed to checkout.',
};

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
