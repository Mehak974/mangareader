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
const MEM = new Map();
const MEM_MAX = 300;

// Per-IP rate limiting (module-level, survives within an isolate instance)
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 60;               // 60 req/min per IP
const rateMap = new Map();

// Request coalescing — 100 concurrent users hitting the same cold cache key
// should produce exactly 1 origin fetch, not 100.
const IN_FLIGHT = new Map();

function isRateLimited(ip) {
  if (!ip) return false;
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.reset) {
    rateMap.set(ip, { count: 1, reset: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

async function sha1Key(prefix, str) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(str));
  const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}:${hex}`;
}

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
  const ttl = ttlSec;
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
const ALLOWED_WORKER_ORIGINS = [
  'https://mangareader.pro',
  'https://www.mangareader.pro',
  'https://mangaread.pro',
  'https://www.mangaread.pro',
  'https://manireader.online',
  'http://localhost:3000',
  'http://localhost:3001',
];

function corsHeaders(origin) {
  if (!origin) {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
  }
  // Hostname-based matching so www.mangareader.pro, mangareader.pro,
  // and any subdomain are all treated as allowed.
  let originHost;
  try { originHost = new URL(origin).hostname; } catch { originHost = origin; }

  const allowed = ALLOWED_WORKER_ORIGINS.some(o => {
    let allowedHost;
    try { allowedHost = new URL(o).hostname; } catch { allowedHost = o; }
    return originHost === allowedHost || originHost.endsWith('.' + allowedHost);
  });

  return {
    'Access-Control-Allow-Origin': allowed ? origin : '',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(data, status = 200, extra = {}, origin = null) {
  const { cf, ...headerExtras } = extra;
  const init = {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin), ...headerExtras },
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
  'manganato.com':       'https://mangakakalot.com/',
  'readmanganato.com':   'https://readmanganato.com/',
  'chapmanganato.to':    'https://chapmanganato.to/',
  'mangakatana.com':     'https://mangakatana.com/',
  'mangaread.org':       'https://mangaread.org/',
  'mangadex.org':        'https://mangadex.org/',
  'mangadex.network':    'https://mangadex.org/',
  'uploads.mangadex.org':'https://mangadex.org/',
  'storage.waitst.com':  'https://mangakakalot.com/',
  'imgs-2.2xstorage.com':'https://mangakakalot.com/',
  'img-r1.2xstorage.com':'https://mangakakalot.com/',
  'img-r2.2xstorage.com':'https://mangakakalot.com/',
  'img-r3.2xstorage.com':'https://mangakakalot.com/',
  'img-r4.2xstorage.com':'https://mangakakalot.com/',
  '2xstorage.com':       'https://mangakakalot.com/',
  'mkklcdnv':            'https://mangakatana.com/',
  'xfs.mangakatana.com':'https://mangakatana.com/',
  'waitst.com':          'https://mangakatana.com/',
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
  'uploads.mangadex.org','mangadex.network',
  'mkklcdnv','xfs.mangakatana.com',
  '2xstorage.com','img-r1.2xstorage.com','img-r2.2xstorage.com','img-r3.2xstorage.com','img-r4.2xstorage.com','imgs-2.2xstorage.com',
  'media.mangaka.com',
  'anilist.co','s4.anilist.co','s5.anilist.co',
  'waitst.com',
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
    const origin = req.headers.get('origin');
    const ip = req.headers.get('cf-connecting-ip') || '';
    if (isRateLimited(ip)) {
      return new Response('Too Many Requests', { status: 429, headers: corsHeaders(origin) });
    }
    if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(origin) });
    const path = new URL(req.url).pathname;
    try {
      if (path.startsWith('/img-proxy'))       return imgProxy(req, ctx, origin);
      if (path.startsWith('/api/anilist'))     return anilist(req, ctx, origin);
      if (path.startsWith('/api/mangadex'))   return mangadex(req, ctx, origin);
      if (path.startsWith('/api/manganato'))   return scraped(req, ctx, 'manganato',   'https://manganato.com/', origin);
      if (path.startsWith('/api/mangakatana')) return scraped(req, ctx, 'mangakatana', 'https://mangakatana.com/', origin);
      if (path.startsWith('/api/mangaread'))   return scraped(req, ctx, 'mangaread',   'https://mangaread.org/', origin);
      return new Response('Not found', { status: 404, headers: corsHeaders(origin) });
    } catch (e) {
      return json({ error: e.message }, 500, {}, origin);
    }
  },
};

// ─── Image proxy ──────────────────────────────────────────────────────────────
// Uses caches.default for images — ALREADY FREE AND UNLIMITED.
// KV is never touched here.
async function imgProxy(req, ctx, origin) {
  const target = new URL(req.url).searchParams.get('url');
  if (!target)         return new Response('Missing ?url=', { status: 400, headers: corsHeaders(origin) });
  if (!allowed(target)) return new Response('Domain not allowed', { status: 403, headers: corsHeaders(origin) });

  // L2: check Cloudflare CDN cache (free, no limits)
  const cacheKey = new Request(`https://img.internal/${await sha1Key('img', target)}`);
  const hit = await caches.default.match(cacheKey);
  if (hit) {
    return new Response(hit.body, {
      headers: { ...Object.fromEntries(hit.headers), 'X-Cache': 'HIT', ...corsHeaders(origin) },
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

  // Retry loop — transient 5xx from the origin CDN are common; retry 2x with backoff
  let originFetch = null;
  let lastError = 'Failed to fetch image';
  let errorStatus = 502;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      originFetch = await fetch(target, { headers, cf: { cacheTtl: 0 } });
      if (originFetch.ok) break;

      // 429 - rate limited, retry with backoff; other 4xx pass through
      if (originFetch.status === 429) {
        lastError = `Source rate limited (429)`;
        errorStatus = 429;
      } else if (originFetch.status < 500) {
        return new Response(`Source error ${originFetch.status}`, { status: originFetch.status, headers: corsHeaders(origin) });
      }

      // 5xx — record and retry
      lastError = `Source error ${originFetch.status}`;
      errorStatus = originFetch.status;
    } catch (err) {
      lastError = err.message;
    }

    // Brief backoff before retry (only for 5xx and network errors)
    if (attempt < 2) {
      await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
    }
  }

  if (!originFetch || !originFetch.ok) {
    return new Response(lastError, { status: errorStatus, headers: { 'Cache-Control': 'public, max-age=15', ...corsHeaders(origin) } });
  }

  const ct = originFetch.headers.get('content-type') || 'image/jpeg';
  const toCache = new Response(originFetch.body, {
    headers: {
      'Content-Type':  ct,
      'Cache-Control': 'public, max-age=31536000, immutable', // 1 year — images never change
      'X-Cache':       'MISS',
      ...corsHeaders(origin),
    },
    cf: { cacheEverything: true, cacheTtl: 31536000 },
  });

  ctx.waitUntil(caches.default.put(cacheKey, toCache.clone()));
  return toCache;
}

// ─── AniList ──────────────────────────────────────────────────────────────────
// Cache key = hash of query+variables. Stored in caches.default (free).
// L1 memory → L2 Cache API → origin. KV: never touched.
async function anilist(req, ctx, origin) {
  const body = await req.json();
  const ck = await sha1Key('al', JSON.stringify(body));

  // L1 memory check (instant, zero cost)
  const mem = memGet(ck);
  if (mem) return json(mem, 200, { 'X-Cache': 'MEM', cf: { cacheEverything: true, cacheTtl: 3600 } }, origin);

  // L2 Cache API check (free CDN)
  const cacheHit = await cacheGet(ck);
  if (cacheHit) {
    memSet(ck, cacheHit, 300); // backfill memory for next requests
    return json(cacheHit, 200, { 'X-Cache': 'CDN', cf: { cacheEverything: true, cacheTtl: 86400 } }, origin);
  }

  // Coalesced origin fetch — 100 concurrent users = 1 upstream call
  let promise = IN_FLIGHT.get(ck);
  if (!promise) {
    promise = (async () => {
      const r = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(body),
      });
      if (r.status === 429) {
        const err = new Error('AniList rate limited — retry');
        err.status = 429;
        throw err;
      }
      return r.json();
    })().finally(() => IN_FLIGHT.delete(ck));
    IN_FLIGHT.set(ck, promise);
  }

  let data;
  try {
    data = await promise;
  } catch (e) {
    if (e.status === 429) return json({ error: 'AniList rate limited — retry' }, 429, {}, origin);
    throw e;
  }

  const ttl = 86400; // 24h — AniList data barely changes
  memSet(ck, data, 3600);
  cachePut(ctx, ck, data, ttl); // async, non-blocking
  return json(data, 200, { 'X-Cache': 'MISS', cf: { cacheEverything: true, cacheTtl: ttl } }, origin);
}

