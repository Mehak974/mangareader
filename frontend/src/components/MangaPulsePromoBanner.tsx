'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { X, ArrowRight } from 'lucide-react';

const STORAGE_KEY = 'mr_mangapulse_banner_dismissed_v6';
const DISMISS_DURATION_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

export default function MangaPulsePromoBanner() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);

  // Keep reader view 100% clean and distraction-free
  const isReaderPage = pathname?.startsWith('/reader/');

  useEffect(() => {
    try {
      const dismissedAt = localStorage.getItem(STORAGE_KEY);
      if (dismissedAt) {
        const elapsed = Date.now() - parseInt(dismissedAt, 10);
        if (elapsed < DISMISS_DURATION_MS) {
          setVisible(false);
        }
      }
    } catch {}
  }, []);

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    } catch {}
  };

  if (!visible || isReaderPage) {
    return null;
  }

  return (
    <aside
      aria-label="MangaPulse Announcement"
      style={{
        width: '100%',
        backgroundColor: '#0c0e12',
        borderBottom: '1px solid #1e2430',
        padding: '6px 12px',
        boxSizing: 'border-box',
        userSelect: 'none',
        position: 'relative',
        zIndex: 50,
      }}
    >
      <div
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          position: 'relative',
        }}
      >
        {/* Banner Link Card */}
        <a
          href="https://mangapulse.co?utm_source=mangareader&utm_medium=promo_banner&utm_campaign=progress_tracker"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            backgroundColor: '#141b26',
            border: '1px solid #242f42',
            borderRadius: '8px',
            padding: '8px 14px',
            textDecoration: 'none',
            color: '#f8fafc',
            transition: 'border-color 0.2s, background-color 0.2s',
            boxSizing: 'border-box',
            width: '100%',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#3b82f6';
            e.currentTarget.style.backgroundColor = '#182130';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#242f42';
            e.currentTarget.style.backgroundColor = '#141b26';
          }}
        >
          {/* Left: Brand Identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {/* MP Badge */}
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                backgroundColor: '#ffffff',
                color: '#0c0e12',
                fontWeight: 900,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                letterSpacing: '-0.5px',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                flexShrink: 0,
              }}
            >
              MP
            </div>
            <span
              style={{
                fontWeight: 800,
                fontSize: '14px',
                letterSpacing: '0.2px',
                color: '#ffffff',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              MANGAPULSE
            </span>
          </div>

          {/* Divider */}
          <div
            style={{
              width: '1px',
              height: '22px',
              backgroundColor: '#242f42',
              flexShrink: 0,
            }}
          />

          {/* Center Message */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flex: 1,
              minWidth: 0,
              fontFamily: 'system-ui, -apple-system, sans-serif',
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontWeight: 700,
                fontSize: '13px',
                color: '#f8fafc',
                whiteSpace: 'nowrap',
              }}
            >
              Progress gone with manga site?
            </span>
            <span
              style={{
                fontSize: '12px',
                color: '#94a3b8',
              }}
            >
              Track &amp; backup reading progress on{' '}
              <strong style={{ color: '#38bdf8', fontWeight: 700, textDecoration: 'underline' }}>
                MangaPulse.co
              </strong>
            </span>
          </div>

          {/* Right: CTA Button */}
          <div style={{ flexShrink: 0, marginRight: '24px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 700,
                fontFamily: 'system-ui, -apple-system, sans-serif',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }}
            >
              <span>Track Progress</span>
              <ArrowRight style={{ width: '13px', height: '13px' }} />
            </span>
          </div>
        </a>

        {/* Cross Button: Top Right Corner OVER the Banner */}
        <button
          onClick={handleDismiss}
          aria-label="Dismiss banner"
          title="Dismiss"
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            zIndex: 10,
            padding: '4px',
            borderRadius: '4px',
            backgroundColor: '#1b2433',
            border: '1px solid #303e56',
            color: '#94a3b8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
            transition: 'background-color 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#242f42';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#1b2433';
            e.currentTarget.style.color = '#94a3b8';
          }}
        >
          <X style={{ width: '14px', height: '14px' }} />
        </button>
      </div>
    </aside>
  );
}
