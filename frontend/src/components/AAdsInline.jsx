'use client';

import { AADS_FLOAT_ENABLED, AD_CONFIG } from '@/lib/site-config';
import { useAdMode } from '@/lib/useAdMode';

/**
 * AAdsInline — the 300x250 A-ADS unit that sits in the flow of a chapter,
 * between page images.
 *
 * This is deliberately the simplest possible ad slot: a plain block in the
 * document, no fixed positioning, no z-index, no scroll logic, no dismissal
 * state. Everything it does NOT do is the point — an in-content unit must not
 * overlay artwork, must not intercept a tap meant for the page above or below
 * it, and must not move when the reader scrolls.
 *
 * Rendering it inside .reader-pages (a flex column) keeps the 300px box centred
 * between two full-width pages. It is a sibling of .reader-page, never a child,
 * so the reader's `document.querySelectorAll('.reader-page img')[i]` indexing in
 * the image-retry handler stays aligned — nesting it would shift every index
 * after the first ad and make retries patch the wrong image.
 *
 * loading="lazy" keeps the ad request from competing with the chapter images for
 * bandwidth on load. The iframe only mounts as it approaches the viewport, which
 * is also the only time it can be seen, so impressions are unaffected.
 */

const { aadsFloatUnitId } = AD_CONFIG;

const UNIT_SRC = `//ad.a-ads.com/${aadsFloatUnitId}/?size=300x250&background_color=transparent`;

export default function AAdsInline() {
  const adMode = useAdMode();

  if (!AADS_FLOAT_ENABLED || !aadsFloatUnitId || adMode !== 'inline') return null;

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
