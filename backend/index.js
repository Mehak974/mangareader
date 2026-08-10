/**
 * Manga Reader — Backend API Server v2.0
 * Express server: manga scraping, blog CMS, admin, security, rate limiting
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { doubleCsrf } = require('csrf-csrf');
const crypto = require('crypto');
const dns = require('dns');
const axios = require('axios');
const cheerio = require('cheerio');
const bcrypt = require('bcryptjs');
const NodeCache = require('node-cache');
const cookieParser = require('cookie-parser');
const expressRateLimit = require('express-rate-limit');
require('dotenv').config();

dns.setServers(['8.8.8.8', '1.1.1.1']);

const Piscina = require('piscina');
const path = require('path');
const {
  SOURCE_SCRAPERS, fetchHTML,
  strategy1_embeddedJSON, strategy2_nextData, strategy3_domSelectors,
} = require('./extractors/universalExtractor');

const extractionWorker = new Piscina({
  filename: path.resolve(__dirname, 'extractors/worker.js')
});

const db = require('./db');
const { getOrFetchMangaMetadata } = require('./utils/metadataFetcher');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;

// ── SECURITY HEADERS ──────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; form-action 'none';");
  next();
});

// ── CORS ──────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes('*')) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

// ── CSRF (double-submit cookie) ───────────────────────────────────────────────
// Replaces `csurf`, which is archived/unmaintained upstream. `csrf-csrf`
// implements the same double-submit-cookie pattern and is a drop-in
// replacement from the client's point of view: GET /api/csrf-token still
// returns { csrfToken }, and mutating requests still send it back via the
// X-CSRF-Token header — no frontend changes needed.
//
// This API has no server-side session store (auth here is stateless
// JWT/legacy-token, see requireAdmin below), so there's no natural "session
// id" to bind the CSRF token to. Rather than pass a constant (which loses a
// layer of protection the library offers), an anonymous per-browser cookie
// is set on first visit and used as the session identifier — this still
// binds a CSRF token to "this browser", just not to an authenticated user.
if (!process.env.CSRF_SECRET) {
  console.error('FATAL: CSRF_SECRET is not set. Refusing to start. Set it in your environment (see backend/.env.example).');
  process.exit(1);
}

app.use((req, res, next) => {
  if (!req.cookies.sid) {
    const sid = crypto.randomBytes(24).toString('hex');
    res.cookie('sid', sid, {
      httpOnly: true,
      sameSite: 'lax', // same-site across subdomains of one domain; use 'none' + secure if frontend/backend are on entirely different domains
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 30,
    });
    req.cookies.sid = sid;
  }
  next();
});

// ── RATE LIMITING ─────────────────────────────────────────────────────────────
const { RedisStore } = require('rate-limit-redis');
const Redis = require('ioredis');

let redisClient;
if (process.env.REDIS_URL) {
  redisClient = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    retryStrategy(times) {
      if (times > 3) return null; // stop retrying after 3 times
      return Math.min(times * 50, 2000);
    }
  });
  redisClient.on('error', (err) => console.error('Redis Client Error', err));
}

function rateLimit(windowMs = 60000, maxRequests = 60) {
  return expressRateLimit({
    windowMs,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    passOnStoreError: true,
    store: redisClient ? new RedisStore({
      sendCommand: (...args) => {
        if (redisClient.status !== 'ready') return Promise.reject(new Error('Redis not ready'));
        return redisClient.call(...args);
      },
    }) : undefined,
    message: { error: 'Too many requests — please slow down.' }
  });
}

const limiter = rateLimit(15 * 60 * 1000, 200);

const anilistCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 }); // Cache for 24 hours

app.post('/api/anilist', rateLimit(60000, 30), async (req, res) => {
  try {
    const cacheKey = crypto.createHash('md5').update(JSON.stringify(req.body)).digest('hex');
    const cachedData = anilistCache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }
    const r = await axios.post('https://graphql.anilist.co', req.body, { headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'MangaReader/1.0 (+https://www.mangareader.pro)' }, timeout: 10000 });
    anilistCache.set(cacheKey, r.data);
    res.json(r.data);
  } catch (err) {
    if (err.response) res.status(err.response.status).json(err.response.data);
    else res.status(500).json({ error: err.message });
  }
});

const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET,
  getSessionIdentifier: (req) => req.cookies.sid,
  cookieName: process.env.NODE_ENV === 'production' ? '__Host-csrf-token' : 'csrf-token',
  cookieOptions: {
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  },
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
});

app.use(doubleCsrfProtection);

app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: generateCsrfToken(req, res) });
});


// ── ADMIN AUTH ────────────────────────────────────────────────────────────────
const jwt = require('jsonwebtoken');
const authRoutes = require('./routes/auth.routes');

// Fail fast rather than silently falling back to a public, hardcoded secret.
// A missing secret here previously meant admin JWTs/tokens could be forged
// by anyone, since the fallback strings ship in this repo.
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set. Refusing to start. Set it in your environment (see backend/.env.example).');
  process.exit(1);
}
if (!process.env.ADMIN_TOKEN) {
  console.error('FATAL: ADMIN_TOKEN is not set. Refusing to start. Set it in your environment (see backend/.env.example).');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_TOKEN_BUF = Buffer.from(process.env.ADMIN_TOKEN);

// Rate-limited: this route gates access to everything behind requireAdmin,
// so it must not accept unlimited password guesses.
app.use('/api/auth', rateLimit(15 * 60_000, 5), authRoutes);

function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Fallback to legacy token for existing active client sessions during transition
    const legacyToken = req.headers['x-admin-token'];
    if (legacyToken) {
      const tokenBuf = Buffer.from(legacyToken);
      if (tokenBuf.length === ADMIN_TOKEN_BUF.length && crypto.timingSafeEqual(tokenBuf, ADMIN_TOKEN_BUF)) {
        return next();
      }
    }
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Forbidden: Invalid token' });
  }
}

// ── CACHE ─────────────────────────────────────────────────────────────────────
const memCache = new NodeCache({ stdTTL: 86400, checkperiod: 600 });
async function getCached(key) {
  if (redisClient && redisClient.status === 'ready') {
    try {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.error('Redis get error', err);
    }
  }
  return memCache.get(key) || null;
}
async function setCached(key, data, ttlMs = 86400000) {
  if (redisClient && redisClient.status === 'ready') {
    try {
      await redisClient.set(key, JSON.stringify(data), 'PX', ttlMs);
      return;
    } catch (err) {
      console.error('Redis set error', err);
    }
  }
  memCache.set(key, data, Math.floor(ttlMs / 1000));
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function san(str, max = 500) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').replace(/[<>\\]/g, '').trim().slice(0, max);
}
function isValidUrl(str) {
  try { const u = new URL(str); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
}

// ── SOURCE SEARCH HELPERS (unchanged logic) ───────────────────────────────────
async function getAlternativeTitles(mangaId) {
  try {
    const res = await db.query(`SELECT english_title,romaji_title,alternative_titles,synonyms FROM metadata WHERE manga_id=$1`, [mangaId]);
    if (!res.rows.length) return [];
    const row = res.rows[0]; const alts = new Set();
    if (row.english_title) alts.add(row.english_title);
    if (row.romaji_title) alts.add(row.romaji_title);
    for (const field of ['alternative_titles', 'synonyms']) {
      const arr = typeof row[field] === 'string' ? JSON.parse(row[field]) : row[field];
      if (Array.isArray(arr)) arr.forEach(t => alts.add(t));
    }
    return [...alts];
  } catch { return []; }
}

function isGoodMatch(orig, found) {
  if (!orig || !found) return false;
  const co = orig.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const cf = found.toLowerCase().replace(/[^\w\s]/g, '').trim();
  if (co.length < 4 || cf.length < 4) return false;
  if (co === cf) return true;
  const seq = ['ragnarok', 'sequel', 'spin-off', 'spinoff', 'gaiden', 'side-story', 'special', 'extra'];
  if (cf.includes(co) || co.includes(cf)) {
    const extra = cf.replace(co, '').trim().split(/\s+/).filter(Boolean);
    if (extra.some(w => seq.includes(w)) && !co.split(/\s+/).some(w => seq.includes(w))) return false;
    return true;
  }
  const stopWords = new Set(['the', 'and', 'of', 'to', 'in', 'a', 'is', 'for', 'on', 'with', 'at', 'by', 'from']);
  const words = co.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
  if (!words.length) return false;
  let m = 0; words.forEach(w => { if (cf.includes(w)) m++; });
  const thresh = Math.max(2, Math.ceil(words.length * 0.5));
  const match = m >= Math.min(words.length, thresh);
  if (match) {
    const extra = cf.split(/\s+/).filter(w => !co.includes(w) && !stopWords.has(w));
    if (extra.some(w => seq.includes(w)) && !co.split(/\s+/).some(w => seq.includes(w))) return false;
  }
  return match;
}

function checkDirectRedirect($, baseUrl) {
  const can = $('link[rel="canonical"]').attr('href') || $('meta[property="og:url"]').attr('content');
  if (!can) return null;
  const cl = can.toLowerCase();
  if ((cl.includes('/manga/') || cl.includes('/series/') || cl.includes('/novel/')) &&
    !cl.endsWith('/manga') && !cl.endsWith('/series') && !cl.endsWith('/novel') &&
    !cl.includes('?s=') && !cl.includes('search')) {
    return can.startsWith('http') ? can : `${baseUrl}${can.startsWith('/') ? '' : '/'}${can}`;
  }
  return null;
}

async function verifyRedirectLink(link, orig) {
  if (!link) return null;
  try {
    const $r = cheerio.load(await fetchHTML(link));
    const t = $r('h1.post-title,.manga-title,h1,.series-title').first().text().trim();
    return isGoodMatch(orig, t) ? link : null;
  } catch { return null; }
}

async function performSearch(sourceId, query, origTitle) {
  if (['coffeemanga', 'mangaread'].includes(sourceId)) {
    const base = SOURCE_SCRAPERS[sourceId].baseUrl;
    const $ = cheerio.load(await fetchHTML(`${base}/?s=${encodeURIComponent(query)}&post_type=wp-manga`));
    const redir = checkDirectRedirect($, base);
    if (redir) { const v = await verifyRedirectLink(redir, origTitle); if (v) return v; }
    let best = null, score = 0, cands = [];
    $('.post-title a,.c-tabs-item__content a,.tab-summary a,.manga-name a,a[href*="/manga/"]').each((_, el) => {
      const text = ($(el).attr('title') || $(el).text()).trim().toLowerCase(), href = $(el).attr('href');
      if (!href || href.includes('?m_orderby') || href.endsWith('/manga') || href.endsWith('/manga/') || href.includes('-novel') || href.includes('/novel/')) return;
      const full = href.startsWith('http') ? href : `${base}${href.startsWith('/') ? '' : '/'}${href}`;
      if (!cands.some(c => c.url === full)) cands.push({ url: full, text });
      if (!isGoodMatch(origTitle, text)) return;
      let s = 0; origTitle.toLowerCase().split(/\s+/).forEach(w => { if (w.length > 2 && text.includes(w)) s++; });
      if (s > score) { score = s; best = full; }
    });
    const mc = origTitle.toLowerCase().replace(/[^\w\s]/g, '').trim().split(/\s+/).filter(w => w.length > 2).length;
    if (score >= 2 || (mc <= 1 && score >= 1)) return best;
    for (let i = 0; i < Math.min(cands.length, 3); i++) {
      try {
        const $d = cheerio.load(await fetchHTML(cands[i].url));
        let alts = [];
        $d('.post-content_item').each((_, it) => {
          const h = $d(it).find('.summary-heading').text().toLowerCase();
          if (h.includes('alternative') || h.includes('alt title')) {
            $d(it).find('.summary-content').text().split(/[,;\n]+/).forEach(v => { const c = v.trim(); if (c) alts.push(c); });
          }
        });
        if (alts.some(a => isGoodMatch(origTitle, a))) return cands[i].url;
      } catch { }
    }
    return null;
  }
  if (sourceId === 'mangakatana') {
    const base = 'https://mangakatana.com';
    const $ = cheerio.load(await fetchHTML(`${base}/?search=${encodeURIComponent(query)}`));
    const redir = checkDirectRedirect($, base); if (redir) { const v = await verifyRedirectLink(redir, origTitle); if (v) return v; }
    let best = null, score = 0;
    $('.title a,a[href*="/manga/"]').each((_, el) => {
      const text = ($(el).attr('title') || $(el).text()).trim().toLowerCase(), href = $(el).attr('href');
      if (!href || (!href.startsWith('https://mangakatana.com/manga/') && !href.startsWith('/manga/'))) return;
      if (!isGoodMatch(origTitle, text)) return;
      let s = 0; origTitle.toLowerCase().split(/\s+/).forEach(w => { if (w.length > 2 && text.includes(w)) s++; });
      if (s > score) { score = s; best = href; }
    });
    return score >= 1 ? best : null;
  }
  if (sourceId === 'mangadex') {
    const r = await axios.get(`https://api.mangadex.org/manga?title=${encodeURIComponent(query)}&limit=5&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica`);
    if (r.data?.data?.length) {
      let bestId = null, bestScore = 0;
      r.data.data.forEach(item => {
        const titles = Object.values(item.attributes.title || {}).concat((item.attributes.altTitles || []).map(t => Object.values(t)[0])).map(t => t.toLowerCase());
        if (!titles.some(t => isGoodMatch(origTitle, t))) return;
        const words = origTitle.toLowerCase().split(/\s+/);
        titles.forEach(t => { let s = 0; words.forEach(w => { if (w.length > 2 && t.includes(w)) s++; }); if (s > bestScore) { bestScore = s; bestId = item.id; } });
      });
      if (bestId) return `https://mangadex.org/title/${bestId}`;
    }
  }
  return null;
}

async function searchSource(sourceId, title, mangaId = null) {
  try {
    let allTitles = [title];
    if (mangaId) {
      const alts = await getAlternativeTitles(mangaId);
      for (const alt of alts) {
        if (!allTitles.map(t => t.toLowerCase()).includes(alt.toLowerCase())) {
          allTitles.push(alt);
        }
      }
    }

    if (sourceId === 'mangaread' || sourceId === 'coffeemanga') {
      const axios = require('axios');
      const topTitlesForDirect = allTitles.slice(0, 8);
      for (const t of topTitlesForDirect) {
        const slug = t.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        if (!slug || slug.length < 2) continue;

        const urlsToTry = sourceId === 'mangaread'
          ? [`https://www.mangaread.org/manga/${slug}/`, `https://www.mangaread.org/manga/${slug}-manga/`]
          : [`https://coffeemanga.ink/manga/${slug}/`];

        for (const directUrl of urlsToTry) {
          try {
            const res = await axios.get(directUrl, { timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (res.status === 200 && res.data.includes('post-title')) return directUrl;
          } catch (e) { }
        }
      }
    }

    const topTitlesForSearch = allTitles.slice(0, 3);
    for (const t of topTitlesForSearch) {
      let link = await performSearch(sourceId, t, t);
      if (link) return link;
      let clean = t.replace(/[^\w\s]/g, '').trim();
      if (clean !== t) {
        link = await performSearch(sourceId, clean, t);
        if (link) return link;
      }
    }
  } catch (err) { console.warn(`Search failed for ${sourceId}:`, err.message); }
  return null;
}

function detectSource(url) {
  const h = new URL(url).hostname;
  if (h === 'coffeemanga.ink') return 'coffeemanga';
  if (h === 'www.mangaread.org' || h === 'mangaread.org') return 'mangaread';
  if (h === 'mangadex.org') return 'mangadex';
  if (h === 'mangakatana.com') return 'mangakatana';
  return null;
}

// ── MANGA API (preserved + secured) ──────────────────────────────────────────
app.get('/api/manga/map', rateLimit(60000, 30), async (req, res) => {
  const title = san(req.query.title, 200);
  if (!title) return res.status(400).json({ error: 'title required' });
  try {
    const mangaId = await getOrFetchMangaMetadata(title);
    const mData = (await db.query('SELECT country, preferred_source_id, preferred_source_slug, last_source_check FROM manga WHERE id=$1', [mangaId])).rows[0];

    // Helper to scrape and cache a single source
    async function scrapeAndCache(m) {
      try {
        const s = SOURCE_SCRAPERS[m.source_id]; if (!s) return null;
        const d = await s.getMangaDetail(m.source_slug);
        if (d?.chapters?.length) {
          await db.query(`INSERT INTO chapters_cache(manga_id,source_id,chapters,fetched_at)VALUES($1,$2,$3,NOW())ON CONFLICT(manga_id,source_id)DO UPDATE SET chapters=EXCLUDED.chapters,fetched_at=NOW()`, [mangaId, m.source_id, JSON.stringify(d.chapters)]);
          return { sourceId: m.source_id, url: m.source_slug, detail: d };
        }
      } catch (err) { console.warn(`Scrape failed ${m.source_id}:`, err.message); }
      return null;
    }

    const now = Date.now();
    const isPreferredValid = mData.preferred_source_id && mData.last_source_check && (now - new Date(mData.last_source_check).getTime()) < 30 * 24 * 60 * 60 * 1000;

    if (isPreferredValid) {
      const cached = (await db.query('SELECT chapters, fetched_at FROM chapters_cache WHERE manga_id=$1 AND source_id=$2', [mangaId, mData.preferred_source_id])).rows[0];
      let detail = null;
      if (cached && (now - new Date(cached.fetched_at).getTime()) < 6 * 3600000 && cached.chapters?.length) {
        // Just return from chapters_cache
        return res.json({ data: { sourceId: mData.preferred_source_id, url: mData.preferred_source_slug, chapters: cached.chapters } });
      } else {
        const result = await scrapeAndCache({ source_id: mData.preferred_source_id, source_slug: mData.preferred_source_slug });
        if (result) {
          return res.json({ data: { sourceId: result.sourceId, url: result.url, title: result.detail.title, cover: result.detail.cover, description: result.detail.description, status: result.detail.status, genres: result.detail.genres, chapters: result.detail.chapters } });
        }
        // If preferred source fails to scrape, fall through to full search
      }
    }

    const isManga = mData?.country === 'JP' || mData?.country === 'Japan';
    const sourceIds = isManga ? ['mangakatana', 'mangadex'] : ['mangaread', 'coffeemanga', 'mangakatana', 'mangadex'];

    let mappings = (await db.query('SELECT source_id,source_slug FROM source_mappings WHERE manga_id=$1', [mangaId])).rows;
    if (!mappings.length) {
      const resolvedMappings = [];
      const promises = sourceIds.map(async sid => {
        const url = await searchSource(sid, title, mangaId);
        if (url) {
          await db.query(`INSERT INTO source_mappings(manga_id,source_id,source_slug)VALUES($1,$2,$3)ON CONFLICT(manga_id,source_id)DO UPDATE SET source_slug=EXCLUDED.source_slug`, [mangaId, sid, url]);
          const mapping = { source_id: sid, source_slug: url };
          resolvedMappings.push(mapping);
          return mapping;
        }
        throw new Error('Not found');
      });

      await Promise.allSettled(promises.map(p => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5500))])));

      mappings = [...resolvedMappings];
      Promise.allSettled(promises).catch(() => { });
    }
    if (!mappings.length) return res.status(404).json({ error: 'No source mappings found' });
    const TTL = 6 * 3600000;
    const cached = (await db.query('SELECT source_id,chapters,fetched_at FROM chapters_cache WHERE manga_id=$1', [mangaId])).rows
      .reduce((m, r) => { m[r.source_id] = { chapters: r.chapters, ts: new Date(r.fetched_at).getTime() }; return m; }, {});

    const fresh = [], stale = [];
    for (const m of mappings) {
      const c = cached[m.source_id];
      if (c && (now - c.ts) < TTL && c.chapters?.length) fresh.push({ sourceId: m.source_id, url: m.source_slug, detail: { chapters: c.chapters } });
      else stale.push(m);
    }
    let active = [...fresh];
    if (stale.length) {
      if (!fresh.length) {
        let activeTemp = [];
        const promises = stale.map(r => scrapeAndCache(r).then(res => { if (res) activeTemp.push(res); else throw new Error(); return res; }));

        await Promise.allSettled(promises.map(p => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5500))])));

        active = activeTemp;
        Promise.allSettled(promises).catch(() => { });
      }
      else setImmediate(async () => { for (const m of stale) await scrapeAndCache(m).catch(() => { }); });
    }
    if (!active.length) return res.status(404).json({ error: 'Could not fetch chapters' });
    active.sort((a, b) => { const d = b.detail.chapters.length - a.detail.chapters.length; return d || sourceIds.indexOf(a.sourceId) - sourceIds.indexOf(b.sourceId); });
    const sel = active[0];

    // Update the preferred source in the database (this is the optimization requested)
    await db.query('UPDATE manga SET preferred_source_id=$1, preferred_source_slug=$2, last_source_check=NOW() WHERE id=$3', [sel.sourceId, sel.url, mangaId]);

    res.json({ data: { sourceId: sel.sourceId, url: sel.url, title: sel.detail?.title, cover: sel.detail?.cover, description: sel.detail?.description, status: sel.detail?.status, genres: sel.detail?.genres, chapters: sel.detail.chapters } });
  } catch (err) { console.error('Mapping failed:', err.message); res.status(500).json({ error: err.message }); }
});

app.get('/api/manga/source-chapters', rateLimit(60000, 20), async (req, res) => {
  const { title, source: sid } = req.query;
  if (!title || !sid) return res.status(400).json({ error: 'title and source required' });
  try {
    const mangaId = await getOrFetchMangaMetadata(san(title, 200));
    const cached = (await db.query('SELECT chapters, fetched_at FROM chapters_cache WHERE manga_id=$1 AND source_id=$2', [mangaId, sid])).rows[0];
    const mr = (await db.query('SELECT source_slug FROM source_mappings WHERE manga_id=$1 AND source_id=$2', [mangaId, san(sid, 50)])).rows;
    let url = mr.length ? mr[0].source_slug : null;
    if (cached && (Date.now() - new Date(cached.fetched_at).getTime()) < 6 * 3600000 && cached.chapters?.length) return res.json({ data: { sourceId: sid, url, chapters: cached.chapters } });
    if (!url) {
      url = await searchSource(sid, title, mangaId);
      if (url) await db.query(`INSERT INTO source_mappings(manga_id,source_id,source_slug)VALUES($1,$2,$3)ON CONFLICT(manga_id,source_id)DO UPDATE SET source_slug=EXCLUDED.source_slug`, [mangaId, sid, url]);
    }
    if (!url) return res.status(404).json({ error: `Not found on source: ${sid}` });
    const s = SOURCE_SCRAPERS[sid]; if (!s) return res.status(400).json({ error: `Unknown source: ${sid}` });
    const d = await s.getMangaDetail(url);
    if (d.chapters?.length) await db.query(`INSERT INTO chapters_cache(manga_id,source_id,chapters,fetched_at)VALUES($1,$2,$3,NOW())ON CONFLICT(manga_id,source_id)DO UPDATE SET chapters=EXCLUDED.chapters,fetched_at=NOW()`, [mangaId, sid, JSON.stringify(d.chapters)]);
    res.json({ data: { sourceId: sid, url, chapters: d.chapters || [] } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/manga/recent', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  try {
    const r = await db.query(`SELECT * FROM ( SELECT DISTINCT ON (m.id) m.id,m.title,m.cover,m.status,m.created_at,lcc.latest_chapter_number,lcc.source_id AS latest_source FROM manga m LEFT JOIN latest_chapter_cache lcc ON m.id=lcc.manga_id ORDER BY m.id, lcc.latest_chapter_number DESC NULLS LAST ) sub ORDER BY created_at DESC LIMIT $1`, [limit]);
    res.json({ data: r.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/manga/search', async (req, res) => {
  const { query: q, genre, status, year, rating, country, sort, limit = 36, offset = 0 } = req.query;
  try {
    let conds = [], vals = [], p = 1;
    let base = `SELECT DISTINCT m.id,m.title,m.cover,m.status,m.rating,m.popularity,m.country,m.format,m.start_date,lcc.latest_chapter_number AS "latestChapter",lcc.source_id AS "latestSource" FROM manga m LEFT JOIN latest_chapter_cache lcc ON m.id=lcc.manga_id LEFT JOIN source_mappings sm ON m.id=sm.manga_id`;
    let cnt = `SELECT COUNT(DISTINCT m.id)as total FROM manga m LEFT JOIN latest_chapter_cache lcc ON m.id=lcc.manga_id LEFT JOIN source_mappings sm ON m.id=sm.manga_id`;
    if (genre && genre !== 'All') { const j = ` LEFT JOIN manga_genres mg ON m.id=mg.manga_id LEFT JOIN genres g ON mg.genre_id=g.id`; base += j; cnt += j; conds.push(`g.name=$${p++}`); vals.push(genre); }
    if (q?.trim()) { conds.push(`(m.title ILIKE $${p} OR m.description ILIKE $${p})`); vals.push(`%${q.trim()}%`); p++; }
    if (status) { conds.push(`m.status=$${p++}`); vals.push(status); }
    if (year && year !== 'All') { conds.push(`m.start_date LIKE $${p++}`); vals.push(`${year}%`); }
    if (rating && rating !== 'All') { conds.push(`m.rating>=$${p++}`); vals.push(parseFloat(rating)); }
    if (country && country !== 'All') { conds.push(`m.country=$${p++}`); vals.push(country); }
    if (conds.length) { const w = ` WHERE ${conds.join(' AND ')}`; base += w; cnt += w; }
    const total = parseInt((await db.query(cnt, vals)).rows[0]?.total || '0');
    const order = sort === 'Top Rated' ? 'm.rating DESC,m.popularity DESC' : sort === 'New Releases' ? 'm.created_at DESC' : sort === 'A–Z' ? 'm.title ASC' : 'm.popularity DESC';
    base += ` ORDER BY ${order} LIMIT $${p++} OFFSET $${p++}`;
    const rows = (await db.query(base, [...vals, parseInt(limit), parseInt(offset)])).rows;
    const results = await Promise.all(rows.map(async row => {
      const g = (await db.query(`SELECT g.name FROM genres g JOIN manga_genres mg ON g.id=mg.genre_id WHERE mg.manga_id=$1`, [row.id])).rows.map(r => r.name);
      return { ...row, genres: g };
    }));
    res.json({ data: results, total });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/home', rateLimit(60000, 30), async (req, res) => {
  const c = await getCached('home'); if (c) return res.json({ data: c, cached: true });
  const results = await Promise.allSettled(Object.values(SOURCE_SCRAPERS).map(async s => {
    try {
      const d = await Promise.race([s.getHome(), new Promise((_, rej) => setTimeout(() => rej(new Error('Home scraper timeout')), 8000))]);
      return { sourceId: s.id, ...d };
    } catch (err) { return { sourceId: s.id, items: [], error: err.message }; }
  }));
  const sections = results.map(r => r.status === 'fulfilled' ? r.value : { items: [], error: r.reason?.message });
  await setCached('home', sections); res.json({ data: sections, cached: false });
});

app.get('/api/home/sections/:key', rateLimit(60000, 30), async (req, res) => {
  const { key } = req.params;
  try {
    const result = await db.query('SELECT media, updated_at FROM home_sections WHERE section_key = $1', [key]);
    if (!result.rows.length) return res.status(404).json({ error: 'Section not found' });
    res.json({ data: result.rows[0].media, updated_at: result.rows[0].updated_at });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/home/sections/:key', requireAdmin, async (req, res) => {
  const { key } = req.params;
  const { media } = req.body;
  if (!Array.isArray(media)) return res.status(400).json({ error: 'media must be an array' });
  try {
    await db.query(
      `INSERT INTO home_sections (section_key, media, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (section_key) DO UPDATE SET media = EXCLUDED.media, updated_at = EXCLUDED.updated_at`,
      [key, JSON.stringify(media)]
    );
    await setCached(`home_section:${key}`, media, 86400000);
    res.json({ success: true, section_key: key, count: media.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const ANILIST_MANGA_QUERY = `
  query ($page: Int, $perPage: Int, $genre: String, $search: String, $sort: [MediaSort], $status: MediaStatus, $countryOfOrigin: CountryCode, $startDate_greater: FuzzyDateInt, $startDate_lesser: FuzzyDateInt, $averageScore_greater: Int) {
    Page (page: $page, perPage: $perPage) {
      pageInfo { total currentPage lastPage hasNextPage perPage }
      media (type: MANGA, genre: $genre, search: $search, sort: $sort, status: $status, countryOfOrigin: $countryOfOrigin, startDate_greater: $startDate_greater, startDate_lesser: $startDate_lesser, averageScore_greater: $averageScore_greater) {
        id
        title { english romaji userPreferred }
        coverImage { large medium color }
        genres averageScore status chapters trending isAdult
        tags { name isAdult }
      }
    }
  }
`;

function mapAnilistMedia(media) {
  return {
    id: media.id,
    t: media.title.userPreferred || media.title.english || media.title.romaji,
    title: media.title.english || media.title.romaji || media.title.userPreferred,
    cover: media.coverImage.large || media.coverImage.medium,
    ch: media.chapters ? `Ch ${media.chapters}` : '',
    g: media.status || 'Ongoing',
    hot: media.trending ? Math.round(media.trending) : undefined,
    rating: media.averageScore ? (media.averageScore / 10).toFixed(1) : undefined,
    genres: media.genres || [],
    isAdult: media.isAdult,
    tags: media.tags || [],
  };
}

app.post('/api/admin/home/sections/:key/refresh', requireAdmin, async (req, res) => {
  const { key } = req.params;
  let query, variables;
  switch (key) {
    case 'popular_now':
      query = ANILIST_MANGA_QUERY;
      variables = { perPage: 12, genre: 'Fantasy', countryOfOrigin: 'KR', sort: ['POPULARITY_DESC'] };
      break;
    case 'readers_also_love':
      query = ANILIST_MANGA_QUERY;
      variables = { perPage: 12, sort: ['POPULARITY_DESC'] };
      break;
    default:
      return res.status(400).json({ error: 'Unknown section key' });
  }
  try {
    const r = await axios.post('https://graphql.anilist.co', { query, variables }, {
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'MangaReader/1.0 (+https://www.mangareader.pro)' },
      timeout: 15000,
    });
    const media = (r.data?.data?.Page?.media || []).map(mapAnilistMedia);
    await db.query(
      `INSERT INTO home_sections (section_key, media, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (section_key) DO UPDATE SET media = EXCLUDED.media, updated_at = EXCLUDED.updated_at`,
      [key, JSON.stringify(media)]
    );
    await setCached(`home_section:${key}`, media, 86400000);
    res.json({ success: true, section_key: key, count: media.length, source: 'anilist' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/manga', async (req, res) => {
  const { url, source: sid } = req.query;
  if (!url || !isValidUrl(url)) return res.status(400).json({ error: 'valid url required' });
  const src = SOURCE_SCRAPERS[sid || detectSource(url)];
  if (!src) return res.status(400).json({ error: 'Unknown source' });
  try { const d = await src.getMangaDetail(url); res.json({ data: { ...d, sourceId: src.id, url }, cached: false }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/chapter/images', rateLimit(60000, 60), async (req, res) => {
  const { url, source: sid } = req.query;
  if (!url || !isValidUrl(url)) return res.status(400).json({ error: 'valid url required' });
  const ck = `ch:${url}`; const c = await getCached(ck); if (c) return res.json({ data: c, cached: true });
  const src = SOURCE_SCRAPERS[sid || detectSource(url)];
  const MIN = 3; let result = null, usedSrc = sid;
  if (src) { try { const d = await src.getChapterImages(url); if (d.images?.length >= MIN) { result = d; usedSrc = sid; } } catch (err) { console.warn(`[${sid}] Failed:`, err.message); } }
  if (!result) {
    try {
      const imgs = await extractionWorker.run({ url });
      if (imgs && imgs.length > 0) { result = { images: imgs, source: 'fallback' }; usedSrc = 'fallback'; }
    } catch (err) { console.warn('[fallback] Failed:', err.message); }
  }
  if (!result?.images?.length) return res.status(404).json({ error: 'No images found', url });
  const resp = { ...result, url, usedSource: usedSrc };
  await setCached(ck, resp, 4 * 3600000);
  res.json({ data: resp, cached: false });
});

function isPrivateIP(hostname) {
  if (hostname === 'localhost' || hostname === '::1' || hostname === '0.0.0.0') return true;
  const parts = hostname.split('.');
  if (parts.length === 4) {
    const first = parseInt(parts[0], 10);
    const second = parseInt(parts[1], 10);
    if (first === 0 || first === 127 || first === 10) return true;
    if (first === 172 && second >= 16 && second <= 31) return true;
    if (first === 192 && second === 168) return true;
    if (first === 169 && second === 254) return true;
  }
  return false;
}

// In-memory cache for proxied images (10MB cap, 1-hour TTL)
const imageCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });
const IMAGE_CACHE_MAX = 500;

app.get('/api/proxy-image', rateLimit(60000, 300), async (req, res) => {
  const { url, w, q } = req.query;
  if (!url || !isValidUrl(url)) return res.status(400).send('Invalid url');
  const cacheKey = `${url}|${w || ''}|${q || ''}`;
  const cached = imageCache.get(cacheKey);
  if (cached) {
    res.setHeader('Content-Type', cached.ct);
    res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
    return res.send(cached.buf);
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return res.status(400).send('Only HTTPS URLs allowed');
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '::1') return res.status(400).send('URL not allowed');
    if (parsed.hostname.endsWith('.internal') || parsed.hostname.endsWith('.local')) return res.status(400).send('URL not allowed');
    if (isPrivateIP(parsed.hostname)) return res.status(400).send('URL not allowed');

    // SSRF Allowlist Regex
    const allowedDomainsRegex = /^(.*?\.)?(anilist\.co|myanimelist\.net|cdn\.myanimelist\.net|pinimg\.com|coffeemanga\.ink|mangaread\.org|mangadex\.org|mangadex\.network|mangakatana\.com|i\.imgur\.com|githubusercontent\.com)$/i;
    if (!allowedDomainsRegex.test(parsed.hostname)) {
      return res.status(403).send('Forbidden: Domain not in allowlist');
    }

    const origin = parsed.origin;
    const r = await axios({
      method: 'get', url, responseType: 'arraybuffer', headers: {
        Referer: origin + '/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'image/*,*/*;q=0.8'
      }, timeout: 3000
    });
    let buf, ct = 'image/webp';
    try {
      let p = sharp(Buffer.from(r.data));
      if (w) { const wi = parseInt(w); if (!isNaN(wi) && wi > 0 && wi <= 2000) p = p.resize({ width: wi, withoutEnlargement: true }); }
      const quality = Math.max(1, Math.min(100, parseInt(q) || 35));
      buf = await p.webp({ quality }).toBuffer();
    } catch {
      try {
        let p = sharp(Buffer.from(r.data));
        if (w) { const wi = parseInt(w); if (!isNaN(wi) && wi > 0 && wi <= 2000) p = p.resize({ width: wi, withoutEnlargement: true }); }
        const quality = Math.max(1, Math.min(100, parseInt(q) || 35));
        buf = await p.jpeg({ quality, progressive: true }).toBuffer();
        ct = 'image/jpeg';
      } catch {
        buf = Buffer.from(r.data);
        ct = r.headers['content-type'] || 'image/jpeg';
      }
    }

    // Cache processed image (evict oldest if over cap)
    if (Object.keys(imageCache.keys()).length >= IMAGE_CACHE_MAX) {
      const keys = imageCache.keys();
      imageCache.del(keys[0]);
    }
    imageCache.set(cacheKey, { buf, ct });

    res.setHeader('Content-Type', ct); res.removeHeader('Content-Disposition');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(buf);
  } catch (err) { res.status(502).send('Error proxying image'); }
});

