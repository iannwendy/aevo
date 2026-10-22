'use client';

import Link from 'next/link';
import { useI18n } from '../lib/i18n';

/**
 * Shared site footer with ENG/VIE localization.
 */
export default function SiteFooter() {
  const { t } = useI18n();

  return (
    <footer className="border-t border-border py-12" data-testid="site-footer">
      <div className="container-main">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <Link href="/" className="text-2xl font-display font-medium focus-ring rounded-lg">
              aevo.
            </Link>
            <p className="text-small text-secondary mt-2">
              {t('footer.tagline')}
            </p>
          </div>

          <nav className="flex gap-8" aria-label="Footer">
            <Link
              href="/products"
              className="text-small text-secondary hover:text-ink transition-colors focus-ring rounded"
            >
              {t('footer.shop')}
            </Link>
            <Link
              href="/account/profile"
              className="text-small text-secondary hover:text-ink transition-colors focus-ring rounded"
            >
              {t('footer.account')}
            </Link>
            <Link
              href="/admin"
              className="text-small text-secondary hover:text-ink transition-colors focus-ring rounded"
            >
              {t('footer.admin')}
            </Link>
          </nav>
        </div>

        <div className="mt-12 pt-8 border-t border-border text-small text-secondary">
          {t('footer.rights', { year: new Date().getFullYear() })}
        </div>
      </div>
    </footer>
  );
}
