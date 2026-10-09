'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Routes where the popunder must never fire.
// Strictly blocks /aads, /aads300, and admin routes.
const EXCLUDED_PATHS = ['/aads', '/aads300', '/admin', '/login', '/signup'];

// ── Hilltop Ads (served from purple-text.com) ────────────────────────────────
const HILLTOP_SRC = '//purple-text.com/c-DC9b6-b.2a5qlISnWTQs9VNZzqMVyYMED/UpygODSX0V3NMGzeIIw/NuT/M_zZ';

let hilltopInjected = false;
let hilltopNode: HTMLScriptElement | null = null;

function removeHilltop() {
  if (hilltopNode) {
    try { hilltopNode.remove(); } catch { /* already gone */ }
    hilltopNode = null;
  }
  hilltopInjected = false;
}

export default function AdScriptLoader() {
  const pathname = usePathname();

  useEffect(() => {
    if (EXCLUDED_PATHS.some((p) => pathname.startsWith(p))) {
      removeHilltop();
      return;
    }

    if (hilltopInjected) return;

    hilltopInjected = true;

    // Directly create script and append to document.head.
    const inject = () => {
      const s = document.createElement('script');
      (s as any).settings = {};
      s.src = HILLTOP_SRC;
      s.async = true;
      s.referrerPolicy = 'no-referrer-when-downgrade';
      s.onerror = () => {
        removeHilltop();
      };

      document.head.appendChild(s);
      hilltopNode = s;
    };

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(inject);
    } else {
      setTimeout(inject, 200);
    }
  }, [pathname]);

  return null;
}
