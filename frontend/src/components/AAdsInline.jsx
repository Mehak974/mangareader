'use client';

import { usePathname } from 'next/navigation';
import { AADS_FLOAT_ENABLED, AD_CONFIG } from '@/lib/site-config';
import { useAdMode } from '@/lib/useAdMode';

const { aadsFloatUnitId } = AD_CONFIG;

const UNIT_SRC = `//ad.a-ads.com/${aadsFloatUnitId}/?size=300x250&background_color=transparent`;

/**
 * Renders in 'inline' ad mode, or forced (e.g. on /aads).
 */
export default function AAdsInline({ force = false }) {
  const pathname = usePathname();
  const adMode = useAdMode();

  if (!AADS_FLOAT_ENABLED || !aadsFloatUnitId) return null;
  const isAadsPage = pathname === '/aads' || pathname?.startsWith('/aads/');
  if (!force && !isAadsPage && adMode !== 'inline') return null;

  return (
    <div className="aads-inline">
      <div className="aads-inline-frame">
        <iframe
          data-aa={aadsFloatUnitId}
          src={UNIT_SRC}
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
