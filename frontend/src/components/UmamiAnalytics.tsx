'use client';

import Script from 'next/script';

const UMAMI_WEBSITE_ID = 'cd14dced-150c-4379-bfc2-d4d3b856cba8';

export default function UmamiAnalytics() {
  return (
    <Script
      src="/u/s.js"
      data-website-id={UMAMI_WEBSITE_ID}
      data-host-url="/u"
      strategy="afterInteractive"
    />
  );
}
