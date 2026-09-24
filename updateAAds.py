import re

with open('frontend/src/components/AAdsBanner.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

new_content = ''''use client';

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
        if (iframe && h) iframe.style.height = ${h}px;
      } catch { /* ignore non-json messages */ }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  if (!aadsUnitId) return null;

  let src = \https://acceptable.a-ads.com/\/?size=Adaptive\;
  if (siteConfig.profile === 'manireader.online') {
    src += '&background_color=transparent';
  } else {
    src += \&background_color=\&title_color=\&title_hover_color=\\;
  }

  return (
    <div
      id="aads-frame"
      ref={ref}
      style={{
        width: '100%',
        margin: '0 auto',
        display: 'block',
        position: 'relative',
        zIndex: 99998
      }}
    >
      <iframe
        key={key}
        data-aa={aadsUnitId}
        src={src}
        style={{
          border: 0,
          padding: 0,
          width: '70%',
          height: 'auto',
          overflow: 'hidden',
          display: 'block',
          margin: 'auto'
        }}
        title="Advertisement"
        scrolling="no"
        allow="autoplay"
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
            href={\https://aads.com/campaigns/new/?source_id=\&source_type=ad_unit&partner=\\}
          >
            Advertise here
          </a>
        </div>
      )}
    </div>
  );
}
'''

with open('frontend/src/components/AAdsBanner.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)
