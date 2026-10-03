/**
 * Local behaviour tests for worker.js — run BEFORE deploying.
 *
 *   node cloudflare/worker.test.mjs
 *
 * The Worker is imported as a data: URL because the repo root package.json has
 * no "type": "module", so Node would otherwise treat worker.js as CommonJS.
 * caches.default and fetch are stubbed, so nothing here touches the network or
 * Cloudflare's edge cache.
 */

import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./worker.js', import.meta.url), 'utf8');
const { default: worker } = await import(
  'data:text/javascript;base64,' + Buffer.from(src).toString('base64')
);

// ── Stubs ────────────────────────────────────────────────────────────────────
const cacheStore = new Map();
globalThis.caches = {
  default: {
    async match(req) { return cacheStore.get(req.url) ?? undefined; },
    async put(req, res) { cacheStore.set(req.url, res.clone()); },
    async delete(req) { return cacheStore.delete(req.url); },
  },
};

/** url -> () => Response | Error */
let originRoutes = new Map();
let originCalls = [];
globalThis.fetch = async (url, opts) => {
  originCalls.push(url);
  const h = new URL(url).hostname;
  const route = originRoutes.get(h);
  if (!route) return new Response('no route', { status: 404 });
  return route(url, opts);
};

const IMG = Buffer.from('fake-webp-bytes');
const okImage = () => new Response(IMG, { status: 200, headers: { 'Content-Type': 'image/webp' } });

const ctx = () => ({ waitUntil: (p) => Promise.resolve(p).catch(() => {}) });
const imgReq = (url) => new Request(`https://w.test/img-proxy?url=${encodeURIComponent(url)}`, {
  headers: { origin: 'https://mangareader.pro' },
});

let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${detail}`); }
}

// ── 1. SSRF guard ────────────────────────────────────────────────────────────
console.log('\nSSRF guard');
{
  const r = await worker.fetch(new Request('https://w.test/img-proxy?url=https%3A%2F%2Fevil.com%2Fa.png'), {}, ctx());
  check('rejects unlisted domain', r.status === 403, `got ${r.status}`);
}

// ── 2. Missing url ───────────────────────────────────────────────────────────
console.log('\nMissing url');
{
  const r = await worker.fetch(new Request('https://w.test/img-proxy'), {}, ctx());
  check('returns 400', r.status === 400, `got ${r.status}`);
}

// ── 3. Dead primary host falls back to the mirror ────────────────────────────
console.log('\nMirror fallback');
{
  cacheStore.clear(); originRoutes = new Map(); originCalls = [];
  originRoutes.set('img-r2.2xstorage.com', () => new Response('down', { status: 503 }));
  originRoutes.set('img-r1.2xstorage.com', okImage);

  const r = await worker.fetch(imgReq('https://img-r2.2xstorage.com/manga-a/77/5.webp'), {}, ctx());
  check('serves 200 despite dead primary', r.status === 200, `got ${r.status}`);
  check('body is the mirror image', (await r.arrayBuffer()).byteLength === IMG.byteLength);
  check('tried the dead host first', originCalls[0]?.includes('img-r2') === true, originCalls[0]);
  check('then the mirror', originCalls[1]?.includes('img-r1') === true, originCalls[1]);
}

// ── 4. Successful image is cached and replayed ───────────────────────────────
console.log('\nCache write-through');
{
  cacheStore.clear(); originRoutes = new Map(); originCalls = [];
  originRoutes.set('img-r1.2xstorage.com', okImage);

  const url = 'https://img-r1.2xstorage.com/manga-b/1/0.webp';
  const first = await worker.fetch(imgReq(url), {}, ctx());
  await new Promise(r => setTimeout(r, 20));       // let waitUntil(put) settle
  const second = await worker.fetch(imgReq(url), {}, ctx());

  check('first request MISS', first.headers.get('X-Cache') === 'MISS', first.headers.get('X-Cache'));
  check('second request HIT', second.headers.get('X-Cache') === 'HIT', second.headers.get('X-Cache'));
  check('origin fetched once', originCalls.length === 1, `origin calls: ${originCalls.length}`);
}

// ── 5. All hosts dead -> 502, and the breaker trips ──────────────────────────
console.log('\nCircuit breaker');
{
  cacheStore.clear(); originRoutes = new Map(); originCalls = [];
  originRoutes.set('img-r1.2xstorage.com', () => new Response('down', { status: 503 }));

  const statuses = [];
  for (let i = 0; i < 6; i++) {
    // Unique URL each time so the negative cache never masks breaker behaviour.
    const r = await worker.fetch(imgReq(`https://img-r1.2xstorage.com/dead/${i}.webp`), {}, ctx());
    statuses.push(`${r.status}/${r.headers.get('X-Cache')}`);
  }
  check('all six fail with 502', statuses.every(s => s.startsWith('502')), statuses.join(' '));
  check('breaker opens after 5 failures', statuses[5].includes('BREAKER'), statuses[5]);
  check('origin calls stop once breaker opens', originCalls.length <= 12, `origin calls: ${originCalls.length}`);
}

