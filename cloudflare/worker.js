/**
 * CLOUDFLARE WORKER — MangaReader Proxy (KV-Free Edition)
 *
 * CACHING ARCHITECTURE (zero KV reads for 99% of traffic):
 *
 *   L1 — Module-level Map    Free │ ~0ms   │ Lives per isolate instance (~mins)
 *   L2 — caches.default      Free │ ~5ms   │ Cloudflare CDN edge, UNLIMITED
 *   L3 — Origin fetch        Paid │ ~300ms │ Only on true cache miss
 *
 * KV is NOT used here. caches.default replaces it completely for read-through
 * caching and has ZERO operation limits on the free plan.
 *
 * Free tier usage after this fix:
 *   KV reads:    0/day   (was hitting 50k+ in 3 hours)
 *   Cache API:   unlimited
 *   Worker reqs: 100k/day free (only counts requests TO the worker)
 */

// ─── L1: Module-level memory cache ───────────────────────────────────────────
// Survives across requests within the same isolate instance.
// Costs 0 KV reads, 0 cache API reads. Instant.
const MEM = new Map();
const MEM_MAX = 300; // max entries before evicting oldest

function memGet(key) {
  const e = MEM.get(key);
  if (!e) return null;
  if (Date.now() > e.exp) { MEM.delete(key); return null; }
  return e.val;
}
function memSet(key, val, ttlSec) {
  if (MEM.size >= MEM_MAX) MEM.delete(MEM.keys().next().value);
  MEM.set(key, { val, exp: Date.now() + ttlSec * 1000 });
}

