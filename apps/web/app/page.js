import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface/80 backdrop-blur-md border-b border-border">
        <div className="container-main h-[72px] flex items-center justify-between">
          <Link href="/" className="text-2xl font-display font-medium tracking-tight">
            aevo.
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <Link href="/products" className="text-small font-medium hover:text-secondary transition-colors">
              Shop
            </Link>
            <Link href="/products?category=laptops" className="text-small font-medium hover:text-secondary transition-colors">
              Laptops
            </Link>
            <Link href="/products?category=components" className="text-small font-medium hover:text-secondary transition-colors">
              Components
            </Link>
            <Link href="/products?category=monitors" className="text-small font-medium hover:text-secondary transition-colors">
              Monitors
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <Link href="/products" className="text-small font-medium hover:text-secondary transition-colors">
              Search
            </Link>
            <Link href="/account/profile" className="text-small font-medium hover:text-secondary transition-colors">
              Account
            </Link>
            <Link href="/cart" className="text-small font-medium hover:text-secondary transition-colors">
              Cart
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-[72px]">
        <div className="container-main section-py">
          <div className="max-w-3xl">
            <h1 className="text-display mb-6">
              Technology, refined.
            </h1>
            <p className="text-xl text-secondary mb-8 max-w-xl">
              Discover exceptional hardware for everything you create.
            </p>
            <Link
              href="/products"
              className="inline-flex items-center gap-2 bg-ink text-white px-6 py-3 rounded-lg font-medium hover:bg-ink/90 transition-colors"
            >
              Explore collection
              <ArrowRight size={20} />
            </Link>
          </div>
        </div>
      </section>

      {/* New Arrivals Section */}
      <section className="section-py border-t border-border">
        <div className="container-main">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-h2">Discover what's next.</h2>
            <Link href="/products?sort=newest" className="text-small font-medium text-secondary hover:text-ink transition-colors flex items-center gap-1">
              View all
              <ArrowRight size={16} />
            </Link>
          </div>
          <p className="text-secondary">New products will be loaded from API</p>
        </div>
      </section>

      {/* Best Sellers Section */}
      <section className="section-py border-t border-border">
        <div className="container-main">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-h2">Chosen for performance.</h2>
            <Link href="/products?sort=best-selling" className="text-small font-medium text-secondary hover:text-ink transition-colors flex items-center gap-1">
              View all
              <ArrowRight size={16} />
            </Link>
          </div>
          <p className="text-secondary">Best seller products will be loaded from API</p>
        </div>
      </section>

      {/* Category Sections */}
      <section className="section-py border-t border-border">
        <div className="container-main">
          <h2 className="text-h2 mb-8">Find your next essential.</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Laptops */}
            <Link href="/products?category=laptops" className="group">
              <div className="aspect-[4/3] bg-canvas rounded-xl border border-border p-8 flex flex-col justify-between transition-colors group-hover:border-ink">
                <div>
                  <span className="text-caption font-mono text-secondary uppercase tracking-wider">Category</span>
                  <h3 className="text-h3 mt-2">Laptops</h3>
                </div>
                <ArrowRight className="w-6 h-6 text-secondary group-hover:text-ink transition-colors" />
              </div>
            </Link>

            {/* Components */}
            <Link href="/products?category=components" className="group">
              <div className="aspect-[4/3] bg-canvas rounded-xl border border-border p-8 flex flex-col justify-between transition-colors group-hover:border-ink">
                <div>
                  <span className="text-caption font-mono text-secondary uppercase tracking-wider">Category</span>
                  <h3 className="text-h3 mt-2">Components</h3>
                </div>
                <ArrowRight className="w-6 h-6 text-secondary group-hover:text-ink transition-colors" />
              </div>
            </Link>

            {/* Monitors */}
            <Link href="/products?category=monitors" className="group">
              <div className="aspect-[4/3] bg-canvas rounded-xl border border-border p-8 flex flex-col justify-between transition-colors group-hover:border-ink">
                <div>
                  <span className="text-caption font-mono text-secondary uppercase tracking-wider">Category</span>
                  <h3 className="text-h3 mt-2">Monitors</h3>
                </div>
                <ArrowRight className="w-6 h-6 text-secondary group-hover:text-ink transition-colors" />
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="container-main">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <Link href="/" className="text-2xl font-display font-medium">
                aevo.
              </Link>
              <p className="text-small text-secondary mt-2">
                Premium Computing, Refined.
              </p>
            </div>

            <nav className="flex gap-8">
              <Link href="/products" className="text-small text-secondary hover:text-ink transition-colors">
                Shop
              </Link>
              <Link href="/account/profile" className="text-small text-secondary hover:text-ink transition-colors">
                Account
              </Link>
              <Link href="/admin" className="text-small text-secondary hover:text-ink transition-colors">
                Admin
              </Link>
            </nav>
          </div>

          <div className="mt-12 pt-8 border-t border-border text-small text-secondary">
            © 2025 AEVO. All rights reserved.
          </div>
        </div>
      </footer>
    </main>
  );
}
