/**
 * Redis-based cache utility with NodeCache fallback.
 * Provides TTL tiers for different data types and graceful degradation
 * when Redis is unavailable.
 */

const NodeCache = require('node-cache');
const { getRedisClient } = require('../middleware/rateLimit');

// useClones: false — NodeCache defaults to deep-cloning values on get/set.
// For image Buffers that doubles memory per cache hit. Verified: the Buffer
// returned by get() is a different instance than the one stored.
//
// maxKeys is deliberately NOT set: NodeCache throws "Cache max keys amount
// exceeded" on the (maxKeys + 1)th key, and set() was unguarded, so every
// new key after the limit returned 502 until restart. The byte-based
// pruning in backend/index.js (imageCache) is the right approach; here we
// rely on the Redis primary and let the process restart if memory grows.
const memFallback = new NodeCache({ stdTTL: 3600, checkperiod: 600, useClones: false });

const TTL = {
  anilist_manga_info: 60 * 60 * 24 * 7,       // 7 days
  anilist_search:     60 * 60 * 6,            // 6 hours
  anilist_trending:   60 * 60 * 1,            // 1 hour
  anilist_meta_search: 60 * 60 * 2,           // 2 hours (metadata by title)
  chapter_list:       60 * 60 * 12,           // 12 hours
  // MangaKatana serves tokenized image URLs (/token/<expiry>/0.jpg) that return
  // 403 once the token expires, so its image lists must not outlive the token.
  // Sources with stable image URLs still get the 1-year TTL.
  chapter_images:     60 * 60 * 24 * 365,    // 1 year — Manganato/MangaRead URLs are stable
  chapter_images_mangakatana: 60 * 10,        // 10 minutes (tokenized URLs)
  scraper_search:     60 * 60 * 2,            // 2 hours
  image_proxy:        60 * 60 * 24 * 365,     // 1 year (images are immutable)
  readers_also_love:  60 * 60 * 24 * 365 * 10, // 10 years (effectively forever)
  static_pages:       60 * 60 * 24 * 365 * 10, // 10 years (effectively forever)
};

let redis;
setTimeout(() => {
  const rl = getRedisClient();
  if (rl && rl.status === 'ready') redis = rl;
}, 2000).unref();

setInterval(() => {
  const rl = getRedisClient();
  if (rl && rl.status === 'ready' && !redis) redis = rl;
}, 5000).unref();

const inFlight = new Map();
// /api/anilist derives its key from an arbitrary request body, so distinct
// bodies produce distinct keys. Unbounded, that map is a slow leak under load.
const MAX_INFLIGHT = 500;

function key(ns, id) {
  return `${ns}:${id}`;
}

async function get(ns, id) {
  const k = key(ns, id);
  if (redis) {
    try {
      const val = await redis.get(k);
      if (val !== null) return JSON.parse(val);
    } catch (err) {
      console.error('[cache] Redis get error:', err.message);
    }
  }
  const val = memFallback.get(k);
  return val !== undefined ? val : null;
}

async function set(ns, id, data, ttlOverride = null) {
  const k = key(ns, id);
  let ttl = ttlOverride !== null ? ttlOverride : (TTL[ns] || 3600);
  // Cap the in-memory fallback at 6h. The TTL table has entries like
  // chapter_images (1 year) and readers_also_love (10 years) that are meant
  // for Redis. When Redis is down or unset, storing those in process memory
  // would grow unbounded and never expire.
  if (ttl > 6 * 3600) ttl = 6 * 3600;
  if (redis) {
    try {
      await redis.set(k, JSON.stringify(data), 'EX', ttlOverride !== null ? ttlOverride : (TTL[ns] || 3600));
      return;
    } catch (err) {
      console.error('[cache] Redis set error:', err.message);
    }
  }
  // Guard the memFallback set. NodeCache throws "Cache max keys amount
  // exceeded" when the internal limit is hit, and without a try/catch that
  // propagates as an unhandled rejection and kills the request. Skip the
  // write rather than crashing — the caller already has the data in hand.
  try {
    memFallback.set(k, data, ttl);
  } catch (err) {
    console.error('[cache] memFallback set error:', err.message);
  }
}

async function del(ns, id) {
  const k = key(ns, id);
  if (redis) {
    try { await redis.del(k); } catch (err) { console.error('[cache] Redis del error:', err.message); }
  }
  memFallback.del(k);
}

/**
 * Deduplicate in-flight cache misses for the same key.
 * Prevents 100 concurrent requests for the same manga from causing
 * 100 upstream calls.
 */
async function getOrFetch(ns, id, ttl, fetchFn) {
  const k = key(ns, id);

  const cached = await get(ns, id);
  if (cached !== null && cached !== undefined) return { data: cached, cached: true };

  if (inFlight.has(k)) {
    return { data: await inFlight.get(k), cached: false };
  }

  // Shed rather than grow without bound; the caller falls back to a live fetch.
  if (inFlight.size >= MAX_INFLIGHT) {
    return { data: await fetchFn(), cached: false };
  }

  const promise = (async () => {
    try {
      const result = await fetchFn();
      if (result !== null && result !== undefined) {
        await set(ns, id, result, ttl);
      }
      return result;
    } finally {
      inFlight.delete(k);
    }
  })();

  inFlight.set(k, promise);
  const data = await promise;
  return { data, cached: false };
}

module.exports = {
  TTL,
  get,
  set,
  del,
  getOrFetch,
  key,
  inFlight,
  memFallback,
};
