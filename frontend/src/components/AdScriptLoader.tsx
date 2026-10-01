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
//
// The guard prevents re-injection. The cleanup does NOT remove the ad
// scripts — they are meant to persist across client-side navigations
// (that's the whole point of a popunder ad). Removing them on every route
// change killed the popunder after the first navigation.
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

    // Intentionally no cleanup. The Hilltop popunder is meant to persist
    // across client-side navigations. Removing the scripts on every route
    // change (which is what the old cleanup did) killed the popunder after
    // the first navigation, while the module-level guard prevented
    // re-injection — a net loss of the ad entirely.
  }, [pathname]);

  return null;
}
