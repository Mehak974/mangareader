export const revalidate = 86400;

import { buildMetadata, absoluteUrl, SITE_URL, mangaSchema, breadcrumbSchema } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import { notFound } from "next/navigation";
import { isBlockedManga } from "@/lib/dmcaBlacklist";
import { prisma } from "@/lib/prisma";

function slugify(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function generateMetadata({ params }) {
  const { title: titleSlug } = await params;
  if (isBlockedManga(titleSlug)) {
    notFound();
  }
  const fallbackTitle = decodeURIComponent(titleSlug).replace(/-/g, " ");

  let isKorean = false;
  try {
    const rows = await prisma.$queryRaw`
      SELECT country FROM manga 
      WHERE id = ${titleSlug} 
         OR LOWER(REGEXP_REPLACE(title, '[^a-zA-Z0-9]+', '-', 'g')) = ${titleSlug}
      LIMIT 1
    `;
    if (Array.isArray(rows) && rows.length > 0 && rows[0]?.country === 'KR') {
      isKorean = true;
    }
  } catch {}

  return buildMetadata({
    title: `${fallbackTitle} — Read Online`,
    path: `/manga/${titleSlug}`,
    type: "article",
    noIndex: isKorean,
  });
}

async function generateJsonLd({ params }) {
  const { title: titleSlug } = await params;
  const name = decodeURIComponent(titleSlug).replace(/-/g, " ");
  
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
  const name = decodeURIComponent(titleSlug).replace(/-/g, " ");
  
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
