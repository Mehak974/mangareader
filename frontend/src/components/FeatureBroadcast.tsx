'use client';

import React, { useState, useEffect } from 'react';

const STORAGE_KEY = 'mr_broadcast_offline_feature_v1';

export default function FeatureBroadcast() {
  const [isOpen, setIsOpen] = useState(false);
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    // Only run on client
    if (typeof window === 'undefined') return;

    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) {
        // Delay slightly for smooth entrance after hydration
        const timer = setTimeout(() => {
          setIsRendered(true);
          // Trigger CSS transition after render
          requestAnimationFrame(() => setIsOpen(true));
        }, 1200);
        return () => clearTimeout(timer);
      }
    } catch {
      // LocalStorage access restricted in some private modes
    }
  }, []);

  const handleDismiss = () => {
    setIsOpen(false);
    setTimeout(() => setIsRendered(false), 300);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {}
  };

  if (!isRendered) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="New Feature Announcement: Offline Reading"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backgroundColor: isOpen ? 'rgba(0, 0, 0, 0.78)' : 'rgba(0, 0, 0, 0)',
        backdropFilter: isOpen ? 'blur(8px)' : 'blur(0px)',
        WebkitBackdropFilter: isOpen ? 'blur(8px)' : 'blur(0px)',
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleDismiss();
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '520px',
          background: 'linear-gradient(145deg, #181126 0%, #0d0a14 100%)',
          borderRadius: '20px',
          border: '1px solid rgba(168, 85, 247, 0.35)',
          boxShadow: '0 0 50px -10px rgba(168, 85, 247, 0.45), 0 25px 60px -15px rgba(0, 0, 0, 0.9)',
          overflow: 'hidden',
          color: '#ffffff',
          transform: isOpen ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(20px)',
          opacity: isOpen ? 1 : 0,
          transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease',
        }}
      >
        {/* Animated Top Neon Accent Bar */}
        <div
          style={{
            height: '4px',
            width: '100%',
            background: 'linear-gradient(90deg, #ec4899, #a855f7, #3b82f6, #ec4899)',
            backgroundSize: '200% 100%',
            animation: 'broadcastGradient 3s linear infinite',
          }}
        />

        {/* Ambient Top Glow Orbs */}
        <div
          style={{
            position: 'absolute',
            top: '-60px',
            right: '-40px',
            width: '160px',
            height: '160px',
            background: 'radial-gradient(circle, rgba(168, 85, 247, 0.35) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-50px',
            left: '-30px',
            width: '140px',
            height: '140px',
            background: 'radial-gradient(circle, rgba(236, 72, 153, 0.25) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        {/* Close button */}
        <button
          onClick={handleDismiss}
          aria-label="Close broadcast letter"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: 'rgba(255, 255, 255, 0.7)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
            e.currentTarget.style.color = '#f87171';
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Inner Letter Content */}
        <div style={{ padding: '24px 26px 22px' }}>
          {/* Top Badge: Broadcast Dispatch */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '999px',
                background: 'rgba(168, 85, 247, 0.16)',
                border: '1px solid rgba(168, 85, 247, 0.4)',
                fontSize: '11px',
                fontWeight: 700,
                color: '#d8b4fe',
                letterSpacing: '0.6px',
                textTransform: 'uppercase',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#a855f7',
                  boxShadow: '0 0 8px #c084fc',
                }}
              />
              Official Broadcast · New Feature
            </span>
            <span
              style={{
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.45)',
                fontWeight: 500,
              }}
            >
              Update v2.4
            </span>
          </div>

          {/* Letter Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 20px -4px rgba(168, 85, 247, 0.5)',
                flexShrink: 0,
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: '20px',
                  fontWeight: 800,
                  letterSpacing: '-0.3px',
                  color: '#ffffff',
                  lineHeight: '1.25',
                }}
              >
                Offline Reading is Live!
              </h2>
              <p
                style={{
                  margin: '2px 0 0',
                  fontSize: '13px',
                  color: 'rgba(255, 255, 255, 0.65)',
                }}
              >
                Read anywhere without internet or mobile data.
              </p>
            </div>
          </div>

          {/* Letter Body Parchment Card */}
          <div
            style={{
              margin: '16px 0',
              padding: '14px 16px',
              borderRadius: '14px',
              background: 'rgba(255, 255, 255, 0.035)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              fontSize: '13px',
              lineHeight: '1.55',
              color: 'rgba(255, 255, 255, 0.85)',
            }}
          >
            <p style={{ margin: '0 0 10px', fontStyle: 'italic', color: '#e9d5ff', fontWeight: 500 }}>
              &ldquo;Dear Reader, whether you&apos;re on a flight, commute, or low-signal spot, your chapters stay with you.&rdquo;
            </p>
            <p style={{ margin: 0 }}>
              You can now download full chapters directly into your browser cache with one tap. Zero loading lag, zero buffering, and 0MB mobile data consumed while reading.
            </p>
          </div>

          {/* Feature Highlights Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '10px',
              marginBottom: '18px',
            }}
          >
            {/* Highlight 1 */}
            <div
              style={{
                background: 'rgba(168, 85, 247, 0.08)',
                border: '1px solid rgba(168, 85, 247, 0.22)',
                borderRadius: '12px',
                padding: '10px 12px',
                textAlign: 'left',
              }}
            >
              <div style={{ fontSize: '18px', marginBottom: '4px' }}>⚡</div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#f3e8ff' }}>Zero Data</div>
              <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.55)', marginTop: '2px' }}>
                Instant pages with no internet
              </div>
            </div>

            {/* Highlight 2 — The 24h Expiration Notice */}
            <div
              style={{
                background: 'rgba(234, 179, 8, 0.09)',
                border: '1px solid rgba(234, 179, 8, 0.3)',
                borderRadius: '12px',
                padding: '10px 12px',
                textAlign: 'left',
              }}
            >
              <div style={{ fontSize: '18px', marginBottom: '4px' }}>⏱️</div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#fef08a' }}>24h Expiry</div>
              <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)', marginTop: '2px' }}>
                Auto-deleted after 24 hours
              </div>
            </div>

            {/* Highlight 3 */}
            <div
              style={{
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.22)',
                borderRadius: '12px',
                padding: '10px 12px',
                textAlign: 'left',
              }}
            >
              <div style={{ fontSize: '18px', marginBottom: '4px' }}>📱</div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#dbeafe' }}>Clean Disk</div>
              <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.55)', marginTop: '2px' }}>
                Never clutters device storage
              </div>
            </div>
          </div>

          {/* Important Expiration Explainer Box */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'rgba(234, 179, 8, 0.07)',
              border: '1px dashed rgba(234, 179, 8, 0.35)',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
            }}
          >
            <span style={{ fontSize: '16px', lineHeight: 1.2 }}>ℹ️</span>
            <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.75)', lineHeight: 1.45 }}>
              <strong style={{ color: '#fef08a' }}>Notice:</strong> Downloaded chapters expire and automatically delete after{' '}
              <strong style={{ color: '#fff' }}>24 hours</strong> to preserve your device storage and ensure fresh updates.
            </div>
          </div>

          {/* Action Footer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handleDismiss}
              style={{
                flex: 1,
                padding: '12px 18px',
                background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 15px rgba(168, 85, 247, 0.35)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 6px 22px rgba(168, 85, 247, 0.55)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(168, 85, 247, 0.35)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <span>Got It, Start Reading</span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes broadcastGradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
}
