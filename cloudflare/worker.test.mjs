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

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);