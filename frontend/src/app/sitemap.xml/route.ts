import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isBlockedManga } from '@/lib/dmcaBlacklist';

export const dynamic = 'force-dynamic';

const STATIC_ROUTES = [
  { path: '',        changeFrequency: 'daily',   priority: '1.0', lastModified: '2026-09-01' },
  { path: '/browse',  changeFrequency: 'daily',   priority: '0.9', lastModified: '2026-09-01' },
  { path: '/blog',    changeFrequency: 'daily',   priority: '0.8', lastModified: '2026-09-01' },
  { path: '/about',   changeFrequency: 'monthly', priority: '0.5', lastModified: '2026-09-01' },
  { path: '/contact', changeFrequency: 'monthly', priority: '0.5', lastModified: '2026-09-01' },
  { path: '/faq',     changeFrequency: 'monthly', priority: '0.5', lastModified: '2026-09-01' },
  { path: '/cookies', changeFrequency: 'monthly', priority: '0.4', lastModified: '2026-09-01' },
  { path: '/privacy', changeFrequency: 'yearly',  priority: '0.3', lastModified: '2026-09-01' },
  { path: '/terms',   changeFrequency: 'yearly',  priority: '0.3', lastModified: '2026-09-01' },
  { path: '/dmca',    changeFrequency: 'yearly',  priority: '0.3', lastModified: '2026-09-01' },
];

const SITEMAP_TOP_MANGA = 50;

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), ms)
    ),
  ]);

export async function GET(request: NextRequest) {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'mangareader.pro';
  let domain = 'mangareader.pro';
  if (host.includes('mangaread.pro')) {
    domain = 'mangaread.pro';
  } else if (host.includes('manireader.online') || host.includes('manireader.pro')) {
    domain = 'manireader.online';
  }

  const siteUrl = `https://${domain}`;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  // 1. Static routes
  for (const r of STATIC_ROUTES) {
    xml += `  <url>\n`;
    xml += `    <loc>${siteUrl}${r.path}</loc>\n`;
    xml += `    <lastmod>${new Date(r.lastModified).toISOString()}</lastmod>\n`;
    xml += `    <changefreq>${r.changeFrequency}</changefreq>\n`;
    xml += `    <priority>${r.priority}</priority>\n`;
    xml += `  </url>\n`;
  }

  // 2. Published blog articles (with 1.5s timeout)
  try {
    const articles = await withTimeout(
      prisma.article.findMany({
        where:   { status: 'PUBLISHED' },
        select:  { slug: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
      1500
    );
    for (const a of articles) {
      xml += `  <url>\n`;
      xml += `    <loc>${siteUrl}/blog/${a.slug}</loc>\n`;
      xml += `    <lastmod>${a.updatedAt.toISOString()}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.7</priority>\n`;
      xml += `  </url>\n`;
    }
  } catch {}

  // 3. Top discovered manga (with 2.0s timeout)
  try {
    const discovered = await withTimeout(
      prisma.$queryRaw<
        { slug: string; lastViewedAt: Date; viewCount: number }[]
      >`
        SELECT d.slug, d.last_viewed_at AS "lastViewedAt", d.view_count AS "viewCount"
        FROM discovered_manga d
        LEFT JOIN manga m ON m.id = d.slug OR LOWER(REGEXP_REPLACE(m.title, '[^a-zA-Z0-9]+', '-', 'g')) = d.slug
        WHERE (m.country IS NULL OR m.country != 'KR')
        ORDER BY d.view_count DESC, d.last_viewed_at DESC
        LIMIT ${SITEMAP_TOP_MANGA}
      `,
      2000
    );

    const step = 0.4 / Math.max(1, SITEMAP_TOP_MANGA - 1);
    const validManga = discovered.filter((m) => !isBlockedManga(m.slug));

    validManga.forEach((m, i) => {
      const priority = Number((0.9 - i * step).toFixed(2));
      xml += `  <url>\n`;
      xml += `    <loc>${siteUrl}/manga/${m.slug}</loc>\n`;
      xml += `    <lastmod>${new Date(m.lastViewedAt).toISOString()}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>${priority}</priority>\n`;
      xml += `  </url>\n`;
    });
  } catch {}

  xml += `</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
