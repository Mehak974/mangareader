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
// A single manga chapter is 20-50 images and they all arrive from the SAME
// reader IP, so this must be well above one chapter's worth or readers get
// broken images mid-chapter. The previous 60/min was exceeded by opening ~2
// chapters a minute, which surfaced to users as a proxy/429 error.
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 600;              // 600 req/min per IP (≈12 chapters)
const rateMap = new Map();

// Request coalescing — 100 concurrent users hitting the same cold cache key
// should produce exactly 1 origin fetch, not 100.
const IN_FLIGHT = new Map();

let rateLimitSweep = 0;
function isRateLimited(ip) {
  if (!ip) return false;
  const now = Date.now();
  if (now - rateLimitSweep > 30000) {
    rateLimitSweep = now;
    for (const [k, v] of rateMap) {
      if (now > v.reset) rateMap.delete(k);
    }
  }
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

// ─── L2b: Negative cache ─────────────────────────────────────────────────────
// A failing origin must not be retried by every visitor, but the TTL has to
// match the failure. 2xstorage rate-limits (429) Cloudflare's egress IPs on a
// scale of seconds, so a long negative TTL there would poison an image far
// longer than the rate limit lasts and defeat the client's own retries.
const NEG_TTL_SEC = 60;      // 5xx / network — origin is down, back off hard
const NEG_TTL_429 = 8;       // 429 — transient throttle, only suppress a burst

async function negGet(key) {
  const m = memGet(`neg:${key}`);
  if (m) return m;
  const c = await cacheGet(`neg:${key}`);
  return c || null;
}
function negSet(ctx, key, val, ttlSec = NEG_TTL_SEC) {
  memSet(`neg:${key}`, val, ttlSec);
  cachePut(ctx, `neg:${key}`, val, ttlSec);
}

// ─── L3b: Per-host circuit breaker ───────────────────────────────────────────
// When an image CDN is down, the retry loop turns every viewer request into 3
// dead origin fetches. 50 images on a chapter page = 150 subrequests, which
// burns the Worker subrequest budget and can escalate to a platform error.
// After BREAKER_FAILS consecutive failures the host is skipped entirely for
// BREAKER_COOLDOWN_MS so the isolate stops hammering a dead origin.
const HOST_FAIL = new Map();
const BREAKER_FAILS = 5;
const BREAKER_COOLDOWN_MS = 60 * 1000;

function breakerOpen(host) {
  const e = HOST_FAIL.get(host);
  if (!e) return false;
  // openUntil is 0 while the host is merely counting failures. Deleting on
  // expiry must only apply to a breaker that actually opened, otherwise every
  // status check resets the tally and the breaker can never trip.
  if (e.openUntil && Date.now() >= e.openUntil) { HOST_FAIL.delete(host); return false; }
  return e.openUntil > 0;
}
function breakerFail(host) {
  const e = HOST_FAIL.get(host) || { fails: 0, openUntil: 0 };
  e.fails += 1;
  if (e.fails >= BREAKER_FAILS) {
    e.openUntil = Date.now() + BREAKER_COOLDOWN_MS;
    e.fails = 0;
  }
  HOST_FAIL.set(host, e);
}
function breakerOk(host) { HOST_FAIL.delete(host); }

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

function errResponse(origin, status, body, extra = {}) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=15',
      ...extra,
      ...corsHeaders(origin),
    },
  });
}

const UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
];
const ua = () => UAS[Math.floor(Math.random() * UAS.length)];

// ponytail: substring-based matching — future-proof against CDN subdomain rotation.
// referer() and allowed() both use .includes(), so keys here are just patterns.
const REFERERS = {
  'mangakatana':         'https://mangakatana.com/',
  'mkklcdnv':            'https://mangakatana.com/',
  // .gg domains must precede the bare 'manganato'/'mangakakalot' patterns,
  // which would otherwise claim them and send the wrong Referer.
  'manganato.gg':        'https://www.manganato.gg/',
  'mangakakalot.gg':     'https://www.mangakakalot.gg/',
  'manganato':           'https://mangakakalot.com/',
  'mangakakalot':        'https://mangakakalot.com/',
  'chapmanganato':       'https://chapmanganato.to/',
  'mangaread.org':       'https://mangaread.org/',
  '2xstorage':           'https://mangakakalot.com/',
  'waitst.com':          'https://mangakatana.com/',
  'anilist.co':          'https://anilist.co/',
};
function referer(url) {
  const h = new URL(url).hostname;
  return Object.entries(REFERERS).find(([d]) => h.includes(d))?.[1] ?? null;
}

