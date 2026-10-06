'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

let currentPagePath: string | null = null;
let currentAdMode: 'sticky' | 'inline' = 'sticky';

function getOrUpdateAdMode(pathname: string | null): 'sticky' | 'inline' {
  if (!pathname) return 'sticky';
  // Deterministic per-route assignments. Checked before the window
  // guard so they hold during SSR too — otherwise the server HTML
  // renders the default 'sticky' and the ad unit flashes/swaps when
  // hydration flips the mode.
  if (pathname === '/aads' || pathname.startsWith('/aads/')) return 'sticky';
  if (pathname === '/crypto' || pathname.startsWith('/crypto/')) return 'inline';
  // Everywhere else: 80/20 inline/sticky split, stable per
  // page path. 300x250 in-flow units carry the majority of
  // impressions; the sticky 728x90 keeps a minority of traffic.
  if (typeof window === 'undefined') return 'sticky';
  if (pathname !== currentPagePath) {
    currentPagePath = pathname;
    currentAdMode = Math.random() < 0.2 ? 'sticky' : 'inline';
  }
  return currentAdMode;
}

export function useAdMode(): 'sticky' | 'inline' {
  const pathname = usePathname();
  const [adMode, setAdMode] = useState<'sticky' | 'inline'>(() => getOrUpdateAdMode(pathname));

  useEffect(() => {
    setAdMode(getOrUpdateAdMode(pathname));
  }, [pathname]);

  return adMode;
}
