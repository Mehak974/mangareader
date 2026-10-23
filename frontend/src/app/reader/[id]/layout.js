export const revalidate = 86400;

import { buildMetadata, absoluteUrl, chapterSchema, breadcrumbSchema } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
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

export async function generateMetadata({ params }) {
  const { id } = await params;
  const domain = await getRequestDomain();
  return buildMetadata({
    title: `Chapter ${id}`,
    description: `Read chapter ${id} online.`,
    path: `/reader/${id}`,
    noIndex: true, // reader pages are session/query-param driven, not canonical content URLs
    domain,
  });
}

export default async function ReaderLayout({ children, params }) {
  const { id } = await params;
  const domain = await getRequestDomain();
  const mangaTitle = "Manga";
  const mangaSlug = "";
  
  const chapter = chapterSchema({
    chapterNumber: id,
    mangaTitle,
    mangaSlug,
    mangaUrl: mangaSlug ? absoluteUrl(`/manga/${mangaSlug}`, domain) : absoluteUrl("/", domain),
    domain,
  });
  
  const breadcrumbs = breadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Browse", url: "/browse" },
    { name: mangaTitle, url: mangaSlug ? absoluteUrl(`/manga/${mangaSlug}`, domain) : absoluteUrl("/", domain) },
    { name: `Chapter ${id}`, url: absoluteUrl(`/reader/${mangaSlug}/${id}`, domain) },
  ], domain);

  return (
    <>
      <JsonLd data={chapter} />
      <JsonLd data={breadcrumbs} />
      {children}
    </>
  );
}
