'use client';

import { useEffect, useState, useCallback, Fragment } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  FolderTree,
  Layers,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import AdminShell from '../../../components/admin/AdminShell';
import Pagination from '../../../components/product/Pagination';
import { productsApi, categoriesApi } from '../../../lib/api';
import { formatPrice, handleImageError } from '../../../lib/utils';
import { useI18n } from '../../../lib/i18n';

export default function AdminProductsPage() {
  const { t, catName } = useI18n();

  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1,
  });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [page, setPage] = useState(1);

  // Expanded product rows for inline variant inventory management
  const [expandedProductId, setExpandedProductId] = useState(null);
  const [inventoryDrafts, setInventoryDrafts] = useState({});

  // Category manager drawer/panel
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');

  // Feedback banner
  const [feedback, setFeedback] = useState(null);

  const loadCategories = useCallback(async () => {
    try {
      const res = await categoriesApi.getAll();
      if (Array.isArray(res.data)) {
        setCategories(res.data);
      }
    } catch {
      // ignore
    }
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 12,
      };
      if (searchQuery) params.search = searchQuery;
      if (selectedCategory) params.category = selectedCategory;

      // Try admin endpoint first; fallback to public GET /products so page works even before login
      let data = null;
      try {
        const adminRes = await productsApi.getAdminAll(params);
        data = adminRes.data;
      } catch {
        const pubRes = await productsApi.getAll(params);
        data = pubRes.data;
      }

      if (data) {
        setProducts(data.products || []);
        if (data.pagination) {
          setPagination(data.pagination);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, selectedCategory]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setSearchQuery(searchInput.trim());
  };

  const handleDeleteProduct = async (product) => {
    setFeedback(null);
    try {
      await productsApi.delete(product.id);
      setFeedback({
        type: 'success',
        message: `Product "${product.name}" has been deactivated (isActive = false).`,
      });
      loadProducts();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.error || 'Could not delete product.',
      });
    }
  };

  const handleUpdateVariantInventory = async (variantId) => {
    const draftVal = inventoryDrafts[variantId];
    if (draftVal === undefined) return;
    setFeedback(null);
    try {
      const nextInv = Math.max(0, parseInt(draftVal, 10) || 0);
      await productsApi.updateVariantInventory(variantId, nextInv);
      setFeedback({
        type: 'success',
        message: `Variant inventory updated to ${nextInv} units.`,
      });
      loadProducts();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.error || 'Failed to update inventory.',
      });
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setFeedback(null);
    try {
      await categoriesApi.create({
        name: newCategoryName.trim(),
        description: newCategoryDesc.trim() || undefined,
      });
      setNewCategoryName('');
      setNewCategoryDesc('');
      setFeedback({ type: 'success', message: 'Category created.' });
      loadCategories();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.error || 'Could not create category.',
      });
    }
  };

  const handleDeleteCategory = async (catId) => {
    setFeedback(null);
    try {
      await categoriesApi.delete(catId);
      setFeedback({ type: 'success', message: 'Category deactivated.' });
      loadCategories();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.error || 'Could not delete category.',
      });
    }
  };

  return (
    <AdminShell>
      <div className="space-y-8" data-testid="admin-products-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-6">
          <div>
            <p className="text-caption font-mono uppercase tracking-widest text-secondary">
              {t('admin.productsEyebrow')}
            </p>
            <h1 className="text-h1 font-display mt-1">{t('admin.productsTitle')}</h1>
            <p className="text-body text-secondary mt-1">{t('admin.productsSubtitle')}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowCategoryManager((v) => !v)}
              data-testid="toggle-categories-btn"
              className="btn-secondary text-small px-4 py-2.5 h-auto"
            >
              <FolderTree size={16} className="mr-1.5" />
              {t('admin.manageCategoriesBtn')} ({categories.length})
            </button>

            <Link
              href="/admin/products/new"
              data-testid="create-product-link"
              className="btn-primary text-small px-4 py-2.5 h-auto"
            >
              <Plus size={16} className="mr-1.5" />
              {t('admin.addProductBtn')}
            </Link>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-4 rounded-xl border flex items-center gap-3 text-small ${
              feedback.type === 'success'
                ? 'border-success/40 bg-success/10 text-success'
                : 'border-danger/40 bg-danger/10 text-danger'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 size={18} />
            ) : (
              <AlertCircle size={18} />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Collapsible Category Manager */}
        {showCategoryManager && (
          <div className="surface-card p-6 space-y-5 animate-slide-up" data-testid="admin-category-manager">
            <h2 className="text-h3 font-display font-medium text-ink">
              Hardware Categories ({categories.length})
            </h2>

            <form
              onSubmit={handleCreateCategory}
              className="grid grid-cols-1 md:grid-cols-3 gap-3"
            >
              <input
                type="text"
                required
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="New category name (e.g., Workstations)"
                className="input-field h-10 text-small"
              />
              <input
                type="text"
                value={newCategoryDesc}
                onChange={(e) => setNewCategoryDesc(e.target.value)}
                placeholder="Category description"
                className="input-field h-10 text-small"
              />
              <button type="submit" className="btn-primary h-10 text-small">
                + Add Category
              </button>
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="p-3.5 rounded-xl bg-surface-muted border border-border flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-small font-medium text-ink truncate">
                      {catName(cat.slug || cat.name)}
                    </p>
                    <p className="text-caption font-mono text-secondary">
                      /{cat.slug} · {cat.productCount ?? 0} products
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(cat.id)}
                    className="p-2 rounded-lg text-secondary hover:text-danger transition-colors"
                    aria-label={`Deactivate ${cat.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <div className="surface-card p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary"
              />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search products by name, brand, or specs…"
                data-testid="admin-product-search-input"
                className="input-field h-10 pl-10 text-small"
              />
            </div>
            <button type="submit" className="btn-primary h-10 px-4 text-small">
              Search
            </button>
          </form>

          <div className="flex items-center gap-3">
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              data-testid="admin-product-category-filter"
              className="input-field h-10 text-small w-auto min-w-[180px]"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.slug}>
                  {catName(cat.slug || cat.name)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Products Data Table (concept.md 9.5) */}
        <div className="surface-card overflow-hidden" data-testid="admin-products-table">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-caption font-mono uppercase text-secondary">
                  <th className="py-3.5 px-4">{t('admin.thProduct')}</th>
                  <th className="py-3.5 px-4">{t('admin.thCategory')}</th>
                  <th className="py-3.5 px-4">{t('admin.thBrand')}</th>
                  <th className="py-3.5 px-4">{t('admin.thVariants')}</th>
                  <th className="py-3.5 px-4">{t('admin.thInventory')}</th>
                  <th className="py-3.5 px-4 text-right">{t('admin.thPrice')}</th>
                  <th className="py-3.5 px-4 text-right">{t('admin.thActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-small">
                {products.map((product) => {
                  const variants = product.variants || [];
                  const totalStock =
                    product.totalInventory ??
                    variants.reduce((sum, v) => sum + (v.inventory || 0), 0);
                  const isExpanded = expandedProductId === product.id;

                  return (
                    <Fragment key={product.id}>
                      <tr
                        className="table-row-interactive"
                        data-testid={`admin-product-row-${product.id}`}
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            {product.image ? (
                              <img
                                src={product.image}
                                alt={product.name}
                                onError={handleImageError}
                                className="w-11 h-11 rounded-lg object-contain p-1 border border-border bg-white shrink-0 transition-transform duration-200 hover:scale-110"
                              />
                            ) : (
                              <div className="w-11 h-11 rounded-lg border border-border bg-surface-muted shrink-0" />
                            )}
                            <div className="min-w-0">
                              <Link
                                href={`/products/${product.slug}`}
                                className="font-medium text-ink hover:underline block truncate max-w-[240px]"
                              >
                                {product.name}
                              </Link>
                              <span className="text-caption font-mono text-secondary">
                                /{product.slug}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-secondary">
                          {catName(product.categorySlug || product.category)}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-caption text-ink">
                          {product.brand}
                        </td>
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedProductId(isExpanded ? null : product.id)
                            }
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-muted border border-border font-mono text-caption text-ink hover:border-ink/40"
                          >
                            <Layers size={13} />
                            <span>{variants.length} variants</span>
                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-caption tabular-nums">
                          <span
                            className={
                              totalStock > 0 ? 'text-success font-medium' : 'text-danger'
                            }
                          >
                            {totalStock} in stock
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-caption tabular-nums text-ink font-medium">
                          {formatPrice(product.price || product.minPrice || 0)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            <Link
                              href={`/admin/products/${product.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-surface text-caption font-medium text-ink hover:bg-surface-muted btn-interactive"
                            >
                              <Edit3 size={13} />
                              <span>Edit</span>
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(product)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-surface text-caption font-medium text-danger hover:border-danger/40 btn-interactive"
                            >
                              <Trash2 size={13} />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Variant Inventory Row */}
                      {isExpanded && (
                        <tr className="bg-surface-muted/60 animate-fade-in">
                          <td colSpan={7} className="p-4">
                            <div className="space-y-2">
                              <p className="text-caption font-mono uppercase text-secondary">
                                Independent Variant Inventory — {product.name}
                              </p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {variants.map((v) => (
                                  <div
                                    key={v.id}
                                    className="p-3 rounded-xl bg-surface border border-border flex items-center justify-between gap-3"
                                  >
                                    <div className="min-w-0">
                                      <p className="text-small font-medium text-ink truncate">
                                        {v.name}
                                      </p>
                                      <p className="text-caption font-mono text-secondary">
                                        SKU: {v.sku} · {formatPrice(v.price)}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <input
                                        type="number"
                                        min="0"
                                        value={
                                          inventoryDrafts[v.id] !== undefined
                                            ? inventoryDrafts[v.id]
                                            : v.inventory
                                        }
                                        onChange={(e) =>
                                          setInventoryDrafts((prev) => ({
                                            ...prev,
                                            [v.id]: e.target.value,
                                          }))
                                        }
                                        className="input-field h-9 w-24 text-caption font-mono text-center"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateVariantInventory(v.id)}
                                        className="btn-primary h-9 px-3 text-caption"
                                      >
                                        Save Stock
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}

                {!loading && products.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-secondary">
                      No matching hardware products found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination (always displayed even on 1 page) */}
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          limit={pagination.limit}
          onPageChange={(nextPage) => setPage(nextPage)}
          ariaLabel="Admin Products Pagination"
        />
      </div>
    </AdminShell>
  );
}
