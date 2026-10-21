export const revalidate = 86400;

import { buildMetadata, absoluteUrl, SITE_URL, mangaSchema, breadcrumbSchema, SITE_NAME } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import { notFound } from "next/navigation";
import { isBlockedManga } from "@/lib/dmcaBlacklist";
import { prisma } from "@/lib/prisma";

function formatTitle(slug) {
  if (!slug) return "";
  return decodeURIComponent(slug)
    .replace(/-/g, " ")
    .replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

export async function generateMetadata({ params }) {
  const { title: titleSlug } = await params;
  if (isBlockedManga(titleSlug)) {
    notFound();
  }

  let isKorean = false;
  let dbTitle = null;
  try {
    const rows = await prisma.$queryRaw`
      SELECT title, country FROM manga 
      WHERE id = ${titleSlug} 
         OR LOWER(REGEXP_REPLACE(title, '[^a-zA-Z0-9]+', '-', 'g')) = ${titleSlug}
      LIMIT 1
    `;
    if (Array.isArray(rows) && rows.length > 0) {
      if (rows[0]?.country === 'KR') isKorean = true;
      if (rows[0]?.title) dbTitle = rows[0].title;
    }
  } catch {}

  const displayTitle = dbTitle || formatTitle(titleSlug);
  const pageTitle = `Read ${displayTitle} Manga Online Free - All Chapters`;
  const metaDescription = `Read ${displayTitle} manga online for free with high quality scans and full chapter list. Enjoy latest chapter releases, English translations, and updates for ${displayTitle} on ${SITE_NAME}.`;

  return buildMetadata({
    title: pageTitle,
    description: metaDescription,
    path: `/manga/${titleSlug}`,
    type: "article",
    noIndex: isKorean,
  });
}

async function generateJsonLd({ params }) {
  const { title: titleSlug } = await params;
  const name = formatTitle(titleSlug);
  
  // Build manga schema - in production you'd fetch real data
  const manga = mangaSchema({
    title: name,
    slug: titleSlug,
    genres: ["Manga"],
  });
  
  // Breadcrumb schema
  const breadcrumbs = breadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Browse", url: "/browse" },
    { name: name, url: `/manga/${titleSlug}` },
  ]);

  return [manga, breadcrumbs];
}

export default async function MangaDetailLayout({ children, params }) {
  const { title: titleSlug } = await params;
  if (isBlockedManga(titleSlug)) {
    notFound();
  }
  const name = formatTitle(titleSlug);
  
  const manga = mangaSchema({
    title: name,
    slug: titleSlug,
    genres: ["Manga"],
  });
  
  const breadcrumbs = breadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Browse", url: "/browse" },
    { name: name, url: `/manga/${titleSlug}` },
  ]);

  return (
    <>
      <JsonLd data={manga} />
      <JsonLd data={breadcrumbs} />
      {children}
    </>
  );
}
