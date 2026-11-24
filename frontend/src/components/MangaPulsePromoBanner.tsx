'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';

const STORAGE_KEY = 'mr_mangapulse_banner_dismissed_v3';
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
      aria-label="MangaPulse Progress Tracker Announcement"
      className="relative z-40 w-full bg-[#0c0e12] border-b border-[#1e2430] px-2 sm:px-4 py-1 select-none"
    >
      <div className="max-w-6xl mx-auto relative flex items-center justify-center">
        {/* Banner Container */}
        <div className="relative w-full max-w-5xl">
          {/* Clickable Image Banner */}
          <a
            href="https://mangapulse.co?utm_source=mangareader&utm_medium=image_banner&utm_campaign=progress_tracker"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full rounded-lg overflow-hidden border border-[#242f42] hover:border-[#3b82f6]/50 bg-[#141b26] transition-colors group"
          >
            <picture className="block w-full">
              <source media="(max-width: 640px)" srcSet="/banners/mangapulse-promo-mobile.svg" />
              <img
                src="/banners/mangapulse-promo-desktop.svg"
                alt="Lost progress with down manga sites? Track and backup your reading safely on MangaPulse.co"
                className="w-full h-auto max-h-[64px] object-contain group-hover:opacity-95 transition-opacity"
                loading="eager"
              />
            </picture>
          </a>

          {/* Cross Button on Top Right Corner OVER the Banner */}
          <button
            onClick={handleDismiss}
            className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 z-50 p-1 rounded bg-[#1b2433] hover:bg-[#222d40] text-[#94a3b8] hover:text-[#f8fafc] border border-[#303e56] shadow-sm transition-colors cursor-pointer"
            aria-label="Dismiss banner"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
