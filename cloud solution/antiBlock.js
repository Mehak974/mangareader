/**
 * antiBlock.js — Smart HTTP layer for manga scraping
 *
 * Drop-in replacement for the raw axios.get() calls in universalExtractor.js.
 * Exports a single `fetchHTML(url, extraHeaders?)` that:
 *
 *  1. Rotates 30+ realistic browser User-Agents across Chrome / Firefox / Edge / Safari
 *  2. Uses per-domain Bottleneck rate limiters to avoid bulk detection
 *  3. Applies a circuit breaker per domain (5 failures → 30s pause → half-open test)
 *  4. Retries up to 3× with exponential back-off + jitter on transient failures
 *  5. Maintains per-domain cookie jars (so session cookies carry across requests)
 *  6. Adds realistic browser fingerprint headers (sec-ch-ua, Sec-Fetch-*, TE)
 *  7. Detects Cloudflare / bot-wall responses and signals the extractor to fall back
 *
 * Installation (add to backend/package.json dependencies):
 *   "got-scraping": "^4.0.4"
 *
 * Usage in universalExtractor.js — replace the internal fetchHTML definition:
 *   const { fetchHTML } = require('./antiBlock');
 *   // Then remove the old axios-based fetchHTML — everything else stays the same.
 */

'use strict';

const Bottleneck = require('bottleneck');

// ── User-Agent pool ─────────────────────────────────────────────────────────
// 30 real desktop UAs spanning Chrome 120-124, Firefox 121-125, Edge 122-124,
// Safari 16-17 across Windows / macOS / Linux.  Enough variety that cycling
// through them looks organic, not mechanical.

const USER_AGENTS = [
  // Chrome 124 – Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  // Chrome 124 – macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Safari/537.36',
  // Chrome 124 – Linux
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  // Chrome 123 – Win / Mac
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.86 Safari/537.36',
  // Chrome 122 – Win
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  // Chrome 121 – Win / Mac
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  // Chrome 120 – Win (older = looks like a regular long-time user)
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  // Firefox 125 – Win / Mac / Linux
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.4; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
  // Firefox 124 – Win
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
  // Firefox 123 – Win / Mac
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13.6; rv:123.0) Gecko/20100101 Firefox/123.0',
  // Firefox 121 – Linux
  'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
  // Edge 124 – Win
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
  // Edge 123 – Win
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0',
  // Edge 122 – Win
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
  // Safari 17 – macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
  // Safari 17 – macOS (different minor)
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Safari/605.1.15',
  // Safari 16 – macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_2_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Safari/605.1.15',
  // Opera – Win
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 OPR/110.0.0.0',
  // Brave (Chrome-based, indistinguishable UA)
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  // Chrome 119 – Win (noticeably older slot – blend in as non-power-users)
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  // Chrome 118 – Mac
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  // Firefox 120 – Win
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
  // Edge 120 – Win
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
];

const ACCEPT_LANGUAGES = [
  'en-US,en;q=0.9',
  'en-US,en;q=0.8',
  'en-GB,en;q=0.9,en-US;q=0.8',
  'en-US,en;q=0.9,es;q=0.8',
  'en-US,en;q=0.9,ja;q=0.8',
  'en-US,en;q=0.9,ko;q=0.8',
  'en-CA,en;q=0.9',
  'en-AU,en;q=0.9',
];

let uaIndex = 0;
function nextUA() {
  const ua = USER_AGENTS[uaIndex % USER_AGENTS.length];
  uaIndex++;
  return ua;
}

// ── Circuit Breaker ─────────────────────────────────────────────────────────
class CircuitBreaker {
  constructor({ name, threshold = 5, timeout = 30000 } = {}) {
    this.name = name || 'unknown';
    this.threshold = threshold;
    this.timeout = timeout;
    this.state = 'CLOSED';  // CLOSED | OPEN | HALF_OPEN
    this.failures = 0;
    this.nextAttemptAt = 0;
  }