// ── 6. 429 does NOT trip the breaker and caches briefly ──────────────────────
// Uses imgur.com so breaker state from the previous block cannot leak in.
console.log('\nThrottling (429)');
{
  cacheStore.clear(); originRoutes = new Map(); originCalls = [];
  originRoutes.set('imgur.com', () => new Response('slow down', { status: 429 }));

  const r1 = await worker.fetch(imgReq('https://imgur.com/hot/1.webp'), {}, ctx());
  check('returns 502 not 429', r1.status === 502, `got ${r1.status}`);
  check('upstream status surfaced', r1.headers.get('X-Origin-Status') === '429', r1.headers.get('X-Origin-Status'));

  const before = originCalls.length;
  const r2 = await worker.fetch(imgReq('https://imgur.com/hot/1.webp'), {}, ctx());
  check('repeat hits negative cache', r2.headers.get('X-Cache') === 'NEGATIVE', r2.headers.get('X-Cache'));
  check('repeat makes no origin call', originCalls.length === before, `${before} -> ${originCalls.length}`);

  const r3 = await worker.fetch(imgReq('https://imgur.com/hot/2.webp'), {}, ctx());
  check('breaker NOT tripped by 429', !String(r3.headers.get('X-Cache')).includes('BREAKER'), r3.headers.get('X-Cache'));
}

// ── 7. Error responses carry per-request CORS ────────────────────────────────
console.log('\nCORS on errors');
{
  cacheStore.clear(); originRoutes = new Map();
  originRoutes.set('waitst.com', () => new Response('down', { status: 503 }));
  const r = await worker.fetch(imgReq('https://waitst.com/cors/1.webp'), {}, ctx());
  check('ACAO echoed back', r.headers.get('Access-Control-Allow-Origin') === 'https://mangareader.pro',
    r.headers.get('Access-Control-Allow-Origin'));
}

// ── 8. Scraped HTML endpoint ────────────────────────────────────────────────
console.log('\nScraper endpoint');
{
  cacheStore.clear(); originRoutes = new Map(); originCalls = [];
  originRoutes.set('www.manganato.gg', () => new Response('<html>chapter</html>', {
    status: 200, headers: { 'Content-Type': 'text/html' },
  }));

  const req = new Request('https://w.test/api/manganato?url=https%3A%2F%2Fwww.manganato.gg%2Fmanga%2Fx%2Fchapter-1', {
    headers: { origin: 'https://mangareader.pro' },
  });
  const r = await worker.fetch(req, {}, ctx());
  const body = await r.json();
  check('returns 200', r.status === 200, `got ${r.status}`);
  check('returns upstream html', body.html === '<html>chapter</html>');
}

