'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AD_CONFIG, siteConfig } from '@/lib/site-config';
import { useAdMode } from '@/lib/useAdMode';
import AAdsInline from './AAdsInline';

const { aadsUnitId, aadsBgColor, aadsTitleColor } = AD_CONFIG;

function AAdsBannerInner() {
  const pathname = usePathname();
  const [key, setKey] = useState(0);
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => { setKey(k => k + 1); }, [pathname]);

  if (!aadsUnitId || isHidden) return null;

  let src = `//acceptable.a-ads.com/${aadsUnitId}/?size=Adaptive`;
  if (siteConfig.profile === 'manireader.online') {
    src += '&background_color=transparent';
  } else if (siteConfig.profile === 'mangareader.pro') {
    src += `&background_color=${aadsBgColor}&title_color=${aadsTitleColor}&title_hover_color=${aadsTitleColor}`;
  }

  const closeId = `aadssticky-${aadsUnitId}`;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          width: '100%',
          textAlign: 'center',
          fontSize: 0,
          zIndex: 100
        }}
      >
        <input autoComplete="off" type="checkbox" id={closeId} hidden />
        <div style={{ paddingTop: 0, paddingBottom: 'auto' }}>
          <div style={{ width: '100%', height: 'auto', position: 'fixed', textAlign: 'center', fontSize: 0, bottom: 0, left: 0, right: 0, margin: 'auto' }}>
            <label
              htmlFor={closeId}
              style={{
                top: '50%',
                transform: 'translateY(-50%)',
                right: '24px',
                position: 'absolute',
                borderRadius: '4px',
                background: 'rgba(248, 248, 249, 0.70)',
                padding: '4px',
                zIndex: 99999,
                cursor: 'pointer'
              }}
            >
              <svg fill="#000000" height="16px" width="16px" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 490 490">
                <polygon points="456.851,0 245,212.564 33.149,0 0.708,32.337 212.669,245.004 0.708,457.678 33.149,490 245,277.443 456.851,490 489.292,457.678 277.331,245.004 489.292,32.337 " />
              </svg>
            </label>
            <div id="frame" style={{ width: '100%', margin: 'auto', position: 'relative', zIndex: 99998 }}>
              <iframe
                key={key}
                data-aa={aadsUnitId}
                src={src}
                loading="lazy"
                style={{
                  border: 0,
                  padding: 0,
                  width: '100%',
                  maxWidth: '728px',
                  height: '90px',
                  minHeight: '90px',
                  overflow: 'hidden',
                  display: 'block',
                  margin: '0 auto'
                }}
                title="Advertisement"
                scrolling="no"
                allow="autoplay"
              />
            </div>
            <style jsx>{`
              #${closeId}:checked + div {
                display: none;
              }
            `}</style>
          </div>
        </div>
      </div>
      <div style={{ height: '90px', width: '100%', display: 'block' }} />
    </>
  );
}

export default function AAdsBanner({ hideOnReader = false }) {
  const pathname = usePathname();
  const adMode = useAdMode();

  const isReaderPage = pathname?.startsWith('/reader/');
  const isCryptoPage = pathname === '/crypto';
  if (hideOnReader && isReaderPage) return null;

  if (adMode === 'inline') {
    if (isReaderPage) return null;
    // /crypto renders its own in-flow 300x250 (force), so the
    // banner's inline fallback must stay off there or the page
    // serves two 300x250 units.
    if (isCryptoPage) return null;
    return (
      <div style={{ width: '100%', margin: '20px 0', display: 'flex', justifyContent: 'center' }}>
        <AAdsInline />
      </div>
    );
  }

  return <AAdsBannerInner />;
}