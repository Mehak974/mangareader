'use client';

import { usePathname } from 'next/navigation';
import { AADS_FLOAT_ENABLED, AD_CONFIG } from '@/lib/site-config';
import { useAdMode } from '@/lib/useAdMode';

const { aadsFloatUnitId } = AD_CONFIG;

const UNIT_SRC = `//ad.a-ads.com/${aadsFloatUnitId}/?size=300x250&background_color=transparent`;

export default function AAdsInline({ force = false }) {
  const pathname = usePathname();
  const adMode = useAdMode();

  const hostname = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  let floatId = '2457490';
  if (hostname.includes('mangaread.pro')) {
    floatId = '2458319';
  } else if (hostname.includes('manireader.online') || hostname.includes('manireader.pro')) {
    floatId = '2459321';
  } else {
    floatId = aadsFloatUnitId || '2457490';
  }
  const unitSrc = `//ad.a-ads.com/${floatId}/?size=300x250&background_color=transparent`;

  if (!AADS_FLOAT_ENABLED || !floatId) return null;
  const isAads300Page = pathname === '/aads300' || pathname?.startsWith('/aads300/') || pathname === '/mangaread-300' || pathname?.startsWith('/mangaread-300/');
  if (!force && !isAads300Page && adMode !== 'inline') return null;

  return (
    <div className="aads-inline">
      <div className="aads-inline-frame">
        <iframe
          data-aa={floatId}
          src={unitSrc}
          title="Advertisement"
          loading="lazy"
          scrolling="no"
          allow="autoplay"
          style={{ border: 0, padding: 0, width: '300px', height: '250px', display: 'block' }}
        />
      </div>
    </div>
  );
}
