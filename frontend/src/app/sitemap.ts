/**
 * sitemap.ts — Domain-aware dynamic sitemap + IndexNow support
 *
 * Replaces src/app/sitemap.js
 *
 * Changes:
 *  - SITE_URL from site-config (so each domain gets its own canonical URLs)
 *  - IndexNow ping helper exported (call from your article/manga publish
 *    API routes to notify Bing/Google of new content instantly)
 */

import type { MetadataRoute } from 'next';
import { prisma }   from '@/lib/prisma';
import { SITE_URL } from '@/lib/site-config';

export const dynamic = 'force-dynamic';

// ── Static routes (same for all domains) ─────────────────────────────────────
const STATIC_ROUTES: Array<{
  path: string;
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: number;
  lastModified: string;
}> = [
  { path: '/',        changeFrequency: 'daily',   priority: 1.0, lastModified: '2026-09-01' },
  { path: '/browse',  changeFrequency: 'daily',   priority: 0.9, lastModified: '2026-09-01' },
  { path: '/blog',    changeFrequency: 'daily',   priority: 0.8, lastModified: '2026-09-01' },
  { path: '/about',   changeFrequency: 'monthly', priority: 0.5, lastModified: '2026-09-01' },
  { path: '/contact', changeFrequency: 'monthly', priority: 0.5, lastModified: '2026-09-01' },
  { path: '/faq',     changeFrequency: 'monthly', priority: 0.5, lastModified: '2026-09-01' },
  { path: '/cookies', changeFrequency: 'monthly', priority: 0.4, lastModified: '2026-09-01' },
  { path: '/privacy', changeFrequency: 'yearly',  priority: 0.3, lastModified: '2026-09-01' },
  { path: '/terms',   changeFrequency: 'yearly',  priority: 0.3, lastModified: '2026-09-01' },
  { path: '/dmca',    changeFrequency: 'yearly',  priority: 0.3, lastModified: '2026-09-01' },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static routes
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map(r => ({
    url:             `${SITE_URL}${r.path}`,
    lastModified:    new Date(r.lastModified),
    changeFrequency: r.changeFrequency,
    priority:        r.priority,
  }));

  // Published blog articles
  let articleEntries: MetadataRoute.Sitemap = [];
  try {
    const articles = await prisma.article.findMany({
      where:   { status: 'PUBLISHED' },
      select:  { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });
    articleEntries = articles.map(a => ({
      url:             `${SITE_URL}/blog/${a.slug}`,
      lastModified:    a.updatedAt,
      changeFrequency: 'weekly' as const,
      priority:        0.7,
    }));
  } catch { /* DB unavailable during build — skip */ }

  // Discovered manga pages (most recently viewed first, capped at 5 000)
  let mangaEntries: MetadataRoute.Sitemap = [];
  try {
    const discovered = await prisma.$queryRaw<
      { slug: string; lastViewedAt: Date; viewCount: number }[]
    >`
      SELECT slug, last_viewed_at AS "lastViewedAt", view_count AS "viewCount"
      FROM discovered_manga
      ORDER BY last_viewed_at DESC
      LIMIT 5000
    `;
    mangaEntries = discovered.map(m => ({
      url:             `${SITE_URL}/manga/${m.slug}`,
      lastModified:    m.lastViewedAt,
      changeFrequency: 'weekly' as const,
      // Boost popular titles toward 0.9; base floor at 0.5
      priority:        Math.min(0.9, 0.5 + Math.min((m.viewCount ?? 0) / 100, 0.4)),
    }));
  } catch { /* DB unavailable */ }

  return [...staticEntries, ...articleEntries, ...mangaEntries];
}

// ── IndexNow helper ───────────────────────────────────────────────────────────
/**
 * Ping Bing (+ Yandex / other IndexNow engines) with a list of new / updated URLs.
 *
 * Call this from your article or manga publish API route, e.g.:
 *   import { pingIndexNow } from '@/app/sitemap';
 *   await pingIndexNow([`${SITE_URL}/blog/${article.slug}`]);
 *
 * Set INDEXNOW_KEY in Vercel env vars (generate a key at https://www.bing.com/indexnow).
 * Drop the key file at /public/<key>.txt — Bing will verify ownership.
 */
export async function pingIndexNow(urls: string[]): Promise<void> {
  const key = process.env.INDEXNOW_KEY;
  if (!key || urls.length === 0) return;

  const host = new URL(SITE_URL).hostname;

  try {
    await fetch('https://api.indexnow.org/indexnow', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `${SITE_URL}/${key}.txt`,
        urlList: urls.slice(0, 10000), // IndexNow batch limit
      }),
    });
    console.log(`[IndexNow] Pinged ${urls.length} URLs for ${host}`);
  } catch (err) {
    console.error('[IndexNow] Ping failed:', err);
  }
}