// ─── MangaDex (official API) ──────────────────────────────────────────────────
async function mangadex(req, ctx, origin) {
  const url = new URL(req.url);
  const urlParam = url.searchParams.get('url');
  if (urlParam) return scraped(req, ctx, 'mangadex', 'https://mangadex.org/', origin);

  // /api/mangadex/chapter-images?id=<uuid> — proxy the official at-home API
  // with CDN caching. Faster and more reliable than routing through the
  // backend (which has a 25s timeout that Mangadex rate-limiting routinely
  // blows past).
  if (url.pathname.startsWith('/api/mangadex/chapter-images')) {
    const chapterId = url.searchParams.get('id') || url.pathname.split('/').pop();
    if (!chapterId) return json({ error: 'chapter id required' }, 400, {}, origin);
    const ck = await sha1Key('mdx', chapterId);

    const mem = memGet(ck);
    if (mem) return json(mem, 200, { 'X-Cache': 'MEM', cf: { cacheEverything: true, cacheTtl: 86400 } }, origin);

    const cacheHit = await cacheGet(ck);
    if (cacheHit) {
      memSet(ck, cacheHit, 300);
      return json(cacheHit, 200, { 'X-Cache': 'CDN', cf: { cacheEverything: true, cacheTtl: 86400 } }, origin);
    }

    let r;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        r = await fetch(`https://api.mangadex.org/at-home/server/${chapterId}`, {
          headers: { 'User-Agent': 'MangaReader/2.0', 'Accept': 'application/json' },
        });
        if (r.ok) break;
        if (r.status === 429) { await new Promise(rs => setTimeout(rs, 2000 * (attempt + 1))); continue; }
        if (r.status === 404) { await new Promise(rs => setTimeout(rs, 2000)); continue; }
        return json({ error: `MangaDex ${r.status}` }, r.status, {}, origin);
      } catch (e) {
        if (attempt < 2) await new Promise(rs => setTimeout(rs, 1000 * (attempt + 1)));
      }
    }
    if (!r || !r.ok) return json({ error: 'MangaDex chapter images unavailable' }, 502, {}, origin);

    const data = await r.json();
    const images = (data?.chapter?.data || []).map(
      fn => `${data.baseUrl}/data/${data.chapter.hash}/${fn}`
    );
    if (images.length === 0) return json({ error: 'No images in chapter' }, 404, {}, origin);

    const payload = { images, source: 'mangadex' };
    memSet(ck, payload, 300);
    cachePut(ctx, ck, payload, 86400);
    return json(payload, 200, { 'X-Cache': 'MISS', cf: { cacheEverything: true, cacheTtl: 86400 } }, origin);
  }

  const path = url.pathname.replace('/api/mangadex', '');
  const target = `https://api.mangadex.org${path}${url.search}`;
  const ck = await sha1Key('md', target);

  const mem = memGet(ck);
  if (mem) return json(mem, 200, { 'X-Cache': 'MEM', cf: { cacheEverything: true, cacheTtl: 300 } }, origin);

  const cacheHit = await cacheGet(ck);
  if (cacheHit) {
    memSet(ck, cacheHit, 300);
    return json(cacheHit, 200, { 'X-Cache': 'CDN', cf: { cacheEverything: true, cacheTtl: 3600 } }, origin);
  }

  const r = await fetch(target, {
    headers: { 'User-Agent': 'MangaReader/2.0', 'Accept': 'application/json' },
  });
  if (!r.ok) return json({ error: `MangaDex ${r.status}` }, r.status, {}, origin);

  const data = await r.json();
  const ttl = path.includes('/feed') ? 600 : 3600; // feed: 10min, rest: 1h
  memSet(ck, data, Math.min(ttl, 300));
  cachePut(ctx, ck, data, ttl);
  return json(data, 200, { 'X-Cache': 'MISS', cf: { cacheEverything: true, cacheTtl: ttl } }, origin);
}

