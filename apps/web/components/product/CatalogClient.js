'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  Search,
  SlidersHorizontal,
  LayoutGrid,
  List as ListIcon,
  X,
  RotateCcw,
  Star,
  Tag,
} from 'lucide-react';
import ProductCard from './ProductCard';
import Pagination from './Pagination';
import { productsApi, categoriesApi } from '../../lib/api';
import { formatPrice } from '../../lib/utils';
import { useI18n } from '../../lib/i18n';

const SORT_OPTIONS = [
  { value: 'newest', key: 'catalog.sortNewest' },
  { value: 'best-selling', key: 'catalog.sortBestSelling' },
  { value: 'price_asc', key: 'catalog.sortPriceAsc' },
  { value: 'price_desc', key: 'catalog.sortPriceDesc' },
  { value: 'name_asc', key: 'catalog.sortNameAsc' },
  { value: 'name_desc', key: 'catalog.sortNameDesc' },
];

const QUICK_PRICE_RANGES = [
  { key: 'catalog.priceUnder5M', min: '', max: '5000000' },
  { key: 'catalog.price5MTo15M', min: '5000000', max: '15000000' },
  { key: 'catalog.price15MTo35M', min: '15000000', max: '35000000' },
  { key: 'catalog.priceOver35M', min: '35000000', max: '' },
];

function parseQueryToState(searchParams, fallback = {}) {
  const get = (key) => {
    if (searchParams && typeof searchParams.get === 'function') {
      return searchParams.get(key) ?? '';
    }
    const raw = fallback[key];
    return Array.isArray(raw) ? raw[0] || '' : raw || '';
  };

  const brandParam = get('brand');
  const selectedBrands = brandParam
    ? String(brandParam)
        .split(',')
        .map((b) => b.trim())
        .filter(Boolean)
    : [];

  return {
    search: get('search') || get('q') || '',
    category: get('category') || '',
    brands: selectedBrands,
    minPrice: get('minPrice') || '',
    maxPrice: get('maxPrice') || '',
    minRating: get('minRating') || '',
    tag: get('tag') || '',
    inStock: get('inStock') === 'true' || get('inStock') === '1',
    sort: get('sort') || 'newest',
    page: Math.max(1, parseInt(get('page') || '1', 10) || 1),
  };
}

function buildQueryString(filters) {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.category) params.set('category', filters.category);
  if (filters.brands?.length > 0) params.set('brand', filters.brands.join(','));
  if (filters.minPrice !== '' && filters.minPrice !== null && filters.minPrice !== undefined) {
    params.set('minPrice', String(filters.minPrice));
  }
  if (filters.maxPrice !== '' && filters.maxPrice !== null && filters.maxPrice !== undefined) {
    params.set('maxPrice', String(filters.maxPrice));
  }
  if (filters.minRating) params.set('minRating', String(filters.minRating));
  if (filters.tag) params.set('tag', filters.tag);
  if (filters.inStock) params.set('inStock', 'true');
  if (filters.sort && filters.sort !== 'newest') params.set('sort', filters.sort);
  if (filters.page && filters.page > 1) params.set('page', String(filters.page));
  return params.toString();
}

