'use client';

import { useEffect, useRef } from 'react';
import { usePathname }       from 'next/navigation';

const EXCLUDED_PATHS = ['/aads', '/admin', '/login', '/signup'];

// ── Hilltop Ads (served from purple-text.com) ────────────────────────────────
const HILLTOP_SRC = '//purple-text.com/c.DB9/6Cbj2W5VlOSkW-QR9/NAzQM/y/MnDiUkyTOXS/0B3SMNzDIAw-NxTgMszu';

export default function AdScriptLoader() {
  const pathname = usePathname();
  const loaded   = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') return;
    if (EXCLUDED_PATHS.some(p => pathname.startsWith(p))) return;
    if (loaded.current) return;

    loaded.current = true;
    const script = document.createElement('script');

    // textContent, not innerHTML: scripts inserted via innerHTML are not
    // executed by the browser. This snippet then creates its own src-based
    // script (purple-text.com) and inserts it before itself.
    script.textContent = `
      (function(ht){
        var d = document,
            s = d.createElement('script'),
            l = d.currentScript || d.scripts[d.scripts.length - 1];
        s.settings = ht || {};
        s.src = "${HILLTOP_SRC}";
        s.async = true;
        s.referrerPolicy = 'no-referrer-when-downgrade';
        l.parentNode.insertBefore(s, l);
      })({})
    `;
    document.body.appendChild(script);

    return () => {
      script.remove();
      loaded.current = false;
    };
  }, [pathname]);

  return null;
}
