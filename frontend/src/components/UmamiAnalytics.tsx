'use client';

import Script from 'next/script';

const UMAMI_WEBSITE_ID = 'cd14dced-150c-4379-bfc2-d4d3b856cba8';

export default function UmamiAnalytics() {
  return (
    <Script
      src="https://analytics.mangareader.pro/script.js"
      data-website-id={UMAMI_WEBSITE_ID}
      strategy="afterInteractive"
    />
  );
}
