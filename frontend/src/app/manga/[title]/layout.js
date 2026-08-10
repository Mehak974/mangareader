import { buildMetadata, absoluteUrl } from "@/lib/seo";

/**
 * `page.js` in this route is a client component ("use client"), so it can't
 * export `generateMetadata` — that API only works in Server Components.
 * Rather than rewrite the (large, stateful, working) client page, this
 * sibling layout is a Server Component that fetches just enough from AniList
 * to produce a unique title/description/OG image per manga, then renders
 * the existing client page unchanged as `children`.
 *
 * This talks to AniList's public GraphQL API directly (not through the
 * project's own /api/anilist proxy) because that proxy sits behind
 * CSRF middleware designed for browser requests with a session cookie —
 * not a great fit for a server-to-server call with no browser involved.
 * AniList's endpoint is public and requires no auth for read queries.
 *
 * Best-effort: if AniList is slow/unreachable/rate-limited, this falls back
 * to sensible generic metadata rather than failing the page render.
 */

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

const SEARCH_QUERY = `
  query ($search: String) {
    Page(perPage: 5) {
      media(search: $search, type: MANGA) {
        id
        title { english romaji userPreferred }
        description(asHtml: false)
        coverImage { large }
        genres
        status
        averageScore
        chapters
        startDate { year }
      }
    }
  }
`;

function slugify(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function findManga(titleSlug) {
  const searchTitle = decodeURIComponent(titleSlug).replace(/-/g, " ");
  try {
    const res = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: SEARCH_QUERY, variables: { search: searchTitle } }),
      // Metadata should be fast; don't let a slow AniList response hold up the page.
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const results = json?.data?.Page?.media ?? [];
    if (results.length === 0) return null;

    const exact = results.find((m) => slugify(m.title.userPreferred || "") === titleSlug);
    return exact || results[0];
  } catch {
    return null;
  }
}

function bookSchema(media, titleSlug) {
  const name = media.title.english || media.title.userPreferred || media.title.romaji;
  const url = absoluteUrl(`/manga/${titleSlug}`);
  const image = media.coverImage?.large;

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Book",
    name,
    url,
    image: image ? absoluteUrl(image) : undefined,
    description: media.description
      ? media.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200)
      : undefined,
    genre: media.genres?.slice(0, 5) || [],
    numberOfPages: media.chapters ? `Chapters: ${media.chapters}` : undefined,
    datePublished: media.startDate?.year ? `${media.startDate.year}-01-01` : undefined,
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

  if (media.averageScore) schema.aggregateRating = { "@type": "AggregateRating", ratingValue: media.averageScore / 20, bestRating: 5 };

  return schema;
}

export async function generateMetadata({ params }) {
  const { title: titleSlug } = await params;
  const media = await findManga(titleSlug);

  if (!media) {
    const fallbackTitle = decodeURIComponent(titleSlug).replace(/-/g, " ");
    return buildMetadata({
      title: `${fallbackTitle} — Read Online`,
      path: `/manga/${titleSlug}`,
      type: "article",
    });
  }

  const name = media.title.english || media.title.userPreferred || media.title.romaji;
  const rawDescription = (media.description || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const description = rawDescription
    ? `${rawDescription.slice(0, 155)}${rawDescription.length > 155 ? "…" : ""}`
    : `Read ${name} online — ${(media.genres || []).slice(0, 3).join(", ")}.`;

  return buildMetadata({
    title: `Read ${name} Online`,
    description,
    path: `/manga/${titleSlug}`,
    type: "article",
    image: media.coverImage?.large,
  });
}

export async function generateJsonLd({ params }) {
  const { title: titleSlug } = await params;
  const media = await findManga(titleSlug);
  if (!media) return [];
  return [bookSchema(media, titleSlug)];
}

export default function MangaDetailLayout({ children }) {
  return children;
}