// ── 8b. Scraper origin failure (e.g. Cloudflare 530) returns clean 502 JSON ──
console.log('\nScraper origin 530');
{
  cacheStore.clear(); originRoutes = new Map(); originCalls = [];
  for (const h of ['www.manganato.gg','manganato.gg','www.manganato.com','manganato.com'])
    originRoutes.set(h, () => new Response('error code: 1016', { status: 530 }));
  const req = new Request('https://w.test/api/manganato?url=https%3A%2F%2Fmanganato.com%2Fmanga-x', {
    headers: { origin: 'https://mangareader.pro' },
  });
  const r = await worker.fetch(req, {}, ctx());
  const body = await r.json();
  check('returns 502 JSON, not a crash', r.status === 502 && body.originStatus === 530, `got ${r.status}`);
  check('failure not cached as html', !body.html);
}

// ── 8c. Dead mirror fails over to a live one ─────────────────────────────────
console.log('\nScraper mirror failover');
{
  cacheStore.clear(); originRoutes = new Map(); originCalls = [];
  originRoutes.set('manganato.com', () => new Response('x', { status: 530 }));
  originRoutes.set('www.manganato.gg', () => new Response('<html>ok</html>', { status: 200 }));
  const req = new Request('https://w.test/api/manganato?url=https%3A%2F%2Fmanganato.com%2Fmanga-x', {
    headers: { origin: 'https://mangareader.pro' },
  });
  const r = await worker.fetch(req, {}, ctx());
  const body = await r.json();
  check('falls over to live mirror', r.status === 200 && body.html === '<html>ok</html>', `got ${r.status}`);
}

// ── 9. 404 from origin passes through, body is not relayed ───────────────────
console.log('\nOrigin 404');
{
  cacheStore.clear(); originRoutes = new Map();
  originRoutes.set('media.mangaka.com', () => new Response('<html>secret upstream page</html>', { status: 404 }));
  const r = await worker.fetch(imgReq('https://media.mangaka.com/gone/1.webp'), {}, ctx());
  const text = await r.text();
  check('status relayed as 404', r.status === 404, `got ${r.status}`);
  check('upstream body NOT relayed', !text.includes('secret upstream page'), text);
}

// ── 7. A throttle that clears mid-retry is recovered, not surfaced ──────────
console.log('\nThrottle recovery');
{
  cacheStore.clear(); originRoutes = new Map(); originCalls = [];
  let attempts = 0;
  originRoutes.set('mangaread.org', () => {
    attempts++;
    return attempts <= 2 ? new Response('slow down', { status: 429 }) : okImage();
  });

  const r = await worker.fetch(imgReq('https://mangaread.org/recovers/1.webp'), {}, ctx());
  check('eventually returns 200', r.status === 200, `got ${r.status}`);
  check('retried past the throttle', attempts === 3, `attempts: ${attempts}`);
  check('origin image served', (await r.arrayBuffer()).byteLength === IMG.byteLength);
}

// ── 8. Persistent throttle gives up instead of hammering forever ─────────────
console.log('\nPersistent throttle');
{
  cacheStore.clear(); originRoutes = new Map(); originCalls = [];
  originRoutes.set('mangakatana.com', () => new Response('slow down', { status: 429 }));

  const r = await worker.fetch(imgReq('https://mangakatana.com/always/1.webp'), {}, ctx());
  check('returns 502', r.status === 502, `got ${r.status}`);
  check('bounded to 5 attempts', originCalls.length === 5, `origin calls: ${originCalls.length}`);
  check('breaker not tripped by 429', !String(r.headers.get('X-Cache')).includes('BREAKER'), r.headers.get('X-Cache'));
}

// ── 10. R2 ───────────────────────────────────────────────────────────────────
function makeBucket() {
  const m = new Map();
  return {
    m,
    async get(k) { const o = m.get(k); return o ? { body: new Response(o.buf).body, httpMetadata: o.opts.httpMetadata } : null; },
    async put(k, buf, opts) { m.set(k, { buf, opts }); },
    async delete(k) { m.delete(k); },
  };
}
const flush = () => new Promise(r => setTimeout(r, 20));

