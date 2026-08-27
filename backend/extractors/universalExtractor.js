/**
 * Universal Manga Extractor
 * Multi-strategy extraction: JSON parsing → DOM selectors → data attributes
 * Supports all Mani Reader sources with proper Referer spoofing
 */

const axios = require('axios');
const cheerio = require('cheerio');

const BROWSER_HEADERS = [
  {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
  },
  {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
  },
  {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
  },
];
let headerIndex = 0;
function getBrowserHeaders() {
  const h = BROWSER_HEADERS[headerIndex % BROWSER_HEADERS.length];
  headerIndex++;
  return h;
}

const PROXY_URL = process.env.SCRAPER_PROXY_URL || null;
const PROXY_ROTATION = process.env.SCRAPER_PROXY_ROTATION === 'true';
const PROXY_LIST = process.env.SCRAPER_PROXY_LIST ? JSON.parse(process.env.SCRAPER_PROXY_LIST) : [];
let proxyIndex = 0;

function getProxy() {
  if (PROXY_ROTATION && PROXY_LIST.length > 0) {
    const proxy = PROXY_LIST[proxyIndex % PROXY_LIST.length];
    proxyIndex++;
    return proxy;
  }
  return PROXY_URL;
}

const http = axios.create({
  headers: getBrowserHeaders(),
  timeout: 15000,
  maxRedirects: 5,
  proxy: getProxy() ? { host: getProxy().host, port: getProxy().port, protocol: getProxy().protocol || 'http' } : undefined,
});

const REFERERS = {
  'coffeemanga.net': 'https://coffeemanga.net/',
  'mangaread.org': 'https://www.mangaread.org/',
  'manganato.gg': 'https://www.manganato.gg/',
  'mangakakalot.gg': 'https://www.mangakakalot.gg/',
};

let puppeteer = null;
let puppeteerBusy = 0;
const PUPPETEER_CONCURRENCY_LIMIT = parseInt(process.env.PUPPETEER_CONCURRENCY || '1', 10);
const puppeteerQueue = [];

function acquirePuppeteerSlot() {
  return new Promise(resolve => {
    if (puppeteerBusy < PUPPETEER_CONCURRENCY_LIMIT) {
      puppeteerBusy++;
      resolve();
    } else {
      puppeteerQueue.push(resolve);
    }
  });
}
function releasePuppeteerSlot() {
  puppeteerBusy--;
  if (puppeteerBusy < 0) puppeteerBusy = 0;
  if (puppeteerQueue.length > 0) {
    const next = puppeteerQueue.shift();
    puppeteerBusy++;
    next();
  }
}

async function getPuppeteer() {
  if (!puppeteer) {
    try {
      const pptr = require('puppeteer-extra');
      const StealthPlugin = require('puppeteer-extra-plugin-stealth');
      pptr.use(StealthPlugin());
      puppeteer = pptr;
    } catch {
      return null;
    }
  }
  return puppeteer;
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms)),
  ]);
}

async function fetchWithPuppeteer(url, extraHeaders = {}) {
  const pp = await getPuppeteer();
  if (!pp) throw new Error('Puppeteer not available');
  const domain = new URL(url).hostname;
  const referer = REFERERS[domain] || `https://${domain}/`;
  const proxy = getProxy();
  const headers = getBrowserHeaders();

  await acquirePuppeteerSlot();
  let browser;
  try {
    browser = await withTimeout(
      pp.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-blink-features=AutomationControlled',
          '--memory-pressure-off',
          '--js-flags=--max_old_space_size=128',
          proxy ? `--proxy-server=${proxy.protocol || 'http'}://${proxy.host}:${proxy.port}` : '',
        ].filter(Boolean),
        defaultViewport: { width: 1366, height: 768 },
        handleSIGINT: false,
        handleSIGTERM: false,
      }),
      15000,
      'puppeteer launch'
    );
    const page = await withTimeout(browser.newPage(), 10000, 'browser.newPage');
    await page.setUserAgent(headers['User-Agent']);
    await page.setExtraHTTPHeaders({
      ...extraHeaders,
      Referer: referer,
      'Accept-Language': headers['Accept-Language'],
      'Accept': headers['Accept'],
      'Accept-Encoding': headers['Accept-Encoding'],
      'Cache-Control': headers['Cache-Control'],
      'Pragma': headers['Pragma'],
      'Upgrade-Insecure-Requests': headers['Upgrade-Insecure-Requests'],
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
    });
    await page.setViewport({ width: 1366, height: 768 });
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    });
    await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
    const response = await withTimeout(page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }), 35000, 'page.goto');
    if (!response || !response.ok()) throw new Error(`HTTP ${response?.status()} for ${url}`);
    const html = await page.content();
    await page.close();
    return html;
  } finally {
    if (browser) {
      try { await browser.close(); } catch (_) { }
      try { await browser.kill(); } catch (_) { }
    }
    releasePuppeteerSlot();
  }
}

async function fetchWithJinaAI(url) {
  const target = new URL(url);
  const jinaUrl = `https://r.jina.ai/https://${target.hostname}${target.pathname}${target.search}`;
  const response = await axios.get(jinaUrl, {
    headers: { 'Accept': 'text/plain, text/markdown' },
    timeout: 20000,
    maxRedirects: 5,
  });
  return response.data;
}

