import "server-only";

const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const DEFAULT_KEY = "1579ed26b5169266ae2c3adaac00a2412e507b7cc87cb7f0c8a187f938413045";

export const ALL_DOMAINS = ["mangareader.pro", "mangaread.pro", "manireader.online"];

export async function submitToIndexNow(urls: string[], host?: string): Promise<void> {
  const key = process.env.INDEXNOW_KEY || DEFAULT_KEY;
  if (!key || urls.length === 0) return;

  try {
    const targetHost = host || (urls[0] ? new URL(urls[0]).host : "mangareader.pro");
    const domainUrl = `https://${targetHost}`;

    await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: targetHost,
        key,
        keyLocation: `${domainUrl}/${key}.txt`,
        urlList: urls,
      }),
    });
  } catch (err) {
    console.error(`IndexNow submission failed for ${host} (non-fatal):`, err);
  }
}

/** Convenience wrapper for a single URL. */
export async function submitUrlToIndexNow(url: string): Promise<void> {
  return submitToIndexNow([url]);
}

/** Submit a batch of relative paths across all 3 active domains simultaneously */
export async function submitPathsToAllDomains(paths: string[]): Promise<void> {
  for (const domain of ALL_DOMAINS) {
    const urls = paths.map(p => `https://${domain}${p.startsWith('/') ? p : `/${p}`}`);
    await submitToIndexNow(urls, domain);
  }
}
