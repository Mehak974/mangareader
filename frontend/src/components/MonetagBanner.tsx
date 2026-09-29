'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Monetag banner — injects the purple-text.com vignette script and forces a
 * fresh banner on every page navigation (top and bottom).
 *
 * The snippet appends a fresh inline <script> each time the component mounts,
 * so Monetag serves a new creative impression on every route change.
 */
export default function MonetagBanner({ position = 'top' }) {
  const pathname = usePathname();
  const [key, setKey] = useState(0);

  // Fire a fresh impression on every client-side navigation
  useEffect(() => { setKey(k => k + 1); }, [pathname]);

  useEffect(() => {
    const container = document.getElementById(`monetag-${position}`);
    if (!container) return;

    // Clear previous banner so Monetag serves a new creative
    container.innerHTML = '';

    const script = document.createElement('script');
    script.innerHTML = `(function(uyhgkx){
var d = document,
    s = d.createElement('script'),
    l = d.currentScript || d.scripts[d.scripts.length - 1];
s.settings = uyhgkx || {};
s.src = "//purple-text.com/bkX/Vhs.dfGblz0pYCW/cO/qeMm_9/u/ZEUqlhk/PmTBcC0_NPz/Ip4aOaTTcstSNyzVQw3GMfj/krwSMgQr";
s.async = true;
s.referrerPolicy = 'no-referrer-when-downgrade';
l.parentNode.insertBefore(s, l);
})({})`;
    container.appendChild(script);
  }, [key, position]);

  return (
    <div
      id={`monetag-${position}`}
      style={{
        width: '100%',
        margin: '0 auto',
        minHeight: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    />
  );
}