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
        '/reader/',   // reader pages are duplicate content — no index value
      ],
      crawlDelay: 2,
    },
    sitemap: [`${SITE_URL}/sitemap.xml`],
    host:    SITE_URL,
  };
}
