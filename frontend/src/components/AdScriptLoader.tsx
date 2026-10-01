'use client';

import { useEffect } from 'react';
import { usePathname }       from 'next/navigation';

const EXCLUDED_PATHS = ['/aads', '/admin', '/login', '/signup'];

// ── Hilltop Ads (served from purple-text.com) ────────────────────────────────
const HILLTOP_SRC = '//purple-text.com/c.DB9/6Cbj2W5VlOSkW-QR9/NAzQM/y/MnDiUkyTOXS/0B3SMNzDIAw-NxTgMszu';

// Module-level guard: Hilltop must load exactly once per page load, not once
// per client-side navigation. The previous implementation re-ran the effect
// on every pathname change, injected a new script each time, and only cleaned
// up the wrapper — leaving N copies of the purple-text.com script and their
// listeners in the DOM after N navigations.
let hilltopInjected = false;

export default function AdScriptLoader() {
  const pathname = usePathname();

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') return;
    if (EXCLUDED_PATHS.some(p => pathname.startsWith(p))) return;
    if (hilltopInjected) return;

    hilltopInjected = true;
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

    // Track the injected purple-text.com script so we can remove it on
    // cleanup. Without this, only the wrapper is removed and the real ad
    // script leaks across navigations.
    const injectedScript = document.querySelector(`script[src="${HILLTOP_SRC}"]`);

    return () => {
      script.remove();
      if (injectedScript) injectedScript.remove();
      // Do NOT reset hilltopInjected here. The effect now runs once per
      // page load; resetting the flag would re-inject on every navigation.
    };
  }, [pathname]);

  return null;
}
