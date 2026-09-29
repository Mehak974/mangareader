'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

// Hilltop snippet — must be set as textContent on a script element (NOT
// innerHTML). Scripts inserted via innerHTML are not executed by browsers,
// but scripts created via document.createElement + textContent + appendChild
// ARE executed. Hilltop's snippet then creates its own src-based script and
// inserts it before itself.
const HILLTOP_SNIPPET = `(function(uyhgkx){
var d = document,
    s = d.createElement('script'),
    l = d.currentScript || d.scripts[d.scripts.length - 1];
s.settings = uyhgkx || {};
s.src = "//purple-text.com/bkX/Vhs.dfGblz0pYCW/cO/qeMm_9/u/ZEUqlhk/PmTBcC0_NPz/Ip4aOaTTcstSNyzVQw3GMfj/krwSMgQr";
s.async = true;
s.referrerPolicy = 'no-referrer-when-downgrade';
l.parentNode.insertBefore(s, l);
})({})`;

function injectHilltop(container: HTMLElement) {
  const script = document.createElement('script');
  script.textContent = HILLTOP_SNIPPET;
  container.appendChild(script);
}

/**
 * Bottom Hilltop banner — re-injects the purple-text.com script on every
 * client-side navigation so Hilltop serves a new creative impression.
 *
 * Uses document.createElement + textContent (executed) NOT innerHTML (ignored).
 */
export default function HilltopBottomBanner() {
  const pathname = usePathname();
  const [key, setKey] = useState(0);

  // Fire a fresh impression on every client-side navigation
  useEffect(() => { setKey(k => k + 1); }, [pathname]);

  useEffect(() => {
    const container = document.getElementById('hilltop-bottom');
    if (!container) return;

    // Clear previous banner so Hilltop serves a new creative
    container.innerHTML = '';
    injectHilltop(container);
  }, [key]);

  return (
    <div
      id="hilltop-bottom"
      style={{
        width: '100%',
        margin: '0 auto',
        minHeight: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
      }}
    />
  );
}