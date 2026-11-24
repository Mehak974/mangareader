'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { X, ArrowRight, ShieldCheck } from 'lucide-react';

const STORAGE_KEY = 'mr_mangapulse_banner_dismissed_v8';
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
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .mp-banner-aside {
              width: 100%;
              background-color: #0c0e12;
              border-bottom: 1px solid #1e2430;
              padding: 6px 10px;
              box-sizing: border-box;
              user-select: none;
              position: relative;
              z-index: 50;
            }
            .mp-banner-wrap {
              max-width: 1100px;
              margin: 0 auto;
              position: relative;
            }
            .mp-banner-card {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
              background-color: #141b26;
              border: 1px solid #242f42;
              border-radius: 8px;
              padding: 8px 14px;
              text-decoration: none;
              color: #f8fafc;
              box-sizing: border-box;
              width: 100%;
              transition: border-color 0.2s, background-color 0.2s;
            }
            .mp-banner-card:hover {
              border-color: #3b82f6;
              background-color: #182130;
            }
            .mp-banner-brand {
              display: flex;
              align-items: center;
              gap: 8px;
              flex-shrink: 0;
            }
            .mp-banner-divider {
              width: 1px;
              height: 22px;
              background-color: #242f42;
              flex-shrink: 0;
            }
            .mp-banner-content {
              display: flex;
              align-items: center;
              gap: 8px;
              flex: 1;
              min-width: 0;
              font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              flex-wrap: wrap;
            }
            .mp-banner-headline {
              font-weight: 800;
              font-size: 13px;
              color: #f8fafc;
              white-space: nowrap;
              display: inline-flex;
              align-items: center;
              gap: 5px;
            }
            .mp-banner-sub {
              font-size: 12px;
              color: #94a3b8;
            }
            .mp-banner-cta-wrap {
              flex-shrink: 0;
              margin-right: 24px;
            }
            .mp-banner-cta {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              padding: 6px 14px;
              border-radius: 6px;
              background-color: #2563eb;
              color: #ffffff;
              font-size: 12px;
              font-weight: 700;
              font-family: system-ui, -apple-system, sans-serif;
              box-shadow: 0 1px 3px rgba(0,0,0,0.3);
              white-space: nowrap;
            }
            .mp-banner-close {
              position: absolute;
              top: 8px;
              right: 8px;
              z-index: 10;
              padding: 5px;
              border-radius: 4px;
              background-color: #1b2433;
              border: 1px solid #303e56;
              color: #94a3b8;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              line-height: 1;
              transition: background-color 0.15s, color 0.15s;
            }
            .mp-banner-close:hover {
              background-color: #242f42;
              color: #ffffff;
            }

            /* Responsive Mobile Layout (< 680px) */
            @media (max-width: 680px) {
              .mp-banner-aside {
                padding: 6px 8px;
              }
              .mp-banner-card {
                flex-direction: column;
                align-items: flex-start;
                gap: 8px;
                padding: 10px 12px;
              }
              .mp-banner-divider {
                display: none;
              }
              .mp-banner-headline {
                white-space: normal;
                font-size: 12.5px;
                line-height: 1.35;
              }
              .mp-banner-sub {
                font-size: 11.5px;
                line-height: 1.35;
              }
              .mp-banner-content {
                flex-direction: column;
                align-items: flex-start;
                gap: 4px;
                width: 100%;
                padding-right: 28px; /* avoid close button overlap */
              }
              .mp-banner-cta-wrap {
                width: 100%;
                margin-right: 0;
                margin-top: 2px;
              }
              .mp-banner-cta {
                width: 100%;
                justify-content: center;
                padding: 7px 12px;
                font-size: 12px;
                box-sizing: border-box;
              }
              .mp-banner-close {
                top: 8px;
                right: 8px;
                padding: 6px;
              }
            }
          `,
        }}
      />

      <aside aria-label="MangaPulse Announcement" className="mp-banner-aside">
        <div className="mp-banner-wrap">
          {/* Banner Link Card */}
          <a
            href="https://mangapulse.co?utm_source=mangareader&utm_medium=promo_banner&utm_campaign=progress_tracker"
            target="_blank"
            rel="noopener noreferrer"
            className="mp-banner-card"
          >
            {/* Top / Left: Brand Identity */}
            <div className="mp-banner-brand">
              {/* MP Badge */}
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '6px',
                  backgroundColor: '#ffffff',
                  color: '#0c0e12',
                  fontWeight: 900,
                  fontSize: '12px',
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
                  fontSize: '13.5px',
                  letterSpacing: '0.2px',
                  color: '#ffffff',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              >
                MANGAPULSE
              </span>
            </div>

            {/* Desktop Divider */}
            <div className="mp-banner-divider" />

            {/* Center Content */}
            <div className="mp-banner-content">
              <span className="mp-banner-headline">
                <ShieldCheck style={{ width: '14px', height: '14px', color: '#10b981', flexShrink: 0 }} />
                <span>Manga sites go down. Your reading history shouldn&apos;t.</span>
              </span>
              <span className="mp-banner-sub">
                Backup bookmarks &amp; track upcoming chapter drops on{' '}
                <strong style={{ color: '#38bdf8', fontWeight: 700, textDecoration: 'underline' }}>
                  MangaPulse.co
                </strong>
              </span>
            </div>

            {/* CTA Button */}
            <div className="mp-banner-cta-wrap">
              <span className="mp-banner-cta">
                <span>Track Free</span>
                <ArrowRight style={{ width: '13px', height: '13px' }} />
              </span>
            </div>
          </a>

          {/* Dismiss Button */}
          <button
            onClick={handleDismiss}
            aria-label="Dismiss banner"
            title="Dismiss"
            className="mp-banner-close"
          >
            <X style={{ width: '14px', height: '14px' }} />
          </button>
        </div>
      </aside>
    </>
  );
}
