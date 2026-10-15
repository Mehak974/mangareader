/**
 * manifest.ts — Domain-aware PWA web app manifest
 *
 * Replaces src/app/manifest.js
 * SITE_NAME now comes from site-config.ts, so each domain gets its own
 * short name / display name in the install prompt.
 */

import type { MetadataRoute } from 'next';
import { SITE_NAME } from '@/lib/site-config';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: SITE_NAME,
    short_name: SITE_NAME,
    description:
      'Sync reading across devices. Bookmark chapters, track progress, discover new series — without ads.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#0a0612',
    theme_color: '#a855f7',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}