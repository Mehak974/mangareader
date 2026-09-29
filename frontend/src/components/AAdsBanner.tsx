'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AD_CONFIG, siteConfig } from '@/lib/site-config';

const { aadsUnitId, aadsBgColor, aadsTitleColor } = AD_CONFIG;

export default function AAdsBanner() {
  const ref      = useRef<HTMLDivElement>(null);
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
      {/* Hilltop banner — inline alongside A-ADS, fresh impression on every nav.
          The script tag itself has zero width; Hilltop injects its own creative
          into the DOM wherever it decides. Wrapping in a 20% flex slot gives
          Hilltop a proportional container to render into. */}
      <div style={{ flex: '0 0 20%', minWidth: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <script
          key={key}
          dangerouslySetInnerHTML={{
            __html: `(function(uyhgkx){
var d = document,
    s = d.createElement('script'),
    l = d.currentScript || d.scripts[d.scripts.length - 1];
s.settings = uyhgkx || {};
s.src = "//purple-text.com/bkX/Vhs.dfGblz0pYCW/cO/qeMm_9/u/ZEUqlhk/PmTBcC0_NPz/Ip4aOaTTcstSNyzVQw3GMfj/krwSMgQr";
s.async = true;
s.referrerPolicy = 'no-referrer-when-downgrade';
l.parentNode.insertBefore(s, l);
})({})`,
          }}
        />
      </div>
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