console.log('\nR2 write-through');
{
  cacheStore.clear(); originRoutes = new Map(); originCalls = [];
  originRoutes.set('media.mangaka.com', okImage);
  const bucket = makeBucket();
  const r = await worker.fetch(imgReq('https://media.mangaka.com/r2/1.webp'), { IMG_BUCKET: bucket }, ctx());
  await flush();
  check('origin image served', r.status === 200);
  check('stored in R2 under img/ prefix', [...bucket.m.keys()].length === 1 && [...bucket.m.keys()][0].startsWith('img/v1/'));
  check('stored with content type', [...bucket.m.values()][0].opts.httpMetadata.contentType === 'image/webp');
}

console.log('\nR2 read-through (cold edge cache, no origin call)');
{
  const bucket = makeBucket();
  cacheStore.clear(); originRoutes = new Map(); originCalls = [];
  originRoutes.set('media.mangaka.com', okImage);
  await worker.fetch(imgReq('https://media.mangaka.com/r2/2.webp'), { IMG_BUCKET: bucket }, ctx());
  await flush();
  cacheStore.clear(); originCalls = [];            // simulate a different data center
  const r = await worker.fetch(imgReq('https://media.mangaka.com/r2/2.webp'), { IMG_BUCKET: bucket }, ctx());
  const body = Buffer.from(await r.arrayBuffer());
  check('served from R2', r.headers.get('X-Cache') === 'R2', r.headers.get('X-Cache'));
  check('zero origin calls', originCalls.length === 0, `calls: ${originCalls.length}`);
  check('bytes intact', body.equals(IMG));
  await flush();
  check('edge cache backfilled', cacheStore.size === 1, `size ${cacheStore.size}`);
}

console.log('\nR2 never stores non-images');
{
  cacheStore.clear(); originCalls = []; originRoutes = new Map();
  originRoutes.set('media.mangaka.com', () => new Response('<html>challenge</html>', { status: 200, headers: { 'Content-Type': 'text/html' } }));
  const bucket = makeBucket();
  await worker.fetch(imgReq('https://media.mangaka.com/r2/3.webp'), { IMG_BUCKET: bucket }, ctx());
  await flush();
  check('HTML 200 not stored', bucket.m.size === 0);
}

console.log('\nR2 failures never break serving');
{
  cacheStore.clear(); originCalls = []; originRoutes = new Map();
  originRoutes.set('media.mangaka.com', okImage);
  const broken = { async get() { throw new Error('r2 down'); }, async put() { throw new Error('r2 down'); }, async delete() {} };
  const r = await worker.fetch(imgReq('https://media.mangaka.com/r2/4.webp'), { IMG_BUCKET: broken }, ctx());
  check('still serves from origin', r.status === 200, `got ${r.status}`);
}

