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
  Camera,
  Upload,
} from 'lucide-react';
import ProductCard from './ProductCard';
import Pagination from './Pagination';
import { productsApi, categoriesApi, aiApi } from '../../lib/api';
import { FALLBACK_PRODUCT_IMAGE, formatPrice, handleImageError } from '../../lib/utils';
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

  // AI Image Search state
  const [imageSearchOpen, setImageSearchOpen] = useState(false);
  const [imageSearching, setImageSearching] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [imageSearchResult, setImageSearchResult] = useState(null);

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

  const runVisualSearch = async ({ imageBase64, fileName, categoryHint, queryHint, previewUrl }) => {
    setImageSearching(true);
    if (previewUrl) setImagePreviewUrl(previewUrl);
    try {
      const res = await aiApi.imageSearch({
        imageBase64,
        fileName,
        categoryHint,
        queryHint,
        limit: 6,
      });
      setImageSearchResult(res.data || null);
    } catch {
      setImageSearchResult(null);
    } finally {
      setImageSearching(false);
    }
  };

  const handleImageFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      runVisualSearch({
        imageBase64: dataUrl,
        fileName: file.name,
        previewUrl: dataUrl,
      });
    };
    reader.readAsDataURL(file);
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
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-caption font-medium hover:bg-primary/90 active:scale-95 transition-all duration-200"
          >
            {t('catalog.go')}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setImageSearchOpen(true)}
          data-testid={idPrefix === 'desktop' ? 'image-search-trigger' : `${idPrefix}-image-search-trigger`}
          className="mt-2.5 w-full h-9 px-3 rounded-xl border border-border bg-canvas hover:bg-surface text-caption font-medium text-ink inline-flex items-center justify-center gap-2 transition-all duration-200"
        >
          <Camera size={14} className="text-secondary" />
          <span>{t('ai.imageSearchBtn')}</span>
        </button>
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
              className="text-caption text-secondary hover:text-ink transition-colors"
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
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-small transition-all duration-200 active:scale-[0.98] ${
              !currentFilters.category
                ? 'bg-primary text-primary-foreground font-medium shadow-xs'
                : 'text-ink hover:bg-canvas hover:translate-x-0.5'
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
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-small transition-all duration-200 active:scale-[0.98] ${
                  isSelected
                    ? 'bg-primary text-primary-foreground font-medium shadow-xs'
                    : 'text-ink hover:bg-canvas hover:translate-x-0.5'
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
          {[...(filterMeta.brands || [])]
            .sort((a, b) => {
              if (a === 'Apple') return -1;
              if (b === 'Apple') return 1;
              return a.localeCompare(b);
            })
            .map((brandName) => {
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
                <span className="truncate">
                  {brandName === 'Apple' ? ' Apple' : brandName}
                </span>
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
            className="w-full h-9 rounded-lg border border-border bg-canvas hover:bg-primary hover:text-primary-foreground text-caption font-medium text-ink transition-all duration-200 active:scale-[0.98]"
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
                className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-all duration-200 active:scale-95 ${
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs'
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
              className="text-caption text-secondary hover:text-ink transition-colors"
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
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-small transition-all duration-200 active:scale-[0.98] ${
                  active ? 'bg-primary text-primary-foreground font-medium shadow-xs' : 'text-ink hover:bg-canvas hover:translate-x-0.5'
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
        <label className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-canvas cursor-pointer text-small text-ink mb-3 transition-colors">
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
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-caption transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ${
                    active
                      ? 'bg-primary text-primary-foreground shadow-xs'
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
          className="group w-full h-10 rounded-xl border border-border bg-surface hover:bg-canvas text-small font-medium text-ink inline-flex items-center justify-center gap-2 btn-interactive"
        >
          <RotateCcw size={15} className="transition-transform duration-300 group-hover:-rotate-90" />
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
              className="inline-flex items-center gap-2 px-4 h-11 rounded-xl border border-border bg-surface text-small font-medium text-ink btn-interactive"
            >
              <SlidersHorizontal size={16} />
              <span>{t('catalog.filtersBtn')}</span>
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-ink animate-badge-pop" />
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
            {/* Apple 2026 Ecosystem Quick-Filter Strip */}
            <div
              data-testid="apple-ecosystem-bar"
              className="bg-surface border border-border rounded-2xl p-3.5 mb-4 flex flex-wrap items-center gap-2"
            >
              <span className="text-caption font-mono uppercase tracking-wider text-secondary px-2">
                 {t('catalog.appleQuickBarLabel')}
              </span>
              {[
                {
                  key: 'catalog.appleAll',
                  patch: { brands: ['Apple'], category: '', tag: '' },
                  active:
                    currentFilters.brands.some((b) => b.toLowerCase() === 'apple') &&
                    !currentFilters.category &&
                    !currentFilters.tag,
                },
                {
                  key: 'catalog.appleMacBookProM5',
                  patch: { brands: ['Apple'], category: 'laptops', tag: 'macbook-pro' },
                  active:
                    currentFilters.category === 'laptops' &&
                    currentFilters.tag === 'macbook-pro',
                },
                {
                  key: 'catalog.appleMacBookAirM5',
                  patch: { brands: ['Apple'], category: 'laptops', tag: 'macbook-air' },
                  active:
                    currentFilters.category === 'laptops' &&
                    currentFilters.tag === 'macbook-air',
                },
                {
                  key: 'catalog.appleMacBookNeo',
                  patch: { brands: ['Apple'], category: 'laptops', tag: 'macbook-neo' },
                  active:
                    currentFilters.category === 'laptops' &&
                    currentFilters.tag === 'macbook-neo',
                },
                {
                  key: 'catalog.appleMacDesktop',
                  patch: { brands: ['Apple'], category: 'components', tag: '' },
                  active:
                    currentFilters.brands.some((b) => b.toLowerCase() === 'apple') &&
                    currentFilters.category === 'components',
                },
                {
                  key: 'catalog.appleStudioDisplay',
                  patch: { brands: ['Apple'], category: 'monitors', tag: '' },
                  active:
                    currentFilters.brands.some((b) => b.toLowerCase() === 'apple') &&
                    currentFilters.category === 'monitors',
                },
                {
                  key: 'catalog.appleMagicAudio',
                  patch: { brands: ['Apple'], category: 'peripherals', tag: '' },
                  active:
                    currentFilters.brands.some((b) => b.toLowerCase() === 'apple') &&
                    currentFilters.category === 'peripherals',
                },
                {
                  key: 'catalog.appleAccessories',
                  patch: { brands: ['Apple'], category: 'accessories', tag: '' },
                  active:
                    currentFilters.brands.some((b) => b.toLowerCase() === 'apple') &&
                    currentFilters.category === 'accessories',
                },
              ].map((pill) => (
                <button
                  key={pill.key}
                  type="button"
                  onClick={() => applyFilterUpdate(pill.patch)}
                  className={`px-3 py-1.5 rounded-full text-caption font-medium transition-all duration-200 active:scale-95 ${
                    pill.active
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-canvas border border-border text-ink hover:border-ink'
                  }`}
                >
                  {t(pill.key)}
                </button>
              ))}
            </div>

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
                    className="h-10 px-3 rounded-xl border border-border bg-canvas text-small font-medium text-ink focus-ring transition-colors"
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
                    className={`p-1.5 rounded-lg transition-all duration-200 active:scale-95 ${
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
                    className={`p-1.5 rounded-lg transition-all duration-200 active:scale-95 ${
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
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface border border-border text-caption font-medium text-ink animate-scale-in">
                    {t('catalog.pillCategory', { value: catName(currentFilters.category) })}
                    <button
                      type="button"
                      onClick={() => applyFilterUpdate({ category: '' })}
                      aria-label="Remove category filter"
                      className="hover:text-danger transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
                {currentFilters.brands.map((b) => (
                  <span
                    key={b}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface border border-border text-caption font-medium text-ink animate-scale-in"
                  >
                    {t('catalog.pillBrand', { value: b })}
                    <button
                      type="button"
                      onClick={() => handleToggleBrand(b)}
                      aria-label={`Remove ${b} filter`}
                      className="hover:text-danger transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                {(currentFilters.minPrice !== '' || currentFilters.maxPrice !== '') && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface border border-border text-caption font-medium text-ink animate-scale-in">
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
                      className="hover:text-danger transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
                {currentFilters.minRating && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface border border-border text-caption font-medium text-ink animate-scale-in">
                    {t('catalog.pillRating', { value: currentFilters.minRating })}
                    <button
                      type="button"
                      onClick={() => applyFilterUpdate({ minRating: '' })}
                      aria-label="Remove rating filter"
                      className="hover:text-danger transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
                {currentFilters.tag && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface border border-border text-caption font-medium text-ink animate-scale-in">
                    {t('catalog.pillTag', { value: currentFilters.tag })}
                    <button
                      type="button"
                      onClick={() => applyFilterUpdate({ tag: '' })}
                      aria-label="Remove tag filter"
                      className="hover:text-danger transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
                {currentFilters.search && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface border border-border text-caption font-medium text-ink animate-scale-in">
                    {t('catalog.pillSearch')} &ldquo;{currentFilters.search}&rdquo;
                    <button
                      type="button"
                      onClick={() => applyFilterUpdate({ search: '' })}
                      aria-label="Remove search filter"
                      className="hover:text-danger transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
              </div>
            )}

            {error && (
              <div className="p-4 mb-6 rounded-xl border border-danger/40 bg-danger/10 text-danger text-small animate-fade-in">
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
                className="bg-surface border border-border rounded-2xl p-12 text-center animate-scale-in"
              >
                <h2 className="text-h3 text-ink mb-2">{t('catalog.emptyTitle')}</h2>
                <p className="text-small text-secondary max-w-md mx-auto mb-6">
                  {t('catalog.emptyDescription')}
                </p>
                <button
                  type="button"
                  onClick={handleResetAll}
                  className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-small font-medium hover:bg-primary/90 btn-interactive"
                >
                  <RotateCcw size={15} className="transition-transform duration-300 group-hover:-rotate-90" />
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
          className="fixed inset-0 z-50 lg:hidden flex justify-end bg-obsidian/60 backdrop-blur-xs animate-fade-in"
          data-testid="mobile-filter-drawer"
        >
          <div className="w-full max-w-sm bg-surface h-full overflow-y-auto p-6 flex flex-col justify-between shadow-xl animate-slide-in">
            <div>
              <div className="flex items-center justify-between pb-4 mb-6 border-b border-border">
                <h2 className="text-h3">{t('catalog.filterHardwareTitle')}</h2>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  aria-label={t('catalog.closeFiltersAria')}
                  className="p-2 rounded-lg hover:bg-canvas transition-all duration-200 active:scale-90"
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
                className="flex-1 h-11 rounded-xl border border-border bg-surface text-small font-medium text-ink btn-interactive"
              >
                {t('catalog.resetFiltersBtn')}
              </button>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-small font-medium btn-interactive"
              >
                {t('catalog.applyFiltersBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Visual Image Search Modal */}
      {imageSearchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian/60 backdrop-blur-xs animate-fade-in"
          data-testid="image-search-modal"
          role="dialog"
          aria-modal="true"
          aria-label={t('ai.imageSearchTitle')}
        >
          <div className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl bg-surface border border-border p-6 shadow-xl space-y-5 animate-scale-in">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-border">
              <div>
                <h2 className="text-h3 text-ink">{t('ai.imageSearchTitle')}</h2>
                <p className="text-caption text-secondary mt-1">
                  {t('ai.imageSearchSubtitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setImageSearchOpen(false)}
                data-testid="image-search-close"
                aria-label="Close visual search"
                className="p-2 rounded-lg text-secondary hover:text-ink hover:bg-canvas transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* File Upload Dropzone */}
            <div>
              <label
                htmlFor="image-search-file-input"
                className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-border bg-canvas hover:border-ink/40 cursor-pointer transition-colors text-center"
              >
                <Upload size={22} className="text-secondary mb-2" />
                <span className="text-small font-medium text-ink">
                  {t('ai.uploadDropzoneTitle')}
                </span>
                <span className="text-caption text-secondary mt-1">
                  {t('ai.uploadDropzoneHint')}
                </span>
                <input
                  id="image-search-file-input"
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileUpload}
                  data-testid="image-search-file-input"
                  className="sr-only"
                />
              </label>

              {/* Sample Quick Presets */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <button
                  type="button"
                  data-testid="image-search-sample-laptops"
                  onClick={() =>
                    runVisualSearch({
                      fileName: 'macbook-pro-m3-laptop.png',
                      categoryHint: 'laptops',
                      queryHint: 'laptop macbook',
                      previewUrl:
                        'https://images.unsplash.com/photo-1517336714731-489689fd1d8a?auto=format&fit=crop&w=600&q=80',
                    })
                  }
                  className="px-3 py-1.5 rounded-xl bg-canvas border border-border text-caption text-ink hover:border-ink transition-colors"
                >
                  {t('ai.sampleLaptop')}
                </button>
                <button
                  type="button"
                  data-testid="image-search-sample-monitors"
                  onClick={() =>
                    runVisualSearch({
                      fileName: 'ultrawide-4k-oled-monitor.png',
                      categoryHint: 'monitors',
                      queryHint: 'monitor oled 4k',
                      previewUrl:
                        'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=600&q=80',
                    })
                  }
                  className="px-3 py-1.5 rounded-xl bg-canvas border border-border text-caption text-ink hover:border-ink transition-colors"
                >
                  {t('ai.sampleMonitor')}
                </button>
                <button
                  type="button"
                  data-testid="image-search-sample-components"
                  onClick={() =>
                    runVisualSearch({
                      fileName: 'nvidia-rtx-4080-gpu-card.png',
                      categoryHint: 'components',
                      queryHint: 'rtx gpu graphics',
                      previewUrl:
                        'https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&w=600&q=80',
                    })
                  }
                  className="px-3 py-1.5 rounded-xl bg-canvas border border-border text-caption text-ink hover:border-ink transition-colors"
                >
                  {t('ai.sampleGpu')}
                </button>
              </div>
            </div>

            {imageSearching && (
              <div
                data-testid="image-search-loading"
                className="p-4 rounded-xl bg-canvas border border-border text-small text-secondary text-center animate-pulse"
              >
                {t('ai.analyzingImage')}
              </div>
            )}

            {imageSearchResult && !imageSearching && (
              <div data-testid="image-search-analysis" className="space-y-4">
                <div className="p-4 rounded-xl bg-canvas border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    {imagePreviewUrl && (
                      <img
                        src={imagePreviewUrl}
                        alt="Uploaded preview"
                        onError={handleImageError}
                        className="w-14 h-14 rounded-xl object-cover border border-border bg-surface shrink-0"
                      />
                    )}
                    <div>
                      <div className="text-caption text-secondary">
                        {t('ai.detectedCategoryLabel')}{' '}
                        <strong
                          data-testid="image-search-detected-category"
                          className="text-ink font-medium"
                        >
                          {catName(imageSearchResult.detectedCategory)}
                        </strong>
                      </div>
                      <div className="text-caption text-secondary mt-0.5">
                        {t('ai.visualConfidenceLabel')}{' '}
                        <span className="font-mono text-ink">
                          {Math.round((imageSearchResult.confidence || 0.9) * 100)}%
                        </span>
                      </div>
                      {Array.isArray(imageSearchResult.visualLabels) && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {imageSearchResult.visualLabels.slice(0, 3).map((lbl) => (
                            <span
                              key={lbl}
                              className="px-2 py-0.5 rounded-full bg-surface border border-border text-[10px] font-mono text-secondary"
                            >
                              {lbl}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    data-testid="image-search-apply-filter"
                    onClick={() => {
                      applyFilterUpdate({
                        category: imageSearchResult.detectedCategory || '',
                        search: '',
                      });
                      setImageSearchOpen(false);
                    }}
                    className="px-4 h-10 rounded-xl bg-primary text-primary-foreground text-caption font-medium shrink-0 hover:bg-primary/90 transition-all"
                  >
                    {t('ai.applyVisualFilterBtn')}
                  </button>
                </div>

                {/* Matched Visual Products */}
                <div
                  data-testid="image-search-results"
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                >
                  {(imageSearchResult.products || []).slice(0, 4).map((prod) => (
                    <Link
                      key={prod.id}
                      href={`/products/${prod.slug}`}
                      data-testid="image-search-result-card"
                      onClick={() => setImageSearchOpen(false)}
                      className="flex items-center gap-3 p-3 rounded-xl bg-canvas border border-border hover:border-ink/40 transition-all group"
                    >
                      <img
                        src={prod.image || FALLBACK_PRODUCT_IMAGE}
                        alt={prod.name}
                        onError={handleImageError}
                        className="w-14 h-14 rounded-lg object-contain bg-surface p-1.5 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-small font-medium text-ink truncate group-hover:underline">
                          {prod.name}
                        </div>
                        <div className="text-caption text-secondary">
                          {prod.brand} · {formatPrice(prod.price)}
                        </div>
                        {prod.similarityScore && (
                          <div className="text-[10px] font-mono text-secondary mt-0.5">
                            Match: {Math.round(prod.similarityScore * 100)}%
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
