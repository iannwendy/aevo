'use client';

import Link from 'next/link';
import { ArrowRight, Star } from 'lucide-react';
import { FALLBACK_PRODUCT_IMAGE, formatPrice, handleImageError } from '../../lib/utils';
import { useI18n } from '../../lib/i18n';

export default function ProductCard({ product, viewMode = 'grid' }) {
  const { t, catName } = useI18n();
  if (!product) return null;

  const rawCategoryName =
    typeof product.category === 'string'
      ? product.category
      : product.category?.name || 'Hardware';
  const categoryName = catName(product.category?.slug || rawCategoryName);
  const primaryImage =
    product.image ||
    product.images?.find((i) => i.isPrimary)?.url ||
    product.images?.[0]?.url ||
    FALLBACK_PRODUCT_IMAGE;
  const displayPrice = product.price ?? product.variants?.[0]?.price ?? product.minPrice ?? 0;
  const comparePrice = product.comparePrice ?? product.variants?.[0]?.comparePrice ?? null;
  const variantCount = product.variants?.length || 0;
  const shortDesc = product.description
    ? product.description.split('\n')[0]
    : '';

  if (viewMode === 'list') {
    return (
      <article
        data-testid="product-card"
        className="group bg-surface border border-border rounded-2xl p-4 md:p-6 flex flex-col sm:flex-row gap-6 transition-all duration-300 ease-out hover:-translate-y-1 hover:border-ink/40 hover:shadow-lg animate-fade-in"
      >
        <Link
          href={`/products/${product.slug}`}
          className="relative w-full sm:w-56 aspect-[4/3] rounded-xl overflow-hidden bg-white p-4 shrink-0 block"
        >
          <img
            src={primaryImage}
            alt={product.name}
            loading="lazy"
            onError={handleImageError}
            className="w-full h-full object-contain transition-transform duration-500 ease-out group-hover:scale-[1.06]"
          />
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
            {product.isNewArrival && (
              <span className="bg-primary text-primary-foreground text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full shadow-xs animate-scale-in">
                {t('productCard.newArrival')}
              </span>
            )}
            {product.isBestSeller && (
              <span className="bg-sage text-primary-foreground text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full shadow-xs animate-scale-in">
                {t('productCard.bestSeller')}
              </span>
            )}
          </div>
        </Link>

        <div className="flex-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 text-caption font-mono text-secondary uppercase tracking-wider">
              <span>
                {categoryName} · {product.brand}
              </span>
              {product.averageRating > 0 && (
                <span className="inline-flex items-center gap-1 text-ink font-sans">
                  <Star size={13} className="fill-ink text-ink" />
                  {Number(product.averageRating).toFixed(1)}
                </span>
              )}
            </div>

            <Link href={`/products/${product.slug}`} className="block mt-1.5">
              <h3 className="text-lg font-display font-medium text-ink group-hover:text-secondary transition-colors duration-200">
                {product.name}
              </h3>
            </Link>

            {shortDesc && (
              <p className="text-small text-secondary mt-2 line-clamp-2">
                {shortDesc}
              </p>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-border flex items-center justify-between gap-4">
            <div>
              <span className="text-lg font-medium text-ink" data-testid="product-card-price">
                {formatPrice(displayPrice)}
              </span>
              {comparePrice && comparePrice > displayPrice && (
                <span className="text-small text-secondary line-through ml-2">
                  {formatPrice(comparePrice)}
                </span>
              )}
              {variantCount > 0 && (
                <span className="block text-caption text-secondary mt-0.5">
                  {variantCount}{' '}
                  {variantCount === 1
                    ? t('productCard.configurationSingular')
                    : t('productCard.configurationPlural')}
                </span>
              )}
            </div>

            <Link
              href={`/products/${product.slug}`}
              className="inline-flex items-center gap-1.5 text-small font-medium text-ink hover:text-secondary transition-all duration-200 group-hover:translate-x-1"
            >
              {t('productCard.viewProduct')}
              <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      data-testid="product-card"
      className="group bg-surface border border-border rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-ink/40 hover:shadow-lg animate-fade-in"
    >
      <div>
        <Link
          href={`/products/${product.slug}`}
          className="relative aspect-[4/3] bg-white p-4 overflow-hidden block"
        >
          <img
            src={primaryImage}
            alt={product.name}
            loading="lazy"
            onError={handleImageError}
            className="w-full h-full object-contain transition-transform duration-500 ease-out group-hover:scale-[1.06]"
          />
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
            {product.isNewArrival && (
              <span className="bg-primary text-primary-foreground text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full shadow-xs animate-scale-in">
                {t('productCard.newArrival')}
              </span>
            )}
            {product.isBestSeller && (
              <span className="bg-sage text-primary-foreground text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full shadow-xs animate-scale-in">
                {t('productCard.bestSeller')}
              </span>
            )}
          </div>
        </Link>

        <div className="p-5 pb-3">
          <div className="flex items-center justify-between gap-2 text-caption font-mono text-secondary uppercase tracking-wider">
            <span className="truncate">
              {categoryName} · {product.brand}
            </span>
            {product.averageRating > 0 && (
              <span className="inline-flex items-center gap-1 text-ink font-sans shrink-0">
                <Star size={12} className="fill-ink text-ink" />
                {Number(product.averageRating).toFixed(1)}
              </span>
            )}
          </div>

          <Link href={`/products/${product.slug}`} className="block mt-1.5">
            <h3 className="text-base font-display font-medium text-ink line-clamp-1 group-hover:text-secondary transition-colors duration-200">
              {product.name}
            </h3>
          </Link>

          {shortDesc && (
            <p className="text-caption text-secondary mt-1.5 line-clamp-2 min-h-[2rem]">
              {shortDesc}
            </p>
          )}
        </div>
      </div>

      <div className="px-5 pb-5 pt-3 border-t border-border/60 flex items-end justify-between gap-2">
        <div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-base font-medium text-ink" data-testid="product-card-price">
              {formatPrice(displayPrice)}
            </span>
            {comparePrice && comparePrice > displayPrice && (
              <span className="text-caption text-secondary line-through">
                {formatPrice(comparePrice)}
              </span>
            )}
          </div>
          {variantCount > 0 && (
            <span className="block text-[11px] text-secondary mt-0.5">
              {variantCount}{' '}
              {variantCount === 1
                ? t('productCard.variantSingular')
                : t('productCard.variantPlural')}
            </span>
          )}
        </div>

        <Link
          href={`/products/${product.slug}`}
          className="inline-flex items-center gap-1 text-caption font-medium text-ink group-hover:translate-x-1 transition-transform duration-200 shrink-0"
        >
          {t('productCard.view')}
          <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </div>
    </article>
  );
}
