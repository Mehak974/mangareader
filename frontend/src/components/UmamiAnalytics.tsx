'use client';

import { useEffect } from 'react';

const UMAMI_MAP: Record<string, string> = {
  'mangareader.pro': 'cd14dced-150c-4379-bfc2-d4d3b856cba8',
  'mangaread.pro': 'b1dd872f-c0bb-4c52-825d-7b4495799626',
  'manireader.online': '6b6b8998-1e5b-4a05-8106-430a310bad28',
};

export default function UmamiAnalytics() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hostname = window.location.hostname.toLowerCase();
    let websiteId = 'cd14dced-150c-4379-bfc2-d4d3b856cba8'; // default fallback

    for (const [domain, id] of Object.entries(UMAMI_MAP)) {
      if (hostname.includes(domain)) {
        websiteId = id;
        break;
      }
    }

    // Prevent duplicate injection
    if (document.querySelector(`script[src*="analytics.mangareader.pro"][data-website-id="${websiteId}"]`)) {
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://analytics.mangareader.pro/script.js';
    script.defer = true;
    script.setAttribute('data-website-id', websiteId);
    document.head.appendChild(script);
  }, []);

  return null;
}
