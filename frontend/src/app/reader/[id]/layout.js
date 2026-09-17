import { buildMetadata, absoluteUrl, chapterSchema, breadcrumbSchema } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";

/**
 * Same pattern as app/manga/[title]/layout.js — page.js here is a client
 * component, so metadata has to come from a sibling server layout instead.
 *
 * Limitation: this route reads the manga title and manga id from the query
 * string (?title=...&mangaId=...), and Next.js does NOT pass searchParams
 * into a layout's generateMetadata (only route params) — layouts persist
 * across searchParam changes, by design, so they can't react to them. That
 * means this can only use the `id` route param (the chapter number) here,
 * not the manga's name. It's still a real improvement over every reader
 * page sharing one title, but the full fix — a unique title per manga+chapter
 * — needs the manga slug moved into the route path itself, e.g.
 * `/reader/[mangaSlug]/[chapterId]`, which is a URL-structure change beyond
 * the scope of a drop-in metadata fix.
 */
export async function generateMetadata({ params }) {
  const { id } = await params;
  return buildMetadata({
    title: `Chapter ${id}`,
    description: `Read chapter ${id} online.`,
    path: `/reader/${id}`,
    noIndex: true, // reader pages are session/query-param driven, not canonical content URLs
  });
}

export async function generateJsonLd({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const mangaTitle = sp.get("title") || "Manga";
  const mangaSlug = sp.get("mangaId") || "";
  
  const chapter = chapterSchema({
    chapterNumber: id,
    mangaTitle,
    mangaSlug,
    mangaUrl: mangaSlug ? absoluteUrl(`/manga/${mangaSlug}`) : absoluteUrl("/"),
  });
  
  const breadcrumbs = breadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Browse", url: "/browse" },
    { name: mangaTitle, url: mangaSlug ? absoluteUrl(`/manga/${mangaSlug}`) : absoluteUrl("/") },
    { name: `Chapter ${id}`, url: absoluteUrl(`/reader/${mangaSlug}/${id}`) },
  ]);

  return [chapter, breadcrumbs];
}

export default async function ReaderLayout({ children, params, searchParams }) {
  const { id } = await params;
  // In layout default export, searchParams is already resolved (not a Promise)
  const sp = searchParams;
  const mangaTitle = sp?.get?.("title") || "Manga";
  const mangaSlug = sp?.get?.("mangaId") || "";
  
  const chapter = chapterSchema({
    chapterNumber: id,
    mangaTitle,
    mangaSlug,
    mangaUrl: mangaSlug ? absoluteUrl(`/manga/${mangaSlug}`) : absoluteUrl("/"),
  });
  
  const breadcrumbs = breadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Browse", url: "/browse" },
    { name: mangaTitle, url: mangaSlug ? absoluteUrl(`/manga/${mangaSlug}`) : absoluteUrl("/") },
    { name: `Chapter ${id}`, url: absoluteUrl(`/reader/${mangaSlug}/${id}`) },
  ]);

  return (
    <>
      <JsonLd data={chapter} />
      <JsonLd data={breadcrumbs} />
      {children}
    </>
  );
}