  canAttempt() {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'OPEN') {
      if (Date.now() >= this.nextAttemptAt) {
        this.state = 'HALF_OPEN';
        console.log(`[CB:${this.name}] Half-open — testing recovery`);
        return true;
      }
      return false;
    }
    return true; // HALF_OPEN: let one through
  }

  recordSuccess() {
    if (this.state !== 'CLOSED') {
      console.log(`[CB:${this.name}] Closed — recovered after ${this.failures} failures`);
    }
    this.failures = 0;
    this.state = 'CLOSED';
  }

  recordFailure() {
    this.failures++;
    if (this.state === 'HALF_OPEN' || this.failures >= this.threshold) {
      const pauseMs = this.timeout * Math.min(Math.pow(1.5, Math.floor(this.failures / this.threshold)), 4);
      this.state = 'OPEN';
      this.nextAttemptAt = Date.now() + pauseMs;
      console.warn(`[CB:${this.name}] OPEN after ${this.failures} failures. Pausing ${(pauseMs / 1000).toFixed(0)}s`);
    }
  }
}

// ── Per-domain rate limiters & circuit breakers ─────────────────────────────
// Tune these per source.  Lower minTime = more aggressive, more likely to be
// detected.  Bottleneck uses a token-reservoir so bursts are smoothed out.

const DOMAIN_CONFIGS = {
  'mangaread.org':    { maxConcurrent: 2, minTime: 1000, reservoir: 6,  reservoirRefreshAmount: 6,  reservoirRefreshInterval: 6000 },
  'www.mangaread.org':{ maxConcurrent: 2, minTime: 1000, reservoir: 6,  reservoirRefreshAmount: 6,  reservoirRefreshInterval: 6000 },
  'mangakatana.com':  { maxConcurrent: 1, minTime: 1500, reservoir: 4,  reservoirRefreshAmount: 4,  reservoirRefreshInterval: 8000 },
  'manganato.gg':     { maxConcurrent: 3, minTime:  500, reservoir: 12, reservoirRefreshAmount: 12, reservoirRefreshInterval: 4000 },
  'mangakakalot.gg':  { maxConcurrent: 3, minTime:  500, reservoir: 12, reservoirRefreshAmount: 12, reservoirRefreshInterval: 4000 },
  'coffeemanga.net':  { maxConcurrent: 2, minTime:  700, reservoir: 8,  reservoirRefreshAmount: 8,  reservoirRefreshInterval: 5000 },
  'api.mangadex.org': { maxConcurrent: 5, minTime:  200, reservoir: 40, reservoirRefreshAmount: 40, reservoirRefreshInterval: 1000 },
};
const DEFAULT_DOMAIN_CONFIG = { maxConcurrent: 2, minTime: 600, reservoir: 10, reservoirRefreshAmount: 10, reservoirRefreshInterval: 4000 };

const limiters  = new Map();
const breakers  = new Map();

function getLimiter(hostname) {
  if (!limiters.has(hostname)) {
    const cfg = DOMAIN_CONFIGS[hostname] || DEFAULT_DOMAIN_CONFIG;
    limiters.set(hostname, new Bottleneck(cfg));
    breakers.set(hostname, new CircuitBreaker({ name: hostname, threshold: 5, timeout: 30000 }));
  }
  return { limiter: limiters.get(hostname), breaker: breakers.get(hostname) };
}

// ── Cookie jar ──────────────────────────────────────────────────────────────
// Simple per-hostname Map<name,value> store.  We only replicate session and
// cf_ cookies — enough to look like a returning visitor.

const cookieJars = new Map();

function storeResponseCookies(hostname, setCookieHeaders) {
  if (!setCookieHeaders) return;
  const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  if (!cookieJars.has(hostname)) cookieJars.set(hostname, new Map());
  const jar = cookieJars.get(hostname);
  for (const h of headers) {
    const m = h.match(/^([^=]+)=([^;]*)/);
    if (m) jar.set(m[1].trim(), m[2].trim());
  }
}

