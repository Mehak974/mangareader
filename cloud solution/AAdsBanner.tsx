/**
 * AAdsBanner.tsx — Domain-aware A-ADS banner
 *
 * Replaces the hardcoded AAdsBanner.js.
 * Unit ID, colors, and domain all come from site-config.ts — no hardcoded values.
 *
 * Replace:  src/components/AAdsBanner.js
 * With:     this file (src/components/AAdsBanner.tsx)
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AD_CONFIG, SITE_URL } from '@/lib/site-config';

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

  const src = `https://acceptable.a-ads.com/${aadsUnitId}/?size=Adaptive`
    + `&background_color=${aadsBgColor}`
    + `&title_color=${aadsTitleColor}`
    + `&title_hover_color=${aadsTitleColor}`;

  return (
    <div
      id="aads-frame"
      ref={ref}
      style={{
        width: '100%',
        margin: '0 auto',
        background: `#${aadsBgColor}`,
        display: 'block',
        position: 'relative',
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
          maxWidth: '800px',
          height: '250px',
          display: 'block',
          background: `#${aadsBgColor}`,
        }}
        title="Advertisement"
        scrolling="no"
        allow="autoplay"
      />
    </div>
  );
}
