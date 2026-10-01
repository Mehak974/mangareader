/**
 * robots.ts — Domain-aware robots.txt
 *
 * Replaces src/app/robots.js
 * SITE_URL now comes from site-config.ts, so each domain gets its own
 * canonical host in the Sitemap and Host directives.
 */

import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site-config';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/api/og'],
      disallow: [
        '/admin',
        '/api',
        '/api/auth',
        '/_next',
        '/static',
        '/login',
        '/signup',
        '/settings',
        '/profile',
        '/library',
        '/history',
        '/messages',
        '/aads',
      ],
      // NOTE: '/reader/' is deliberately NOT disallowed here.
      //
      // Reader pages are noindexed via the X-Robots-Tag response header set in
      // middleware.js. A robots.txt disallow stops the crawler from fetching
      // the page at all, so it can never observe that noindex header — the
      // result is "Indexed, though blocked by robots.txt", which keeps already
      // indexed chapters in the index indefinitely. Letting the crawler fetch
      // and read the header is what actually removes them.
      //
      // crawlDelay is omitted because Google ignores it entirely; it only slows
      // Bing/Yandex and was giving no crawl-budget protection in return.
    },
    sitemap: [`${SITE_URL}/sitemap.xml`],
  };
}
