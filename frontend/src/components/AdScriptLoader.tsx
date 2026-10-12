'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Routes where the popunder must never fire.
// Strictly blocks /aads, /aads300, /mangaread-sticky, /mangaread-300, and admin routes.
const EXCLUDED_PATHS = ['/aads', '/aads300', '/mangaread-sticky', '/mangaread-300', '/admin', '/login', '/signup'];

// ── Hilltop Ads (served from purple-text.com) per domain ─────────────────────
const MANGAREADER_POPUNDER = '//purple-text.com/c-DC9b6-b.2a5qlISnWTQs9VNZzqMVyYMED/UpygODSX0V3NMGzeIIw/NuT/M_zZ';
const MANGAREAD_POPUNDER    = '//purple-text.com/cyDP9.6nbb2R5-lxS/WBQU9ONdzVMNyENjTgU/zAMXyy0J3nMczdIh1INwTuMl3F';

function getPopunderSrc(): string {
  if (typeof window !== 'undefined') {
    const h = window.location.hostname.toLowerCase();
    if (h.includes('mangaread.pro')) {
      return MANGAREAD_POPUNDER;
    }
  }
  return MANGAREADER_POPUNDER;
}

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
      s.src = getPopunderSrc();
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