console.log('\nPurge endpoint');
{
  cacheStore.clear(); originCalls = []; originRoutes = new Map();
  originRoutes.set('media.mangaka.com', okImage);
  const bucket = makeBucket();
  const url = 'https://media.mangaka.com/r2/5.webp';
  await worker.fetch(imgReq(url), { IMG_BUCKET: bucket }, ctx());
  await flush();
  const mk = (tok) => new Request('https://w.test/admin/img-purge', {
    method: 'POST', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  const env = { IMG_BUCKET: bucket, ADMIN_TOKEN: 'secret' };
  check('404 when no ADMIN_TOKEN set', (await worker.fetch(mk('x'), { IMG_BUCKET: bucket }, ctx())).status === 404);
  check('401 on wrong token', (await worker.fetch(mk('nope'), env, ctx())).status === 401);
  check('object still present after bad token', bucket.m.size === 1);
  const ok = await worker.fetch(mk('secret'), env, ctx());
  check('200 on right token', ok.status === 200, `got ${ok.status}`);
  check('object deleted from R2', bucket.m.size === 0);
}

// ── 11. Backend fallback for throttled / dead image hosts ────────────────────
console.log('\nBackend fallback');
{
  cacheStore.clear(); originRoutes = new Map(); originCalls = [];
  originRoutes.set('mangakatana.com', () => new Response('slow down', { status: 429 }));
  originRoutes.set('backend.test', () => okImage());
  const t0 = Date.now();
  const r = await worker.fetch(imgReq('https://mangakatana.com/fb/1.webp'), { BACKEND_URL: 'https://backend.test' }, ctx());
  check('served via backend', r.status === 200, `got ${r.status}`);
  check('fast (no backoff wait)', Date.now() - t0 < 1500, `${Date.now() - t0}ms`);
  check('backend called exactly once', originCalls.filter(u => u.includes('backend.test')).length === 1);
  check('backend URL carries target', originCalls.some(u => u.includes('backend.test/api/proxy-image?url=')));
}
{
  cacheStore.clear(); originRoutes = new Map(); originCalls = [];
  originRoutes.set('media.mangaka.com', () => new Response('nope', { status: 503 }));
  originRoutes.set('backend.test', () => new Response('<html>err</html>', { status: 200, headers: { 'Content-Type': 'text/html' } }));
  const r = await worker.fetch(imgReq('https://media.mangaka.com/fb/2.webp'), { BACKEND_URL: 'https://backend.test' }, ctx());
  check('non-image from backend is rejected', r.status === 502, `got ${r.status}`);
}
{
  cacheStore.clear(); originRoutes = new Map(); originCalls = [];
  originRoutes.set('media.mangaka.com', () => new Response('nope', { status: 503 }));
  const r = await worker.fetch(imgReq('https://media.mangaka.com/fb/3.webp'), {}, ctx());
  check('no BACKEND_URL = old behaviour', r.status === 502 && !originCalls.some(u => u.includes('backend')));
}

// ── 12. WebP conversion ──────────────────────────────────────────────────────
function makeImages(fn) {
  const calls = [];
  return {
    calls,
    input(stream) {
      calls.push('input');
      return { async output(opts) { const out = await fn(stream, opts); return { response: () => out }; } };
    },
  };
}
const jpegRoute = () => new Response(IMG, { status: 200, headers: { 'Content-Type': 'image/jpeg' } });
const WEBP_SMALL = Buffer.from('tiny');
const webpOut = (b) => () => new Response(b, { headers: { 'Content-Type': 'image/webp' } });

console.log('\nWebP conversion');
{
  cacheStore.clear(); originRoutes = new Map(); originCalls = [];
  originRoutes.set('media.mangaka.com', jpegRoute);
  const bucket = makeBucket();
  const images = makeImages(webpOut(WEBP_SMALL));
  const r = await worker.fetch(imgReq('https://media.mangaka.com/w/1.jpg'), { IMG_BUCKET: bucket, IMAGES: images }, ctx());
  const body = Buffer.from(await r.arrayBuffer());
  await flush();
  const stored = [...bucket.m.values()][0];
  check('user gets webp', r.headers.get('Content-Type') === 'image/webp', r.headers.get('Content-Type'));
  check('user gets converted bytes', body.equals(WEBP_SMALL));
  check('R2 stores converted bytes', Buffer.from(stored.buf).equals(WEBP_SMALL));
  check('R2 content type is webp', stored.opts.httpMetadata.contentType === 'image/webp');
  check('R2 metadata records conversion', stored.opts.customMetadata.converted === 'webp' && stored.opts.customMetadata.origBytes === String(IMG.length));
}
{
  cacheStore.clear(); originRoutes = new Map(); originCalls = [];
  originRoutes.set('media.mangaka.com', okImage);   // already image/webp
  const images = makeImages(webpOut(WEBP_SMALL));
  await worker.fetch(imgReq('https://media.mangaka.com/w/2.webp'), { IMAGES: images }, ctx());
  check('already-webp skipped (no billable transform)', images.calls.length === 0);
}
{
  cacheStore.clear(); originRoutes = new Map(); originCalls = [];
  originRoutes.set('media.mangaka.com', jpegRoute);
  const images = makeImages(() => { throw new Error('quota exceeded'); });
  const r = await worker.fetch(imgReq('https://media.mangaka.com/w/3.jpg'), { IMAGES: images }, ctx());
  const body = Buffer.from(await r.arrayBuffer());
  check('conversion error -> original served', r.status === 200 && body.equals(IMG) && r.headers.get('Content-Type') === 'image/jpeg');
}
{
  cacheStore.clear(); originRoutes = new Map(); originCalls = [];
  originRoutes.set('media.mangaka.com', jpegRoute);
  const images = makeImages(webpOut(Buffer.alloc(500, 1)));   // bigger than the 15-byte original
  const r = await worker.fetch(imgReq('https://media.mangaka.com/w/4.jpg'), { IMAGES: images }, ctx());
  const body = Buffer.from(await r.arrayBuffer());
  check('bigger webp rejected, original kept', body.equals(IMG));
}
{
  cacheStore.clear(); originRoutes = new Map(); originCalls = [];
  originRoutes.set('media.mangaka.com', jpegRoute);
  const images = makeImages(webpOut(WEBP_SMALL));
  await worker.fetch(imgReq('https://media.mangaka.com/w/5.jpg'), { IMAGES: images, WEBP_CONVERT: 'off' }, ctx());
  check('kill switch disables conversion', images.calls.length === 0);
}
{
  cacheStore.clear(); originRoutes = new Map(); originCalls = [];
  originRoutes.set('media.mangaka.com', jpegRoute);
  const images = makeImages(() => new Response('<html>', { headers: { 'Content-Type': 'text/html' } }));
  const r = await worker.fetch(imgReq('https://media.mangaka.com/w/6.jpg'), { IMAGES: images }, ctx());
  check('non-webp output rejected', Buffer.from(await r.arrayBuffer()).equals(IMG));
}
{
  // converted once, then a cold edge cache is served from R2 with NO second transform
  cacheStore.clear(); originRoutes = new Map(); originCalls = [];
  originRoutes.set('media.mangaka.com', jpegRoute);
  const bucket = makeBucket(); const images = makeImages(webpOut(WEBP_SMALL));
  const env = { IMG_BUCKET: bucket, IMAGES: images };
  await worker.fetch(imgReq('https://media.mangaka.com/w/7.jpg'), env, ctx());
  await flush(); cacheStore.clear();
  const r = await worker.fetch(imgReq('https://media.mangaka.com/w/7.jpg'), env, ctx());
  check('second request from R2', r.headers.get('X-Cache') === 'R2');
  check('only one transform ever billed', images.calls.length === 1, `calls: ${images.calls.length}`);
}

// ── 13. Errors and bad answers are never cached long-term ────────────────────
console.log('\nError caching');
{
  cacheStore.clear(); originRoutes = new Map(); originCalls = [];
  originRoutes.set('media.mangaka.com', () => new Response('down', { status: 503 }));
  const bucket = makeBucket();
  const r = await worker.fetch(imgReq('https://media.mangaka.com/e/1.webp'), { IMG_BUCKET: bucket }, ctx());
  await flush();
  check('failed fetch returns 502', r.status === 502);
  check('nothing written to R2 on failure', bucket.m.size === 0);
  const cc = r.headers.get('Cache-Control') || '';
  check('error response cache-control is short (<=15s)', /max-age=(\d+)/.test(cc) && Number(cc.match(/max-age=(\d+)/)[1]) <= 15, cc);
  const negTtls = [...cacheStore.entries()].filter(([k]) => k.includes('neg')).map(([, v]) => v.headers.get('Cache-Control'));
  check('negative-cache entry is short (<=60s)', negTtls.every(c => Number(c.match(/max-age=(\d+)/)[1]) <= 60), String(negTtls));
}
{
  cacheStore.clear(); originRoutes = new Map(); originCalls = [];
  originRoutes.set('media.mangaka.com', () => new Response('<html>challenge</html>', { status: 200, headers: { 'Content-Type': 'text/html' } }));
  const bucket = makeBucket();
  const r = await worker.fetch(imgReq('https://media.mangaka.com/e/2.webp'), { IMG_BUCKET: bucket }, ctx());
  await flush();
  check('HTML-200 not stored in R2', bucket.m.size === 0);
  check('HTML-200 not stored in edge cache', ![...cacheStore.keys()].some(k => k.includes('img.internal')));
  check('HTML-200 response is no-store', r.headers.get('Cache-Control') === 'no-store', r.headers.get('Cache-Control'));
}

// ── 14. R2 operation budget ──────────────────────────────────────────────────
function countingBucket() {
  const b = makeBucket(); b.ops = { get: 0, put: 0 };
  const g = b.get.bind(b), p = b.put.bind(b);
  b.get = async (k) => { b.ops.get++; return g(k); };
  b.put = async (k, v, o) => { b.ops.put++; return p(k, v, o); };
  return b;
}
console.log('\nR2 operation budget');
{
  cacheStore.clear(); originRoutes = new Map(); originCalls = [];
  originRoutes.set('media.mangaka.com', () => new Response('down', { status: 503 }));
  const bucket = countingBucket();
  await worker.fetch(imgReq('https://media.mangaka.com/b/1.webp'), { IMG_BUCKET: bucket }, ctx());   // first failure: 1 read
  const before = bucket.ops.get;
  for (let i = 0; i < 5; i++) await worker.fetch(imgReq('https://media.mangaka.com/b/1.webp'), { IMG_BUCKET: bucket }, ctx());
  check('repeat retries of a failing image cost 0 extra R2 reads', bucket.ops.get === before, `reads ${before} -> ${bucket.ops.get}`);
  check('failing image never written', bucket.ops.put === 0);
}
{
  cacheStore.clear(); originRoutes = new Map(); originCalls = [];
  originRoutes.set('media.mangaka.com', okImage);
  const bucket = countingBucket();
  await worker.fetch(imgReq('https://media.mangaka.com/b/2.webp'), { IMG_BUCKET: bucket, R2_CACHE: 'off' }, ctx());
  check('R2_CACHE=off -> zero R2 operations', bucket.ops.get === 0 && bucket.ops.put === 0);
}
{
  cacheStore.clear(); originRoutes = new Map(); originCalls = [];
  originRoutes.set('media.mangaka.com', okImage);
  const bucket = countingBucket();
  const r = await worker.fetch(new Request('https://w.test/img-proxy?url=' + encodeURIComponent('https://media.mangaka.com/b/3.webp'),
    { headers: { referer: 'https://some-scraper.example/page' } }), { IMG_BUCKET: bucket }, ctx());
  check('foreign referer blocked (hotlink)', r.status === 403, `got ${r.status}`);
  check('blocked hotlink costs 0 R2 ops and 0 origin calls', bucket.ops.get === 0 && originCalls.length === 0);
  const ok = await worker.fetch(new Request('https://w.test/img-proxy?url=' + encodeURIComponent('https://media.mangaka.com/b/3.webp'),
    { headers: { referer: 'https://www.mangareader.pro/reader/1' } }), { IMG_BUCKET: bucket }, ctx());
  check('own-site referer allowed', ok.status === 200);
  const none = await worker.fetch(new Request('https://w.test/img-proxy?url=' + encodeURIComponent('https://media.mangaka.com/b/4.webp')), { IMG_BUCKET: bucket }, ctx());
  check('empty referer allowed (no-referrer pages)', none.status === 200);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);