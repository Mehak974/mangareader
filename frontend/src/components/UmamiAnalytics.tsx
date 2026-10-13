'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

const UMAMI_CONFIGS: Record<string, { src: string; id: string }> = {
  'mangaread.pro': {
    src: 'https://analytics.mangareader.pro/script.js',
    id: 'cd14dced-150c-4379-bfc2-d4d3b856cba8',
  },
  'mangareader.pro': {
    src: 'https://analytics.mangareader.pro/script.js',
    id: 'cd14dced-150c-4379-bfc2-d4d3b856cba8',
  },
};

export default function UmamiAnalytics() {
  const [cfg, setCfg] = useState<{ src: string; id: string }>({
    src: 'https://analytics.mangareader.pro/script.js',
    id: 'cd14dced-150c-4379-bfc2-d4d3b856cba8',
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const h = window.location.hostname.toLowerCase();
      if (h.includes('mangaread.pro')) {
        setCfg(UMAMI_CONFIGS['mangaread.pro']);
      } else {
        setCfg(UMAMI_CONFIGS['mangareader.pro']);
      }
    }
  }, []);

  return (
    <Script
      key={cfg.id}
      src={cfg.src}
      data-website-id={cfg.id}
      strategy="afterInteractive"
    />
  );
}
