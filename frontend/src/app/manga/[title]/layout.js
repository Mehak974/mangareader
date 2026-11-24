export const revalidate = 86400;

import { buildMetadata, absoluteUrl, SITE_URL, mangaSchema, breadcrumbSchema, SITE_NAME } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import { notFound } from "next/navigation";
import { isBlockedManga } from "@/lib/dmcaBlacklist";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

async function getRequestDomain() {
  try {
    const headersList = await headers();
    const host = headersList.get('x-forwarded-host') || headersList.get('host') || '';
    if (host.includes('mangafire.pro')) return 'mangafire.pro';
    if (host.includes('mangaread.pro')) return 'mangaread.pro';
    if (host.includes('manireader.online') || host.includes('manireader.pro')) return 'manireader.online';
  } catch {}
  return 'mangareader.pro';
}

function formatTitle(slug) {
  if (!slug) return "";
  return decodeURIComponent(slug)
    .replace(/-/g, " ")
    .replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

async function getMangaData(titleSlug) {
  let m = null;
  try {
    const rows = await prisma.$queryRaw`
      SELECT id, title, country, cover, description, status, rating, popularity, total_chapters
      FROM manga 
      WHERE id = ${titleSlug} 
         OR LOWER(REGEXP_REPLACE(title, '[^a-zA-Z0-9]+', '-', 'g')) = ${titleSlug}
      LIMIT 1
    `;
    if (Array.isArray(rows) && rows.length > 0) {
      m = rows[0];
    }
  } catch {}

  if (!m) {
    try {
      const dRows = await prisma.$queryRaw`
        SELECT slug, title, chapter_count
        FROM discovered_manga 
        WHERE slug = ${titleSlug}
        LIMIT 1
      `;
      if (Array.isArray(dRows) && dRows.length > 0) {
        m = {
          title: dRows[0].title,
          total_chapters: dRows[0].chapter_count,
        };
      }
    } catch {}
  }

  // 3. Fallback: Query AniList directly if country is unknown
  if (!m?.country) {
    try {
      const cleanTitle = (m?.title || decodeURIComponent(titleSlug)).replace(/-/g, ' ');
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        body: JSON.stringify({
          query: `query ($search: String) { Media(search: $search, type: MANGA) { id countryOfOrigin genres title { english romaji userPreferred } } }`,
          variables: { search: cleanTitle }
        }),
        next: { revalidate: 86400 }
      });
      if (res.ok) {
        const data = await res.json();
        const media = data?.data?.Media;
        if (media) {
          m = {
            ...(m || {}),
            id: String(media.id),
            title: m?.title || media.title?.english || media.title?.romaji || media.title?.userPreferred || cleanTitle,
            country: media.countryOfOrigin,
            genres: media.genres || []
          };
        }
      }
    } catch {}
  }

  return m;
}

export async function generateMetadata({ params }) {
  const { title: titleSlug } = await params;
  const m = await getMangaData(titleSlug);
  const isProtected = m?.country === 'KR' || m?.country === 'JP' || isBlockedManga(titleSlug) || String(m?.genres || '').toLowerCase().includes('manhwa');

  // Hard 404 for DMCA-blocked titles, Korean manhwa, and Japanese manga on public /manga/ route
  if (isProtected) {
    notFound();
  }

  const domain = await getRequestDomain();
  const siteName = domain.includes('mangafire') ? 'MangaFire' : domain.includes('mangaread.') ? 'MangaRead' : domain.includes('manireader') ? 'ManiReader' : SITE_NAME;
  const displayTitle = m?.title || formatTitle(titleSlug);
  const chCount = m?.total_chapters ? Number(m.total_chapters) : null;
  const chSnippet = chCount && chCount > 0 ? ` (Ch. 1 - ${chCount})` : '';

  const pageTitle = domain.includes('mangafire')
    ? `${displayTitle}${chSnippet} Free English Scans & Online Reader`
    : domain.includes('mangaread.')
    ? `${displayTitle}${chSnippet} English Chapters - Read Free Online`
    : domain.includes('manireader')
    ? `${displayTitle}${chSnippet} Webtoon & Manga - Read Online Free`
    : `Read ${displayTitle}${chSnippet} Online Free - Latest English Chapters`;

  const chDesc = chCount && chCount > 0 ? `chapters 1 through ${chCount}` : 'latest chapter releases';
  const metaDescription = domain.includes('mangafire')
    ? (m?.description
        ? `${m.description.replace(/<[^>]*>/g, '').slice(0, 140).trim()}... Read all chapters of ${displayTitle} (${chDesc}) online for free on MangaFire.`
        : `Read ${displayTitle} manga online for free with high quality scans and full chapter list on MangaFire Pro.`)
    : domain.includes('manireader')
    ? (m?.description 
        ? `${m.description.replace(/<[^>]*>/g, '').slice(0, 140).trim()}... Read ${displayTitle} webtoon scans (${chDesc}) on ManiReader.`
        : `Read ${displayTitle} webtoon and manga online with high quality chapters and daily updates on ManiReader.`)
    : domain.includes('mangaread.')
    ? (m?.description
        ? `${m.description.replace(/<[^>]*>/g, '').slice(0, 140).trim()}... Read ${displayTitle} (${chDesc}) free on MangaRead.`
        : `Read all English chapters of ${displayTitle} (${chDesc}) for free on MangaRead with fast page loading.`)
    : (m?.description
        ? `${m.description.replace(/<[^>]*>/g, '').slice(0, 140).trim()}... Read ${displayTitle} (${chDesc}) free online with high quality scans on ${siteName}.`
        : `Read ${displayTitle} manga online for free with high quality scans and full chapter list. Enjoy ${chDesc}, English translations, and daily updates on ${siteName}.`);

  return buildMetadata({
    title: pageTitle,
    description: metaDescription,
    path: `/manga/${titleSlug}`,
    type: "article",
    image: m?.cover,
    noIndex: isProtected,
    domain,
  });
}

export default async function MangaDetailLayout({ children, params }) {
  const { title: titleSlug } = await params;
  const m = await getMangaData(titleSlug);
  const isProtected = m?.country === 'KR' || m?.country === 'JP' || isBlockedManga(titleSlug) || String(m?.genres || '').toLowerCase().includes('manhwa');

  if (isProtected) {
    notFound();
  }
  const domain = await getRequestDomain();
  const name = m?.title || formatTitle(titleSlug);
  const chaptersCount = m?.total_chapters ? Number(m.total_chapters) : undefined;
  const ratingValue = m?.rating ? Number(m.rating) : 4.8;
  const popularityValue = m?.popularity ? Number(m.popularity) : undefined;
  
  const manga = mangaSchema({
    title: name,
    slug: titleSlug,
    coverImage: m?.cover,
    description: m?.description,
    status: m?.status || "Ongoing",
    chapters: chaptersCount,
    rating: ratingValue,
    popularity: popularityValue,
    genres: ["Manga"],
    domain,
  });
  
  const breadcrumbs = breadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Browse", url: "/browse" },
    { name: name, url: `/manga/${titleSlug}` },
  ], domain);

  return (
    <>
      <JsonLd data={manga} />
      <JsonLd data={breadcrumbs} />
      {children}
    </>
  );
}