function buildCookieHeader(hostname) {
  if (!cookieJars.has(hostname)) return '';
  const jar = cookieJars.get(hostname);
  if (jar.size === 0) return '';
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

// ── Header builder ───────────────────────────────────────────────────────────
const REFERER_MAP = {
  'mangaread.org':     'https://www.mangaread.org/',
  'www.mangaread.org': 'https://www.mangaread.org/',
  'mangakatana.com':   'https://mangakatana.com/',
  'manganato.gg':      'https://www.manganato.gg/',
  'www.manganato.gg':  'https://www.manganato.gg/',
  'mangakakalot.gg':   'https://mangakakalot.gg/',
  'coffeemanga.net':   'https://coffeemanga.net/',
};

function buildHeaders(hostname, extraHeaders = {}) {
  const ua   = nextUA();
  const lang = ACCEPT_LANGUAGES[Math.floor(Math.random() * ACCEPT_LANGUAGES.length)];
  const ref  = REFERER_MAP[hostname] || `https://${hostname}/`;
  const cookie = buildCookieHeader(hostname);

  const isFF  = ua.includes('Firefox');
  const isSaf = ua.includes('Safari') && !ua.includes('Chrome');

  const base = {
    'User-Agent': ua,
    'Accept-Language': lang,
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Upgrade-Insecure-Requests': '1',
    'Referer': ref,
  };

  if (isFF) {
    Object.assign(base, {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'cross-site',
      'Sec-Fetch-User': '?1',
      'TE': 'trailers',
    });
  } else if (isSaf) {
    Object.assign(base, {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    });
  } else {
    // Chrome / Edge / Opera
    const platform = ua.includes('Windows') ? '"Windows"'
                   : ua.includes('Macintosh') ? '"macOS"'
                   : '"Linux"';
    const brandVer = ua.match(/Chrome\/(\d+)/)?.[1] || '124';
    Object.assign(base, {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'sec-ch-ua': `"Chromium";v="${brandVer}", "Google Chrome";v="${brandVer}", "Not-A.Brand";v="99"`,
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': platform,
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'cross-site',
      'Sec-Fetch-User': '?1',
    });
  }

  if (cookie) base['Cookie'] = cookie;
  return { ...base, ...extraHeaders };
}

// ── Cloudflare / WAF detection ───────────────────────────────────────────────
const CF_PATTERNS = [
  /just a moment/i,
  /checking your browser/i,
  /please wait/i,
  /enable javascript and cookies to continue/i,
  /attention required.*cloudflare/is,
  /cf-browser-verification/i,
  /ddos[- ]guard/i,
  /under[- ]attack[- ]mode/i,
];

function detectBlock(statusCode, body) {
  if (statusCode === 429) return { blocked: true, kind: 'rate_limit' };
  if (statusCode === 403) {
    if (typeof body === 'string' && CF_PATTERNS.some(p => p.test(body))) {
      return { blocked: true, kind: 'cloudflare' };
    }
    return { blocked: true, kind: 'forbidden' };
  }
  if (typeof body === 'string') {
    for (const pat of CF_PATTERNS) {
      if (pat.test(body)) return { blocked: true, kind: 'cloudflare' };
    }
    if (/access denied/i.test(body) && body.length < 5000) {
      return { blocked: true, kind: 'waf' };
    }
  }
  return { blocked: false };
}

// ── Human-like jitter ────────────────────────────────────────────────────────
function jitter(minMs, maxMs) {
  return new Promise(r => setTimeout(r, minMs + Math.random() * (maxMs - minMs)));
}

// ── got-scraping loader (optional peer dependency) ───────────────────────────
let _got = null;
async function getGot() {
  if (_got) return _got;
  try {
    // got-scraping v4 is ESM-only; use dynamic import
    const mod = await import('got-scraping');
    _got = mod.gotScraping;
    return _got;
  } catch {
    return null;
  }
}

// ── Axios fallback (uses existing dep) ──────────────────────────────────────
let axios = null;
function getAxios() {
  if (!axios) axios = require('axios');
  return axios;
}

// ── Core fetchHTML ───────────────────────────────────────────────────────────
/**
 * Fetch a URL's HTML, never returning a CF challenge page or a block page.
 * Throws a structured error { cfChallenge: true } when a Cloudflare wall is
 * detected — caller should pass to FlareSolverr / Puppeteer.
 *
 * @param {string} url
 * @param {object} [extraHeaders]
 * @returns {Promise<string>}  HTML body
 */
async function fetchHTML(url, extraHeaders = {}) {
  const parsed   = new URL(url);
  const hostname = parsed.hostname;
  const { limiter, breaker } = getLimiter(hostname);

  if (!breaker.canAttempt()) {
    const waitSec = Math.ceil((breaker.nextAttemptAt - Date.now()) / 1000);
    throw Object.assign(
      new Error(`[antiBlock] Circuit open for ${hostname} — retry in ${waitSec}s`),
      { circuitOpen: true, hostname, waitSec }
    );
  }

  // Schedule through per-domain rate limiter
  return limiter.schedule(async () => {
    await jitter(150, 600);

    const got      = await getGot();
    const headers  = buildHeaders(hostname, extraHeaders);
    let lastError  = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        const backoff = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 800, 8000);
        await new Promise(r => setTimeout(r, backoff));
        // Rotate UA on retry
        uaIndex += 3;
        Object.assign(headers, buildHeaders(hostname, extraHeaders));
      }

      try {
        let body, statusCode, resHeaders;

        if (got) {
          // ── got-scraping: TLS fingerprint matches Chrome/Firefox ──────────
          const resp = await got({
            url,
            headers,
            followRedirect: true,
            maxRedirects: 5,
            timeout: { request: 15000 },
            retry:   { limit: 0 },      // we own the retry loop
          });
          body       = resp.body;
          statusCode = resp.statusCode;
          resHeaders = resp.headers;
        } else {
          // ── axios fallback ────────────────────────────────────────────────
          const axinst = getAxios();
          const resp = await axinst.get(url, {
            headers,
            timeout: 15000,
            maxRedirects: 5,
            validateStatus: s => s < 600,
            decompress: true,
          });
          body       = resp.data;
          statusCode = resp.status;
          resHeaders = resp.headers;
        }

        // Persist cookies
        const setCookie = resHeaders?.['set-cookie'];
        if (setCookie) storeResponseCookies(hostname, setCookie);

        // Check for block
        const block = detectBlock(statusCode, body);
        if (block.blocked) {
          if (block.kind === 'cloudflare' || block.kind === 'js_required') {
            breaker.recordFailure();
            throw Object.assign(
              new Error(`[antiBlock] CF challenge on ${url}`),
              { cfChallenge: true, kind: block.kind }
            );
          }
          if (block.kind === 'rate_limit') {
            console.warn(`[antiBlock] Rate limited on ${hostname}, cooling off 6s`);
            await new Promise(r => setTimeout(r, 6000 + Math.random() * 4000));
            lastError = new Error('Rate limited');
            continue;
          }
          // Generic WAF / forbidden
          lastError = new Error(`[antiBlock] Blocked (${block.kind}) for ${url}`);
          console.warn(lastError.message);
          continue;
        }

        if (statusCode >= 400) {
          throw Object.assign(new Error(`HTTP ${statusCode}`), { statusCode });
        }

        breaker.recordSuccess();
        return body;

      } catch (err) {
        if (err.cfChallenge || err.circuitOpen) throw err; // don't retry these
        lastError = err;
        console.warn(`[antiBlock] Attempt ${attempt + 1}/3 failed for ${hostname}: ${err.message}`);
      }
    }

    breaker.recordFailure();
    throw lastError || new Error(`[antiBlock] All attempts failed for ${url}`);
  });
}

// ── Exports ─────────────────────────────────────────────────────────────────
module.exports = {
  fetchHTML,
  detectBlock,
  buildHeaders,
  CircuitBreaker,
  // Expose internals for testing/monitoring
  getLimiterStats: (hostname) => {
    const limiter = limiters.get(hostname);
    const breaker = breakers.get(hostname);
    return {
      limiter: limiter ? limiter.counts() : null,
      breaker: breaker ? { state: breaker.state, failures: breaker.failures } : null,
    };
  },
  getAllStats: () => {
    const stats = {};
    for (const hostname of limiters.keys()) {
      stats[hostname] = module.exports.getLimiterStats(hostname);
    }
    return stats;
  },
};
