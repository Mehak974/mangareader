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
      allow: "/",
      disallow: [
        "/admin",
        "/api",
        "/login",
        "/signup",
        "/settings",
        "/profile",
        "/library",
        "/history",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
