'use client';

import React from 'react';
import { HILLTOP_DIRECT_LINK } from '@/lib/site-config';

interface PartnerSpotlightProps {
  directUrl?: string;
  style?: React.CSSProperties;
}

export default function PartnerSpotlight({ directUrl, style }: PartnerSpotlightProps) {
  const targetUrl = directUrl || HILLTOP_DIRECT_LINK || 'https://purple-text.com/b/3/V/0mP.3Lpkv/brmBV-JeZWDM0/3bNUT/EkxlNajfci3ILPT/cT1KMXTEE/2-OLDWEr';

  return (
    <div
      className="spotlight-card-wrapper"
      style={{
        width: '100%',
        maxWidth: '560px',
        margin: '8px auto',
        padding: '0 8px',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <a
        href={targetUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="spotlight-card-link"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '12px 16px',
          background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(19, 9, 30, 0.95) 100%)',
          border: '1px solid rgba(168, 85, 247, 0.28)',
          borderRadius: '12px',
          textDecoration: 'none',
          color: '#ffffff',
          boxShadow: '0 4px 18px rgba(0, 0, 0, 0.35)',
          transition: 'all 0.2s ease-in-out',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '19px',
              flexShrink: 0,
              boxShadow: '0 2px 10px rgba(168, 85, 247, 0.35)',
            }}
          >
            🔥
          </div>
          <div style={{ textAlign: 'left', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: '#c084fc',
                  background: 'rgba(168, 85, 247, 0.18)',
                  padding: '1px 6px',
                  borderRadius: '4px',
                }}
              >
                Featured
              </span>
              <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)' }}>
                Recommended Partner
              </span>
            </div>
            <div
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#f3f4f6',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Trending Manga & Anime Games 🎮
            </div>
            <div
              style={{
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.45)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Free web games, new releases & rewards
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            background: 'var(--accent, #a855f7)',
            color: '#ffffff',
            padding: '7px 13px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 600,
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(168, 85, 247, 0.35)',
          }}
        >
          <span>Explore</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="7" y1="17" x2="17" y2="7" />
            <polyline points="7 7 17 7 17 17" />
          </svg>
        </div>
      </a>
    </div>
  );
}
