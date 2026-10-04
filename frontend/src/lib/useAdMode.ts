'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

let currentPagePath: string | null = null;
let currentAdMode: 'sticky' | 'inline' = 'sticky';

function getOrUpdateAdMode(pathname: string | null): 'sticky' | 'inline' {
  if (typeof window === 'undefined' || !pathname) return 'sticky';
  if (pathname === '/aads' || pathname.startsWith('/aads/')) return 'sticky';
  if (pathname !== currentPagePath) {
    currentPagePath = pathname;
    currentAdMode = Math.random() < 0.5 ? 'sticky' : 'inline';
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
