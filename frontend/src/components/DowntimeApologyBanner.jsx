'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Heart, Sparkles, X } from 'lucide-react';

const STORAGE_KEY = 'mr_downtime_apology_oct2026';

// 24-hour lifetime: Auto-expires at 2026-11-01 17:00:00 UTC (24 hours from launch)
// Once expired, it returns null for all users and automatically self-destructs.
const EXPIRES_AT = new Date('2026-11-01T17:00:00Z').getTime();

export default function DowntimeApologyBanner() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  // Never distract readers on chapter reading pages
  const isReaderPage = pathname?.startsWith('/reader/');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Self-destruct if 24 hours have elapsed
    if (Date.now() > EXPIRES_AT) {
      return;
    }

    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (!dismissed) {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {}
  };

  // If expired, dismissed, or inside chapter reading mode, don't show
  if (!visible || isReaderPage || (typeof window !== 'undefined' && Date.now() > EXPIRES_AT)) {
    return null;
  }

  return (
    <div className="relative z-40 bg-gradient-to-r from-purple-950/90 via-indigo-950/90 to-purple-950/90 border-b border-purple-500/30 text-white px-4 py-2.5 shadow-lg backdrop-blur-md transition-all duration-300">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/40">
            <Heart className="w-3.5 h-3.5 fill-purple-400 text-purple-400 animate-pulse" />
          </span>
          <p className="text-zinc-200 leading-snug">
            <strong className="text-white font-semibold">We’re back online!</strong>{' '}
            <span className="hidden sm:inline text-zinc-300">
              We sincerely apologize for the downtime over the past 24 hours caused by a datacenter attack. We’ve fully migrated to faster, dedicated offshore servers so you can enjoy smooth, uninterrupted reading.
            </span>
            <span className="sm:hidden text-zinc-300">
              Apologies for the recent downtime! We have migrated to faster servers for smooth reading.
            </span>
            <span className="inline-flex items-center gap-1 ml-1 text-purple-300 font-medium">
              Thank you for your patience! <Sparkles className="w-3 h-3 text-yellow-400 inline" />
            </span>
          </p>
        </div>

        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Dismiss message"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
