import SiteHeader from './SiteHeader';

/**
 * Page shell for non-landing pages: shared header + padded content area.
 * Landing page keeps its own full-bleed layout.
 */
export default function PageFrame({ children, wide = false }) {
  return (
    <main className="min-h-screen bg-canvas">
      <SiteHeader />
      <div className="container-main pt-[72px] animate-page-enter">
        <div className={wide ? 'section-py' : 'section-py max-w-5xl'}>{children}</div>
      </div>
    </main>
  );
}

/** Small eyebrow label used above page titles ("Account", "Auth", …). */
export function Eyebrow({ children }) {
  return (
    <span className="text-caption font-mono text-secondary uppercase tracking-wider">
      {children}
    </span>
  );
}
