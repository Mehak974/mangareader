/**
 * CLOUDFLARE WORKER — MangaReader Proxy
 * Deploy at: workers.cloudflare.com
 * Routes:
 *   /img-proxy?url=<encoded>        → Image proxy with Referer spoofing + infinite cache
 *   /api/anilist                    → AniList GraphQL cache (90 req/min limit bypass)
 *   /api/mangadex/*                 → MangaDex official API passthrough
 *   /api/manganato/*                → Manganato with browser headers
 *   /api/mangakatana/*              → MangaKatana with browser headers
 *   /api/mangaread/*                → MangaRead.org with browser headers
 */

const ALLOWED_IMAGE_DOMAINS = [
  'manganato.com',
  'readmanganato.com',
  'chapmanganato.to',
  'manganato.gg',
  'mangakatana.com',
  'mangaread.org',
  'uploads.mangadex.org',
  'cmdxd98sb0x3yprd.mangadex.network',
  's1.mkklcdnv6tempv2.com',
  'xfs.mangakatana.com',
  's4.anilist.co',
  'anilist.co',
  '2xstorage.com',
  'img-r1.2xstorage.com',
  'img-r2.2xstorage.com',
  'media.mangaka.com',
];

const SOURCE_REFERERS = {
  'manganato.com':       'https://manganato.com/',
  'manganato.gg':        'https://manganato.gg/',
  'readmanganato.com':   'https://readmanganato.com/',
  'chapmanganato.to':    'https://chapmanganato.to/',
  'mangakatana.com':     'https://mangakatana.com/',
  'mangaread.org':       'https://mangaread.org/',
  'uploads.mangadex.org':'https://mangadex.org/',
  'cmdxd98sb0x3yprd.mangadex.network': 'https://mangadex.org/',
  's4.anilist.co':       'https://anilist.co/',
  'anilist.co':          'https://anilist.co/',
  '2xstorage.com':       'https://manganato.com/',
  'img-r1.2xstorage.com':'https://manganato.com/',
  'img-r2.2xstorage.com':'https://manganato.com/',
};

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url  = new URL(request.url);
    const path = url.pathname;

    try {
      if (path.startsWith('/img-proxy'))        return handleImageProxy(request, env, ctx);
      if (path.startsWith('/api/anilist'))      return handleAniList(request, env, ctx);
      if (path.startsWith('/api/mangadex'))     return handleMangaDex(request, env, ctx);
      if (path.startsWith('/api/manganato'))    return handleManganato(request, env, ctx);
      if (path.startsWith('/api/mangakatana'))  return handleMangaKatana(request, env, ctx);
      if (path.startsWith('/api/mangaread'))    return handleMangaRead(request, env, ctx);
      return new Response('Not Found', { status: 404 });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }
  },
};

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function getReferer(targetUrl) {
  const hostname = new URL(targetUrl).hostname;
  for (const [domain, referer] of Object.entries(SOURCE_REFERERS)) {
    if (hostname.includes(domain)) return referer;
  }
  return null;
}

function isAllowedImageDomain(targetUrl) {
  try {
    const hostname = new URL(targetUrl).hostname;
    return ALLOWED_IMAGE_DOMAINS.some(d => hostname.includes(d));
  } catch {
    return false;
  }
}

function jsonResponse(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS, ...extra },
  });
}

async function kvGet(env, key) {
  try { return await env.CACHE.get(key, 'json'); } catch { return null; }
}

async function kvSet(env, key, value, ttlSeconds) {
  try {
    await env.CACHE.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds });
  } catch {}
}

async function handleImageProxy(request, env, ctx) {
  const url       = new URL(request.url);
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl)                    return new Response('Missing ?url=', { status: 400 });
  if (!isAllowedImageDomain(targetUrl)) return new Response('Domain not allowed', { status: 403 });

  const cache    = caches.default;
  const cacheKey = new Request(`https://img-proxy/${btoa(encodeURIComponent(targetUrl))}`);
  const cached   = await cache.match(cacheKey);
  if (cached) {
    return new Response(cached.body, {
      headers: { ...Object.fromEntries(cached.headers), 'X-Cache': 'HIT', ...CORS_HEADERS },
    });
  }

  const referer = getReferer(targetUrl);
  const fetchHeaders = {
    'User-Agent':       randomUA(),
    'Accept':           'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    'Accept-Language':  'en-US,en;q=0.9',
    'Cache-Control':    'no-cache',
  };
  if (referer) fetchHeaders['Referer'] = referer;

  const origin = await fetch(targetUrl, { headers: fetchHeaders });
  if (!origin.ok) return new Response(`Source error ${origin.status}`, {
    status: origin.status,
    headers: { 'Cache-Control': 'no-store', ...CORS_HEADERS },
  });

  const contentType = origin.headers.get('content-type') || 'image/jpeg';
  const responseToCache = new Response(origin.body, {
    headers: {
      'Content-Type':  contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Cache':       'MISS',
      ...CORS_HEADERS,
    },
  });

  ctx.waitUntil(cache.put(cacheKey, responseToCache.clone()));
  return responseToCache;
}

