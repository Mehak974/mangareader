'use client';

import React from 'react';
import { HILLTOP_DIRECT_LINK } from '@/lib/site-config';

interface PartnerMangaCardProps {
  directUrl?: string;
}

export default function PartnerMangaCard({ directUrl }: PartnerMangaCardProps) {
  const targetUrl = directUrl || HILLTOP_DIRECT_LINK || 'https://purple-text.com/Rvsm31';

  const handleClick = () => {
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="m-card partner-m-card"
      onClick={handleClick}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label="Popular Anime Games & Webtoons partner link"
      style={{
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      <div
        className="m-cover"
        style={{
          background: 'linear-gradient(155deg, #2e1065 0%, #110524 60%, #080312 100%)',
          border: '1px solid rgba(168, 85, 247, 0.45)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div className="m-shimmer" />

        {/* Featured pill badge */}
        <div
          style={{
            position: 'absolute',
            top: '7px',
            left: '7px',
            background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
            color: '#ffffff',
            fontSize: '9px',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
            padding: '2px 7px',
            borderRadius: '4px',
            zIndex: 3,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
          }}
        >
          Special
        </div>

        {/* Central Graphic */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
            padding: '0 8px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.25) 0%, rgba(99, 102, 241, 0.25) 100%)',
              border: '1px solid rgba(168, 85, 247, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              marginBottom: '6px',
              boxShadow: '0 4px 14px rgba(168, 85, 247, 0.35)',
            }}
          >
            🎮
          </div>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#c084fc',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              lineHeight: 1.2,
            }}
          >
            Anime RPG
          </div>
        </div>

        {/* Bottom Tag */}
        <div
          style={{
            position: 'absolute',
            bottom: '7px',
            right: '7px',
            background: 'rgba(0, 0, 0, 0.75)',
            color: '#fbbf24',
            fontSize: '10px',
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: '4px',
            zIndex: 3,
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
          }}
        >
          <span>Free</span>
          <span>↗</span>
        </div>
      </div>

      <div className="m-title">Popular Anime Games</div>
      <div className="m-meta">
        <span className="m-dot done" />
        <span>Partner · Free to Play</span>
      </div>
    </div>
  );
}
