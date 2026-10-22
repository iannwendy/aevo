import ProductFormClient from '../../../../components/admin/ProductFormClient';

export const metadata = {
  title: 'Create Product — AEVO Control',
  description: 'Add a new computing hardware product with variants and inventory.',
};

export default function AdminNewProductPage() {
  return <ProductFormClient />;
}