const ALLOWED = [
  'manganato.gg','manganato.com','mangakakalot.gg','mangakakalot.com','chapmanganato.to',
  'mangakatana.com','mkklcdnv','mangaread.org',
  '2xstorage.com','waitst.com',
  'media.mangaka.com','anilist.co','imgur.com',
];
function allowed(url) {
  try {
    const h = new URL(url).hostname;
    // Hostname-aware matching. Substring matching (h.includes(d)) is
    // vulnerable: 'mangakatana' matches 'mangakatana.com.evil.com'.
    // Each pattern is matched as an exact hostname OR a subdomain of it.
    return ALLOWED.some(d => h === d || h.endsWith('.' + d));
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
      if (path.startsWith('/api/manganato'))   return scraped(req, ctx, 'manganato',   'https://manganato.com/', origin);
      if (path.startsWith('/api/mangakatana')) return scraped(req, ctx, 'mangakatana', 'https://mangakatana.com/', origin);
      if (path.startsWith('/api/mangaread'))   return scraped(req, ctx, 'mangaread',   'https://mangaread.org/', origin);
      return new Response('Not found', { status: 404, headers: corsHeaders(origin) });
    } catch (e) {
      return json({ error: e.message }, 500, {}, origin);
    }
  },
};

// ─── Image mirrors ───────────────────────────────────────────────────────────
// Manganato/MangaKakalot chapter HTML references several 2xstorage hosts, and
// they rot independently: img-r1 serves, img-r2 answers 503, imgs-2 404s on
// page images. The path layout is identical across hosts, so when the host in
// the HTML is dead we replay the same path against a verified-good mirror.
const MIRROR_HOSTS = ['img-r1.2xstorage.com'];
const MAX_429_ATTEMPTS = 5;   // throttle clears in ~10s → 1+2+4+8s of backoff
const MAX_5XX_ATTEMPTS = 2;   // hard failures give up early, breaker covers repeats

function candidatesFor(url) {
  const host = new URL(url).hostname;
  if (!host.endsWith('2xstorage.com')) return [url];
  const tail = url.slice(url.indexOf(host) + host.length);
  const mirrors = MIRROR_HOSTS.filter(m => m !== host).map(m => `https://${m}${tail}`);
  // Never fan out to more than the original host plus one mirror.
  return [url, ...mirrors.slice(0, 1)];
}

