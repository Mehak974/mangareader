'use client';

import { useEffect } from 'react';
import { usePathname }       from 'next/navigation';

// Routes where the popunder must never fire. `startsWith` matching, so
// '/crypto' also covers any future sub-route under it. /crypto is a long
// reference page, and a popunder stealing focus partway through it loses the
// reader for good.
const EXCLUDED_PATHS = ['/aads', '/admin', '/login', '/signup', '/crypto'];

// ── Hilltop Ads (served from purple-text.com) ────────────────────────────────
const HILLTOP_SRC = '//purple-text.com/c.DB9/6Cbj2W5VlOSkW-QR9/NAzQM/y/MnDiUkyTOXS/0B3SMNzDIAw-NxTgMszu';

// Module-level guard: Hilltop must load exactly once per page load, not once
// per client-side navigation. The previous implementation re-ran the effect
// on every pathname change, injected a new script each time, and only cleaned
// up the wrapper — leaving N copies of the purple-text.com script and their
// listeners in the DOM after N navigations.
//
// The guard prevents re-injection. Cleanup does NOT remove the ad scripts on
// ordinary navigations — they are meant to persist across client-side
// navigations (that's the whole point of a popunder ad). The one exception
// is the excluded routes below: entering one tears the popunder down so it
// can never fire there, and leaving one re-arms injection so it works again
// on the next allowed page.
let hilltopInjected = false;
let hilltopNodes: HTMLScriptElement[] = [];

function removeHilltop() {
  for (const node of hilltopNodes) {
    try { node.remove(); } catch { /* already gone */ }
  }
  hilltopNodes = [];
  hilltopInjected = false;
}

export default function AdScriptLoader() {
  const pathname = usePathname();

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') return;

    if (EXCLUDED_PATHS.some(p => pathname.startsWith(p))) {
      // Popunder must never be active on these routes. If it was
      // injected on an earlier allowed page, tear it down now and
      // allow re-injection when the user returns to an allowed page.
      removeHilltop();
      return;
    }

    if (hilltopInjected) return;

    hilltopInjected = true;
    const wrapper = document.createElement('script');

    // textContent, not innerHTML: scripts inserted via innerHTML are not
    // executed by the browser. This snippet then creates its own src-based
    // script (purple-text.com) and inserts it before itself.
    wrapper.textContent = `
      (function(ht){
        var d = document,
            s = d.createElement('script'),
            l = d.currentScript || d.scripts[d.scripts.length - 1];
        s.settings = ht || {};
        s.src = "${HILLTOP_SRC}";
        s.async = false;
        s.referrerPolicy = 'no-referrer-when-downgrade';
        l.parentNode.insertBefore(s, l);
      })({})
    `;
    document.body.appendChild(wrapper);

    // The inline snippet runs synchronously on append, so the
    // purple-text.com script it inserts is already the wrapper's
    // previous sibling. Track both so an excluded route can tear the
    // whole popunder down.
    const srcScript = wrapper.previousElementSibling;
    hilltopNodes =
      srcScript && srcScript.tagName === 'SCRIPT'
        ? [wrapper, srcScript as HTMLScriptElement]
        : [wrapper];

    // No cleanup on ordinary navigations: the Hilltop popunder is meant
    // to persist across client-side route changes. Only the excluded-route
    // branch above removes it.
  }, [pathname]);

  return null;
}
