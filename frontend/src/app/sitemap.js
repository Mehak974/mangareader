import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";

/**
 * Dynamic sitemap.
 *
 * Lists the public, indexable surface of the site: static marketing/app routes
 * plus every PUBLISHED article and manga detail page. Private and auth-gated
 * routes (/admin, /login, /signup, /settings, /profile) are deliberately
 * excluded — they are also disallowed in robots.js.
 *
 * This is a special Route Handler. Because it reads from the database it opts
 * into dynamic rendering rather than being cached at build time.
 */
export const dynamic = "force-dynamic";

// `/library` and `/history` are intentionally NOT listed here: they render
// per-user data behind client-side auth state and have no unique indexable
// content for an anonymous crawler. They're also disallowed in robots.js.
const STATIC_ROUTES = [
  { path: "/", changeFrequency: "daily", priority: 1.0, lastModified: "2026-07-01" },
  { path: "/browse", changeFrequency: "daily", priority: 0.9, lastModified: "2026-07-01" },
  { path: "/blog", changeFrequency: "daily", priority: 0.8, lastModified: "2026-07-01" },
  { path: "/about", changeFrequency: "monthly", priority: 0.5, lastModified: "2026-01-01" },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3, lastModified: "2026-01-01" },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3, lastModified: "2026-01-01" },
  { path: "/dmca", changeFrequency: "yearly", priority: 0.3, lastModified: "2026-01-01" },
];

export default async function sitemap() {
  // Bump each route's `lastModified` string above when that page's content
  // actually changes, rather than stamping every route with the request
  // time. An always-"now" lastmod tells crawlers nothing and can suppress
  // re-crawl prioritization for pages that genuinely did just change.
  const staticEntries = STATIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: new Date(route.lastModified),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  let articleEntries = [];
  try {
    const articles = await prisma.article.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });

    articleEntries = articles.map((article) => ({
      url: `${SITE_URL}/blog/${article.slug}`,
      lastModified: article.updatedAt,
      changeFrequency: "weekly",
      priority: 0.7,
    }));
  } catch {
    articleEntries = [];
  }

  return [...staticEntries, ...articleEntries];
}