// ─── Image proxy ──────────────────────────────────────────────────────────────
// Uses caches.default for images — ALREADY FREE AND UNLIMITED.
// KV is never touched here.
async function imgProxy(req, ctx, origin) {
  const target = new URL(req.url).searchParams.get('url');
  if (!target)         return errResponse(origin, 400, 'Missing ?url=');
  if (!allowed(target)) return errResponse(origin, 403, 'Domain not allowed');

  const imgKey = await ckFor('img', target);
  const host = new URL(target).hostname;

  // L2: check Cloudflare CDN cache (free, no limits)
  const cacheKey = new Request(`https://img.internal/${imgKey}`);
  const hit = await caches.default.match(cacheKey);
  if (hit) {
    // Headers normalises casing, so spreading hit.headers and then adding
    // 'X-Cache' appends instead of replacing — the client saw "MISS, HIT".
    const cached = Object.fromEntries(hit.headers);
    cached['x-cache'] = 'HIT';
    delete cached['access-control-allow-origin'];
    return new Response(hit.body, {
      headers: { ...cached, ...corsHeaders(origin) },
      cf: { cacheEverything: true, cacheTtl: 31536000 },
    });
  }

  const candidates = candidatesFor(target);

  // Recent origin failure for this exact image — serve it instantly instead of
  // repeating dead fetches per visitor.
  const neg = await negGet(imgKey);
  if (neg) {
    return errResponse(origin, 502, neg.msg, { 'X-Cache': 'NEGATIVE', 'X-Origin-Status': String(neg.status) });
  }

  // Origin host is in cooldown. If a mirror is available the request still has
  // a chance, so only bail outright when there is nowhere left to try.
  if (breakerOpen(host) && candidates.length === 1) {
    return errResponse(origin, 502, `Origin ${host} temporarily unavailable`, {
      'X-Cache': 'BREAKER', 'X-Origin-Status': '503', 'Retry-After': '30',
    });
  }

  // Request coalescing: if another request is already fetching this image, await it
  if (IN_FLIGHT.has(imgKey)) {
    const result = await IN_FLIGHT.get(imgKey);
    if (result.type === 'error') {
      return errResponse(origin, result.status, result.body, {
        'X-Cache': 'HIT-INFLIGHT', 'X-Origin-Status': String(result.originStatus ?? result.status),
      });
    }
    // Build headers fresh for THIS request. The shared result carries no
    // CORS headers, so a waiting visitor never inherits the first
    // requester's Access-Control-Allow-Origin.
    return new Response(result.buf, {
      headers: { 'Content-Type': result.ct, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Cache': 'HIT-INFLIGHT', ...corsHeaders(origin) },
      cf: { cacheEverything: true, cacheTtl: 31536000 },
    });
  }

  const promise = (async () => {
    try {
      // Fetch from source with correct headers
      const ref = referer(target);
      const fetchHeaders = {
        'User-Agent':      ua(),
        'Accept':          'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Fetch-Dest':  'image',
        'Sec-Fetch-Mode':  'no-cors',
        'Sec-Fetch-Site':  'cross-site',
      };
      if (ref) fetchHeaders['Referer'] = ref;

      // Retry budget. A 429 from the image CDN clears in roughly 10s, so throttled
      // requests get an escalating retry; hard failures give up quickly.
      let originFetch = null;
      let lastError = 'Failed to fetch image';
      let errorStatus = 502;
      let throttled = false;
      let clientStatus = null;   // a non-5xx origin status worth surfacing as-is

      for (let attempt = 0; attempt < MAX_429_ATTEMPTS; attempt++) {
        for (const cand of candidates) {
          const candHost = new URL(cand).hostname;
          try {
            const r = await fetch(cand, { headers: fetchHeaders, cf: { cacheTtl: 0 } });
            if (r.ok) { originFetch = r; break; }

            // Release the connection — the error body is never read.
            try { r.body?.cancel().catch(() => {}); } catch { /* already consumed */ }

            lastError = `Source error ${r.status}`;
            errorStatus = r.status;
            // A throttled host is not a broken host — never count it toward
            // the breaker, or a retry burst trips it on its own.
            if (cand === target && r.status !== 429) breakerFail(candHost);

            // A 4xx means this host simply does not hold the file; keep the
            // first one so it can be surfaced, but still let a mirror answer.
            if (r.status >= 400 && r.status < 500 && r.status !== 429 && clientStatus === null) {
              clientStatus = r.status;
              lastError = `Origin error ${r.status}`;
            }

            // Throttling applies to the whole CDN, so mirrors would be limited
            // too. Stop instead of fanning out.
            if (r.status === 429) { throttled = true; break; }
          } catch (err) {
            lastError = err.message;
            if (cand === target) breakerFail(candHost);
          }
        }
        if (originFetch) break;

        // A hard failure (5xx / network) is not worth many attempts — the
        // circuit breaker handles repetition. Only a throttle earns patience.
        if (!throttled && attempt >= MAX_5XX_ATTEMPTS - 1) break;

        // Backoff. Throttling clears in ~10s, so escalate geometrically with
        // jitter; ordinary failures back off fast and stop early.
        const wait = throttled
          ? 1000 * Math.pow(2, attempt) + Math.floor(Math.random() * 500)
          : 400 * (attempt + 1) + Math.floor(Math.random() * 300);
        if (attempt < MAX_429_ATTEMPTS - 1) {
          await new Promise(r => setTimeout(r, wait));
        }
      }

      if (!originFetch) {
        // breakerFail already ran per failing candidate; 429 never trips it.
        negSet(ctx, imgKey, { status: errorStatus, msg: lastError }, throttled ? NEG_TTL_429 : NEG_TTL_SEC);
        // A 4xx is a real answer (the file is genuinely absent here), so relay
        // it instead of disguising it as a gateway failure. 5xx and network
        // errors stay 502 — that one is ours, not the origin's.
        const surfaced = clientStatus ?? 502;
        return { type: 'error', status: surfaced, body: lastError, originStatus: errorStatus };
      }

      breakerOk(new URL(target).hostname);

      const ct = originFetch.headers.get('content-type') || 'image/jpeg';
      const buf = await originFetch.arrayBuffer();

      // Populate CDN cache (non-blocking).
      // Store origin-AGNOST headers only. Baking Access-Control-Allow-Origin
      // into the cached object leaks one visitor's origin to every other
      // visitor and, on re-merge, produces an invalid comma-joined value.
      // CORS is re-derived per request at serve time instead.
      const cacheResp = new Response(buf, {
        headers: {
          'Content-Type':  ct,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'X-Cache':       'MISS',
        },
        cf: { cacheEverything: true, cacheTtl: 31536000 },
      });
      ctx.waitUntil(caches.default.put(cacheKey, cacheResp.clone()));

      // Return buffer + content-type so concurrent waiters each build their own Response
      return { type: 'image', buf, ct };
    } finally {
      IN_FLIGHT.delete(imgKey);
    }
  })();

  IN_FLIGHT.set(imgKey, promise);
  const result = await promise;
  if (result.type === 'error') {
    return errResponse(origin, result.status, result.body, {
      'X-Cache': 'MISS', 'X-Origin-Status': String(result.originStatus ?? result.status),
    });
  }
  return new Response(result.buf, {
    headers: {
      'Content-Type': result.ct,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Cache': 'MISS',
      ...corsHeaders(origin),
    },
    cf: { cacheEverything: true, cacheTtl: 31536000 },
  });
}

// ─── AniList ──────────────────────────────────────────────────────────────────
// Cache key = hash of query+variables. Stored in caches.default (free).
// L1 memory → L2 Cache API → origin. KV: never touched.
async function anilist(req, ctx, origin) {
  const body = await req.json();
  const ck = await ckFor('al', JSON.stringify(body));

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

// ─── Cache epochs (manual purge) ─────────────────────────────────────────────
// caches.default has NO delete API, so a "dump the cache" is done by salting
// the cache key. Change the version below, deploy, and every old entry becomes
// unreachable and is reclaimed when its TTL expires. Zero API calls, zero cost.
//
//   SCRAPED_EPOCH          → bumps every source (manganato, mangakatana, …)
//   SCRAPED_EPOCH.manganato → bumps one source only
const SCRAPED_EPOCH = 'v1';
const SCRAPED_EPOCH_BY_SOURCE = { manganato: 'v2' };
const IMG_EPOCH = 'v1';
const ANILIST_EPOCH = 'v1';
function ckFor(source, str) {
  const epoch = source === 'img' ? IMG_EPOCH
    : source === 'al' ? ANILIST_EPOCH
    : SCRAPED_EPOCH_BY_SOURCE[source] ?? SCRAPED_EPOCH;
  return sha1Key(`${source}:${epoch}`, str);
}

// ─── Generic scraper (Manganato, MangaKatana, MangaRead) ─────────────────────
async function scraped(req, ctx, source, siteReferer, origin) {
  const target = new URL(req.url).searchParams.get('url');
  if (!target) return json({ error: 'Missing ?url=' }, 400, {}, origin);

  // SSRF guard — imgProxy has this check but scraped did not, making the
  // Worker an open HTML proxy for any URL. Add the same allowlist.
  if (!allowed(target)) return json({ error: 'Domain not allowed' }, 403, {}, origin);

  const ck = await ckFor(source, target);

  const mem = memGet(ck);
  if (mem) return json(mem, 200, { 'X-Cache': 'MEM', cf: { cacheEverything: true, cacheTtl: 300 } }, origin);

  const cacheHit = await cacheGet(ck);
  if (cacheHit) {
    memSet(ck, cacheHit, 300);
    return json(cacheHit, 200, { 'X-Cache': 'CDN', cf: { cacheEverything: true, cacheTtl: 1800 } }, origin);
  }

  // Request coalescing — concurrent cache misses for the same URL share one origin fetch
  if (IN_FLIGHT.has(ck)) {
    try {
      const data = await IN_FLIGHT.get(ck);
      memSet(ck, data, 300);
      return json(data, 200, { 'X-Cache': 'CDN', cf: { cacheEverything: true, cacheTtl: 1800 } }, origin);
    } catch {
      // fall through to fresh fetch
    }
  }

  const promise = (async () => {
    try {
      const targetOrigin = new URL(target).origin + '/';
      const r = await fetch(target, {
        headers: {
          'User-Agent':      ua(),
          'Referer':         targetOrigin,
          'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Sec-Fetch-Dest':  'document',
          'Sec-Fetch-Mode':  'navigate',
          'Sec-Fetch-Site':  'same-origin',
          'Upgrade-Insecure-Requests': '1',
        },
      });
      if (!r.ok) throw new Error(`${source} ${r.status}`);

      const html = await r.text();
      const data = { html, status: r.status };
      const ttl = 1800; // 30min — chapter HTML doesn't change

      memSet(ck, data, 300); // 5min in memory
      cachePut(ctx, ck, data, ttl); // 30min in CDN cache
      return data;
    } finally {
      IN_FLIGHT.delete(ck);
    }
  })();

  IN_FLIGHT.set(ck, promise);

  const data = await promise;
  return json(data, 200, { 'X-Cache': 'MISS', cf: { cacheEverything: true, cacheTtl: 1800 } }, origin);
}