// ── BLOG API ──────────────────────────────────────────────────────────────────
app.get('/api/blog', async (req, res) => {
  const { category, tag, status = 'published', limit = 20, offset = 0, search, featured } = req.query;
  try {
    let conds = ['bp.status=$1'], vals = [status], p = 2;
    if (category) { conds.push(`bc.slug=$${p++}`); vals.push(san(category, 100)); }
    if (search) { conds.push(`(bp.title ILIKE $${p} OR bp.excerpt ILIKE $${p})`); vals.push(`%${san(search, 100)}%`); p++; }
    if (featured === 'true') { conds.push(`bp.is_featured=true`); }
    const where = `WHERE ${conds.join(' AND ')}`;
    const total = parseInt((await db.query(`SELECT COUNT(*)as total FROM blog_posts bp LEFT JOIN blog_categories bc ON bp.category_id=bc.id ${where}`, vals)).rows[0].total);
    const rows = (await db.query(`SELECT bp.id,bp.slug,bp.title,bp.excerpt,bp.featured_image,bp.reading_time,bp.views,bp.status,bp.is_featured,bp.published_at,bp.updated_at,bc.name as category_name,bc.slug as category_slug,ba.name as author_name,ba.slug as author_slug,ba.avatar as author_avatar FROM blog_posts bp LEFT JOIN blog_categories bc ON bp.category_id=bc.id LEFT JOIN blog_authors ba ON bp.author_id=ba.id ${where} ORDER BY bp.is_featured DESC,bp.published_at DESC NULLS LAST LIMIT $${p++} OFFSET $${p++}`, [...vals, parseInt(limit), parseInt(offset)])).rows;
    res.json({ data: rows, total });
  } catch (err) { console.error('[/api/blog]', err.message); res.status(500).json({ error: err.message }); }
});

