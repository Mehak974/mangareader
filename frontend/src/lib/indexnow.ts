import "server-only";
import { SITE_URL } from "@/lib/seo";

/**
 * IndexNow — a single ping notifies Bing, Yandex, and any other participating
 * search engine that a URL was added/changed, instead of waiting for the next
 * crawl. Requires:
 *   1. INDEXNOW_KEY set in the environment (any random hex string works).
 *   2. That same key hosted at {SITE_URL}/{key}.txt containing just the key
 *      (see app/[key]/route.js below, or drop a static file in /public).
 *
 * This is intentionally best-effort: a failed ping should never break the
 * publish flow, so every call is wrapped and swallows errors.
 */
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

export async function submitToIndexNow(urls: string[]): Promise<void> {
  const key = process.env.INDEXNOW_KEY;
  if (!key || urls.length === 0) return;

  try {
    const host = new URL(SITE_URL).host;
    await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `${SITE_URL}/${key}.txt`,
        urlList: urls,
      }),
    });
  } catch (err) {
    console.error("IndexNow submission failed (non-fatal):", err);
  }
}

/** Convenience wrapper for a single URL. */
export async function submitUrlToIndexNow(url: string): Promise<void> {
  return submitToIndexNow([url]);
}