// ─── L2: Cloudflare Cache API (caches.default) ───────────────────────────────
// Free, unlimited, global CDN. Works for ANY response type (JSON, images, HTML).
// TTL is set via Cache-Control header. No KV, no cost.
async function cacheGet(key) {
  const r = await caches.default.match(new Request(`https://cache.internal/${key}`));
  if (!r) return null;
  try { return await r.json(); } catch { return null; }
}
async function cachePut(ctx, key, data, ttlSec) {
  const ttl = Math.min(ttlSec, 300);
  ctx.waitUntil(
    caches.default.put(
      new Request(`https://cache.internal/${key}`),
      new Response(JSON.stringify(data), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${ttlSec}`,
        },
        cf: { cacheEverything: true, cacheTtl: ttl },
      })
    )
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200, extra = {}) {
  const { cf, ...headerExtras } = extra;
  const init = {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS, ...headerExtras },
  };
  if (cf) init.cf = cf;
  return new Response(JSON.stringify(data), init);
}

const UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
];
const ua = () => UAS[Math.floor(Math.random() * UAS.length)];

const REFERERS = {
  'manganato.com':       'https://manganato.com/',
  'readmanganato.com':   'https://readmanganato.com/',
  'chapmanganato.to':    'https://chapmanganato.to/',
  'mangakatana.com':     'https://mangakatana.com/',
  'mangaread.org':       'https://mangaread.org/',
  'uploads.mangadex.org':'https://mangadex.org/',
  'cmdxd98sb0x3yprd.mangadex.network': 'https://mangadex.org/',
  '2xstorage.com':       'https://manganato.com/',
  'img-r1.2xstorage.com':'https://manganato.com/',
  'img-r2.2xstorage.com':'https://manganato.com/',
  'imgs-2.2xstorage.com':'https://manganato.com/',
  'anilist.co':          'https://anilist.co/',
  's4.anilist.co':       'https://anilist.co/',
  's5.anilist.co':       'https://anilist.co/',
};
function referer(url) {
  const h = new URL(url).hostname;
  return Object.entries(REFERERS).find(([d]) => h.includes(d))?.[1] ?? null;
}

const ALLOWED = [
  'manganato.com','readmanganato.com','chapmanganato.to',
  'mangakatana.com','mangaread.org',
  'uploads.mangadex.org','cmdxd98sb0x3yprd.mangadex.network',
  'mkklcdnv6tempv2.com','mkklcdnv6temp.com','xfs.mangakatana.com',
  '2xstorage.com','img-r1.2xstorage.com','img-r2.2xstorage.com','imgs-2.2xstorage.com',
  'media.mangaka.com',
  'anilist.co','s4.anilist.co','s5.anilist.co',
];
function allowed(url) {
  try {
    const h = new URL(url).hostname;
    return ALLOWED.some(d => h.includes(d));
  } catch { return false; }
}

// ─── Main router ──────────────────────────────────────────────────────────────
export default {
  async fetch(req, env, ctx) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const path = new URL(req.url).pathname;
    try {
      if (path.startsWith('/img-proxy'))       return imgProxy(req, ctx);
      if (path.startsWith('/api/anilist'))     return anilist(req, ctx);
      if (path.startsWith('/api/mangadex'))    return mangadex(req, ctx);
      if (path.startsWith('/api/manganato'))   return scraped(req, ctx, 'manganato',   'https://manganato.com/');
      if (path.startsWith('/api/mangakatana')) return scraped(req, ctx, 'mangakatana', 'https://mangakatana.com/');
      if (path.startsWith('/api/mangaread'))   return scraped(req, ctx, 'mangaread',   'https://mangaread.org/');
      return new Response('Not found', { status: 404 });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  },
};

// ─── Image proxy ──────────────────────────────────────────────────────────────
// Uses caches.default for images — ALREADY FREE AND UNLIMITED.
// KV is never touched here.
async function imgProxy(req, ctx) {
  const target = new URL(req.url).searchParams.get('url');
  if (!target)         return new Response('Missing ?url=', { status: 400 });
  if (!allowed(target)) return new Response('Domain not allowed', { status: 403 });

  // L2: check Cloudflare CDN cache (free, no limits)
  const cacheKey = new Request(`https://img.internal/${btoa(encodeURIComponent(target)).slice(0, 200)}`);
  const hit = await caches.default.match(cacheKey);
  if (hit) {
    return new Response(hit.body, {
      headers: { ...Object.fromEntries(hit.headers), 'X-Cache': 'HIT', ...CORS },
      cf: { cacheEverything: true, cacheTtl: 31536000 },
    });
  }

  // Fetch from source with correct headers
  const ref = referer(target);
  const headers = {
    'User-Agent':      ua(),
    'Accept':          'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-Fetch-Dest':  'image',
    'Sec-Fetch-Mode':  'no-cors',
    'Sec-Fetch-Site':  'cross-site',
  };
  if (ref) headers['Referer'] = ref;

  const origin = await fetch(target, { headers });
  if (!origin.ok) return new Response(`Source error ${origin.status}`, { status: origin.status });

  const ct = origin.headers.get('content-type') || 'image/jpeg';
  const toCache = new Response(origin.body, {
    headers: {
      'Content-Type':  ct,
      'Cache-Control': 'public, max-age=31536000, immutable', // 1 year — images never change
      'X-Cache':       'MISS',
      ...CORS,
    },
    cf: { cacheEverything: true, cacheTtl: 31536000 },
  });

  ctx.waitUntil(caches.default.put(cacheKey, toCache.clone()));
  return toCache;
}

// ─── AniList ──────────────────────────────────────────────────────────────────
// Cache key = hash of query+variables. Stored in caches.default (free).
// L1 memory → L2 Cache API → origin. KV: never touched.
async function anilist(req, ctx) {
  const body = await req.json();
  const ck = 'al:' + btoa(JSON.stringify(body)).slice(0, 150);

  // L1 memory check (instant, zero cost)
  const mem = memGet(ck);
  if (mem) return json(mem, 200, { 'X-Cache': 'MEM', cf: { cacheEverything: true, cacheTtl: 3600 } });

  // L2 Cache API check (free CDN)
  const cacheHit = await cacheGet(ck);
  if (cacheHit) {
    memSet(ck, cacheHit, 300); // backfill memory for next requests
    return json(cacheHit, 200, { 'X-Cache': 'CDN', cf: { cacheEverything: true, cacheTtl: 86400 } });
  }

  // Origin fetch
  const r = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(body),
  });
  if (r.status === 429) return json({ error: 'AniList rate limited — retry' }, 429);

  const data = await r.json();
  const ttl = 86400; // 24h — AniList data barely changes
  memSet(ck, data, 3600);
  cachePut(ctx, ck, data, ttl); // async, non-blocking
  return json(data, 200, { 'X-Cache': 'MISS', cf: { cacheEverything: true, cacheTtl: ttl } });
}

// ─── MangaDex (official API) ──────────────────────────────────────────────────
async function mangadex(req, ctx) {
  const url = new URL(req.url);
  const path = url.pathname.replace('/api/mangadex', '');
  const target = `https://api.mangadex.org${path}${url.search}`;
  const ck = 'md:' + btoa(target).slice(0, 150);

  const mem = memGet(ck);
  if (mem) return json(mem, 200, { 'X-Cache': 'MEM', cf: { cacheEverything: true, cacheTtl: 300 } });

  const cacheHit = await cacheGet(ck);
  if (cacheHit) {
    memSet(ck, cacheHit, 300);
    return json(cacheHit, 200, { 'X-Cache': 'CDN', cf: { cacheEverything: true, cacheTtl: 3600 } });
  }

  const r = await fetch(target, {
    headers: { 'User-Agent': 'MangaReader/2.0', 'Accept': 'application/json' },
  });
  if (!r.ok) return json({ error: `MangaDex ${r.status}` }, r.status);

  const data = await r.json();
  const ttl = path.includes('/feed') ? 600 : 3600; // feed: 10min, rest: 1h
  memSet(ck, data, Math.min(ttl, 300));
  cachePut(ctx, ck, data, ttl);
  return json(data, 200, { 'X-Cache': 'MISS', cf: { cacheEverything: true, cacheTtl: ttl } });
}

// ─── Generic scraper (Manganato, MangaKatana, MangaRead) ─────────────────────
async function scraped(req, ctx, source, siteReferer) {
  const target = new URL(req.url).searchParams.get('url');
  if (!target) return json({ error: 'Missing ?url=' }, 400);

  const ck = `${source}:${btoa(target).slice(0, 150)}`;

  const mem = memGet(ck);
  if (mem) return json(mem, 200, { 'X-Cache': 'MEM', cf: { cacheEverything: true, cacheTtl: 300 } });

  const cacheHit = await cacheGet(ck);
  if (cacheHit) {
    memSet(ck, cacheHit, 300);
    return json(cacheHit, 200, { 'X-Cache': 'CDN', cf: { cacheEverything: true, cacheTtl: 1800 } });
  }

  const r = await fetch(target, {
    headers: {
      'User-Agent':      ua(),
      'Referer':         siteReferer,
      'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Sec-Fetch-Dest':  'document',
      'Sec-Fetch-Mode':  'navigate',
      'Sec-Fetch-Site':  'same-origin',
      'Upgrade-Insecure-Requests': '1',
    },
  });
  if (!r.ok) return json({ error: `${source} ${r.status}` }, r.status);

  const html = await r.text();
  const data = { html, status: r.status };
  const ttl = 1800; // 30min — chapter HTML doesn't change

  memSet(ck, data, 300); // 5min in memory
  cachePut(ctx, ck, data, ttl); // 30min in CDN cache
  return json(data, 200, { 'X-Cache': 'MISS', cf: { cacheEverything: true, cacheTtl: ttl } });
}
