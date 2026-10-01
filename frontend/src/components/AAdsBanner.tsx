'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AD_CONFIG, siteConfig } from '@/lib/site-config';

const { aadsUnitId, aadsBgColor, aadsTitleColor } = AD_CONFIG;

function AAdsBannerInner({ style }: { style?: React.CSSProperties }) {
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
        margin: '0 auto',
        position: 'relative',
        textAlign: 'center',
        ...style
      }}
    >
      <iframe
        key={key}
        data-aa={aadsUnitId}
        src={src}
        style={{
          border: 0,
          padding: 0,
          width: '100%',
          maxWidth: '728px',
          height: '90px',
          minHeight: '90px',
          overflow: 'hidden',
          display: 'inline-block',
          verticalAlign: 'top'
        }}
        title="Advertisement"
        scrolling="no"
        allow="autoplay"
      />
      {siteConfig.profile === 'manireader.online' && (
        <div style={{ width: '100%', maxWidth: '728px', margin: '4px auto 0', textAlign: 'center' }}>
          <a
            target="_blank"
            style={{
              display: 'inline-block',
              fontSize: '13px',
              color: '#263238',
              padding: '4px 10px',
              background: '#F8F8F9',
              textDecoration: 'none',
              borderRadius: '4px'
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

export default function AAdsBanner({ hideOnReader = false, style = {} }) {
  const pathname = usePathname();
  
  // Hide on reader pages if requested (reader page has its own banner in footer)
  if (hideOnReader && pathname?.startsWith('/reader/')) return null;
  
  return <AAdsBannerInner style={style} />;
}