// ─── Generic scraper (Manganato, MangaKatana, MangaRead) ─────────────────────
async function scraped(req, ctx, source, siteReferer, origin) {
  const target = new URL(req.url).searchParams.get('url');
  if (!target) return json({ error: 'Missing ?url=' }, 400, {}, origin);

  const ck = await sha1Key(source, target);

  const mem = memGet(ck);
  if (mem) return json(mem, 200, { 'X-Cache': 'MEM', cf: { cacheEverything: true, cacheTtl: 300 } }, origin);

  const cacheHit = await cacheGet(ck);
  if (cacheHit) {
    memSet(ck, cacheHit, 300);
    return json(cacheHit, 200, { 'X-Cache': 'CDN', cf: { cacheEverything: true, cacheTtl: 1800 } }, origin);
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
  if (!r.ok) return json({ error: `${source} ${r.status}` }, r.status, {}, origin);

  const html = await r.text();
  const data = { html, status: r.status };
  const ttl = 1800; // 30min — chapter HTML doesn't change

  memSet(ck, data, 300); // 5min in memory
  cachePut(ctx, ck, data, ttl); // 30min in CDN cache
  return json(data, 200, { 'X-Cache': 'MISS', cf: { cacheEverything: true, cacheTtl: ttl } }, origin);
}
