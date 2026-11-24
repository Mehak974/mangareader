'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { BookmarkCheck, ArrowRight, X } from 'lucide-react';

const STORAGE_KEY = 'mr_mangapulse_banner_dismissed_v1';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // Re-show after 7 days if dismissed

export default function MangaPulsePromoBanner() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  // Keep reading view 100% clean and distraction-free
  const isReaderPage = pathname?.startsWith('/reader/');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const dismissedAt = localStorage.getItem(STORAGE_KEY);
      if (dismissedAt) {
        const elapsed = Date.now() - parseInt(dismissedAt, 10);
        if (elapsed < DISMISS_DURATION_MS) {
          return;
        }
      }
      setVisible(true);
    } catch {
      setVisible(true);
    }
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
      aria-label="MangaPulse Progress Tracker"
      className="relative z-40 bg-gradient-to-r from-[#150d2a] via-[#0d1222] to-[#120e29] border-b border-purple-500/25 text-white px-3 sm:px-4 py-2 sm:py-2.5 shadow-md backdrop-blur-md transition-all select-none"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2.5 sm:gap-4 text-xs sm:text-sm">
        {/* Banner Content */}
        <a
          href="https://mangapulse.co?utm_source=mangareader&utm_medium=top_banner&utm_campaign=progress_tracker"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 group text-decoration-none text-inherit cursor-pointer"
        >
          {/* Pulsing Icon */}
          <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 group-hover:scale-105 transition-transform">
            <BookmarkCheck className="w-3.5 h-3.5 text-purple-300" />
          </span>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
            {/* Tag badge */}
            <span className="text-[10px] font-bold font-mono tracking-wide uppercase px-1.5 py-0.5 rounded bg-purple-500/25 text-purple-200 border border-purple-400/30">
              Never Lose Progress
            </span>

            {/* Desktop text */}
            <span className="hidden md:inline text-neutral-200">
              Manga sites get taken down, but your reading history shouldn&apos;t.
            </span>

            {/* Hook question & solution */}
            <span className="text-white font-medium group-hover:text-purple-200 transition-colors">
              <span className="hidden sm:inline text-neutral-400">Lost your chapters before?</span> Track safely on{' '}
              <strong className="text-purple-300 font-bold underline decoration-purple-400/50 decoration-2 underline-offset-2">
                MangaPulse.co
              </strong>
            </span>
          </div>

          {/* CTA Pill button */}
          <span className="hidden lg:inline-flex items-center gap-1 ml-auto flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-600/80 hover:bg-purple-600 text-white border border-purple-400/40 shadow-sm transition-all group-hover:translate-x-0.5">
            <span>Track Free</span>
            <ArrowRight className="w-3 h-3" />
          </span>
        </a>

        {/* Dismiss Button */}
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 -mr-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Dismiss banner"
          title="Dismiss for 7 days"
        >
          <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>
      </div>
    </aside>
  );
}
