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
    name:        SITE_NAME,
    short_name:  SITE_NAME,
    description:
      'Sync reading across devices. Bookmark chapters, track progress, discover new series — without ads.',
    start_url:   '/',
    display:     'standalone',
    background_color: '#0a0612',
    theme_color:       '#FFB300',
    icons: [
      {
        src:   '/favicon.ico',
        sizes: 'any',
        type:  'image/x-icon',
      },
    ],
  };
}