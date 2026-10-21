import Link from 'next/link';

/**
 * Shared site header. Fixed to the top, frosted surface - pages that use it
 * must start their content below the 72px bar (see `.pt-[72px]`).
 *
 * Server component: no interactivity needed for Phase 1.
 */
const NAV_LINKS = [
  { href: '/products', label: 'Shop' },
  { href: '/products?category=laptops', label: 'Laptops' },
  { href: '/products?category=components', label: 'Components' },
  { href: '/products?category=monitors', label: 'Monitors' },
];

const ACTION_LINKS = [
  { href: '/products', label: 'Search' },
  { href: '/account/profile', label: 'Account' },
  { href: '/cart', label: 'Cart' },
];

export default function SiteHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface/80 backdrop-blur-md border-b border-border">
      <div className="container-main h-[72px] flex items-center justify-between">
        <Link
          href="/"
          className="text-2xl font-display font-medium tracking-tight focus-ring rounded-lg"
        >
          aevo.
        </Link>

        <nav className="hidden md:flex items-center gap-8" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-small font-medium hover:text-secondary transition-colors focus-ring rounded"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          {ACTION_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-small font-medium hover:text-secondary transition-colors focus-ring rounded"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
