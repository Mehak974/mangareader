'use client';

import { useEffect, useRef } from 'react';
import { usePathname }       from 'next/navigation';
import { POP_ADS_ENABLED, siteConfig } from '@/lib/site-config';

const EXCLUDED_PATHS = ['/aads', '/admin', '/login', '/signup'];

export default function AdScriptLoader() {
  const pathname = usePathname();
  const loaded   = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') return;
    if (EXCLUDED_PATHS.some(p => pathname.startsWith(p))) return;
    if (loaded.current) return;

    let scriptContent = '';

    if (siteConfig.profile === 'manireader.online') {
      scriptContent = 
        (function(ised){
        var d = document,
            s = d.createElement('script'),
            l = d.currentScript || d.scripts[d.scripts.length - 1];
        s.settings = ised || {};
        s.src = "//purple-text.com/c.DT9/6/b/2A5gl/SmWFQo9/NjzqQ/0wNkDwQf2VMkSl0/3RNDDuQT0YNBD/Y/1j";
        s.async = true;
        s.referrerPolicy = 'no-referrer-when-downgrade';
        l.parentNode.insertBefore(s, l);
        })({})
      ;
    } else if (siteConfig.profile === 'mangaread.pro') {
      scriptContent = 
        (function(jkfsm){
        var d = document,
            s = d.createElement('script'),
            l = d.currentScript || d.scripts[d.scripts.length - 1];
        s.settings = jkfsm || {};
        s.src = "//purple-text.com/c.D-9x6wbe2/5il/SWW_QJ9iN/z/Q/0lNIDIQy2XO/SE0K3RNxD/Q/0lNeDncGzt";
        s.async = true;
        s.referrerPolicy = 'no-referrer-when-downgrade';
        l.parentNode.insertBefore(s, l);
        })({})
      ;
    } else {
      // mangareader.pro (default)
      scriptContent = 
        (function(xceo){
        var d = document,
            s = d.createElement('script'),
            l = d.currentScript || d.scripts[d.scripts.length - 1];
        s.settings = xceo || {};
        s.src = "//purple-text.com/cJD.9/6tbA2q5ClCSeWGQl9uNYzGMJyVMlDrU/y/OkS_0/3gMVzHI/wNNATwMEzV";
        s.async = true;
        s.referrerPolicy = 'no-referrer-when-downgrade';
        l.parentNode.insertBefore(s, l);
        })({})
      ;
    }

    loaded.current = true;
    const script = document.createElement('script');
    script.innerHTML = scriptContent;
    document.body.appendChild(script);

    return () => {
      script.remove();
      loaded.current = false;
    };
  }, [pathname]);

  return null;
}

