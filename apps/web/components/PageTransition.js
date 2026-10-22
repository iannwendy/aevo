'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Global page-load progress bar and route transition wrapper.
 * Provides a top progress sweep on initial load and route navigation,
 * plus a smooth fade-in container without creating a transform containing block
 * that would interfere with fixed headers.
 */
export default function PageTransition({ children }) {
  const pathname = usePathname();
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    setAnimKey((k) => k + 1);
  }, [pathname]);

  return (
    <div data-testid="page-transition-wrapper" className="animate-fade-in">
      <div
        key={animKey}
        data-testid="page-load-progress"
        aria-hidden="true"
        className="fixed top-0 left-0 right-0 h-[2.5px] bg-primary origin-left z-[100] pointer-events-none animate-progress-sweep"
      />
      {children}
    </div>
  );
}
