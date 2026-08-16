import { buildMetadata, absoluteUrl, SITE_URL } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";

function slugify(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function bookSchema(titleSlug) {
  const name = decodeURIComponent(titleSlug).replace(/-/g, " ");
  const url = absoluteUrl(`/manga/${titleSlug}`);

  return {
    "@context": "https://schema.org",
    "@type": "Book",
    name,
    url,
    description: `Read ${name} manga online for free.`,
    genre: [],
    inLanguage: "en",
    author: {
      "@type": "Organization",
      name: "Aggregated from multiple publishers",
    },
    isAccessibleForFree: "True",
    publisher: {
      "@type": "Organization",
      name: "MangaReader",
      url: SITE_URL,
    },
  };
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
  return [bookSchema(titleSlug)];
}

export default async function MangaDetailLayout({ children, params }) {
  const { title: titleSlug } = await params;
  const schema = bookSchema(titleSlug);

  return (
    <>
      {schema && <JsonLd data={schema} />}
      {children}
    </>
  );
}
