'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Bottom Hilltop banner — re-injects the purple-text.com script on every
 * client-side navigation so Hilltop serves a new creative impression.
 *
 * Renders a visible container div that Hilltop's injected script can
 * populate. The script tag is appended to this container, giving Hilltop a
 * clear insertion point instead of relying on `document.body`.
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