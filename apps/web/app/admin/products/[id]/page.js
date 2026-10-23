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
    title: formatAevoTitle(translate(locale, 'pageTitles.adminEditProduct')),
    description: 'Update computing hardware product, variants, and inventory.',
  };
}

export default function AdminEditProductPage({ params }) {
  return <ProductFormClient productId={params?.id} />;
}
