'use client';

import { useEffect } from 'react';
import { useApp } from '@/context/AppContext';

// Spillover destination: mangaread.pro
const TARGET_DOMAIN = 'mangaread.pro';

// Spillover rate: ~12% of traffic (~1,000 unique daily visitors out of 8,500)
const SPILLOVER_RATE = 0.12;

export default function MirrorSpillover() {
  const { isLoggedIn, user } = useApp() || {};

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Only run on mangareader.pro
    const host = window.location.hostname.toLowerCase();
    if (!host.includes('mangareader.pro')) return;

    // 2. Unlogged-in users only — if user is logged in or has session cookie, never redirect
    if (isLoggedIn || user || document.cookie.includes('mr_session=')) return;

    // 3. Assign 12% cohort (~1,000 users/day) via localStorage
    let isSpilloverUser = false;
    try {
      let cohort = localStorage.getItem('mr:spillover_cohort');
      if (!cohort) {
        cohort = Math.random() < SPILLOVER_RATE ? 'mangaread' : 'none';
        localStorage.setItem('mr:spillover_cohort', cohort);
      }
      isSpilloverUser = cohort === 'mangaread';
    } catch {
      return;
    }

    if (!isSpilloverUser) return;

    // 4. Intercept clicks on internal manga links, browse, and reader
    const handleActionClick = (e: MouseEvent) => {
      // Allow browser shortcuts (Cmd/Ctrl click, right-click, etc.)
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

      const target = e.target as HTMLElement | null;
      const anchor = target?.closest('a') as HTMLAnchorElement | null;
      if (!anchor || !anchor.href) return;

      try {
        const url = new URL(anchor.href, window.location.origin);
        // Ensure it's internal to mangareader.pro
        if (url.origin !== window.location.origin) return;

        const p = url.pathname.toLowerCase();
        // Check if user is clicking to browse or read manga
        if (
          p.startsWith('/manga') ||
          p.startsWith('/browse') ||
          p.startsWith('/reader') ||
          p.startsWith('/series')
        ) {
          e.preventDefault();
          e.stopPropagation();
          // Navigate to mangaread.pro with exact same path & query parameters
          window.location.href = `https://${TARGET_DOMAIN}${url.pathname}${url.search}`;
        }
      } catch {}
    };

    document.addEventListener('click', handleActionClick, true);
    return () => document.removeEventListener('click', handleActionClick, true);
  }, [isLoggedIn, user]);

  return null;
}
