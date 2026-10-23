import { cookies } from 'next/headers';
import ProductFormClient from '../../../../components/admin/ProductFormClient';
import {
  LOCALE_COOKIE_NAME,
  normalizeLocale,
  translate,
  formatAevoTitle,
} from '../../../../lib/i18n/dictionaries';

export async function generateMetadata() {
  const cookieStore = cookies();
  const locale = normalizeLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  return {
    title: formatAevoTitle(translate(locale, 'pageTitles.adminNewProduct')),
    description: 'Add a new computing hardware product with variants and inventory.',
  };
}

export default function AdminNewProductPage() {
  return <ProductFormClient />;
}
