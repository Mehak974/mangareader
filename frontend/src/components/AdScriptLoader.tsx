'use client';

import { useEffect, useRef } from 'react';
import { usePathname }       from 'next/navigation';
import { siteConfig } from '@/lib/site-config';

const EXCLUDED_PATHS = ['/aads', '/admin', '/login', '/signup'];

// ── Hilltop Ads (served from purple-text.com) — one script per domain ────────
const HILLTOP_SCRIPTS: Record<string, string> = {
  'mangaread.pro':    '//purple-text.com/c.D-9x6wbe2/5il/SWW_QJ9iN/z/Q/0lNIDIQy2XO/SE0K3RNxD/Q/0lNeDncGzt',
  'mangareader.pro':  '//purple-text.com/cJD.9/6tbA2q5ClCSeWGQl9uNYzGMJyVMlDrU/y/OkS_0/3gMVzHI/wNNATwMEzV',
  'manireader.online':'//purple-text.com/c.DT9/6/b/2A5gl/SmWFQo9/NjzqQ/0wNkDwQf2VMkSl0/3RNDDuQT0YNBD/Y/1j',
};

export default function AdScriptLoader() {
  const pathname = usePathname();
  const loaded   = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') return;
    if (EXCLUDED_PATHS.some(p => pathname.startsWith(p))) return;
    if (loaded.current) return;

    const src = HILLTOP_SCRIPTS[siteConfig.profile];
    if (!src) return;

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
        s.src = "${src}";
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
