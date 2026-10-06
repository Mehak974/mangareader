'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Routes where the popunder must never fire. `startsWith` matching, so
// '/crypto' also covers any future sub-route under it.
const EXCLUDED_PATHS = ['/aads', '/admin', '/login', '/signup', '/crypto'];

// ── Hilltop Ads (served from purple-text.com) ────────────────────────────────
const HILLTOP_SRC = '//purple-text.com/c.DB9/6Cbj2W5VlOSkW-QR9/NAzQM/y/MnDiUkyTOXS/0B3SMNzDIAw-NxTgMszu';

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
    if (process.env.NODE_ENV === 'development') return;

    if (EXCLUDED_PATHS.some(p => pathname.startsWith(p))) {
      removeHilltop();
      return;
    }

    if (hilltopInjected) return;

    hilltopInjected = true;

    // Directly create script and append to document.head.
    // Appending to document.head avoids mutating document.body where Next.js / React
    // performs streaming SSR hydration ($RS), preventing React Error #418 & parentNode errors.
    const s = document.createElement('script');
    s.src = HILLTOP_SRC;
    s.async = false;
    s.referrerPolicy = 'no-referrer-when-downgrade';

    document.head.appendChild(s);
    hilltopNode = s;
  }, [pathname]);

  return null;
}