const FLARESOLVERR_URL = process.env.FLARESOLVERR_URL || 'http://localhost:8191/v1';
let flaresolverrHealthy = null;
let flaresolverrCheckedAt = 0;
const FLARESOLVERR_HEALTH_TTL = 30000;

async function checkFlareSolverrHealth() {
  const now = Date.now();
  if (now - flaresolverrCheckedAt < FLARESOLVERR_HEALTH_TTL) return flaresolverrHealthy;
  flaresolverrCheckedAt = now;
  try {
    await Promise.race([
      axios.get(FLARESOLVERR_URL.replace(/\/v1$/, '')),
      new Promise((_, reject) => setTimeout(() => reject(new Error('health check timeout')), 2000)),
    ]);
    flaresolverrHealthy = true;
  } catch (err) {
    flaresolverrHealthy = false;
  }
  return flaresolverrHealthy;
}

/**
 * Fetch HTML via FlareSolverr — bypasses Cloudflare and other anti-bot protections.
 * Used as a fallback when direct HTTP requests are blocked.
 */
async function fetchWithFlareSolverr(url, extraHeaders = {}) {
  if (!await checkFlareSolverrHealth()) throw new Error('FlareSolverr not available');
  const domain = new URL(url).hostname;
  const referer = REFERERS[domain] || `https://${domain}/`;
  const headers = getBrowserHeaders();
  const response = await axios.post(FLARESOLVERR_URL, {
    cmd: 'request.get',
    url,
    maxTimeout: 10000,
    headers: {
      ...headers,
      Referer: referer,
      ...extraHeaders,
    },
  }, {
    timeout: 10000,
  });

  const data = response.data;
  if (data?.solution?.status === 'ok' && data.solution.response) {
    return data.solution.response;
  }
  if (data?.solution?.error) {
    throw new Error(`FlareSolverr error: ${data.solution.error}`);
  }
  throw new Error(`FlareSolverr failed for ${url}`);
}

function isCloudflareChallenge(html, status, headers) {
  if (status === 429) return true;
  if (status === 403 && html && typeof html === 'string') {
    const lower = html.toLowerCase();
    return lower.includes('cloudflare') && (lower.includes('checking your browser') || lower.includes('attention required'));
  }
  if (html && typeof html === 'string') {
    const lower = html.toLowerCase();
    if (lower.includes('cloudflare') && lower.includes('checking your browser')) return true;
    if (lower.includes('just a moment')) return true;
  }
  return false;
}

// ── Concurrency limiter for fetchHTML (prevents memory exhaustion from
//    too many concurrent HTML responses buffered in memory) ──────────────
let fetchHtmlBusy = 0;
const FETCH_HTML_LIMIT = parseInt(process.env.FETCH_HTML_CONCURRENCY || '15', 10);
const fetchHtmlQueue = [];

function acquireFetchSlot() {
  return new Promise(resolve => {
    if (fetchHtmlBusy < FETCH_HTML_LIMIT) {
      fetchHtmlBusy++;
      resolve();
    } else {
      fetchHtmlQueue.push(resolve);
    }
  });
}
function releaseFetchSlot() {
  fetchHtmlBusy--;
  if (fetchHtmlBusy < 0) fetchHtmlBusy = 0;
  if (fetchHtmlQueue.length > 0) {
    fetchHtmlBusy++;
    fetchHtmlQueue.shift()();
  }
}

/**
 * Fetch HTML from a URL with proper headers for the source domain.
 * Falls back to FlareSolverr when Cloudflare or anti-bot protections block
 * direct HTTP requests.
 */
async function fetchHTML(url, extraHeaders = {}) {
  await acquireFetchSlot();
  try {
    const domain = new URL(url).hostname;
    const referer = REFERERS[domain] || `https://${domain}/`;
    const headers = getBrowserHeaders();

    try {
      await new Promise(r => setTimeout(r, 200 + Math.random() * 800));
      const response = await http.get(url, {
        headers: {
          ...headers,
          Referer: referer,
          ...extraHeaders,
        },
        timeout: 10000,
        maxRedirects: 5,
        proxy: getProxy() ? { host: getProxy().host, port: getProxy().port, protocol: getProxy().protocol || 'http' } : undefined,
        validateStatus: (status) => status < 500,
      });

      if (!isCloudflareChallenge(response.data, response.status, response.headers)) {
        if (response.status >= 400) throw Object.assign(new Error(`HTTP ${response.status}`), { response: { status: response.status, data: response.data, headers: response.headers } });
        return response.data;
      }
      console.warn(`[fetchHTML] Cloudflare challenge detected for ${url}, falling back to FlareSolverr`);
    } catch (err) {
      if (err.response) {
        if (!isCloudflareChallenge(err.response.data, err.response.status, err.response.headers)) {
          throw err;
        }
        console.warn(`[fetchHTML] Cloudflare error ${err.response.status} for ${url}, falling back to FlareSolverr`);
      } else {
        throw err;
      }
    }

    const fsResult = await fetchWithFlareSolverr(url, extraHeaders);
    return fsResult;
  } finally {
    releaseFetchSlot();
  }
}

