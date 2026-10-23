import ProductFormClient from '../../../../components/admin/ProductFormClient';

export const metadata = {
  title: 'AEVO',
  description: 'Update computing hardware product, variants, and inventory.',
};

export default function AdminEditProductPage({ params }) {
  return <ProductFormClient productId={params?.id} />;
}
