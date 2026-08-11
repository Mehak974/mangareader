import { SITE_URL } from "@/lib/seo";

/**
 * robots.txt generator.
 *
 * Allows crawling of the public site while disallowing auth-gated and private
 * areas. Points crawlers at the dynamic sitemap.
 */
export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/api/og"],
      disallow: [
        "/admin",
        "/api",
        "/api/auth",
        "/_next",
        "/static",
        "/login",
        "/signup",
        "/settings",
        "/profile",
        "/library",
        "/history",
      ],
      crawlDelay: 2,
    },
    sitemap: [
      `${SITE_URL}/sitemap.xml`,
      `${SITE_URL}/sitemap-manga.xml`,
      `${SITE_URL}/sitemap-blog.xml`,
    ],
    host: SITE_URL,
  };
}