function markdownToHtml(markdown) {
  if (!markdown) return '<html><body></body></html>';
  let html = markdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2">$1</a>');
  html = html.replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
  html = html.replace(/\n/g, '<br>');
  return `<html><body>${html}</body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// STRATEGY 1: Extract from embedded <script> tags (JSON parsing)
// ─────────────────────────────────────────────────────────────────────────────
function strategy1_embeddedJSON($) {
  const images = [];

  $('script').each((_, el) => {
    const text = $(el).html() || '';

    // Pattern A: { "chapter": { "pages": [...] } }
    const pagesMatch = text.match(/"pages"\s*:\s*(\[(?:"[^"]+",?\s*)*\])/);
    if (pagesMatch) {
      try {
        const urls = JSON.parse(pagesMatch[1]);
        images.push(...urls.filter(isValidImageUrl));
        return false; // stop iteration
      } catch (_) { }
    }

    // Pattern B: images = ["url1", "url2"] or var images = [...]
    const imagesVarMatch = text.match(/(?:var\s+)?images\s*=\s*(\[(?:[^\]]*)\])/s);
    if (imagesVarMatch) {
      try {
        const urls = JSON.parse(imagesVarMatch[1]);
        images.push(...urls.filter(isValidImageUrl));
        return false;
      } catch (_) { }
    }

    // Pattern C: chapImages = [...] or chap_images = [...]
    const chapMatch = text.match(/chap(?:ter)?[_-]?[Ii]mages?\s*=\s*(\[(?:[^\]]*)\])/s);
    if (chapMatch) {
      try {
        const urls = JSON.parse(chapMatch[1]);
        images.push(...urls.filter(isValidImageUrl));
        return false;
      } catch (_) { }
    }

    // Pattern D: "src":"https://...jpg" repeated (JSON with repeated src keys)
    // Require at least 3 matches to avoid single cover/thumbnail hits
    const srcMatches = text.match(/"(?:src|url|image_url|img_url)"\s*:\s*"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp))"/g);
    if (srcMatches && srcMatches.length > 3) {
      srcMatches.forEach(m => {
        const url = m.match(/"(https?:\/\/[^"]+)"/)?.[1];
        if (url && isValidImageUrl(url)) images.push(url);
      });
      if (images.length > 0) return false;
    }

    // Pattern E: window.CHAPTER_IMAGES or window.pageImages
    const windowMatch = text.match(/window\.[a-zA-Z_]+\s*=\s*(\[(?:[^\]]*)\])/s);
    if (windowMatch) {
      try {
        const urls = JSON.parse(windowMatch[1]);
        if (urls.length > 0 && isValidImageUrl(urls[0])) {
          images.push(...urls.filter(isValidImageUrl));
          return false;
        }
      } catch (_) { }
    }

    // Pattern F: "images": ["url1", "url2"] inside JSON (WordPress themes like ts_reader)
    const imagesJsonMatch = text.match(/"images"\s*:\s*(\[(?:[^\]]*)\])/s);
    if (imagesJsonMatch) {
      try {
        const cleanJson = imagesJsonMatch[1].replace(/\\/g, '');
        const urls = JSON.parse(cleanJson);
        if (urls.length > 0 && isValidImageUrl(urls[0])) {
          images.push(...urls.filter(isValidImageUrl));
          return false;
        }
      } catch (_) { }
    }
  });

  return [...new Set(images)]; // deduplicate
}

// ─────────────────────────────────────────────────────────────────────────────
// STRATEGY 2: Next.js __NEXT_DATA__
// ─────────────────────────────────────────────────────────────────────────────
function strategy2_nextData($) {
  const nextDataEl = $('#__NEXT_DATA__');
  if (!nextDataEl.length) return [];

  try {
    const data = JSON.parse(nextDataEl.html());
    const images = [];

    // Recursively search for image URL arrays
    findImageArrays(data, images);
    return [...new Set(images)].filter(isValidImageUrl);
  } catch (_) {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STRATEGY 3: CSS selectors on img elements (DOM parsing fallback)
// ─────────────────────────────────────────────────────────────────────────────
function strategy3_domSelectors($) {
  const CHAPTER_SELECTORS = [
    // Most specific manga reader containers first
    '.container-chapter-reader img',
    '.chapter-content img',
    '.chapter-images img',
    '.reader-content img',
    '.reading-content img',
    '.chapter-img img',
    '.page-chapter img',
    'div.chapter img',
    '#chapter-content img',
    '#chapter img',
    '.manga-page img',
    '.pages img',
    // Semi-generic
    'article img',
    '.content img[src*="/manga/"]',
    '.content img[src*="/chapter/"]',
    // Lazy loading attributes (broad — only use if above found nothing)
    'img[data-src]',
    'img[data-lazy-src]',
    'img[data-original]',
  ];

  for (const selector of CHAPTER_SELECTORS) {
    const found = [];
    $(selector).each((_, el) => {
      const $el = $(el);
      const src = $el.attr('data-src') || $el.attr('data-lazy-src') ||
        $el.attr('data-original') || $el.attr('src');
      // Reject tiny icons / thumbnails by checking URL patterns
      if (src && isValidImageUrl(src) && !isThumbnailOrIcon(src)) {
        found.push(src.trim());
      }
    });
    // Only trust this selector if it returned a real chapter (3+ pages)
    if (found.length >= 3) {
      return [...new Set(found)];
    }
  }

  // Last resort: collect ALL img[src] and filter to only chapter-path images
  const allImgs = [];
  $('img').each((_, el) => {
    const $el = $(el);
    const src = $el.attr('data-src') || $el.attr('data-lazy-src') ||
      $el.attr('data-original') || $el.attr('src');
    if (src && isValidImageUrl(src) && isChapterImage(src) && !isThumbnailOrIcon(src)) {
      allImgs.push(src.trim());
    }
  });
  return [...new Set(allImgs)];
}

/** Returns true if the URL looks like a chapter page image (not a logo/icon) */
function isChapterImage(src) {
  return /\/(?:manga|chapter|uploads?|images?|pages?|content)\//i.test(src);
}

/** Returns true if the URL looks like a small UI image to skip */
function isThumbnailOrIcon(src) {
  return /(?:logo|icon|banner|avatar|thumb|ads?|sprite|button|\.svg)/i.test(src) ||
    /[_-](?:16|24|32|48|64|96|100|120)x/i.test(src); // tiny size hints in filename
}

const SOURCE_SCRAPERS = {
  // ── COFFEEMANGA ─────────────────────────────────────────────────────────────
  coffeemanga: {
    id: 'coffeemanga',
    name: 'CoffeeManga',
    baseUrl: 'https://coffeemanga.net',
    color: '#795548',

    async getHome() {
        const html = await fetchHTML('https://coffeemanga.net/');
      const $ = cheerio.load(html);
      const results = [];

      // WordPress manga theme
      $('.manga-item, .page-item-detail, .item-summary').each((_, el) => {
        const $el = $(el);
        let $a = $el.find('.post-title a, h3 a, h4 a, .item-title a').first();
        if (!$a.length) {
          $a = $el.find('a[title]').first();
        }
        if (!$a.length) {
          $a = $el.find('a').first();
        }
        const title = $a.attr('title') || $a.text().trim() || '';
        const href = $a.attr('href') || '';
        const cover = $el.find('img').attr('data-src') || $el.find('img').attr('src') || '';
        const chapter = $el.find('.chapter a').first().text().trim() || '';
        if (title && href) results.push({ title, href: toAbsolute(href, 'https://coffeemanga.net'), cover, chapter });
      });

      return { section: 'Romance & Drama', items: dedupByHref(results).slice(0, 12) };
    },

    async getMangaDetail(url) {
      const html = await fetchHTML(url);
      const $ = cheerio.load(html);
      const title = $('h1.post-title, .manga-title').first().text().trim();
      const cover = $('.summary_image img').attr('data-src') || $('.summary_image img').attr('src') || '';
      const description = $('.summary__content p').first().text().trim();
      const status = $('.post-content_item:contains("Status") .summary-content').text().trim();
      const genres = [];
      $('.genres-content a').each((_, el) => genres.push($(el).text().trim()));
      const chapters = [];
      $('li.wp-manga-chapter a').each((_, el) => {
        const href = toAbsolute($(el).attr('href') || '', 'https://coffeemanga.net');
        const date = $(el).closest('li.wp-manga-chapter').find('.chapter-release-date').text().trim();
        if (href && !chapters.some(c => c.href === href)) {
          chapters.push({ title: $(el).text().trim(), href, date });
        }
      });
      return { title, cover, description, status, genres, chapters };
    },

    async getChapterImages(url) {
      const html = await fetchHTML(url);
      const $ = cheerio.load(html);
      // WordPress manga uses .reading-content img with data-src lazy loading
      const images = [];
      $('.reading-content img, #chapter-content img').each((_, el) => {
        const src = $(el).attr('data-src') || $(el).attr('src') || '';
        if (src && isValidImageUrl(src)) images.push(src.trim());
      });
      const fallback = images.length === 0 ? strategy1_embeddedJSON($) : images;
      return { images: fallback, source: 'coffeemanga' };
    }
  },

  // ── MANGAREAD ───────────────────────────────────────────────────────────────
  mangaread: {
    id: 'mangaread',
    name: 'MangaRead',
    baseUrl: 'https://www.mangaread.org',
    color: '#2980b9',

    async getHome() {
      const html = await fetchHTML('https://www.mangaread.org/');
      const $ = cheerio.load(html);
      const results = [];

      $('.page-item-detail, .manga-item').each((_, el) => {
        const $el = $(el);
        let $a = $el.find('.post-title a, h3 a, h4 a').first();
        if (!$a.length) {
          $a = $el.find('a[title]').first();
        }
        if (!$a.length) {
          $a = $el.find('a').first();
        }
        const title = $a.attr('title') || $a.text().trim() || '';
        const href = $a.attr('href') || '';
        const cover = $el.find('img').attr('data-src') || $el.find('img').attr('src') || '';
        const chapter = $el.find('.chapter a').first().text().trim() || '';

        if (title && href && href.includes('/manga/')) {
          results.push({ title, href: toAbsolute(href, 'https://www.mangaread.org'), cover, chapter });
        }
      });

      return { section: 'Featured Updates', items: dedupByHref(results).slice(0, 12) };
    },

    async getMangaDetail(url) {
      // Guard: if a bare slug was stored, build the full URL
      if (!url.startsWith('http')) {
        url = `https://www.mangaread.org/manga/${url.replace(/^\/+|\/+$/g, '')}/`;
      }
      let html;
      let usedHeadless = false;
      let fallbackUsed = 'none';

      // Step 1: Direct HTTP fetch with stealth headers
      try {
        console.log(`[mangaread] Attempting direct HTTP fetch: ${url}`);
        html = await fetchHTML(url);
        fallbackUsed = 'http';
        console.log(`[mangaread] Direct HTTP fetch succeeded`);
      } catch (httpErr) {
        console.warn(`[mangaread] Direct HTTP fetch failed: ${httpErr.message}`);

        // Step 2: Try Jina AI reader (often works when direct fetch is blocked)
        try {
          console.log(`[mangaread] Attempting Jina AI fallback: ${url}`);
          const markdown = await fetchWithJinaAI(url);
          html = markdownToHtml(markdown);
          usedHeadless = true;
          fallbackUsed = 'jina';
          console.log(`[mangaread] Jina AI fallback succeeded`);
        } catch (jinaErr) {
          console.warn(`[mangaread] Jina AI fallback failed: ${jinaErr.message}`);

          // Step 3: Last resort - headless browser (may fail on servers without Chrome)
          try {
            console.log(`[mangaread] Attempting headless browser fallback: ${url}`);
            html = await fetchWithPuppeteer(url);
            usedHeadless = true;
            fallbackUsed = 'puppeteer';
            console.log(`[mangaread] Headless browser fallback succeeded`);
          } catch (ppErr) {
            console.error(`[mangaread] All fetch methods failed for ${url}`);
            console.error(`[mangaread] HTTP: ${httpErr.message}`);
            console.error(`[mangaread] JinaAI: ${jinaErr.message}`);
            console.error(`[mangaread] Puppeteer: ${ppErr.message}`);
            return { title: '', cover: '', description: '', status: '', genres: [], chapters: [] };
          }
        }
      }
      const $ = cheerio.load(html);

      const title = $('h1.post-title, .manga-title, h1').first().text().trim();
      const cover = $('.summary_image img').attr('data-src') || $('.summary_image img').attr('src') || '';
      const description = $('.summary__content p, .description-summary p').first().text().trim() || $('.summary__content').first().text().trim();
      const status = $('.post-content_item:contains("Status") .summary-content').text().trim();
      const genres = [];
      $('.genres-content a').each((_, el) => genres.push($(el).text().trim()));

      // Try static HTML chapters first (sometimes available on cached pages)
      let chapters = [];
      $('li.wp-manga-chapter a').each((_, el) => {
        const href = $(el).attr('href') || '';
        const chTitle = $(el).text().trim();
        const date = $(el).closest('li.wp-manga-chapter').find('.chapter-release-date').text().trim();
        if (href && !chapters.some(c => c.href === href)) {
          chapters.push({ title: chTitle, href: toAbsolute(href, 'https://www.mangaread.org'), date });
        }
      });

      // MangaRead serves the full chapter list directly in the page HTML.
      // Parse chapters from static markup. If none are found, fall back to
      // the dedicated chapter-list endpoint used by newer Madara versions.
      {
        // Extract the numeric post ID from the page (data-id attribute on .rating-post-id or similar)
        const mangaId = $('[id^="manga-chapters-holder"]').attr('data-id') ||
          $('input#manga-chapters-holder').attr('data-id') ||
          $('div#manga-chapters-holder').attr('data-id') ||
          $('script:contains("manga_id")').html()?.match(/"manga_id"\s*:\s*"?(\d+)"?/)?.[1] ||
          $('body').attr('class')?.match(/postid-(\d+)/)?.[1];

        if (chapters.length === 0 && mangaId) {
          try {
            const chapterListRes = await http.post(
              `${url.replace(/\/$/, '')}/ajax/load_chapters/`,
              new URLSearchParams({ action: 'manga_get_chapters' }).toString(),
              {
                headers: {
                  ...getBrowserHeaders(),
                  'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                  'X-Requested-With': 'XMLHttpRequest',
                  'Referer': url,
                },
                timeout: 20000,
              }
            );
            const $ajax = cheerio.load(chapterListRes.data);
            $ajax('li.wp-manga-chapter a').each((_, el) => {
              const href = $ajax(el).attr('href') || '';
              const chTitle = $ajax(el).text().trim();
              const date = $ajax(el).closest('li.wp-manga-chapter').find('.chapter-release-date').text().trim();
              if (href && !chapters.some(c => c.href === href)) {
                chapters.push({ title: chTitle, href: toAbsolute(href, 'https://www.mangaread.org'), date: date || null });
              }
            });
          } catch (_) { }
        }
      }

      // If still no chapters and we used headless browser, try extracting from markdown links
      if (chapters.length === 0 && usedHeadless) {
        const markdownLinks = $('a').map((_, el) => {
          const href = $(el).attr('href') || '';
          const text = $(el).text().trim();
          return { text, href };
        }).get().filter(l => l.href && /chapter/i.test(l.href));
        for (const link of markdownLinks) {
          if (!chapters.some(c => c.href === link.href)) {
            chapters.push({ title: link.text, href: toAbsolute(link.href, 'https://www.mangaread.org'), date: null });
          }
        }
      }

      return { title, cover, description, status, genres, chapters };
    },

    async getChapterImages(url) {
      const html = await fetchHTML(url);
      const $ = cheerio.load(html);
      const images = [];
      $('.reading-content img, #chapter-content img').each((_, el) => {
        const src = $(el).attr('data-src') || $(el).attr('src') || '';
        if (src && isValidImageUrl(src)) images.push(src.trim());
      });
      const fallback = images.length === 0 ? strategy1_embeddedJSON($) : images;
      return { images: fallback, source: 'mangaread' };
    }
  },

  // ── MANGADEX ────────────────────────────────────────────────────────────────
  mangadex: {
    id: 'mangadex',
    name: 'MangaDex',
    baseUrl: 'https://mangadex.org',
    color: '#e67e22',

    async getHome() {
      try {
        const res = await http.get('https://api.mangadex.org/manga?limit=10&order[followedCount]=desc&contentRating[]=safe');
        const items = res.data.data.map(m => {
          const title = Object.values(m.attributes.title)[0];
          return {
            title,
            href: `https://mangadex.org/title/${m.id}`,
            cover: '',
            chapter: 'Ch 1'
          };
        });
        return { section: 'Popular Updates', items };
      } catch (err) {
        return { section: 'Popular Updates', items: [] };
      }
    },

    async getMangaDetail(url) {
      let uuid = url.split('/').pop();
      if (uuid.length !== 36 || !uuid.includes('-')) {
        try {
          const searchRes = await http.get(`https://api.mangadex.org/manga?title=${encodeURIComponent(uuid.replace(/-/g, ' '))}&limit=1&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica`);
          if (searchRes.data.data && searchRes.data.data.length > 0) {
            uuid = searchRes.data.data[0].id;
          }
        } catch (_) { }
      }

      try {
        const detailRes = await http.get(`https://api.mangadex.org/manga/${uuid}`);
        const m = detailRes.data.data;
        const title = Object.values(m.attributes.title)[0];
        const description = m.attributes.description ? Object.values(m.attributes.description)[0] : '';
        const status = m.attributes.status;

        let allChapters = [];
        let offset = 0;
        let limit = 500;
        while (true) {
          const feedRes = await http.get(`https://api.mangadex.org/manga/${uuid}/feed?translatedLanguage[]=en&limit=${limit}&offset=${offset}&order[chapter]=desc`);
          const data = feedRes.data.data || [];
          allChapters = allChapters.concat(data);
          if (data.length < limit) break;
          offset += limit;
        }

        const chapters = allChapters.map(ch => {
          const chNum = ch.attributes.chapter;
          const chTitle = ch.attributes.title ? `Chapter ${chNum} — ${ch.attributes.title}` : `Chapter ${chNum}`;

          let date = ch.attributes.publishAt || ch.attributes.createdAt || null;
          if (date) {
            const d = new Date(date);
            date = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).replace(',', '');
          }

          return {
            title: chTitle,
            href: `https://mangadex.org/chapter/${ch.id}`,
            date
          };
        });
        return { title, cover: '', description, status, genres: [], chapters };
      } catch (err) {
        return { title: 'MangaDex Title', cover: '', description: '', status: '', genres: [], chapters: [] };
      }
    },

    async getChapterImages(url) {
      try {
        const chapterId = url.split('/').pop();
        const res = await http.get(`https://api.mangadex.org/at-home/server/${chapterId}`);
        const { baseUrl, chapter } = res.data;
        const images = chapter.data.map(filename => `${baseUrl}/data/${chapter.hash}/${filename}`);
        return { images, source: 'mangadex' };
      } catch (err) {
        if (err.response?.status === 404) {
          return { images: [], source: 'mangadex' };
        }
        throw err;
      }
    }
  },

  // ── MANGAKATANA ─────────────────────────────────────────────────────────────
  mangakatana: {
    id: 'mangakatana',
    name: 'MangaKatana',
    baseUrl: 'https://mangakatana.com',
    color: '#c0392b',

    async getHome() {
      const html = await fetchHTML('https://mangakatana.com/');
      const $ = cheerio.load(html);
      const items = [];
      $('.item').each((_, el) => {
        const title = $(el).find('.title a').text().trim();
        const href = $(el).find('.title a').attr('href') || '';
        const cover = $(el).find('.img img').attr('src') || '';
        const chapter = $(el).find('.chapter a').text().trim();
        if (title && href) items.push({ title, href: toAbsolute(href, 'https://mangakatana.com'), cover, chapter });
      });
      return { section: 'Latest Updates', items };
    },

    async getMangaDetail(url) {
      try {
        const html = await fetchHTML(url);
        const $ = cheerio.load(html);
        const title = $('h1.heading, h1').first().text().trim();
        const cover = $('.cover img').first().attr('src') || '';
        const description = $('.summary p').first().text().trim();
        const status = $('.status').text().trim();
        const chapters = [];
        $('.chapters a').each((_, el) => {
          const href = toAbsolute($(el).attr('href') || '', 'https://mangakatana.com');
          const date = $(el).closest('tr').find('.update_time, .chapter-date').first().text().trim() || null;
          chapters.push({ title: $(el).text().trim(), href, date });
        });
        return { title, cover, description, status, genres: [], chapters };
      } catch (err) {
        console.warn('[mangakatana] getMangaDetail failed:', err.message);
        return { title: 'MangaKatana Title', cover: '', description: '', status: '', genres: [], chapters: [] };
      }
    },

    async getChapterImages(url) {
      try {
        const html = await fetchHTML(url);
        const $ = cheerio.load(html);

        // ── MangaKatana-specific image decoder ────────────────────────────────
        // Images are stored in named JS arrays (thzq = full chapter, ytaw = 1 cover).
        // We scan ALL arrays and keep the LARGEST (= full chapter).
        // Then apply the same hostname-remapping pipeline as chapter.min.js:
        //   rv46(s) = atob( s.split('').reverse().join('') )
        //   kc1 JSON → global host alias map  {"i7":"i.supernova22.click"}
        //   i1 → i6 (idx%3===0) / i1 → i5 (others)
        //   kc2.m JSON → per-page-range CDN {"azlegends.shop":["i6",2,5]}
        // ──────────────────────────────────────────────────────────────────────
        const rv46 = (s) =>
          Buffer.from(s.split('').reverse().join(''), 'base64').toString('utf-8');

        let thzq = [];
        let kc1Raw = null;
        let kc2Raw = null;

        $('script').each((_, el) => {
          const text = $(el).html() || '';
          if (!text.includes('mangakatana.com') && !text.includes('/token/')) return;

          const kc1M = text.match(/var\s+kc1\s*=\s*['"]([^'"]+)['"]/);
          if (kc1M) kc1Raw = kc1M[1];
          const kc2M = text.match(/var\s+kc2\s*=\s*['"]([^'"]+)['"]/);
          if (kc2M) kc2Raw = kc2M[1];

          // Find every JS array; keep the largest image-URL array
          const arrRe = /var\s+\w+\s*=\s*\[([^\]]+)\]/g;
          let m;
          while ((m = arrRe.exec(text)) !== null) {
            const urls = (m[1].match(/https?:\/\/[^'"]+\.(?:jpg|jpeg|png|webp)[^'""]*/gi) || [])
              .filter(u => u && !u.includes(' '));
            if (urls.length > thzq.length) thzq = urls;
          }
        });

        if (thzq.length > 0) {
          let hostMap = {};
          let rangeMap = {};
          if (kc1Raw) { try { hostMap = JSON.parse(rv46(kc1Raw)); } catch (_) { } }
          if (kc2Raw) { try { const d = JSON.parse(rv46(kc2Raw)); if (d && d.m) rangeMap = d.m; } catch (_) { } }

          const decoded = thzq.map((raw, i) => {
            let u = raw;
            // Step 1: rotate i1 host
            u = i % 3 === 0 ? u.replace('://i1.', '://i6.') : u.replace('://i1.', '://i5.');
            // Step 2: kc1 global host aliases
            for (const [alias, actual] of Object.entries(hostMap)) {
              u = u.replace('//' + alias + '.mangakatana.com', '//' + actual);
            }
            // Step 3: kc2 per-page CDN remaps (1-indexed)
            const pageNum = i + 1;
            for (const [cdnHost, entry] of Object.entries(rangeMap)) {
              if (!Array.isArray(entry) || entry.length < 3) continue;
              const [imgPrefix, startPage, endPage] = entry;
              if (pageNum >= startPage && pageNum <= endPage) {
                u = u.replace('//' + imgPrefix + '.mangakatana.com', '//' + cdnHost);
              }
            }
            return u;
          }).filter(u => isValidImageUrl(u));

          if (decoded.length > 0) return { images: decoded, source: 'mangakatana' };
        }

        // Generic fallback
        let images = strategy1_embeddedJSON($);
        if (images.length === 0) images = strategy3_domSelectors($);
        return { images, source: 'mangakatana' };

      } catch (err) {
        console.error('[mangakatana] getChapterImages error:', err.message);
        return { images: [], source: 'mangakatana' };
      }
    }
  },

  // ── MANGANATO / MANGAKAKALOT ────────────────────────────────────────────────
  manganato: {
    id: 'manganato',
    name: 'MangaKakalot',
    baseUrl: 'https://www.manganato.gg',
    color: '#27ae60',

    async getHome() {
      try {
        const html = await fetchHTML('https://www.manganato.gg/');
        const $ = cheerio.load(html);
        const items = [];

        $('.update_item, .xem-nhieu-item, .owl-item').each((_, el) => {
          const $el = $(el);
          const $a = $el.find('a[href*="/manga/"]').first();
          if (!$a.length) return;
          const href = $a.attr('href') || '';
          const title = $a.attr('title') || $a.text().trim() || '';
          const cover = $el.find('img').attr('data-src') || $el.find('img').attr('src') || '';
          const chapter = $el.find('.chapter').first().text().trim() || '';
          if (title && href && href.includes('/manga/')) {
            items.push({ title, href: toAbsolute(href, 'https://www.manganato.gg'), cover, chapter });
          }
        });

        return { section: 'Latest Updates', items: dedupByHref(items).slice(0, 12) };
      } catch (err) {
        console.warn('[manganato] getHome failed:', err.message);
        return { section: 'Latest Updates', items: [] };
      }
    },

    async getMangaDetail(url) {
      try {
        const html = await fetchHTML(url);
        const $ = cheerio.load(html);
        const title = $('h1').first().text().trim();
        const cover = $('.summary_image img, .manga-info-pic img, .cover img').first().attr('data-src') || 
                      $('.summary_image img, .manga-info-pic img, .cover img').first().attr('src') || '';
        const description = $('.summary__content p, .description p, .entry-content p').first().text().trim() || 
                           $('.summary__content, .description').first().text().trim();
        const status = $('.post-status .summary-content, .status, .manga-status').last().text().trim() || '';
        const genres = [];
        $('.genres-content a, .genre a, .mgen a').each((_, el) => genres.push($(el).text().trim()));
        
        const chapters = [];
        try {
          const slug = url.replace('https://www.manganato.gg/manga/', '').replace(/\/$/, '');
          let offset = 0;
          const limit = 50;
          let hasMore = true;
          
          while (hasMore) {
            const apiUrl = `https://www.manganato.gg/api/manga/${slug}/chapters?limit=${limit}&offset=${offset}`;
            const apiRes = await fetchHTML(apiUrl, {
              'Accept': 'application/json, text/javascript, */*; q=0.01',
              'X-Requested-With': 'XMLHttpRequest'
            });
            const apiData = typeof apiRes === 'string' ? JSON.parse(apiRes) : apiRes;
            if (apiData.success && apiData.data?.chapters) {
              for (const ch of apiData.data.chapters) {
                chapters.push({
                  title: ch.chapter_name,
                  href: `https://www.manganato.gg/manga/${slug}/${ch.chapter_slug}`,
                  date: ch.updated_at ? new Date(ch.updated_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).replace(',', '') : null
                });
              }
              hasMore = apiData.data.pagination?.has_more === true;
              offset += limit;
            } else {
              hasMore = false;
            }
          }
        } catch (apiErr) {
          console.warn('[manganato] API chapter fetch failed, falling back to DOM:', apiErr.message);
          $('a[href*="chapter-"]').each((_, el) => {
            const href = $(el).attr('href') || '';
            const chTitle = $(el).text().replace(/\s+/g, ' ').trim();
            if (href && href.includes('/manga/') && chTitle && !chapters.some(c => c.href === href)) {
              chapters.push({ title: chTitle, href: toAbsolute(href, 'https://www.manganato.gg') });
            }
          });
        }

        return { title, cover, description, status, genres, chapters: dedupByHref(chapters) };
      } catch (err) {
        console.warn('[manganato] getMangaDetail failed:', err.message);
        return { title: '', cover: '', description: '', status: '', genres: [], chapters: [] };
      }
    },

    async getChapterImages(url) {
      try {
        const html = await fetchHTML(url);
        const $ = cheerio.load(html);
        
        // Method 1: Parse window.chapterImages from inline script
        const scriptMatch = html.match(/window\.chapterImages\s*=\s*(\[.*?\]);/s);
        if (scriptMatch) {
          try {
            const parsed = JSON.parse(scriptMatch[1]);
            const cdnMatch = html.match(/var\s+cdns\s*=\s*\["([^"]+)"/);
            const cdnBase = cdnMatch ? cdnMatch[1] : 'https://img-r1.2xstorage.com/';
            const images = parsed
              .map(img => img.replace(/\\\//g, '/').replace(/^\/+/, ''))
              .filter(img => img && !img.includes('data:'))
              .map(img => cdnBase + img);
            if (images.length > 0) return { images, source: 'manganato' };
          } catch (e) {
            console.log('[manganato] Failed to parse chapterImages JSON');
          }
        }
        
        // Method 2: Fallback to container-chapter-reader
        const images = [];
        $('.container-chapter-reader img').each((_, el) => {
          const src = $(el).attr('data-src') || $(el).attr('src') || '';
          if (src && isValidImageUrl(src)) images.push(src.trim());
        });
        
        // Method 3: Any img with chapter paths
        if (images.length === 0) {
          $('img').each((_, el) => {
            const src = $(el).attr('data-src') || $(el).attr('src') || '';
            if (src && /\/manga\/|\/chapter\/|\/uploads\//.test(src) && isValidImageUrl(src)) {
              images.push(src.trim());
            }
          });
        }
        
        return { images: dedupByHref(images), source: 'manganato' };
      } catch (err) {
        console.warn('[manganato] getChapterImages failed:', err.message);
        return { images: [], source: 'manganato' };
      }
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function isValidImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim();
  // Must be http/https and a known image extension, OR a CDN-style URL
  // Reject SVGs (mostly icons) and data URIs
  if (clean.startsWith('data:') || /\.svg(\?|$)/i.test(clean)) return false;
  return /^https?:\/\/.+\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(clean) ||
    (clean.startsWith('https://') && clean.length > 30 && !clean.includes(' ') && !clean.includes('.svg'));
}

function toAbsolute(href, base) {
  if (!href) return '';
  if (href.startsWith('http')) return href;
  try {
    return new URL(href, base).toString();
  } catch (_) {
    return href;
  }
}

function dedupByHref(items) {
  const seen = new Set();
  return items.filter(item => {
    const href = typeof item === 'string' ? item : (item.href || '');
    if (!href || seen.has(href)) return false;
    seen.add(href);
    return true;
  });
}

function findImageArrays(obj, result = [], depth = 0) {
  if (depth > 8 || !obj || typeof obj !== 'object') return result;
  if (Array.isArray(obj)) {
    if (obj.length > 0 && typeof obj[0] === 'string' && isValidImageUrl(obj[0])) {
      result.push(...obj.filter(isValidImageUrl));
    } else {
      obj.forEach(item => findImageArrays(item, result, depth + 1));
    }
  } else {
    Object.values(obj).forEach(val => findImageArrays(val, result, depth + 1));
  }
  return result;
}

function findMangaArrays(obj, depth = 0) {
  if (depth > 5 || !obj || typeof obj !== 'object') return [];
  if (Array.isArray(obj)) {
    if (obj.length > 0 && obj[0] && typeof obj[0] === 'object' && (obj[0].title || obj[0].name)) {
      return obj;
    }
    for (const item of obj) {
      const found = findMangaArrays(item, depth + 1);
      if (found.length > 0) return found;
    }
  } else {
    for (const val of Object.values(obj)) {
      const found = findMangaArrays(val, depth + 1);
      if (found.length > 0) return found;
    }
  }
  return [];
}

module.exports = { SOURCE_SCRAPERS, fetchHTML, fetchWithFlareSolverr, strategy1_embeddedJSON, strategy2_nextData, strategy3_domSelectors };