app.get('/api/blog/:slug', async (req, res) => {
  const { slug } = req.params;
  if (!/^[a-z0-9-]+$/.test(slug)) return res.status(400).json({ error: 'Invalid slug' });
  try {
    const r = (await db.query(`SELECT bp.*,bc.name as category_name,bc.slug as category_slug,ba.name as author_name,ba.slug as author_slug,ba.bio as author_bio,ba.avatar as author_avatar,ba.twitter as author_twitter FROM blog_posts bp LEFT JOIN blog_categories bc ON bp.category_id=bc.id LEFT JOIN blog_authors ba ON bp.author_id=ba.id WHERE bp.slug=$1 AND bp.status='published'`, [slug])).rows;
    if (!r.length) return res.status(404).json({ error: 'Post not found' });
    db.query('UPDATE blog_posts SET views=views+1 WHERE slug=$1', [slug]).catch(() => { });
    const tags = (await db.query(`SELECT bt.name,bt.slug FROM blog_tags bt JOIN blog_post_tags bpt ON bt.id=bpt.tag_id WHERE bpt.post_id=$1`, [r[0].id])).rows;
    const related = (await db.query(`SELECT bp.slug,bp.title,bp.excerpt,bp.reading_time,bp.published_at,bp.featured_image,bc.name as category_name,ba.name as author_name FROM blog_posts bp LEFT JOIN blog_categories bc ON bp.category_id=bc.id LEFT JOIN blog_authors ba ON bp.author_id=ba.id WHERE bp.status='published' AND bp.category_id=$1 AND bp.slug!=$2 ORDER BY bp.published_at DESC LIMIT 4`, [r[0].category_id, slug])).rows;
    res.json({ data: { ...r[0], tags, related } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/blog-categories', async (req, res) => {
  try {
    const r = await db.query(`SELECT bc.*,COUNT(bp.id)as post_count FROM blog_categories bc LEFT JOIN blog_posts bp ON bc.id=bp.category_id AND bp.status='published' GROUP BY bc.id ORDER BY bc.sort_order,bc.name`);
    res.json({ data: r.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/blog-tags', async (req, res) => {
  try {
    const r = await db.query(`SELECT bt.*,COUNT(bpt.post_id)as post_count FROM blog_tags bt LEFT JOIN blog_post_tags bpt ON bt.id=bpt.tag_id GROUP BY bt.id ORDER BY post_count DESC LIMIT 50`);
    res.json({ data: r.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── CONTACT / NEWSLETTER ──────────────────────────────────────────────────────
app.post('/api/contact', rateLimit(60000, 5), async (req, res) => {
  const { name, email, subject, message, type = 'general' } = req.body;
  const sn = san(name, 100), se = san(email, 200), ss = san(subject, 200), sm = san(message, 5000);
  const st = ['general', 'bug', 'feature', 'dmca', 'business', 'complaint'].includes(type) ? type : 'general';
  if (!sn || !se || !sm) return res.status(400).json({ error: 'Name, email and message required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(se)) return res.status(400).json({ error: 'Invalid email' });
  try {
    await db.query('INSERT INTO contact_messages(name,email,subject,message,type,created_at)VALUES($1,$2,$3,$4,$5,NOW())', [sn, se, ss, sm, st]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed to save' }); }
});

app.post('/api/newsletter', rateLimit(60000, 5), async (req, res) => {
  const se = san(req.body.email, 200);
  if (!se || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(se)) return res.status(400).json({ error: 'Valid email required' });
  try {
    await db.query('INSERT INTO newsletter_subscribers(email,created_at)VALUES($1,NOW())ON CONFLICT(email)DO NOTHING', [se]);
    res.json({ success: true, message: 'Subscribed!' });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── ADMIN API ─────────────────────────────────────────────────────────────────
app.get('/api/admin/blog', requireAdmin, async (req, res) => {
  const { limit = 50, offset = 0, status } = req.query;
  try {
    const where = status ? `WHERE bp.status=$3` : '';
    const vals = status ? [parseInt(limit), parseInt(offset), status] : [parseInt(limit), parseInt(offset)];
    const rows = (await db.query(`SELECT bp.id,bp.slug,bp.title,bp.status,bp.reading_time,bp.views,bp.is_featured,bp.published_at,bp.created_at,bc.name as category_name,ba.name as author_name FROM blog_posts bp LEFT JOIN blog_categories bc ON bp.category_id=bc.id LEFT JOIN blog_authors ba ON bp.author_id=ba.id ${where} ORDER BY bp.created_at DESC LIMIT $1 OFFSET $2`, vals)).rows;
    const total = parseInt((await db.query(`SELECT COUNT(*)as total FROM blog_posts bp ${where}`, status ? [status] : [])).rows[0].total);
    res.json({ data: rows, total });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/blog', requireAdmin, async (req, res) => {
  const { slug, title, excerpt, content, category_id, author_id, featured_image, meta_title, meta_description, tags = [], status = 'draft', scheduled_at, is_featured = false, faq = [], table_of_contents = '' } = req.body;
  if (!slug || !title || !content) return res.status(400).json({ error: 'slug, title, content required' });
  const sl = san(slug, 200).toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const rt = Math.max(1, Math.round(content.split(/\s+/).length / 200));
  try {
    const r = (await db.query(`INSERT INTO blog_posts(slug,title,excerpt,content,category_id,author_id,featured_image,meta_title,meta_description,status,reading_time,scheduled_at,is_featured,faq,table_of_contents,published_at,created_at,updated_at)VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,CASE WHEN $10='published' THEN NOW() ELSE NULL END,NOW(),NOW())RETURNING id,slug`, [sl, san(title, 300), san(excerpt, 500), content, category_id || null, author_id || null, featured_image || null, san(meta_title || title, 300), san(meta_description || excerpt, 500), status, rt, scheduled_at || null, is_featured, JSON.stringify(faq), table_of_contents])).rows[0];
    if (tags.length) for (const t of tags) await db.query('INSERT INTO blog_post_tags(post_id,tag_id)VALUES($1,$2)ON CONFLICT DO NOTHING', [r.id, t]);
    res.json({ success: true, ...r });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Slug already exists' });
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/blog/:id', requireAdmin, async (req, res) => {
  const { title, excerpt, content, category_id, author_id, featured_image, meta_title, meta_description, status, tags = [], is_featured, faq, table_of_contents } = req.body;
  const rt = content ? Math.max(1, Math.round(content.split(/\s+/).length / 200)) : null;
  try {
    await db.query(`UPDATE blog_posts SET title=COALESCE($2,title),excerpt=COALESCE($3,excerpt),content=COALESCE($4,content),category_id=COALESCE($5,category_id),author_id=COALESCE($6,author_id),featured_image=COALESCE($7,featured_image),meta_title=COALESCE($8,meta_title),meta_description=COALESCE($9,meta_description),status=COALESCE($10,status),reading_time=COALESCE($11,reading_time),is_featured=COALESCE($12,is_featured),faq=COALESCE($13,faq),table_of_contents=COALESCE($14,table_of_contents),published_at=CASE WHEN $10='published' AND published_at IS NULL THEN NOW() ELSE published_at END,updated_at=NOW() WHERE id=$1`, [req.params.id, title ? san(title, 300) : null, excerpt ? san(excerpt, 500) : null, content || null, category_id || null, author_id || null, featured_image || null, meta_title ? san(meta_title, 300) : null, meta_description ? san(meta_description, 500) : null, status || null, rt, is_featured ?? null, faq ? JSON.stringify(faq) : null, table_of_contents || null]);
    await db.query('DELETE FROM blog_post_tags WHERE post_id=$1', [req.params.id]);
    if (tags.length) for (const t of tags) await db.query('INSERT INTO blog_post_tags(post_id,tag_id)VALUES($1,$2)ON CONFLICT DO NOTHING', [req.params.id, t]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/blog/:id', requireAdmin, async (req, res) => {
  try { await db.query('DELETE FROM blog_posts WHERE id=$1', [req.params.id]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/blog-categories', requireAdmin, async (req, res) => {
  const { name, slug, description = '', sort_order = 0 } = req.body;
  if (!name || !slug) return res.status(400).json({ error: 'name and slug required' });
  try { const r = (await db.query('INSERT INTO blog_categories(name,slug,description,sort_order)VALUES($1,$2,$3,$4)RETURNING id', [san(name, 100), san(slug, 100).toLowerCase(), san(description, 500), sort_order])).rows[0]; res.json({ success: true, ...r }); }
  catch (err) { if (err.code === '23505') return res.status(409).json({ error: 'Slug exists' }); res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/blog-tags', requireAdmin, async (req, res) => {
  const { name, slug } = req.body;
  if (!name || !slug) return res.status(400).json({ error: 'name and slug required' });
  try { const r = (await db.query('INSERT INTO blog_tags(name,slug)VALUES($1,$2)RETURNING id', [san(name, 100), san(slug, 100).toLowerCase()])).rows[0]; res.json({ success: true, ...r }); }
  catch (err) { if (err.code === '23505') return res.status(409).json({ error: 'Slug exists' }); res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/blog-authors', requireAdmin, async (req, res) => {
  const { name, slug, bio = '', avatar = '', twitter = '' } = req.body;
  if (!name || !slug) return res.status(400).json({ error: 'name and slug required' });
  try { const r = (await db.query('INSERT INTO blog_authors(name,slug,bio,avatar,twitter)VALUES($1,$2,$3,$4,$5)RETURNING id', [san(name, 100), san(slug, 100).toLowerCase(), san(bio, 1000), avatar, twitter])).rows[0]; res.json({ success: true, ...r }); }
  catch (err) { if (err.code === '23505') return res.status(409).json({ error: 'Slug exists' }); res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/messages', requireAdmin, async (req, res) => {
  const { type, limit = 50, offset = 0 } = req.query;
  try {
    const where = type ? 'WHERE type=$3' : '';
    const vals = type ? [parseInt(limit), parseInt(offset), type] : [parseInt(limit), parseInt(offset)];
    const rows = (await db.query(`SELECT * FROM contact_messages ${where} ORDER BY created_at DESC LIMIT $1 OFFSET $2`, vals)).rows;
    const total = parseInt((await db.query(`SELECT COUNT(*)as total FROM contact_messages ${where}`, type ? [type] : [])).rows[0].total);
    res.json({ data: rows, total });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/newsletter', requireAdmin, async (req, res) => {
  const { limit = 100, offset = 0 } = req.query;
  try {
    const rows = (await db.query('SELECT email,created_at FROM newsletter_subscribers ORDER BY created_at DESC LIMIT $1 OFFSET $2', [parseInt(limit), parseInt(offset)])).rows;
    const total = parseInt((await db.query('SELECT COUNT(*)as total FROM newsletter_subscribers')).rows[0].total);
    res.json({ data: rows, total });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const [mc, bc, cc, sc, tp, uc, u24, u7, u30, ur, newRegs] = await Promise.all([
      db.query('SELECT COUNT(*)as c FROM manga'),
      db.query("SELECT COUNT(*)as c FROM articles WHERE status='PUBLISHED'"),
      db.query('SELECT COUNT(*)as c FROM contact_messages'),
      db.query('SELECT COUNT(*)as c FROM newsletter_subscribers'),
      db.query("SELECT slug,title,view_count as views FROM articles WHERE status='PUBLISHED' ORDER BY view_count DESC LIMIT 10"),
      db.query('SELECT COUNT(*)as c FROM users'),
      db.query("SELECT COUNT(*)as c FROM users WHERE last_active_at >= NOW() - INTERVAL '24 hours'"),
      db.query("SELECT COUNT(*)as c FROM users WHERE last_active_at >= NOW() - INTERVAL '7 days'"),
      db.query("SELECT COUNT(*)as c FROM users WHERE last_active_at >= NOW() - INTERVAL '30 days'"),
      db.query("SELECT COUNT(*)as c FROM contact_messages WHERE type IN ('bug', 'complaint', 'dmca') AND read = false"),
      db.query("SELECT DATE(created_at) as date, COUNT(*) as count FROM users WHERE created_at >= NOW() - INTERVAL '30 days' GROUP BY DATE(created_at) ORDER BY DATE(created_at) ASC")
    ]);
    res.json({
      data: {
        manga: parseInt(mc.rows[0].c),
        blog_posts: parseInt(bc.rows[0].c),
        messages: parseInt(cc.rows[0].c),
        subscribers: parseInt(sc.rows[0].c),
        top_posts: tp.rows,
        total_users: parseInt(uc.rows[0].c),
        active_users_24h: parseInt(u24.rows[0].c),
        active_users_7d: parseInt(u7.rows[0].c),
        active_users_30d: parseInt(u30.rows[0].c),
        reported_issues: parseInt(ur.rows[0].c),
        new_registrations: newRegs.rows.map(r => ({ date: r.date ? r.date.toISOString().split('T')[0] : '', count: parseInt(r.count) }))
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── AUTH ENDPOINTS ─────────────────────────────────────────────────────────────
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email and password are required' });
    }
    const password_hash = await bcrypt.hash(password, 10);
    const result = await db.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, is_vip',
      [username, email, password_hash]
    );
    res.status(201).json({ success: true, user: result.rows[0] });
  } catch (err) {
    if (err.message.includes('unique constraint') || err.message.includes('duplicate key')) {
      res.status(400).json({ error: 'Username or email already exists' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const result = await db.query(
      'SELECT id, username, email, is_vip, password_hash FROM users WHERE email = $1',
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const match = await bcrypt.compare(password, result.rows[0].password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    await db.query('UPDATE users SET last_active_at = CURRENT_TIMESTAMP WHERE id = $1', [result.rows[0].id]);
    const user = {
      id: result.rows[0].id,
      username: result.rows[0].username,
      email: result.rows[0].email,
      is_vip: result.rows[0].is_vip
    };
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── SYSTEM SETTINGS & MAINTENANCE ────────────────────────────────────────────────
app.get('/api/settings/maintenance', async (req, res) => {
  try {
    const result = await db.query("SELECT value FROM site_settings WHERE key = 'maintenance_mode'");
    const maintenanceMode = result.rows.length > 0 && result.rows[0].value === 'true';
    res.json({ maintenanceMode });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/settings/maintenance', requireAdmin, async (req, res) => {
  try {
    const { value } = req.body;
    if (value === undefined || (value !== 'true' && value !== 'false')) {
      return res.status(400).json({ error: "Value must be 'true' or 'false'" });
    }
    await db.query("UPDATE site_settings SET value = $1 WHERE key = 'maintenance_mode'", [value]);
    res.json({ success: true, maintenanceMode: value === 'true' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── USER MANAGEMENT (ADMIN) ─────────────────────────────────────────────────────
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT id, username, email, is_vip, created_at, last_active_at FROM users ORDER BY created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/users/:id/vip', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_vip } = req.body;
    if (is_vip === undefined) {
      return res.status(400).json({ error: 'is_vip field is required' });
    }
    await db.query('UPDATE users SET is_vip = $1 WHERE id = $2', [is_vip, id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── MESSAGES / ISSUES MANAGEMENT (ADMIN) ────────────────────────────────────────
app.put('/api/admin/messages/:id/resolve', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('UPDATE contact_messages SET read = true WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── SITEMAP ────────────────────────────────────────────────────────────────────
app.get('/api/sitemap/blog', async (req, res) => {
  try {
    const posts = (await db.query("SELECT slug,updated_at,published_at FROM blog_posts WHERE status='published' ORDER BY published_at DESC")).rows;
    const base = process.env.SITE_URL || 'https://mangareader.app';
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${posts.map(p => `  <url>\n    <loc>${base}/blog/${p.slug}</loc>\n    <lastmod>${(p.updated_at || p.published_at || new Date()).toISOString().split('T')[0]}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`).join('\n')}\n</urlset>`;
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => { console.error('[Error]', err.message); res.status(500).json({ error: 'Internal error' }); });

app.listen(PORT, () => {
  console.log(`\n🚀 Manga Reader API on http://localhost:${PORT}`);
  console.log(`📚 Sources: ${Object.keys(SOURCE_SCRAPERS).join(', ')}`);
});

process.on('unhandledRejection', (r) => console.error('[UnhandledRejection]', r?.message || r));
process.on('uncaughtException', (e) => console.error('[UncaughtException]', e.message));
module.exports = app;

module.exports = { performSearch };
