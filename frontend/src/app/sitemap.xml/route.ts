import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isBlockedManga } from '@/lib/dmcaBlacklist';
import { submitPathsToAllDomains } from '@/lib/indexnow';

export const dynamic = 'force-dynamic';

const today = new Date().toISOString().slice(0, 10);

const STATIC_ROUTES = [
  { path: '',        changeFrequency: 'daily',   priority: '1.0', lastModified: today },
  { path: '/browse',  changeFrequency: 'daily',   priority: '0.9', lastModified: today },
  { path: '/blog',    changeFrequency: 'daily',   priority: '0.8', lastModified: today },
  { path: '/about',   changeFrequency: 'monthly', priority: '0.5', lastModified: '2026-11-20' },
  { path: '/contact', changeFrequency: 'monthly', priority: '0.5', lastModified: '2026-11-20' },
  { path: '/faq',     changeFrequency: 'monthly', priority: '0.5', lastModified: '2026-11-20' },
  { path: '/cookies', changeFrequency: 'monthly', priority: '0.4', lastModified: '2026-11-20' },
  { path: '/privacy', changeFrequency: 'yearly',  priority: '0.3', lastModified: '2026-11-20' },
  { path: '/terms',   changeFrequency: 'yearly',  priority: '0.3', lastModified: '2026-11-20' },
  { path: '/dmca',    changeFrequency: 'yearly',  priority: '0.3', lastModified: '2026-11-20' },
];

const SITEMAP_TOP_MANGA = 150;

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

  // 3. Top Popular Manga, Manhwa, and Chinese Martial Arts/Cultivation for search engine indexing
  try {
    const topManga = await withTimeout(
      prisma.$queryRawUnsafe<Array<{ title: string }>>(`
        SELECT DISTINCT title FROM (
          -- 1. All Chinese manga in manga table
          SELECT title FROM manga WHERE country = 'CN' AND title IS NOT NULL
          UNION
          -- 2. Martial arts / Cultivation / Wuxia / Xianxia in manga table
          SELECT title FROM manga WHERE (title ILIKE '%martial%' OR title ILIKE '%cultivat%' OR title ILIKE '%wuxia%' OR title ILIKE '%xianxia%' OR title ILIKE '%immortal%' OR title ILIKE '%peerless%' OR title ILIKE '%invincible%' OR title ILIKE '%alchemist%' OR title ILIKE '%sect%') AND title IS NOT NULL
          UNION
          -- 3. All Discovered Chinese / Martial / Cultivation titles
          SELECT title FROM discovered_manga WHERE (slug ILIKE '%martial%' OR slug ILIKE '%cultivat%' OR slug ILIKE '%wuxia%' OR slug ILIKE '%xianxia%' OR slug ILIKE '%immortal%' OR slug ILIKE '%peerless%' OR slug ILIKE '%invincible%' OR slug ILIKE '%alchemist%' OR slug ILIKE '%sect%') AND title IS NOT NULL
          UNION
          -- 4. Top 400 popular manga overall
          SELECT title FROM (
            SELECT title FROM manga WHERE title IS NOT NULL ORDER BY popularity DESC NULLS LAST LIMIT 400
          ) sub
        ) combined
        ORDER BY title ASC
      `),
      6000
    );

    if (topManga && Array.isArray(topManga)) {
      for (const m of topManga) {
        if (!m.title) continue;
        const slug = m.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        if (isBlockedManga(slug)) continue;

        xml += `  <url>\n`;
        xml += `    <loc>${siteUrl}/manga/${slug}</loc>\n`;
        xml += `    <lastmod>${new Date().toISOString()}</lastmod>\n`;
        xml += `    <changefreq>daily</changefreq>\n`;
        xml += `    <priority>0.8</priority>\n`;
        xml += `  </url>\n`;
      }
    }
  } catch (err) {
    console.error('Error adding top manga to sitemap:', err);
  }

  xml += `</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
