'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

let currentPagePath: string | null = null;
let currentAdMode: 'sticky' | 'inline' = 'sticky';

function getOrUpdateAdMode(pathname: string | null): 'sticky' | 'inline' {
  if (!pathname) return 'sticky';
  // Deterministic per-route assignments
  if (pathname === '/aads' || pathname.startsWith('/aads/')) return 'sticky';
  if (pathname === '/aads300' || pathname.startsWith('/aads300/')) return 'inline';

  // Everywhere else: 50/50 inline/sticky split, stable per page path
  if (typeof window === 'undefined') return 'sticky';
  if (pathname !== currentPagePath) {
    currentPagePath = pathname;
    currentAdMode = Math.random() < 0.5 ? 'sticky' : 'inline';
  }
  return currentAdMode;
}

export function useAdMode(): 'sticky' | 'inline' {
  const pathname = usePathname();
  // Always initialize to 'sticky' to match SSR HTML and eliminate hydration mismatches
  const [adMode, setAdMode] = useState<'sticky' | 'inline'>('sticky');

  useEffect(() => {
    setAdMode(getOrUpdateAdMode(pathname));
  }, [pathname]);

  return adMode;
}

