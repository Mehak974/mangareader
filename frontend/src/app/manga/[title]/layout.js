export const revalidate = 86400;

import { buildMetadata, SITE_NAME, mangaSchema, breadcrumbSchema } from "@/lib/seo";
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
  const name = decodeURIComponent(titleSlug).replace(/-/g, " ");

  // A per-title description. Passing none fell through to the site-wide default
  // in seo.ts, so every manga page shipped the identical homepage description —
  // which collapses thousands of pages into one duplicate snippet and gives
  // Google no reason to rank any of them individually.
  return buildMetadata({
    title: `${name} — Read Online`,
    description: `Read ${name} manga online for free. Browse chapters, follow the story and keep reading ${name} free on ${SITE_NAME}.`,
    path: `/manga/${titleSlug}`,
    type: "article",
  });
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
