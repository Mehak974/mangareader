'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { X, ArrowRight } from 'lucide-react';

const STORAGE_KEY = 'mr_mangapulse_banner_dismissed_v5';
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
      className="relative z-40 w-full bg-[#0c0e12] border-b border-[#1e2430] px-2 sm:px-4 py-1.5 select-none"
    >
      <div className="max-w-6xl mx-auto relative flex items-center justify-center">
        {/* Banner Card Container */}
        <div className="relative w-full max-w-5xl">
          {/* Clickable Banner Card (Matching MangaPulse Theme, No Gradient, AdBlock Immune) */}
          <a
            href="https://mangapulse.co?utm_source=mangareader&utm_medium=promo_banner&utm_campaign=progress_tracker"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 sm:gap-6 w-full bg-[#141b26] hover:bg-[#1a2332] border border-[#242f42] hover:border-[#3b82f6]/50 rounded-lg px-3 py-2 sm:px-5 sm:py-2.5 transition-colors group text-decoration-none"
          >
            {/* Left: Brand Identity */}
            <div className="flex items-center gap-2.5 flex-shrink-0">
              {/* White MP Badge */}
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white text-[#0c0e12] font-black text-xs sm:text-sm flex items-center justify-center tracking-tighter shadow-sm flex-shrink-0">
                MP
              </div>
              <span className="font-extrabold text-sm sm:text-base tracking-tight text-white group-hover:text-neutral-200 transition-colors">
                MANGAPULSE
              </span>
            </div>

            {/* Divider */}
            <div className="h-6 w-px bg-[#242f42] hidden md:block flex-shrink-0" />

            {/* Center: Message */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 flex-1 min-w-0 pr-6 sm:pr-0">
              <span className="text-xs sm:text-sm font-bold text-white whitespace-nowrap">
                Progress gone with manga site?
              </span>
              <span className="text-[11px] sm:text-xs text-[#94a3b8] truncate">
                Don&apos;t worry — track &amp; backup reading progress on{' '}
                <strong className="text-blue-400 font-semibold underline decoration-blue-500/40 underline-offset-2">
                  MangaPulse.co
                </strong>
              </span>
            </div>

            {/* Right: CTA Button */}
            <div className="hidden sm:flex items-center flex-shrink-0">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[#2563eb] group-hover:bg-[#1d4ed8] text-white text-xs font-bold transition-colors shadow-sm">
                <span>Track Progress</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </a>

          {/* Cross Button on Top Right Corner OVER the Banner */}
          <button
            onClick={handleDismiss}
            className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 z-50 p-1 rounded-md bg-[#1b2433] hover:bg-[#242f42] text-[#94a3b8] hover:text-[#f8fafc] border border-[#303e56] shadow-sm transition-colors cursor-pointer"
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