async function handleAniList(request, env, ctx) {
  const body      = await request.json();
  const cacheKey  = 'al:' + btoa(JSON.stringify(body)).slice(0, 200);

  const cached = await kvGet(env, cacheKey);
  if (cached) return jsonResponse(cached, 200, { 'X-Cache': 'HIT' });

  const origin = await fetch('https://graphql.anilist.co', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body:    JSON.stringify(body),
  });

  const data = await origin.json();

  if (origin.status === 429) {
    return jsonResponse({ error: 'AniList rate limit — try again shortly' }, 429);
  }

  ctx.waitUntil(kvSet(env, cacheKey, data, 86400));
  return jsonResponse(data, 200, { 'X-Cache': 'MISS' });
}

async function handleMangaDex(request, env, ctx) {
  const url      = new URL(request.url);
  const mdPath   = url.pathname.replace('/api/mangadex', '');
  const mdSearch = url.search;
  const targetUrl = `https://api.mangadex.org${mdPath}${mdSearch}`;

  const cacheKey = 'md:' + btoa(targetUrl).slice(0, 200);
  const ttl = mdPath.includes('/feed') ? 600 : 3600;

  const cached = await kvGet(env, cacheKey);
  if (cached) return jsonResponse(cached, 200, { 'X-Cache': 'HIT' });

  const origin = await fetch(targetUrl, {
    headers: {
      'User-Agent': 'MangaReader/2.0 (contact: your@email.com)',
      'Accept':     'application/json',
    },
  });

  if (!origin.ok) return jsonResponse({ error: `MangaDex ${origin.status}` }, origin.status);

  const data = await origin.json();
  ctx.waitUntil(kvSet(env, cacheKey, data, ttl));
  return jsonResponse(data, 200, { 'X-Cache': 'MISS' });
}

async function handleManganato(request, env, ctx) {
  const url       = new URL(request.url);
  const targetUrl = url.searchParams.get('url');
  if (!targetUrl) return jsonResponse({ error: 'Missing ?url=' }, 400);

  const cacheKey = 'mnt:' + btoa(targetUrl).slice(0, 200);
  const cached   = await kvGet(env, cacheKey);
  if (cached) return jsonResponse(cached, 200, { 'X-Cache': 'HIT' });

  const origin = await fetch(targetUrl, {
    headers: {
      'User-Agent':      randomUA(),
      'Referer':         'https://manganato.com/',
      'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Sec-Fetch-Dest':  'document',
      'Sec-Fetch-Mode':  'navigate',
      'Sec-Fetch-Site':  'same-origin',
      'Upgrade-Insecure-Requests': '1',
    },
  });

  if (!origin.ok) return jsonResponse({ error: `Manganato ${origin.status}` }, origin.status);

  const html = await origin.text();
  const result = { html, status: origin.status };
  ctx.waitUntil(kvSet(env, cacheKey, result, 1800));
  return jsonResponse(result, 200, { 'X-Cache': 'MISS' });
}

async function handleMangaKatana(request, env, ctx) {
  const url       = new URL(request.url);
  const targetUrl = url.searchParams.get('url');
  if (!targetUrl) return jsonResponse({ error: 'Missing ?url=' }, 400);

  const cacheKey = 'mkt:' + btoa(targetUrl).slice(0, 200);
  const cached   = await kvGet(env, cacheKey);
  if (cached) return jsonResponse(cached, 200, { 'X-Cache': 'HIT' });

  const origin = await fetch(targetUrl, {
    headers: {
      'User-Agent':      randomUA(),
      'Referer':         'https://mangakatana.com/',
      'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection':      'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest':  'document',
      'Sec-Fetch-Mode':  'navigate',
      'Sec-Fetch-Site':  'none',
      'Sec-Fetch-User':  '?1',
    },
  });

  if (!origin.ok) return jsonResponse({ error: `MangaKatana ${origin.status}` }, origin.status);

  const html   = await origin.text();
  const result = { html, status: origin.status };
  ctx.waitUntil(kvSet(env, cacheKey, result, 1800));
  return jsonResponse(result, 200, { 'X-Cache': 'MISS' });
}

async function handleMangaRead(request, env, ctx) {
  const url       = new URL(request.url);
  const targetUrl = url.searchParams.get('url');
  if (!targetUrl) return jsonResponse({ error: 'Missing ?url=' }, 400);

  const cacheKey = 'mr:' + btoa(targetUrl).slice(0, 200);
  const cached   = await kvGet(env, cacheKey);
  if (cached) return jsonResponse(cached, 200, { 'X-Cache': 'HIT' });

  const origin = await fetch(targetUrl, {
    headers: {
      'User-Agent':      randomUA(),
      'Referer':         'https://mangaread.org/',
      'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Sec-Fetch-Dest':  'document',
      'Sec-Fetch-Mode':  'navigate',
      'Sec-Fetch-Site':  'same-origin',
    },
  });

  if (!origin.ok) return jsonResponse({ error: `MangaRead ${origin.status}` }, origin.status);

  const html   = await origin.text();
  const result = { html, status: origin.status };
  ctx.waitUntil(kvSet(env, cacheKey, result, 1800));
  return jsonResponse(result, 200, { 'X-Cache': 'MISS' });
}
