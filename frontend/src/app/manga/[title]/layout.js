export const revalidate = 86400;

import { buildMetadata, absoluteUrl, SITE_URL, mangaSchema, breadcrumbSchema } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";

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
  const fallbackTitle = decodeURIComponent(titleSlug).replace(/-/g, " ");

  return buildMetadata({
    title: `${fallbackTitle} — Read Online`,
    path: `/manga/${titleSlug}`,
    type: "article",
  });
}

export async function generateJsonLd({ params }) {
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
