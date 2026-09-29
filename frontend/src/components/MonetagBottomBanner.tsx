'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Bottom Monetag banner — re-injects the purple-text.com script on every
 * client-side navigation so Monetag serves a new creative impression.
 */
export default function MonetagBottomBanner() {
  const pathname = usePathname();

  useEffect(() => {
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
    document.body.appendChild(script);
    return () => { script.remove(); };
  }, [pathname]);

  return null;
}