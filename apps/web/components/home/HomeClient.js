'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles, Award, Layers } from 'lucide-react';
import ProductCard from '../product/ProductCard';
import Pagination from '../product/Pagination';
import { productsApi, categoriesApi } from '../../lib/api';

const FEATURED_CATEGORY_SLUGS = [
  {
    slug: 'laptops',
    title: 'Laptops',
    subtitle: 'Precision-engineered portable workstations and ultrabooks.',
  },
  {
    slug: 'components',
    title: 'Components',
    subtitle: 'Flagship processors, graphics cards, memory, and thermal architecture.',
  },
  {
    slug: 'monitors',
    title: 'Monitors',
    subtitle: 'Reference-grade OLED and 4K IPS Black studio displays.',
  },
];

const HOME_SECTION_LIMIT = 4;

function paginateSlice(items = [], page = 1, limit = HOME_SECTION_LIMIT) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * limit;
  return {
    items: items.slice(start, start + limit),
    pagination: {
      page: safePage,
      limit,
      total,
      totalPages,
    },
  };
}

export default function HomeClient({ initialData }) {
  const [newArrivalsAll, setNewArrivalsAll] = useState(initialData?.newArrivals || []);
  const [newArrivalsPage, setNewArrivalsPage] = useState(1);

  const [bestSellersAll, setBestSellersAll] = useState(initialData?.bestSellers || []);
  const [bestSellersPage, setBestSellersPage] = useState(1);

  const [categories, setCategories] = useState(initialData?.categories || []);

  const [categorySections, setCategorySections] = useState(() => {
    const map = {};
    for (const c of FEATURED_CATEGORY_SLUGS) {
      const seeded = initialData?.categoryProducts?.[c.slug];
      map[c.slug] = {
        products: seeded?.products || [],
        pagination: seeded?.pagination || {
          page: 1,
          limit: HOME_SECTION_LIMIT,
          total: seeded?.products?.length || 0,
          totalPages: 1,
        },
        loading: false,
      };
    }
    return map;
  });

  const [loadingMain, setLoadingMain] = useState(!initialData);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadHomepageData() {
      try {
        setLoadingMain(true);
        const [newRes, bestRes, catRes, ...catProdResponses] = await Promise.all([
          productsApi.getNewArrivals({ limit: 24 }),
          productsApi.getBestSellers({ limit: 24 }),
          categoriesApi.getAll(),
          ...FEATURED_CATEGORY_SLUGS.map((c) =>
            productsApi.getAll({ category: c.slug, page: 1, limit: HOME_SECTION_LIMIT })
          ),
        ]);

        if (!active) return;

        if (Array.isArray(newRes.data)) {
          setNewArrivalsAll(newRes.data);
        }
        if (Array.isArray(bestRes.data)) {
          setBestSellersAll(bestRes.data);
        }
        if (Array.isArray(catRes.data)) {
          setCategories(catRes.data);
        }

        const nextSections = {};
        FEATURED_CATEGORY_SLUGS.forEach((c, idx) => {
          const data = catProdResponses[idx]?.data;
          nextSections[c.slug] = {
            products: data?.products || [],
            pagination: data?.pagination || {
              page: 1,
              limit: HOME_SECTION_LIMIT,
              total: data?.products?.length || 0,
              totalPages: 1,
            },
            loading: false,
          };
        });
        setCategorySections(nextSections);
        setError(null);
      } catch (err) {
        if (!active) return;
        console.error('Failed to load homepage data:', err);
        setError('Unable to load latest product collections.');
      } finally {
        if (active) setLoadingMain(false);
      }
    }

    loadHomepageData();
    return () => {
      active = false;
    };
  }, []);

  const handleCategorySectionPageChange = useCallback(async (slug, targetPage) => {
    setCategorySections((prev) => ({
      ...prev,
      [slug]: {
        ...prev[slug],
        loading: true,
      },
    }));

    try {
      const res = await productsApi.getAll({
        category: slug,
        page: targetPage,
        limit: HOME_SECTION_LIMIT,
      });
      setCategorySections((prev) => ({
        ...prev,
        [slug]: {
          products: res.data?.products || [],
          pagination: res.data?.pagination || {
            page: targetPage,
            limit: HOME_SECTION_LIMIT,
            total: 0,
            totalPages: 1,
          },
          loading: false,
        },
      }));
    } catch (err) {
      console.error(`Failed to paginate ${slug}:`, err);
      setCategorySections((prev) => ({
        ...prev,
        [slug]: {
          ...prev[slug],
          loading: false,
        },
      }));
    }
  }, []);

  const newArrivalsPaged = paginateSlice(newArrivalsAll, newArrivalsPage, HOME_SECTION_LIMIT);
  const bestSellersPaged = paginateSlice(bestSellersAll, bestSellersPage, HOME_SECTION_LIMIT);

  const displayedCategories =
    categories.length > 0
      ? categories
      : [
          { slug: 'laptops', name: 'Laptops', description: 'Portable machines for work, study and play.', productCount: 5 },
          { slug: 'components', name: 'Components', description: 'CPUs, GPUs, memory and cooling for a desktop build.', productCount: 6 },
          { slug: 'monitors', name: 'Monitors', description: 'Colour-accurate and high-refresh displays.', productCount: 5 },
        ];

  return (
    <>
      {/* Hero Section */}
      <section className="pt-[72px]" data-testid="hero-section">
        <div className="container-main section-py">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7">
              <span className="inline-block text-caption font-mono uppercase tracking-widest text-secondary mb-4">
                SERIES 01 — PERFORMANCE COMPUTING
              </span>
              <h1 className="text-display mb-6">Technology, refined.</h1>
              <p className="text-xl text-secondary mb-8 max-w-xl">
                Discover exceptional hardware for everything you create. Curated workstations,
                components, and studio displays built for demanding workflows.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <Link
                  href="/products"
                  data-testid="hero-explore-cta"
                  className="inline-flex items-center gap-2 bg-ink text-white px-6 py-3.5 rounded-lg font-medium hover:bg-ink/90 transition-colors"
                >
                  Explore collection
                  <ArrowRight size={20} />
                </Link>
                <Link
                  href="/products?sort=best-selling"
                  className="inline-flex items-center gap-2 bg-surface border border-border text-ink px-6 py-3.5 rounded-lg font-medium hover:bg-canvas transition-colors"
                >
                  Best sellers
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-border bg-surface shadow-sm">
                <img
                  src="https://images.unsplash.com/photo-1517336714731-489689fd1d8a?auto=format&fit=crop&w=1200&q=80"
                  alt="AEVO Flagship Computing Setup"
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-4 left-4 right-4 bg-surface/90 backdrop-blur-md border border-border rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-secondary block">
                      Featured System
                    </span>
                    <span className="text-small font-medium text-ink">
                      MacBook Pro M3 & Studio Hardware
                    </span>
                  </div>
                  <Link
                    href="/products/macbook-pro-m3"
                    className="text-caption font-medium text-ink hover:text-secondary inline-flex items-center gap-1"
                  >
                    Configure
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="container-main mb-8">
          <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-small">
            {error}
          </div>
        </div>
      )}

      {/* New Arrivals Section */}
      <section
        id="new-arrivals"
        data-testid="new-arrivals-section"
        className="section-py border-t border-border"
      >
        <div className="container-main">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <div className="inline-flex items-center gap-1.5 text-caption font-mono uppercase tracking-wider text-secondary mb-2">
                <Sparkles size={13} />
                <span>New Products</span>
              </div>
              <h2 className="text-h2">Discover what&apos;s next.</h2>
            </div>
            <Link
              href="/products?sort=newest"
              className="text-small font-medium text-secondary hover:text-ink transition-colors inline-flex items-center gap-1"
            >
              View all new arrivals
              <ArrowRight size={16} />
            </Link>
          </div>

          {loadingMain && newArrivalsPaged.items.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="h-80 rounded-2xl bg-surface border border-border animate-pulse"
                />
              ))}
            </div>
          ) : (
            <>
              <div
                data-testid="new-arrivals-grid"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
              >
                {newArrivalsPaged.items.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              <Pagination
                label="New Arrivals Pagination"
                page={newArrivalsPaged.pagination.page}
                totalPages={newArrivalsPaged.pagination.totalPages}
                total={newArrivalsPaged.pagination.total}
                limit={newArrivalsPaged.pagination.limit}
                onPageChange={setNewArrivalsPage}
              />
            </>
          )}
        </div>
      </section>

      {/* Best Sellers Section */}
      <section
        id="best-sellers"
        data-testid="best-sellers-section"
        className="section-py border-t border-border bg-surface/40"
      >
        <div className="container-main">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <div className="inline-flex items-center gap-1.5 text-caption font-mono uppercase tracking-wider text-secondary mb-2">
                <Award size={13} />
                <span>Best Sellers</span>
              </div>
              <h2 className="text-h2">Chosen for performance.</h2>
            </div>
            <Link
              href="/products?sort=best-selling"
              className="text-small font-medium text-secondary hover:text-ink transition-colors inline-flex items-center gap-1"
            >
              View all best sellers
              <ArrowRight size={16} />
            </Link>
          </div>

          {loadingMain && bestSellersPaged.items.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="h-80 rounded-2xl bg-surface border border-border animate-pulse"
                />
              ))}
            </div>
          ) : (
            <>
              <div
                data-testid="best-sellers-grid"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
              >
                {bestSellersPaged.items.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              <Pagination
                label="Best Sellers Pagination"
                page={bestSellersPaged.pagination.page}
                totalPages={bestSellersPaged.pagination.totalPages}
                total={bestSellersPaged.pagination.total}
                limit={bestSellersPaged.pagination.limit}
                onPageChange={setBestSellersPage}
              />
            </>
          )}
        </div>
      </section>

      {/* Category Cards Directory */}
      <section
        id="categories"
        data-testid="categories-section"
        className="section-py border-t border-border"
      >
        <div className="container-main">
          <div className="mb-8">
            <div className="inline-flex items-center gap-1.5 text-caption font-mono uppercase tracking-wider text-secondary mb-2">
              <Layers size={13} />
              <span>Hardware Categories</span>
            </div>
            <h2 className="text-h2">Find your next essential.</h2>
          </div>

          <div
            data-testid="categories-grid"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {displayedCategories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/products?category=${cat.slug}`}
                data-testid={`category-card-${cat.slug}`}
                className="group block"
              >
                <div className="h-full bg-surface rounded-2xl border border-border p-6 md:p-8 flex flex-col justify-between transition-all duration-200 group-hover:border-ink group-hover:shadow-sm">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-caption font-mono text-secondary uppercase tracking-wider">
                        Category
                      </span>
                      {typeof cat.productCount === 'number' && (
                        <span className="text-caption font-mono text-secondary">
                          {cat.productCount} {cat.productCount === 1 ? 'item' : 'items'}
                        </span>
                      )}
                    </div>
                    <h3 className="text-h3 mt-2 text-ink">{cat.name}</h3>
                    {cat.description && (
                      <p className="text-small text-secondary mt-2 line-clamp-2">
                        {cat.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-border/60 flex items-center justify-between text-small font-medium text-ink">
                    <span>Explore {cat.name}</span>
                    <ArrowRight className="w-5 h-5 text-secondary group-hover:text-ink group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 3 Distinct Category Product Sections (Laptops, Components, Monitors) with Pagination */}
      {FEATURED_CATEGORY_SLUGS.map((catMeta, idx) => {
        const sectionState = categorySections[catMeta.slug] || {
          products: [],
          pagination: { page: 1, limit: HOME_SECTION_LIMIT, total: 0, totalPages: 1 },
          loading: false,
        };

        return (
          <section
            key={catMeta.slug}
            data-testid={`category-showcase-${catMeta.slug}`}
            className={`section-py border-t border-border ${
              idx % 2 === 1 ? 'bg-surface/40' : ''
            }`}
          >
            <div className="container-main">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
                <div>
                  <span className="text-caption font-mono uppercase tracking-wider text-secondary block mb-1.5">
                    Category · 0{idx + 1}
                  </span>
                  <h2 className="text-h2">{catMeta.title}</h2>
                  <p className="text-small text-secondary mt-1">{catMeta.subtitle}</p>
                </div>
                <Link
                  href={`/products?category=${catMeta.slug}`}
                  className="text-small font-medium text-secondary hover:text-ink transition-colors inline-flex items-center gap-1"
                >
                  Shop all {catMeta.title}
                  <ArrowRight size={16} />
                </Link>
              </div>

              {sectionState.loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[1, 2, 3, 4].map((n) => (
                    <div
                      key={n}
                      className="h-80 rounded-2xl bg-surface border border-border animate-pulse"
                    />
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {sectionState.products.map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                  <Pagination
                    label={`${catMeta.title} Pagination`}
                    page={sectionState.pagination.page}
                    totalPages={sectionState.pagination.totalPages}
                    total={sectionState.pagination.total}
                    limit={sectionState.pagination.limit}
                    onPageChange={(nextPage) =>
                      handleCategorySectionPageChange(catMeta.slug, nextPage)
                    }
                  />
                </>
              )}
            </div>
          </section>
        );
      })}
    </>
  );
}
