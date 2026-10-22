'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Trash2,
  Save,
  Image as ImageIcon,
  Layers,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import AdminShell from './AdminShell';
import { productsApi, categoriesApi } from '../../lib/api';
import { useI18n } from '../../lib/i18n';

const DEFAULT_IMAGES = [
  'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=1000',
  'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=1000',
  'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=1000',
];

const DEFAULT_VARIANTS = [
  {
    name: '16GB RAM / 512GB NVMe SSD',
    sku: '',
    price: '29990000',
    comparePrice: '32990000',
    inventory: '15',
  },
  {
    name: '32GB RAM / 1TB NVMe SSD',
    sku: '',
    price: '36990000',
    comparePrice: '39990000',
    inventory: '10',
  },
];

export default function ProductFormClient({ productId = null }) {
  const router = useRouter();
  const { t, catName } = useI18n();
  const isEdit = Boolean(productId);

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [isNewArrival, setIsNewArrival] = useState(true);
  const [isBestSeller, setIsBestSeller] = useState(false);
  const [images, setImages] = useState(DEFAULT_IMAGES);
  const [variants, setVariants] = useState(DEFAULT_VARIANTS);

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const catRes = await categoriesApi.getAll();
        if (!active) return;
        const catList = Array.isArray(catRes.data) ? catRes.data : [];
        setCategories(catList);
        if (!isEdit && catList.length > 0 && !categoryId) {
          setCategoryId(catList[0].id);
        }

        if (isEdit && productId) {
          setLoading(true);
          const prodRes = await productsApi.getById(productId);
          if (!active) return;
          const p = prodRes.data;
          if (p) {
            setName(p.name || '');
            setBrand(p.brand || '');
            setCategoryId(p.categoryId || catList[0]?.id || '');
            setDescription(p.description || '');
            setIsNewArrival(Boolean(p.isNewArrival));
            setIsBestSeller(Boolean(p.isBestSeller));
            setImages(
              p.images?.length > 0
                ? p.images.map((img) => img.url)
                : DEFAULT_IMAGES
            );
            setVariants(
              p.variants?.length > 0
                ? p.variants.map((v) => ({
                    id: v.id,
                    name: v.name || '',
                    sku: v.sku || '',
                    price: String(v.price ?? 0),
                    comparePrice: v.comparePrice != null ? String(v.comparePrice) : '',
                    inventory: String(v.inventory ?? 0),
                  }))
                : DEFAULT_VARIANTS
            );
          }
        }
      } catch (err) {
        if (active && isEdit) {
          setError('Could not load product details.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    init();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, productId]);

  const handleImageChange = (index, value) => {
    setImages((prev) => prev.map((img, i) => (i === index ? value : img)));
  };

  const handleAddImage = () => {
    setImages((prev) => [...prev, '']);
  };

  const handleRemoveImage = (index) => {
    if (images.length <= 1) return;
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleVariantChange = (index, field, value) => {
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value } : v))
    );
  };

  const handleAddVariant = () => {
    setVariants((prev) => [
      ...prev,
      {
        name: '',
        sku: '',
        price: '0',
        comparePrice: '',
        inventory: '10',
      },
    ]);
  };

  const handleRemoveVariant = (index) => {
    if (variants.length <= 1) return;
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!name.trim() || !brand.trim() || !categoryId || !description.trim()) {
      setError('Product name, brand, category, and description are required.');
      return;
    }

    const validImages = images.map((u) => u.trim()).filter(Boolean);
    if (validImages.length === 0) {
      setError('Please provide at least one product image URL.');
      return;
    }

    const validVariants = variants
      .filter((v) => v.name && String(v.name).trim())
      .map((v, idx) => ({
        ...(v.id && { id: v.id }),
        name: String(v.name).trim(),
        sku:
          v.sku && String(v.sku).trim()
            ? String(v.sku).trim()
            : `AEVO-${Date.now().toString(36).toUpperCase()}-${idx + 1}`,
        price: Number(v.price) || 0,
        comparePrice:
          v.comparePrice !== '' && v.comparePrice != null
            ? Number(v.comparePrice)
            : null,
        inventory: Math.max(0, parseInt(v.inventory, 10) || 0),
      }));

    if (validVariants.length === 0) {
      setError('Please configure at least one product variant.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        name: name.trim(),
        brand: brand.trim(),
        categoryId,
        description: description.trim(),
        isNewArrival,
        isBestSeller,
        images: validImages,
        variants: validVariants,
      };

      if (isEdit) {
        await productsApi.update(productId, payload);
        setSuccess('Product updated successfully.');
      } else {
        const res = await productsApi.create(payload);
        setSuccess(`Product "${res.data?.name || name}" created successfully.`);
        setTimeout(() => {
          router.push('/admin/products');
        }, 800);
      }
    } catch (err) {
      setError(
        err.response?.data?.error || 'Failed to save product. Ensure you are signed in as Admin.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminShell>
      <div
        className="max-w-4xl space-y-8"
        data-testid={isEdit ? 'admin-product-edit-page' : 'admin-product-new-page'}
      >
        <div>
          <Link
            href="/admin/products"
            className="text-small text-secondary hover:text-ink transition-colors"
          >
            {t('admin.backToProducts')}
          </Link>
          <p className="text-caption font-mono uppercase tracking-widest text-secondary mt-3">
            {t('admin.productsEyebrow')}
          </p>
          <h1 className="text-h1 font-display mt-1">
            {isEdit ? t('admin.editProductTitle') : t('admin.createProductTitle')}
          </h1>
        </div>

        {error && (
          <div
            data-testid="product-form-error"
            className="p-4 rounded-xl border border-danger/40 bg-danger/10 text-danger flex items-center gap-3 text-small"
          >
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div
            data-testid="product-form-success"
            className="p-4 rounded-xl border border-success/40 bg-success/10 text-success flex items-center gap-3 text-small"
          >
            <CheckCircle2 size={18} />
            <span>{success}</span>
          </div>
        )}

        {loading ? (
          <div className="surface-card p-10 text-center text-secondary">
            Loading product configuration…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6" data-testid="admin-product-form">
            {/* Core Information */}
            <div className="surface-card p-6 space-y-5">
              <h2 className="text-h3 font-display font-medium text-ink">
                1. Hardware Information
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-caption font-mono uppercase text-secondary mb-1.5">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    data-testid="product-name-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., MacBook Pro 16 M3 Max"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-caption font-mono uppercase text-secondary mb-1.5">
                    Brand *
                  </label>
                  <input
                    type="text"
                    required
                    data-testid="product-brand-input"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="e.g., Apple, ASUS, NVIDIA, Dell"
                    className="input-field"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-caption font-mono uppercase text-secondary mb-1.5">
                    Hardware Category *
                  </label>
                  <select
                    required
                    data-testid="product-category-select"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="input-field"
                  >
                    <option value="">Select category…</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {catName(cat.slug || cat.name)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end gap-6 pb-2">
                  <label className="inline-flex items-center gap-2.5 text-small text-ink cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isNewArrival}
                      onChange={(e) => setIsNewArrival(e.target.checked)}
                      className="w-4 h-4 rounded border-border"
                    />
                    <span>New Arrival Badge</span>
                  </label>

                  <label className="inline-flex items-center gap-2.5 text-small text-ink cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isBestSeller}
                      onChange={(e) => setIsBestSeller(e.target.checked)}
                      className="w-4 h-4 rounded border-border"
                    />
                    <span>Best Seller Badge</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-caption font-mono uppercase text-secondary mb-1.5">
                  Technical Description (Minimum 5 lines recommended) *
                </label>
                <textarea
                  rows={6}
                  required
                  data-testid="product-description-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter detailed multi-line hardware specifications and workflow highlights..."
                  className="input-field h-auto py-3"
                />
              </div>
            </div>

            {/* Product Images (>= 3 recommended) */}
            <div className="surface-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-h3 font-display font-medium text-ink flex items-center gap-2">
                    <ImageIcon size={20} className="text-secondary" />
                    <span>2. Illustrative Images ({images.length})</span>
                  </h2>
                  <p className="text-caption text-secondary mt-0.5">
                    Minimum 3 studio product images recommended. First image is primary.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddImage}
                  data-testid="add-image-btn"
                  className="btn-secondary text-caption px-3 py-2 h-auto"
                >
                  <Plus size={14} className="mr-1" />
                  Add Image URL
                </button>
              </div>

              <div className="space-y-3">
                {images.map((url, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-caption font-mono text-secondary">
                      {idx === 0 ? 'Primary' : `Image #${idx + 1}`}
                    </span>
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => handleImageChange(idx, e.target.value)}
                      placeholder="https://images.unsplash.com/..."
                      className="input-field flex-1"
                    />
                    {images.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        className="p-2.5 rounded-xl border border-border text-secondary hover:text-danger hover:border-danger/40 transition-colors"
                        aria-label={`Remove image ${idx + 1}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Product Variants & Independent Inventory (>= 2 recommended) */}
            <div className="surface-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-h3 font-display font-medium text-ink flex items-center gap-2">
                    <Layers size={20} className="text-secondary" />
                    <span>3. Product Variants & Inventory ({variants.length})</span>
                  </h2>
                  <p className="text-caption text-secondary mt-0.5">
                    Each configuration has independent SKU, price, and stock tracking.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddVariant}
                  data-testid="add-variant-btn"
                  className="btn-secondary text-caption px-3 py-2 h-auto"
                >
                  <Plus size={14} className="mr-1" />
                  Add Variant
                </button>
              </div>

              <div className="space-y-4">
                {variants.map((variant, idx) => (
                  <div
                    key={variant.id || idx}
                    data-testid={`variant-row-${idx}`}
                    className="p-4 rounded-xl bg-surface-muted border border-border space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-caption font-mono uppercase text-secondary">
                        Configuration #{idx + 1}
                      </span>
                      {variants.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveVariant(idx)}
                          className="text-caption text-danger hover:underline inline-flex items-center gap-1"
                        >
                          <Trash2 size={13} />
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                      <div className="lg:col-span-2">
                        <label className="block text-[11px] font-mono uppercase text-secondary mb-1">
                          Variant Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={variant.name}
                          onChange={(e) => handleVariantChange(idx, 'name', e.target.value)}
                          placeholder="e.g., 32GB RAM / 1TB SSD"
                          className="input-field h-10 text-small"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-mono uppercase text-secondary mb-1">
                          SKU
                        </label>
                        <input
                          type="text"
                          value={variant.sku}
                          onChange={(e) => handleVariantChange(idx, 'sku', e.target.value)}
                          placeholder="Auto-generated if blank"
                          className="input-field h-10 text-small font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-mono uppercase text-secondary mb-1">
                          Price (VND) *
                        </label>
                        <input
                          type="number"
                          min="0"
                          required
                          value={variant.price}
                          onChange={(e) => handleVariantChange(idx, 'price', e.target.value)}
                          className="input-field h-10 text-small font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-mono uppercase text-secondary mb-1">
                          Inventory (Units) *
                        </label>
                        <input
                          type="number"
                          min="0"
                          required
                          value={variant.inventory}
                          onChange={(e) => handleVariantChange(idx, 'inventory', e.target.value)}
                          className="input-field h-10 text-small font-mono"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit Bar */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Link href="/admin/products" className="btn-secondary px-5">
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting}
                data-testid="submit-product-btn"
                className="btn-primary px-6"
              >
                <Save size={16} className="mr-2" />
                {submitting
                  ? 'Saving Hardware…'
                  : isEdit
                  ? 'Save Product Changes'
                  : 'Create Product'}
              </button>
            </div>
          </form>
        )}
      </div>
    </AdminShell>
  );
}
