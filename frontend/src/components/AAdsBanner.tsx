'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AD_CONFIG, siteConfig } from '@/lib/site-config';

const { aadsUnitId, aadsBgColor, aadsTitleColor } = AD_CONFIG;

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

export default function AAdsBanner() {
  const ref      = useRef<HTMLDivElement>(null);
  const hilltopRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const [key, setKey] = useState(0);

  // Fire a fresh impression on every client-side navigation
  useEffect(() => { setKey(k => k + 1); }, [pathname]);

  // Listen for dynamic height updates from the iframe
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        const h    = data?.height ?? data?.h;
        const iframe = ref.current?.querySelector('iframe');
        if (iframe && h) iframe.style.height = `${h}px`;
      } catch { /* ignore non-json messages */ }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Hilltop banner — re-inject on every nav.
  // Uses textContent on a script element (executed) NOT innerHTML (ignored).
  useEffect(() => {
    const container = hilltopRef.current;
    if (!container) return;

    // Clear previous banner so Hilltop serves a new creative
    container.innerHTML = '';
    injectHilltop(container);
  }, [key]);

  if (!aadsUnitId) return null;

  let src = `//acceptable.a-ads.com/${aadsUnitId}/?size=Adaptive`;
  if (siteConfig.profile === 'manireader.online') {
    src += '&background_color=transparent';
  } else if (siteConfig.profile === 'mangareader.pro') {
    src += `&background_color=${aadsBgColor}&title_color=${aadsTitleColor}&title_hover_color=${aadsTitleColor}`;
  }

  return (
    <div
      id="frame"
      ref={ref}
      style={{
        width: '100%',
        margin: 'auto',
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        gap: '8px',
        flexWrap: 'wrap',
      }}
    >
      <iframe
        key={key}
        data-aa={aadsUnitId}
        src={src}
        style={{
          border: 0,
          padding: 0,
          width: '80%',
          height: 'auto',
          overflow: 'hidden',
          display: 'block',
          margin: 'auto',
          flex: '0 0 auto',
        }}
        title="Advertisement"
        scrolling="no"
        allow="autoplay"
      />
      {/* Hilltop banner — 20% slot alongside A-ADS, fresh impression on every nav.
          The script is appended via createElement + textContent so the browser
          actually executes it. */}
      <div
        ref={hilltopRef}
        style={{
          flex: '0 0 20%',
          minWidth: '120px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      />
      {siteConfig.profile === 'manireader.online' && (
        <div style={{ width: '70%', margin: 'auto', position: 'absolute', left: 0, right: 0 }}>
          <a
            target="_blank"
            style={{
              display: 'inline-block',
              fontSize: '13px',
              color: '#263238',
              padding: '4px 10px',
              background: '#F8F8F9',
              textDecoration: 'none',
              borderRadius: '0 0 4px 4px'
            }}
            id="frame-link"
            href={`https://aads.com/campaigns/new/?source_id=${aadsUnitId}&source_type=ad_unit&partner=${aadsUnitId}`}
          >
            Advertise here
          </a>
        </div>
      )}
    </div>
  );
}