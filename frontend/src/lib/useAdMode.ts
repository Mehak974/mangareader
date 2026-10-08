'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

function getOrUpdateAdMode(pathname: string | null): 'sticky' | 'inline' {
  if (!pathname) return 'sticky';
  // Only allow 300x250 on /crypto. Everywhere else: 100% sticky banner.
  if (pathname === '/crypto' || pathname.startsWith('/crypto/')) return 'inline';
  return 'sticky';
}

export function useAdMode(): 'sticky' | 'inline' {
  const pathname = usePathname();
  const [adMode, setAdMode] = useState<'sticky' | 'inline'>(() => getOrUpdateAdMode(pathname));

  useEffect(() => {
    setAdMode(getOrUpdateAdMode(pathname));
  }, [pathname]);

  return adMode;
}
