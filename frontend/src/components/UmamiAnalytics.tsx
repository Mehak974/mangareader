'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

const UMAMI_CONFIGS: Record<string, { src: string; id: string }> = {
  'mangaread.pro': {
    src: 'https://umami-production-30dc.up.railway.app/script.js',
    id: 'e86694e7-14e4-419e-91dc-acbc20c501de',
  },
  'mangareader.pro': {
    src: 'https://umami-production-f50d.up.railway.app/script.js',
    id: '8a1b7e69-8899-4383-a9aa-c6f61f930a0a',
  },
};

export default function UmamiAnalytics() {
  const [cfg, setCfg] = useState<{ src: string; id: string }>({
    src: 'https://umami-production-f50d.up.railway.app/script.js',
    id: '8a1b7e69-8899-4383-a9aa-c6f61f930a0a',
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
