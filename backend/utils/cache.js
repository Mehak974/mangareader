/**
 * Redis-based cache utility with NodeCache fallback.
 * Provides TTL tiers for different data types and graceful degradation
 * when Redis is unavailable.
 */

const NodeCache = require('node-cache');
const { getRedisClient } = require('../middleware/rateLimit');

const memFallback = new NodeCache({ stdTTL: 3600, checkperiod: 600, maxKeys: 5000 });

const TTL = {
  anilist_manga_info: 60 * 60 * 24 * 7,       // 7 days
  anilist_search:     60 * 60 * 6,            // 6 hours
  anilist_trending:   60 * 60 * 1,            // 1 hour
  anilist_meta_search: 60 * 60 * 2,           // 2 hours (metadata by title)
  chapter_list:       60 * 60 * 12,           // 12 hours
  chapter_images:     60 * 60 * 24 * 3,      // 3 days
  scraper_search:     60 * 60 * 2,            // 2 hours
  image_proxy:        60 * 60 * 24 * 14,     // 14 days (images are immutable)
};

let redis;
setTimeout(() => {
  const rl = getRedisClient();
  if (rl && rl.status === 'ready') redis = rl;
}, 2000);

setInterval(() => {
  const rl = getRedisClient();
  if (rl && rl.status === 'ready' && !redis) redis = rl;
}, 5000);

const inFlight = new Map();

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
  const ttl = ttlOverride !== null ? ttlOverride : (TTL[ns] || 3600);
  if (redis) {
    try {
      await redis.set(k, JSON.stringify(data), 'EX', ttl);
      return;
    } catch (err) {
      console.error('[cache] Redis set error:', err.message);
    }
  }
  memFallback.set(k, data, ttl);
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
