import { cookies, headers } from 'next/headers';
import SiteHeader from '../../../components/SiteHeader';
import SiteFooter from '../../../components/SiteFooter';
import CheckoutClient from '../../../components/checkout/CheckoutClient';

const API_URL =
  process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function fetchInitialCheckoutData() {
  try {
    const cookieStore = cookies();
    const headerStore = headers();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');
    const authHeader = headerStore.get('authorization');

    if (!cookieHeader && !authHeader) {
      return { initialUser: null, initialCart: null };
    }

    const reqHeaders = {};
    if (cookieHeader) reqHeaders.Cookie = cookieHeader;
    if (authHeader) reqHeaders.Authorization = authHeader;

    const [profileRes, cartRes] = await Promise.all([
      fetch(`${API_URL}/api/auth/profile`, {
        headers: reqHeaders,
        cache: 'no-store',
      }).catch(() => null),
      fetch(`${API_URL}/api/cart`, {
        headers: reqHeaders,
        cache: 'no-store',
      }).catch(() => null),
    ]);

    const initialUser = profileRes && profileRes.ok ? await profileRes.json() : null;
    const initialCart = cartRes && cartRes.ok ? await cartRes.json() : null;

    return { initialUser, initialCart };
  } catch {
    return { initialUser: null, initialCart: null };
  }
}

export const metadata = {
  title: 'AEVO',
  description: 'Complete your precision hardware acquisition with multi-step verification.',
};

export default async function CheckoutPage() {
  const { initialUser, initialCart } = await fetchInitialCheckoutData();

  return (
    <main className="min-h-screen flex flex-col justify-between">
      <SiteHeader />
      <CheckoutClient initialUser={initialUser} initialCart={initialCart} />
      <SiteFooter />
    </main>
  );
}
