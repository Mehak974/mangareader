/**
 * clientImages.js — fetch chapter images from the browser with CORS proxy fallback + caching.
 */

import { clientFetchHTML } from './clientProxy';

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getCacheKey(url) {
  return `images_${url.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
}

function getCached(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function setCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // localStorage full or unavailable
  }
}

function isValidImage(src) {
  if (!src || src.startsWith('data:')) return false;
  if (/\.svg(\?|$)/i.test(src)) return false;
  return /^https?:\/\/.+\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(src) ||
    (src.startsWith('https://') && src.length > 30 && !src.includes(' ') && !src.includes('.svg'));
}

const CHAPTER_SELECTORS = [
  '.container-chapter-reader img',
  '.chapter-content img',
  '.chapter-images img',
  '.reader-content img',
  '.reading-content img',
  '#chapter-content img',
  '#chapter img',
  '.chapter-img img',
  '.page-chapter img',
  '.manga-page img',
  '.pages img',
  'article img',
  '.content img[src*="/manga/"]',
  '.content img[src*="/chapter/"]',
  'img[data-src]',
  'img[data-lazy-src]',
  'img[data-original]',
];

function extractImagesFromHTML(html, source) {
  const images = [];
  const doc = new DOMParser().parseFromString(html, 'text/html');

  for (const selector of CHAPTER_SELECTORS) {
    const found = [];
    const imgElements = doc.querySelectorAll(selector);
    for (const el of imgElements) {
      const src = el.getAttribute('data-src') || el.getAttribute('data-lazy-src') ||
        el.getAttribute('data-original') || el.getAttribute('src') || '';
      if (src && isValidImage(src) && !isThumbnailOrIcon(src)) {
        found.push(src.trim());
      }
    }
    if (found.length >= 3) {
      return [...new Set(found)];
    }
  }

  // Try embedded JSON arrays
  const scriptRegex = /var\s+\w+\s*=\s*(\[.*?\]);/gs;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const arr = JSON.parse(match[1]);
      if (Array.isArray(arr)) {
        const urls = findImageArrays(arr);
        if (urls.length >= 3) {
          return urls.filter(isValidImage);
        }
      }
    } catch {
      // ignore
    }
  }

  return images;
}

function isThumbnailOrIcon(src) {
  return /(?:logo|icon|banner|avatar|thumb|ads?|sprite|button|\.svg)/i.test(src) ||
    /[_-](?:16|24|32|48|64|96|100|120)x/i.test(src);
}

function findImageArrays(obj) {
  const results = [];
  if (Array.isArray(obj)) {
    const strings = obj.filter(item => typeof item === 'string' && isValidImage(item));
    if (strings.length > 0) results.push(...strings);
    for (const item of obj) {
      if (typeof item === 'object' && item !== null) {
        results.push(...findImageArrays(item));
      }
    }
  } else if (typeof obj === 'object' && obj !== null) {
    for (const val of Object.values(obj)) {
      results.push(...findImageArrays(val));
    }
  }
  return results;
}

export async function fetchChapterImagesClient(url, source) {
  const cacheKey = getCacheKey(url);
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const html = await clientFetchHTML(url, {
      'X-Requested-With': 'XMLHttpRequest',
    });

    const images = extractImagesFromHTML(html, source);

    if (images.length > 0) {
      setCache(cacheKey, images);
    }

    return images;
  } catch (err) {
    console.warn('Client image fetch failed:', err.message);
    return [];
  }
}