export default function CatalogClient({ initialData, initialQuery = {} }) {
  const { t, catName } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentFilters = useMemo(
    () => parseQueryToState(searchParams, initialQuery),
    [searchParams, initialQuery]
  );

  // Local input states for controlled search & price inputs
  const [searchInput, setSearchInput] = useState(currentFilters.search);
  const [minPriceInput, setMinPriceInput] = useState(currentFilters.minPrice);
  const [maxPriceInput, setMaxPriceInput] = useState(currentFilters.maxPrice);
  const [viewMode, setViewMode] = useState('grid');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const [products, setProducts] = useState(initialData?.products || []);
  const [pagination, setPagination] = useState(
    initialData?.pagination || {
      page: currentFilters.page || 1,
      limit: 12,
      total: initialData?.products?.length || 0,
      totalPages: 1,
    }
  );
  const [categories, setCategories] = useState(initialData?.categories || []);
  const [filterMeta, setFilterMeta] = useState(
    initialData?.filterMeta || {
      brands: ['AMD', 'Anker', 'Apple', 'ASUS', 'BenQ', 'CalDigit', 'Corsair', 'Crucial', 'Dell', 'Elgato', 'HP', 'HyperX', 'Keychron', 'Lamicall', 'Lenovo', 'LG', 'Logitech', 'Noctua', 'NVIDIA', 'Razer', 'Samsung', 'SanDisk', 'Seagate', 'TwelveSouth', 'Western Digital'],
      tags: [],
      priceRange: { min: 0, max: 80000000 },
    }
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Sync controlled inputs when URL changes externally
  useEffect(() => {
    setSearchInput(currentFilters.search);
    setMinPriceInput(currentFilters.minPrice);
    setMaxPriceInput(currentFilters.maxPrice);
  }, [currentFilters.search, currentFilters.minPrice, currentFilters.maxPrice]);

  // Load categories & filter metadata once if not present
  useEffect(() => {
    let active = true;
    async function loadMeta() {
      try {
        const [catRes, metaRes] = await Promise.all([
          categoriesApi.getAll(),
          productsApi.getFilters(),
        ]);
        if (!active) return;
        if (Array.isArray(catRes.data)) setCategories(catRes.data);
        if (metaRes.data) setFilterMeta(metaRes.data);
      } catch {
        // Keep initial metadata on error
      }
    }
    loadMeta();
    return () => {
      active = false;
    };
  }, []);

  // Fetch products whenever URL query parameters change
  useEffect(() => {
    let active = true;
    async function fetchCatalog() {
      try {
        setLoading(true);
        const apiParams = {
          page: currentFilters.page,
          limit: 12,
          sort: currentFilters.sort,
        };
        if (currentFilters.search) apiParams.search = currentFilters.search;
        if (currentFilters.category) apiParams.category = currentFilters.category;
        if (currentFilters.brands.length > 0) apiParams.brand = currentFilters.brands.join(',');
        if (currentFilters.minPrice !== '') apiParams.minPrice = currentFilters.minPrice;
        if (currentFilters.maxPrice !== '') apiParams.maxPrice = currentFilters.maxPrice;
        if (currentFilters.minRating) apiParams.minRating = currentFilters.minRating;
        if (currentFilters.tag) apiParams.tag = currentFilters.tag;
        if (currentFilters.inStock) apiParams.inStock = 'true';

        const res = await productsApi.getAll(apiParams);
        if (!active) return;
        setProducts(res.data?.products || []);
        setPagination(
          res.data?.pagination || {
            page: currentFilters.page,
            limit: 12,
            total: res.data?.products?.length || 0,
            totalPages: 1,
          }
        );
        setError(null);
      } catch (err) {
        if (!active) return;
        console.error('Failed to fetch catalog products:', err);
        setError('Could not load products. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchCatalog();
    return () => {
      active = false;
    };
  }, [
    currentFilters.search,
    currentFilters.category,
    currentFilters.brands.join(','),
    currentFilters.minPrice,
    currentFilters.maxPrice,
    currentFilters.minRating,
    currentFilters.tag,
    currentFilters.inStock,
    currentFilters.sort,
    currentFilters.page,
  ]);

  const applyFilterUpdate = useCallback(
    (patch, resetPage = true) => {
      const next = {
        ...currentFilters,
        ...patch,
      };
      if (resetPage) {
        next.page = 1;
      }
      const qs = buildQueryString(next);
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [currentFilters, pathname, router]
  );

  const handleToggleBrand = (brandName) => {
    const lower = brandName.toLowerCase();
    const exists = currentFilters.brands.some((b) => b.toLowerCase() === lower);
    const nextBrands = exists
      ? currentFilters.brands.filter((b) => b.toLowerCase() !== lower)
      : [...currentFilters.brands, brandName];
    applyFilterUpdate({ brands: nextBrands });
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    applyFilterUpdate({ search: searchInput });
  };

  const handlePriceApply = (e) => {
    if (e) e.preventDefault();
    applyFilterUpdate({
      minPrice: minPriceInput,
      maxPrice: maxPriceInput,
    });
  };

  const handleResetAll = () => {
    setSearchInput('');
    setMinPriceInput('');
    setMaxPriceInput('');
    router.push(pathname, { scroll: false });
  };

  const hasActiveFilters = Boolean(
    currentFilters.search ||
      currentFilters.category ||
      currentFilters.brands.length > 0 ||
      currentFilters.minPrice !== '' ||
      currentFilters.maxPrice !== '' ||
      currentFilters.minRating ||
      currentFilters.tag ||
      currentFilters.inStock
  );

  const renderFilterSections = (idPrefix = 'desktop') => (
    <div className="space-y-8">
      {/* Search Keyword */}
      <div>
        <h3 className="text-caption font-mono uppercase tracking-wider text-secondary mb-3">
          {t('catalog.keywordSearch')}
        </h3>
        <form onSubmit={handleSearchSubmit} className="relative">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('catalog.searchPlaceholder')}
            data-testid={`${idPrefix}-filter-search`}
            className="w-full h-11 pl-9 pr-16 rounded-xl border border-border bg-surface text-small text-ink placeholder:text-secondary focus-ring"
          />
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary"
          />
          <button
            type="submit"
            data-testid={`${idPrefix}-filter-search-submit`}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-caption font-medium hover:bg-primary/90 transition-colors"
          >
            {t('catalog.go')}
          </button>
        </form>
      </div>

      {/* Category Filter */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-caption font-mono uppercase tracking-wider text-secondary">
            {t('catalog.category')}
          </h3>
          {currentFilters.category && (
            <button
              type="button"
              onClick={() => applyFilterUpdate({ category: '' })}
              className="text-caption text-secondary hover:text-ink"
            >
              {t('catalog.clear')}
            </button>
          )}
        </div>
        <div className="space-y-1.5" data-testid={`${idPrefix}-filter-categories`}>
          <button
            type="button"
            onClick={() => applyFilterUpdate({ category: '' })}
            data-testid={`${idPrefix}-category-all`}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-small transition-colors ${
              !currentFilters.category
                ? 'bg-primary text-primary-foreground font-medium'
                : 'text-ink hover:bg-canvas'
            }`}
          >
            <span>{t('catalog.allHardware')}</span>
          </button>
          {categories.map((cat) => {
            const isSelected =
              currentFilters.category.toLowerCase() === cat.slug.toLowerCase();
            return (
              <button
                key={cat.slug}
                type="button"
                onClick={() =>
                  applyFilterUpdate({ category: isSelected ? '' : cat.slug })
                }
                data-testid={`${idPrefix}-category-${cat.slug}`}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-small transition-colors ${
                  isSelected
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'text-ink hover:bg-canvas'
                }`}
              >
                <span>{catName(cat.slug || cat.name)}</span>
                {typeof cat.productCount === 'number' && (
                  <span
                    className={`text-caption font-mono ${
                      isSelected ? 'text-primary-foreground/80' : 'text-secondary'
                    }`}
                  >
                    {cat.productCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Brand Filter (Mandatory multi-select) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-caption font-mono uppercase tracking-wider text-secondary">
            {t('catalog.brandMultiSelect')}
          </h3>
          {currentFilters.brands.length > 0 && (
            <button
              type="button"
              onClick={() => applyFilterUpdate({ brands: [] })}
              className="text-caption text-secondary hover:text-ink"
            >
              {t('catalog.clear')} ({currentFilters.brands.length})
            </button>
          )}
        </div>
        <div
          data-testid={`${idPrefix}-filter-brands`}
          className="max-h-52 overflow-y-auto pr-1 space-y-1.5"
        >
          {(filterMeta.brands || []).map((brandName) => {
            const checked = currentFilters.brands.some(
              (b) => b.toLowerCase() === brandName.toLowerCase()
            );
            return (
              <label
                key={brandName}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-canvas cursor-pointer text-small text-ink"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => handleToggleBrand(brandName)}
                  data-testid={`${idPrefix}-brand-${brandName.toLowerCase().replace(/\s+/g, '-')}`}
                  className="h-4 w-4 rounded border-border text-ink focus:ring-ink"
                />
                <span className="truncate">{brandName}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Price Range Filter (Mandatory min/max) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-caption font-mono uppercase tracking-wider text-secondary">
            {t('catalog.priceRangeVnd')}
          </h3>
          {(currentFilters.minPrice !== '' || currentFilters.maxPrice !== '') && (
            <button
              type="button"
              onClick={() => {
                setMinPriceInput('');
                setMaxPriceInput('');
                applyFilterUpdate({ minPrice: '', maxPrice: '' });
              }}
              className="text-caption text-secondary hover:text-ink"
            >
              {t('catalog.clear')}
            </button>
          )}
        </div>

        <form onSubmit={handlePriceApply} className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="sr-only">Min Price</label>
              <input
                type="number"
                min="0"
                step="100000"
                placeholder={t('catalog.minPricePlaceholder')}
                value={minPriceInput}
                onChange={(e) => setMinPriceInput(e.target.value)}
                data-testid={`${idPrefix}-min-price`}
                className="w-full h-10 px-3 rounded-lg border border-border bg-surface text-small text-ink placeholder:text-secondary focus-ring"
              />
            </div>
            <div>
              <label className="sr-only">Max Price</label>
              <input
                type="number"
                min="0"
                step="100000"
                placeholder={t('catalog.maxPricePlaceholder')}
                value={maxPriceInput}
                onChange={(e) => setMaxPriceInput(e.target.value)}
                data-testid={`${idPrefix}-max-price`}
                className="w-full h-10 px-3 rounded-lg border border-border bg-surface text-small text-ink placeholder:text-secondary focus-ring"
              />
            </div>
          </div>
          <button
            type="submit"
            data-testid={`${idPrefix}-apply-price`}
            className="w-full h-9 rounded-lg border border-border bg-canvas hover:bg-primary hover:text-primary-foreground text-caption font-medium text-ink transition-colors"
          >
            {t('catalog.applyPriceRange')}
          </button>
        </form>

        <div className="grid grid-cols-2 gap-1.5 mt-3">
          {QUICK_PRICE_RANGES.map((range) => {
            const isSelected =
              currentFilters.minPrice === range.min &&
              currentFilters.maxPrice === range.max;
            return (
              <button
                key={range.key}
                type="button"
                onClick={() => {
                  setMinPriceInput(range.min);
                  setMaxPriceInput(range.max);
                  applyFilterUpdate({ minPrice: range.min, maxPrice: range.max });
                }}
                className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-colors ${
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-surface text-secondary border-border hover:border-ink hover:text-ink'
                }`}
              >
                {t(range.key)}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3rd Filtering Criterion: Customer Rating */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-caption font-mono uppercase tracking-wider text-secondary">
            {t('catalog.customerRating')}
          </h3>
          {currentFilters.minRating && (
            <button
              type="button"
              onClick={() => applyFilterUpdate({ minRating: '' })}
              className="text-caption text-secondary hover:text-ink"
            >
              {t('catalog.clear')}
            </button>
          )}
        </div>
        <div className="space-y-1.5" data-testid={`${idPrefix}-filter-rating`}>
          {[4, 3, 2].map((stars) => {
            const active = String(currentFilters.minRating) === String(stars);
            return (
              <button
                key={stars}
                type="button"
                onClick={() =>
                  applyFilterUpdate({ minRating: active ? '' : String(stars) })
                }
                data-testid={`${idPrefix}-rating-${stars}`}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-small transition-colors ${
                  active ? 'bg-primary text-primary-foreground font-medium' : 'text-ink hover:bg-canvas'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Star
                    size={14}
                    className={active ? 'fill-current text-primary-foreground' : 'fill-ink text-ink'}
                  />
                  <span>{t('catalog.starsAndAbove', { stars })}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Additional Filtering Criterion: Tags & Stock Availability */}
      <div>
        <h3 className="text-caption font-mono uppercase tracking-wider text-secondary mb-3">
          {t('catalog.availabilityAndTags')}
        </h3>
        <label className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-canvas cursor-pointer text-small text-ink mb-3">
          <input
            type="checkbox"
            checked={currentFilters.inStock}
            onChange={(e) => applyFilterUpdate({ inStock: e.target.checked })}
            data-testid={`${idPrefix}-filter-instock`}
            className="h-4 w-4 rounded border-border text-ink focus:ring-ink"
          />
          <span>{t('catalog.inStockOnly')}</span>
        </label>

        {filterMeta.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5" data-testid={`${idPrefix}-filter-tags`}>
            {filterMeta.tags.slice(0, 14).map((tagObj) => {
              const active = currentFilters.tag === tagObj.slug;
              return (
                <button
                  key={tagObj.slug}
                  type="button"
                  onClick={() => applyFilterUpdate({ tag: active ? '' : tagObj.slug })}
                  data-testid={`${idPrefix}-tag-${tagObj.slug}`}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-caption transition-colors ${
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-canvas text-secondary hover:text-ink border border-border'
                  }`}
                >
                  <Tag size={10} />
                  <span>{tagObj.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={handleResetAll}
          data-testid={`${idPrefix}-reset-filters`}
          className="w-full h-10 rounded-xl border border-border bg-surface hover:bg-canvas text-small font-medium text-ink inline-flex items-center justify-center gap-2 transition-colors"
        >
          <RotateCcw size={15} />
          {t('catalog.resetAllFilters')}
        </button>
      )}
    </div>
  );

  return (
    <div className="pt-[72px]" data-testid="catalog-page">
      <div className="container-main py-10 md:py-14">
        {/* Breadcrumb & Heading */}
        <nav aria-label="Breadcrumb" className="text-caption font-mono uppercase tracking-wider text-secondary mb-4">
          <Link href="/" className="hover:text-ink transition-colors">
            {t('catalog.breadcrumbHome')}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-ink">{t('catalog.breadcrumbShop')}</span>
          {currentFilters.category && (
            <>
              <span className="mx-2">/</span>
              <span className="text-ink">
                {catName(currentFilters.category).toUpperCase()}
              </span>
            </>
          )}
        </nav>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-8 border-b border-border">
          <div>
            <h1 className="text-h1">{t('catalog.title')}</h1>
            <p className="text-body text-secondary mt-2">
              {t('catalog.subtitle')}
            </p>
          </div>

          {/* Mobile Filter Trigger */}
          <div className="flex items-center gap-3 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              data-testid="mobile-filter-trigger"
              className="inline-flex items-center gap-2 px-4 h-11 rounded-xl border border-border bg-surface text-small font-medium text-ink"
            >
              <SlidersHorizontal size={16} />
              <span>{t('catalog.filtersBtn')}</span>
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-ink" />
              )}
            </button>
          </div>
        </div>

        {/* Main Layout: Sidebar + Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 pt-8">
          {/* Desktop Sidebar Filters */}
          <aside
            aria-label="Product Filters"
            data-testid="catalog-sidebar"
            className="hidden lg:block lg:col-span-3"
          >
            <div className="bg-surface border border-border rounded-2xl p-6 sticky top-24">
              {renderFilterSections('desktop')}
            </div>
          </aside>

          {/* Product Grid Area */}
          <div className="lg:col-span-9">
            {/* Toolbar: Product Count, Active Filter Pills, Sort Dropdown, View Toggle */}
            <div className="bg-surface border border-border rounded-2xl p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-small text-secondary" data-testid="catalog-count">
                {t('catalog.showing')}{' '}
                <strong className="font-medium text-ink">{products.length}</strong>{' '}
                {t('catalog.of')}{' '}
                <strong className="font-medium text-ink">{pagination.total}</strong>{' '}
                {t('catalog.products')}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="catalog-sort-select"
                    className="text-caption font-mono uppercase tracking-wider text-secondary"
                  >
                    {t('catalog.sortBy')}
                  </label>
                  <select
                    id="catalog-sort-select"
                    data-testid="catalog-sort-select"
                    value={currentFilters.sort}
                    onChange={(e) => applyFilterUpdate({ sort: e.target.value })}
                    className="h-10 px-3 rounded-xl border border-border bg-canvas text-small font-medium text-ink focus-ring"
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {t(opt.key)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Grid / List View Mode Toggle */}
                <div
                  className="inline-flex items-center rounded-xl border border-border bg-canvas p-1"
                  role="group"
                  aria-label="View mode"
                >
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    data-testid="view-mode-grid"
                    aria-label="Grid view"
                    className={`p-1.5 rounded-lg transition-colors ${
                      viewMode === 'grid'
                        ? 'bg-surface text-ink shadow-sm'
                        : 'text-secondary hover:text-ink'
                    }`}
                  >
                    <LayoutGrid size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    data-testid="view-mode-list"
                    aria-label="List view"
                    className={`p-1.5 rounded-lg transition-colors ${
                      viewMode === 'list'
                        ? 'bg-surface text-ink shadow-sm'
                        : 'text-secondary hover:text-ink'
                    }`}
                  >
                    <ListIcon size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Active Filter Badges */}
            {hasActiveFilters && (
              <div
                data-testid="active-filter-pills"
                className="flex flex-wrap items-center gap-2 mb-6"
              >
                {currentFilters.category && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface border border-border text-caption font-medium text-ink">
                    {t('catalog.pillCategory', { value: catName(currentFilters.category) })}
                    <button
                      type="button"
                      onClick={() => applyFilterUpdate({ category: '' })}
                      aria-label="Remove category filter"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
                {currentFilters.brands.map((b) => (
                  <span
                    key={b}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface border border-border text-caption font-medium text-ink"
                  >
                    {t('catalog.pillBrand', { value: b })}
                    <button
                      type="button"
                      onClick={() => handleToggleBrand(b)}
                      aria-label={`Remove ${b} filter`}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                {(currentFilters.minPrice !== '' || currentFilters.maxPrice !== '') && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface border border-border text-caption font-medium text-ink">
                    {t('catalog.pillPrice')}{' '}
                    {currentFilters.minPrice
                      ? formatPrice(Number(currentFilters.minPrice))
                      : '0 ₫'}{' '}
                    –{' '}
                    {currentFilters.maxPrice
                      ? formatPrice(Number(currentFilters.maxPrice))
                      : t('catalog.pillAny')}
                    <button
                      type="button"
                      onClick={() => applyFilterUpdate({ minPrice: '', maxPrice: '' })}
                      aria-label="Remove price filter"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
                {currentFilters.minRating && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface border border-border text-caption font-medium text-ink">
                    {t('catalog.pillRating', { value: currentFilters.minRating })}
                    <button
                      type="button"
                      onClick={() => applyFilterUpdate({ minRating: '' })}
                      aria-label="Remove rating filter"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
                {currentFilters.tag && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface border border-border text-caption font-medium text-ink">
                    {t('catalog.pillTag', { value: currentFilters.tag })}
                    <button
                      type="button"
                      onClick={() => applyFilterUpdate({ tag: '' })}
                      aria-label="Remove tag filter"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
                {currentFilters.search && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface border border-border text-caption font-medium text-ink">
                    {t('catalog.pillSearch')} &ldquo;{currentFilters.search}&rdquo;
                    <button
                      type="button"
                      onClick={() => applyFilterUpdate({ search: '' })}
                      aria-label="Remove search filter"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
              </div>
            )}

            {error && (
              <div className="p-4 mb-6 rounded-xl border border-danger/40 bg-danger/10 text-danger text-small">
                {t('catalog.loadError')}
              </div>
            )}

            {/* Products Grid / List */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div
                    key={n}
                    className="h-80 rounded-2xl bg-surface border border-border animate-pulse"
                  />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div
                data-testid="catalog-empty-state"
                className="bg-surface border border-border rounded-2xl p-12 text-center"
              >
                <h2 className="text-h3 text-ink mb-2">{t('catalog.emptyTitle')}</h2>
                <p className="text-small text-secondary max-w-md mx-auto mb-6">
                  {t('catalog.emptyDescription')}
                </p>
                <button
                  type="button"
                  onClick={handleResetAll}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-small font-medium hover:bg-primary/90 transition-colors"
                >
                  <RotateCcw size={15} />
                  {t('catalog.resetFiltersLower')}
                </button>
              </div>
            ) : (
              <div
                data-testid="catalog-products-grid"
                className={
                  viewMode === 'list'
                    ? 'space-y-4'
                    : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6'
                }
              >
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    viewMode={viewMode}
                  />
                ))}
              </div>
            )}

            {/* Pagination (Always rendered even when 1 page per requirement) */}
            <Pagination
              label={t('catalog.catalogPagination')}
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={pagination.limit}
              onPageChange={(nextPage) =>
                applyFilterUpdate({ page: nextPage }, false)
              }
            />
          </div>
        </div>
      </div>

      {/* Mobile Filter Drawer */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex justify-end bg-obsidian/60 backdrop-blur-xs"
          data-testid="mobile-filter-drawer"
        >
          <div className="w-full max-w-sm bg-surface h-full overflow-y-auto p-6 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center justify-between pb-4 mb-6 border-b border-border">
                <h2 className="text-h3">{t('catalog.filterHardwareTitle')}</h2>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  aria-label={t('catalog.closeFiltersAria')}
                  className="p-2 rounded-lg hover:bg-canvas"
                >
                  <X size={20} />
                </button>
              </div>

              {renderFilterSections('mobile')}
            </div>

            <div className="pt-6 mt-6 border-t border-border flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  handleResetAll();
                  setMobileDrawerOpen(false);
                }}
                className="flex-1 h-11 rounded-xl border border-border bg-surface text-small font-medium text-ink"
              >
                {t('catalog.resetFiltersBtn')}
              </button>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-small font-medium"
              >
                {t('catalog.applyFiltersBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
