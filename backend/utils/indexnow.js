/**
 * IndexNow Automated Integration
 * Submits URL changes to search engines (Bing, Yandex, Seznam, Naver)
 * across all 3 active domains simultaneously.
 */

const axios = require('axios');

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
const DEFAULT_KEY = process.env.INDEXNOW_KEY || '1579ed26b5169266ae2c3adaac00a2412e507b7cc87cb7f0c8a187f938413045';
const DOMAINS = ['mangareader.pro', 'mangaread.pro', 'manireader.online'];

// In-memory queue to batch new manga/chapter updates
const urlQueue = new Set();
let debounceTimer = null;

/**
 * Submit a list of absolute URLs for a specific host
 */
async function submitHostUrls(host, urlList) {
  if (!urlList || urlList.length === 0) return;
  try {
    const payload = {
      host,
      key: DEFAULT_KEY,
      keyLocation: `https://${host}/${DEFAULT_KEY}.txt`,
      urlList,
    };

    await axios.post(INDEXNOW_ENDPOINT, payload, {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      timeout: 10000,
    });
    console.log(`[IndexNow] Successfully submitted ${urlList.length} URLs for ${host}`);
  } catch (err) {
    const msg = err.response ? `${err.response.status} ${err.response.statusText}` : err.message;
    console.warn(`[IndexNow] Submission to ${host} failed: ${msg}`);
  }
}

/**
 * Submit relative paths (e.g. ['/manga/solo-leveling']) across all 3 domains
 */
async function submitPathsToAllDomains(paths) {
  if (!paths || paths.length === 0) return;
  const cleanPaths = Array.from(new Set(paths.map(p => p.startsWith('/') ? p : `/${p}`)));

  for (const domain of DOMAINS) {
    const urls = cleanPaths.map(p => `https://${domain}${p}`);
    await submitHostUrls(domain, urls);
  }
}

/**
 * Queue a path for batched near-instant IndexNow notification
 */
function queuePath(path) {
  if (!path) return;
  urlQueue.add(path.startsWith('/') ? path : `/${path}`);

  if (!debounceTimer) {
    // Flush queue after 3 minutes or when reaching 30 items
    debounceTimer = setTimeout(async () => {
      flushQueue().catch(() => {});
    }, 3 * 60 * 1000);
    debounceTimer.unref();
  }

  if (urlQueue.size >= 30) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = null;
    flushQueue().catch(() => {});
  }
}

/**
 * Flush all queued paths to all domains
 */
async function flushQueue() {
  if (urlQueue.size === 0) return;
  const paths = Array.from(urlQueue);
  urlQueue.clear();
  debounceTimer = null;
  console.log(`[IndexNow] Flushing batched queue of ${paths.length} updated manga paths`);
  await submitPathsToAllDomains(paths);
}

/**
 * Hourly automated synchronization:
 * Pulls the latest active manga from the database and submits to IndexNow.
 */
async function runHourlySync(db) {
  try {
    const rows = await db.query(`
      SELECT slug
      FROM discovered_manga
      ORDER BY last_viewed_at DESC
      LIMIT 100
    `);

    const paths = [
      '/',
      '/browse',
      '/trending',
      '/blog',
    ];

    if (rows && rows.rows) {
      for (const r of rows.rows) {
        if (r.slug) paths.push(`/manga/${r.slug}`);
      }
    }

    console.log(`[IndexNow] Running automated sync for ${paths.length} top platform paths`);
    await submitPathsToAllDomains(paths);
  } catch (err) {
    console.warn('[IndexNow] Hourly sync query failed:', err.message);
  }
}

module.exports = {
  submitPathsToAllDomains,
  queuePath,
  flushQueue,
  runHourlySync,
  DOMAINS,
};
