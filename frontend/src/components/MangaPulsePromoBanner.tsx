'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';

const STORAGE_KEY = 'mr_mangapulse_banner_dismissed_v2';
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
      className="relative z-40 w-full bg-[#070512] border-b border-purple-500/20 px-2 sm:px-4 py-1.5 sm:py-2 select-none"
    >
      <div className="max-w-6xl mx-auto relative flex items-center justify-center">
        {/* Clickable Image Banner */}
        <a
          href="https://mangapulse.co?utm_source=mangareader&utm_medium=image_banner&utm_campaign=progress_tracker"
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full max-w-5xl rounded-lg overflow-hidden border border-purple-500/30 hover:border-purple-400/60 shadow-[0_4px_20px_rgba(124,58,237,0.18)] hover:shadow-[0_6px_25px_rgba(124,58,237,0.3)] transition-all duration-200 group"
        >
          <picture className="block w-full">
            <source media="(max-width: 640px)" srcSet="/banners/mangapulse-promo-mobile.svg" />
            <img
              src="/banners/mangapulse-promo-desktop.svg"
              alt="Lost progress with down manga sites? Track and backup your reading safely on MangaPulse.co"
              className="w-full h-auto max-h-[105px] object-cover sm:object-contain group-hover:brightness-105 transition-all duration-200"
              loading="eager"
            />
          </picture>
        </a>

        {/* Floating Dismiss Button */}
        <button
          onClick={handleDismiss}
          className="absolute -top-1 right-0 sm:top-1 sm:right-2 z-50 p-1.5 rounded-full bg-black/70 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-white/10 shadow-md backdrop-blur-md transition-all cursor-pointer"
          aria-label="Dismiss banner"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
}
