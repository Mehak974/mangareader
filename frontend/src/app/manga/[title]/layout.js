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
  try {
    const rows = await prisma.$queryRaw`
      SELECT id, title, country, cover, description, status, rating, popularity, total_chapters
      FROM manga 
      WHERE id = ${titleSlug} 
         OR LOWER(REGEXP_REPLACE(title, '[^a-zA-Z0-9]+', '-', 'g')) = ${titleSlug}
      LIMIT 1
    `;
    if (Array.isArray(rows) && rows.length > 0) {
      return rows[0];
    }
  } catch {}

  try {
    const dRows = await prisma.$queryRaw`
      SELECT slug, title, chapter_count
      FROM discovered_manga 
      WHERE slug = ${titleSlug}
      LIMIT 1
    `;
    if (Array.isArray(dRows) && dRows.length > 0) {
      return {
        title: dRows[0].title,
        total_chapters: dRows[0].chapter_count,
      };
    }
  } catch {}

  return null;
}

export async function generateMetadata({ params }) {
  const { title: titleSlug } = await params;
  if (isBlockedManga(titleSlug)) {
    notFound();
  }

  const domain = await getRequestDomain();
  const siteName = domain.includes('mangaread') ? 'MangaRead' : domain.includes('manireader') ? 'ManiReader' : SITE_NAME;

  const m = await getMangaData(titleSlug);
  const isKorean = m?.country === 'KR';
  const displayTitle = m?.title || formatTitle(titleSlug);
  const pageTitle = `Read ${displayTitle} Manga Online Free - All Chapters`;
  const metaDescription = m?.description
    ? `${m.description.replace(/<[^>]*>/g, '').slice(0, 155).trim()}... Read ${displayTitle} free online on ${siteName}.`
    : `Read ${displayTitle} manga online for free with high quality scans and full chapter list. Enjoy latest chapter releases, English translations, and updates for ${displayTitle} on ${siteName}.`;

  return buildMetadata({
    title: pageTitle,
    description: metaDescription,
    path: `/manga/${titleSlug}`,
    type: "article",
    image: m?.cover,
    noIndex: isKorean,
    domain,
  });
}

export default async function MangaDetailLayout({ children, params }) {
  const { title: titleSlug } = await params;
  if (isBlockedManga(titleSlug)) {
    notFound();
  }
  const domain = await getRequestDomain();
  const m = await getMangaData(titleSlug);
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
