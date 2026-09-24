/**
 * AdScriptLoader.tsx — Domain-aware pop-ads / inline ad script loader
 *
 * Replaces the hardcoded AdScriptLoader.js.
 * Pop-ads key and any other per-domain script URLs come from site-config.ts.
 *
 * Each domain can have a different pop-ads partner / script URL
 * by setting NEXT_PUBLIC_POP_ADS_KEY in its Vercel environment variables.
 *
 * Replace:  src/components/AdScriptLoader.js
 * With:     this file (src/components/AdScriptLoader.tsx)
 */

'use client';

import { useEffect, useRef } from 'react';
import { usePathname }       from 'next/navigation';
import { POP_ADS_ENABLED, AD_CONFIG } from '@/lib/site-config';

// Per-domain pop-ads script URLs.
// Key is NEXT_PUBLIC_POP_ADS_KEY value; value is the full script src.
// Add new entries as you sign up for more networks.
const POP_ADS_SCRIPTS: Record<string, string> = {
  // mangareader.pro — purple-text popads (existing)
  'mangareader_pro': 'https://purple-text.com/c.DI9m6_bw2t5/l/S/WzQH9tNNzrMVysMeDqUiyMOUSN0_3/M/z/IuwNNaTSMwzb',
  // mangaread.pro — set NEXT_PUBLIC_POP_ADS_KEY=mangaread_pro and add the real URL below
  'mangaread_pro': '',
  // manireader.online — set NEXT_PUBLIC_POP_ADS_KEY=manireader and add the real URL below
  'manireader': '',
};

const EXCLUDED_PATHS = ['/aads', '/admin', '/login', '/signup'];

export default function AdScriptLoader() {
  const pathname = usePathname();
  const loaded   = useRef(false);

  useEffect(() => {
    if (!POP_ADS_ENABLED) return;
    if (EXCLUDED_PATHS.some(p => pathname.startsWith(p))) return;
    if (loaded.current) return;

    const scriptSrc = POP_ADS_SCRIPTS[AD_CONFIG.popAdsKey] || '';
    if (!scriptSrc) return;

    loaded.current = true;
    const script   = document.createElement('script');

    // Propeller / popads style IIFE loader
    script.innerHTML = `
      (function(twvsf){
        var d = document,
            s = d.createElement('script'),
            l = d.scripts[d.scripts.length - 1];
        s.settings = twvsf || {};
        s.src = "${scriptSrc}";
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
