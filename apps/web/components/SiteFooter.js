import Link from 'next/link';

/**
 * Shared site footer. Server component: no interactivity needed for Phase 1.
 */
export default function SiteFooter() {
  return (
    <footer className="border-t border-border py-12">
      <div className="container-main">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <Link href="/" className="text-2xl font-display font-medium focus-ring rounded-lg">
              aevo.
            </Link>
            <p className="text-small text-secondary mt-2">
              Premium Computing, Refined.
            </p>
          </div>

          <nav className="flex gap-8" aria-label="Footer">
            <Link
              href="/products"
              className="text-small text-secondary hover:text-ink transition-colors focus-ring rounded"
            >
              Shop
            </Link>
            <Link
              href="/account/profile"
              className="text-small text-secondary hover:text-ink transition-colors focus-ring rounded"
            >
              Account
            </Link>
            <Link
              href="/admin"
              className="text-small text-secondary hover:text-ink transition-colors focus-ring rounded"
            >
              Admin
            </Link>
          </nav>
        </div>

        <div className="mt-12 pt-8 border-t border-border text-small text-secondary">
          © {new Date().getFullYear()} AEVO. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
