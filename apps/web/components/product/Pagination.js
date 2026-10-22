'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '../../lib/i18n';

/**
 * Reusable Pagination component.
 *
 * Per requirement.md Section II.3:
 * "The pagination feature must function everywhere that product lists are displayed.
 *  It should show the page numbers, even if there is only one page."
 */
export default function Pagination({
  page = 1,
  totalPages = 1,
  total,
  limit = 12,
  onPageChange,
  label = 'Pagination',
  itemLabel,
}) {
  const { t } = useI18n();
  const resolvedItemLabel = itemLabel || t('pagination.products');
  const safeTotalPages = Math.max(1, Number(totalPages) || 1);
  const currentPage = Math.min(Math.max(1, Number(page) || 1), safeTotalPages);

  const pages = [];
  for (let i = 1; i <= safeTotalPages; i++) {
    pages.push(i);
  }

  const handleSelect = (targetPage) => {
    if (targetPage < 1 || targetPage > safeTotalPages || targetPage === currentPage) return;
    if (onPageChange) onPageChange(targetPage);
  };

  return (
    <nav
      aria-label={label}
      data-testid="pagination"
      className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-border"
    >
      <div className="text-small text-secondary">
        {typeof total === 'number' ? (
          <span>
            {t('pagination.showing')}{' '}
            <strong className="font-medium text-ink">
              {total === 0 ? 0 : (currentPage - 1) * limit + 1}
            </strong>
            –
            <strong className="font-medium text-ink">
              {Math.min(currentPage * limit, total)}
            </strong>{' '}
            {t('pagination.of')} <strong className="font-medium text-ink">{total}</strong>{' '}
            {resolvedItemLabel}
          </span>
        ) : (
          <span>
            {t('pagination.page')} <strong className="font-medium text-ink">{currentPage}</strong>{' '}
            {t('pagination.of')} <strong className="font-medium text-ink">{safeTotalPages}</strong>
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <button
          type="button"
          onClick={() => handleSelect(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label={t('pagination.prevAria')}
          className="inline-flex items-center gap-1 px-2.5 sm:px-3 h-9 sm:h-10 rounded-lg border border-border bg-surface text-small font-medium text-ink disabled:opacity-40 disabled:cursor-not-allowed hover:bg-canvas transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 disabled:hover:translate-y-0 disabled:active:scale-100"
        >
          <ChevronLeft size={16} />
          <span className="hidden sm:inline">{t('pagination.prev')}</span>
        </button>

        {pages.map((p) => {
          const isCurrent = p === currentPage;
          return (
            <button
              key={p}
              type="button"
              onClick={() => handleSelect(p)}
              aria-current={isCurrent ? 'page' : undefined}
              data-testid={`pagination-page-${p}`}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg text-small font-medium transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ${
                isCurrent
                  ? 'bg-primary text-primary-foreground border border-primary shadow-sm'
                  : 'bg-surface text-ink border border-border hover:bg-canvas'
              }`}
            >
              {p}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => handleSelect(currentPage + 1)}
          disabled={currentPage >= safeTotalPages}
          aria-label={t('pagination.nextAria')}
          className="inline-flex items-center gap-1 px-2.5 sm:px-3 h-9 sm:h-10 rounded-lg border border-border bg-surface text-small font-medium text-ink disabled:opacity-40 disabled:cursor-not-allowed hover:bg-canvas transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 disabled:hover:translate-y-0 disabled:active:scale-100"
        >
          <span className="hidden sm:inline">{t('pagination.next')}</span>
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  );
}
