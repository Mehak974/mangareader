/**
 * CLOUDFLARE WORKER — MangaReader Proxy (KV-Free Edition)
 *
 * CACHING ARCHITECTURE (zero KV reads for 99% of traffic):
 *
 *   L1 — Module-level Map    Free │ ~0ms   │ Lives per isolate instance (~mins)
 *   L2 — caches.default      Free │ ~5ms   │ Per-data-center edge cache (NOT global)
 *   L2b— R2 (IMG_BUCKET)     Free*│ ~30ms  │ Global, persistent, images only. Optional:
 *                                           skipped entirely if the binding is absent.
 *   L3 — Origin fetch        Paid │ ~300ms │ Only on true cache miss
 *                                           (converted to WebP here if env.IMAGES is bound)
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
const MEM_MAX = 100;   // entries hold whole chapter HTML; 300 risked the 128MB isolate cap

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
      // `return await` (not bare `return`): without it a rejected promise from
      // the handler escapes this try/catch and surfaces as an unhandled
      // platform-level 500 instead of our JSON error.
      if (path === '/admin/img-purge')         return await purgeImage(req, env, origin);
      if (path.startsWith('/img-proxy'))       return await imgProxy(req, ctx, origin, env);
      if (path.startsWith('/api/anilist'))     return await anilist(req, ctx, origin);
      if (path.startsWith('/api/manganato'))   return await scraped(req, ctx, 'manganato',   'https://manganato.com/', origin);
      if (path.startsWith('/api/mangakatana')) return await scraped(req, ctx, 'mangakatana', 'https://mangakatana.com/', origin);
      if (path.startsWith('/api/mangaread'))   return await scraped(req, ctx, 'mangaread',   'https://mangaread.org/', origin);
      return new Response('Not found', { status: 404, headers: corsHeaders(origin) });
    } catch (e) {
      console.error(`[worker] ${path} failed:`, e && e.message);
      return json({ error: e.message }, 502, {}, origin);
    }
  },
};

// ─── Image mirrors ───────────────────────────────────────────────────────────
// Manganato/MangaKakalot chapter HTML references several 2xstorage hosts, and
// they rot independently: img-r1 serves, img-r2 answers 503, imgs-2 404s on
// page images. The path layout is identical across hosts, so when the host in
// the HTML is dead we replay the same path against a verified-good mirror.
const MIRROR_HOSTS = ['img-r1.2xstorage.com', 'img-r2.2xstorage.com', 'imgs-2.2xstorage.com'];
const MAX_429_ATTEMPTS = 5;   // throttle clears in ~10s → 1+2+4+8s of backoff
const MAX_5XX_ATTEMPTS = 2;   // hard failures give up early, breaker covers repeats

function candidatesFor(url) {
  const host = new URL(url).hostname;
  if (!host.endsWith('2xstorage.com')) return [url];
  const tail = url.slice(url.indexOf(host) + host.length);
  const mirrors = MIRROR_HOSTS.filter(m => m !== host).map(m => `https://${m}${tail}`);
  return [url, ...mirrors];
}

// ─── WebP conversion (Cloudflare Images binding: env.IMAGES) ─────────────────
// Runs once per image on a cold origin fetch, BEFORE the R2 / edge-cache write,
// so every later hit (and every coalesced waiter) gets the smaller WebP.
// Fails safe: no binding, kill switch, error, quota exhausted, or a "smaller"
// result that isn't actually smaller -> the original bytes are used untouched.
const WEBP_QUALITY = 80;
const WEBP_SKIP = ['image/webp', 'image/avif', 'image/gif', 'image/svg+xml'];  // already efficient / animated / vector

async function toWebp(env, buf, ct) {
  if (!env || !env.IMAGES || env.WEBP_CONVERT === 'off') return null;
  const type = ct.toLowerCase().split(';')[0].trim();
  if (!type.startsWith('image/') || WEBP_SKIP.includes(type)) return null;
  if (buf.byteLength === 0 || buf.byteLength > R2_MAX_BYTES) return null;
  try {
    const result = await env.IMAGES.input(new Response(buf).body)
      .output({ format: 'image/webp', quality: WEBP_QUALITY });
    const out = result.response();
    const outType = (out.headers.get('content-type') || '').toLowerCase();
    const outBuf = await out.arrayBuffer();
    if (!outType.startsWith('image/webp') || outBuf.byteLength === 0 || outBuf.byteLength >= buf.byteLength) return null;
    return { buf: outBuf, ct: 'image/webp' };
  } catch (e) {
    console.warn(`[webp] conversion failed, using original: ${e.message}`);
    return null;
  }
}

// ─── R2 (persistent image store) ─────────────────────────────────────────────
// Binding: IMG_BUCKET. Everything here degrades to a no-op when it is missing
// or when R2 errors, so R2 can never take image serving down.
const R2_MAX_BYTES = 10 * 1024 * 1024;   // never store anything bigger than 10MB
const R2_CACHE_CONTROL = 'public, max-age=31536000, immutable';
// 'img:v1:<sha1>' -> 'img/v1/<sha1>' so a lifecycle rule can target the img/ prefix
const r2KeyFor = (imgKey) => imgKey.split(':').join('/');

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// POST /admin/img-purge  {"url": "<exact image url the frontend proxies>"}
// Authorization: Bearer <ADMIN_TOKEN secret>. 404s when no secret is configured.
async function purgeImage(req, env, origin) {
  if (req.method !== 'POST' || !env || !env.ADMIN_TOKEN) {
    return new Response('Not found', { status: 404, headers: corsHeaders(origin) });
  }
  const auth = req.headers.get('authorization') || '';
  if (!safeEqual(auth, `Bearer ${env.ADMIN_TOKEN}`)) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders(origin) });
  }
  let body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400, {}, origin); }
  if (!body.url || !allowed(body.url)) return json({ error: 'Missing or disallowed url' }, 400, {}, origin);

  const imgKey = await ckFor('img', body.url);
  const r2Key = r2KeyFor(imgKey);
  // R2 Class A operations (DELETE) are forbidden — only purge from edge cache
  await caches.default.delete(new Request(`https://img.internal/${imgKey}`));
  return json({ purged: true, r2Key }, 200, {}, origin);
}

// ─── Image proxy ──────────────────────────────────────────────────────────────
// Uses caches.default for images — ALREADY FREE AND UNLIMITED.
// KV is never touched here.
// True when the request names a Referer/Origin that is NOT one of our sites.
// Empty Referer is allowed (pages using referrerPolicy="no-referrer"); this only
// stops other websites from hot-linking the proxy and burning R2 / origin quota.
function isForeignReferer(req, env) {
  if (env && env.HOTLINK_PROTECT === 'off') return false;
  const src = req.headers.get('origin') || req.headers.get('referer');
  if (!src) return false;
  let host;
  try { host = new URL(src).hostname; } catch { return true; }
  return !ALLOWED_WORKER_ORIGINS.some(o => {
    const h = new URL(o).hostname;
    return host === h || host.endsWith('.' + h);
  });
}

async function imgProxy(req, ctx, origin, env) {
  const target = new URL(req.url).searchParams.get('url');
  if (!target)         return errResponse(origin, 400, 'Missing ?url=');
  if (!allowed(target)) return errResponse(origin, 403, 'Domain not allowed');
  if (isForeignReferer(req, env)) return errResponse(origin, 403, 'Hotlinking not allowed');

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

  // Recent origin failure for this exact image — serve it instantly. Checked BEFORE
  // R2 so a failing image's retries don't each cost an R2 read (Class B op).
  const neg = await negGet(imgKey);
  if (neg) {
    return errResponse(origin, 502, neg.msg, { 'X-Cache': 'NEGATIVE', 'X-Origin-Status': String(neg.status) });
  }

  // L2b: R2. Only reached on an edge-cache miss. Kill switch: R2_CACHE = "off".
  const bucket = env && env.R2_CACHE !== 'off' ? env.IMG_BUCKET : null;
  const r2Key = r2KeyFor(imgKey);
  if (bucket) {
    try {
      const obj = await bucket.get(r2Key);
      if (obj) {
        const ct = obj.httpMetadata?.contentType || 'image/jpeg';
        const base = { 'Content-Type': ct, 'Cache-Control': R2_CACHE_CONTROL };
        // Stream once, serve the user and backfill this data center's edge cache.
        const [toClient, toEdge] = obj.body.tee();
        ctx.waitUntil(
          caches.default.put(cacheKey, new Response(toEdge, { headers: { ...base, 'X-Cache': 'MISS' } }))
            .catch(() => {})
        );
        return new Response(toClient, { headers: { ...base, 'X-Cache': 'R2', ...corsHeaders(origin) } });
      }
    } catch (e) {
      console.warn(`[r2] get failed for ${r2Key}: ${e.message}`);   // fall through to origin
    }
  }

  const candidates = candidatesFor(target);

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
      headers: { 'Content-Type': result.ct, 'Cache-Control': result.cacheable ? 'public, max-age=31536000, immutable' : 'no-store', 'X-Cache': 'HIT-INFLIGHT', ...corsHeaders(origin) },
      ...(result.cacheable ? { cf: { cacheEverything: true, cacheTtl: 31536000 } } : {}),
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
      let triedBackend = false;
      let viaBackend = false;

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

        // Last-resort fallback: ask the backend (Railway) to fetch it. The image
        // CDN throttles Cloudflare's shared egress IPs, so a different network
        // path often succeeds where every Worker retry fails. Tried once, right
        // after the first failed round, so the reader doesn't wait out backoffs.
        if (!triedBackend && env && env.BACKEND_URL) {
          triedBackend = true;
          try {
            const br = await fetch(
              `${String(env.BACKEND_URL).replace(/\/$/, '')}/api/proxy-image?url=${encodeURIComponent(target)}`,
              { signal: AbortSignal.timeout(10000), cf: { cacheTtl: 0 } }
            );
            const bct = (br.headers.get('content-type') || '').toLowerCase();
            if (br.ok && bct.startsWith('image/')) { originFetch = br; viaBackend = true; break; }
            try { br.body?.cancel().catch(() => {}); } catch { /* ignore */ }
          } catch (err) {
            console.warn(`[img] backend fallback failed for ${target}: ${err.message}`);
          }
        }

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

      if (!viaBackend) breakerOk(new URL(target).hostname);

      let ct = originFetch.headers.get('content-type') || 'image/jpeg';
      let buf;
      try {
        buf = await originFetch.arrayBuffer();
      } catch (err) {
        // Connection dropped while the body was streaming ("Network connection
        // lost"). Previously this rejected the shared promise and became an
        // uncaught 500 for every coalesced waiter.
        breakerFail(new URL(target).hostname);
        negSet(ctx, imgKey, { status: 502, msg: 'Origin connection lost' }, 10);
        return { type: 'error', status: 502, body: 'Origin connection lost', originStatus: 502 };
      }

      // Convert to WebP once, here, so R2, the edge cache, the user and any
      // coalesced waiters all share the same (smaller) bytes.
      const origBytes = buf.byteLength;
      const webp = await toWebp(env, buf, ct);
      if (webp) { buf = webp.buf; ct = webp.ct; }

      // R2 Class A operations (PUT, DELETE, LIST, MULTIPART) are strictly FORBIDDEN.
      // Zero writes are performed to R2. Images are cached solely in the free Cloudflare
      // Edge Cache (caches.default) below, eliminating all R2 Class A write costs.

      // Populate CDN cache (non-blocking).
      // Store origin-AGNOST headers only. Baking Access-Control-Allow-Origin
      // into the cached object leaks one visitor's origin to every other
      // visitor and, on re-merge, produces an invalid comma-joined value.
      // CORS is re-derived per request at serve time instead.
      // Only real images are cached for a year. An origin that answers 200 with
      // an HTML challenge/error page is still relayed, but never cached, so a
      // one-off bad answer can't stick for months.
      const cacheable = ct.toLowerCase().startsWith('image/') && buf.byteLength > 0;
      if (cacheable) {
        const cacheResp = new Response(buf, {
          headers: {
            'Content-Type':  ct,
            'Cache-Control': 'public, max-age=31536000, immutable',
            'X-Cache':       'MISS',
          },
          cf: { cacheEverything: true, cacheTtl: 31536000 },
        });
        ctx.waitUntil(caches.default.put(cacheKey, cacheResp.clone()));
      }

      // Return buffer + content-type so concurrent waiters each build their own Response
      return { type: 'image', buf, ct, cacheable };
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
      'Cache-Control': result.cacheable ? 'public, max-age=31536000, immutable' : 'no-store',
      'X-Cache': 'MISS',
      ...corsHeaders(origin),
    },
    ...(result.cacheable ? { cf: { cacheEverything: true, cacheTtl: 31536000 } } : {}),
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
const SCRAPED_EPOCH_BY_SOURCE = { manganato: 'v3' };  // bumped: drop cached failures
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
      if (data.failed) throw new Error('shared origin failure');
      memSet(ck, data, 300);
      return json(data, 200, { 'X-Cache': 'CDN', cf: { cacheEverything: true, cacheTtl: 1800 } }, origin);
    } catch {
      // fall through to fresh fetch
    }
  }

  const promise = (async () => {
    try {
      // Manganato domains rotate and die independently (530 = Cloudflare can't
      // reach the origin). Try the same path on each sibling mirror in turn.
      const MIRRORS = ['www.manganato.gg', 'manganato.gg', 'www.manganato.com', 'manganato.com'];
      const tu = new URL(target);
      const hosts = MIRRORS.includes(tu.hostname)
        ? [tu.hostname, ...MIRRORS.filter(h => h !== tu.hostname)] : [tu.hostname];
      let r;
      for (const h of hosts) {
        const u = new URL(target); u.hostname = h;
        try {
          r = await doFetch(u.toString());
          if (r.ok || (r.status < 500 && r.status !== 429)) break;
          try { r.body?.cancel().catch(() => {}); } catch {}
        } catch (e) { r = null; }
      }
      if (!r) throw new Error('all mirrors unreachable');
      async function doFetch(url) {
        const targetOrigin = new URL(url).origin + '/';
        return fetch(url, {
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
      }
      if (!r.ok) {
        // 530 / 1xxx = Cloudflare refusing to reach a CF-fronted origin (dead
        // domain, DNS error, edge ban). Log the target so it is diagnosable.
        console.warn(`[scraped:${source}] origin ${r.status} for ${target}`);
        try { r.body?.cancel().catch(() => {}); } catch { /* ignore */ }
        return { failed: true, originStatus: r.status };
      }

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

  let data;
  try {
    data = await promise;
  } catch (e) {
    console.warn(`[scraped:${source}] fetch threw for ${target}: ${e.message}`);
    return json({ error: `${source} unreachable`, detail: e.message }, 502, { 'Cache-Control': 'no-store' }, origin);
  }
  if (data.failed) {
    const status = data.originStatus >= 500 || data.originStatus === 429 ? 502 : data.originStatus;
    return json({ error: `${source} origin returned ${data.originStatus}`, originStatus: data.originStatus },
      status, { 'Cache-Control': 'no-store' }, origin);
  }
  return json(data, 200, { 'X-Cache': 'MISS', cf: { cacheEverything: true, cacheTtl: 1800 } }, origin);
}
