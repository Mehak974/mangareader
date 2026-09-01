const crypto = require('crypto');
const db = require('../db');
const cheerio = require('cheerio');
const { fetchHTML } = require('../extractors/universalExtractor');

function san(str, max = 500) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').replace(/[<>\\]/g, '').trim().slice(0, max);
}

function isValidUrl(str) {
  try { const u = new URL(str); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
}

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

function detectSource(url) {
  const h = new URL(url).hostname;
  if (h === 'www.mangaread.org' || h === 'mangaread.org') return 'mangaread';
  if (h === 'mangadex.org') return 'mangadex';
  if (h === 'mangakatana.com') return 'mangakatana';
  if (h === 'www.manganato.gg' || h === 'manganato.gg') return 'manganato';
  if (h === 'www.mangakakalot.gg' || h === 'mangakakalot.gg') return 'manganato';
  return null;
}

module.exports = {
  san, isValidUrl, isPrivateIP, getAlternativeTitles, isGoodMatch,
  checkDirectRedirect, verifyRedirectLink, detectSource
};
