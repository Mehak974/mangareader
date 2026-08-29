/**
 * api.js — central API helper
 *
 * Use API_BASE for client-side fetch calls to the Express scraper backend.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_SCRAPER_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3001";

export const WORKER_URL =
  process.env.NEXT_PUBLIC_WORKER_URL ||
  process.env.NEXT_PUBLIC_SCRAPER_URL ||
  "";

const ANILIST_IMAGE_DOMAINS = ['anilist.co', 's4.anilist.co', 's5.anilist.co'];

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.bmp', '.svg'];
const SKIP_DOMAINS = ['yandex.ru', 'yandex.com', 'google-analytics.com', 'doubleclick.net', 'googletagmanager.com', 'hotjar.com', 'cloudflareinsights.com', 'cloudflare-analytics.com'];

export function proxyImage(url, width = null, quality = null) {
  if (!url) return "";
  if (url.startsWith('/') || url.startsWith('data:')) return url;

  if (WORKER_URL && url.startsWith(WORKER_URL)) return url;
  if (url.includes('/img-proxy?')) return url;
  if (url.includes('/api/proxy-image?')) return url;

  const isAniList = ANILIST_IMAGE_DOMAINS.some(d => url.includes(d));
  if (isAniList) return url;

  const isSkipped = SKIP_DOMAINS.some(d => url.includes(d));
  if (isSkipped) return url;

  const isImageExt = IMAGE_EXTENSIONS.some(ext => url.toLowerCase().includes(ext));
  const isKnownImageDomain = ['mkklcdnv', '2xstorage', 'mangadex', 'mangakatana', 'xfs', 'uploads', 'media.mangaka', 'anilist.co'].some(d => url.includes(d));
  if (!isImageExt && !isKnownImageDomain) return url;

  if (WORKER_URL) {
    return `${WORKER_URL}/img-proxy?url=${encodeURIComponent(url)}`;
  }

  let target = `${API_BASE}/api/proxy-image?url=${encodeURIComponent(url)}`;
  if (width) target += `&w=${width}`;
  if (quality) target += `&q=${quality}`;
  return target;
}

const WORKER_SOURCE_MAP = {
  manganato: '/api/manganato',
  mangakatana: '/api/mangakatana',
  mangaread: '/api/mangaread',
  mdr: '/api/mangaread',
  mangadex: '/api/mangadex',
};

function getWorkerSourceRoute(source, url) {
  if (!source) source = url.includes('mangakatana') ? 'mangakatana' : url.includes('manganato') ? 'manganato' : url.includes('mangaread') ? 'mangaread' : 'manganato';
  return WORKER_SOURCE_MAP[source] || '/api/manganato';
}

export async function fetchChapterImagesThroughWorker(url, source) {
  if (!WORKER_URL) {
    const res = await fetch(`${API_BASE}/api/chapter/images?url=${encodeURIComponent(url)}&source=${source || ''}`);
    if (!res.ok) throw new Error(`Failed to fetch chapter images: ${res.status}`);
    return res.json();
  }

  // MangaDex: use official API with chapter ID extracted from URL
  if (source === 'mangadex' || url.includes('mangadex.org/chapter/')) {
    const chapterId = url.match(/mangadex\.org\/chapter\/([0-9a-f-]+)/)?.[1];
    if (chapterId) {
      const workerUrl = `${WORKER_URL}/api/mangadex/at-home/server/${chapterId}`;
      const res = await fetch(workerUrl);
      if (!res.ok) throw new Error(`MangaDex API error: ${res.status}`);
      const data = await res.json();
      const baseUrl = data.baseUrl;
      const hash = data.chapter?.hash;
      const pages = data.chapter?.data || [];
      const images = pages.map(p => `${baseUrl}/data/${hash}/${p}`);
      return {
        data: { images: images.map(img => proxyImage(img)), source: 'mangadex' },
        cached: false,
      };
    }
  }

  const workerRoute = getWorkerSourceRoute(source, url);
  const workerUrl = `${WORKER_URL}${workerRoute}?url=${encodeURIComponent(url)}`;
  const res = await fetch(workerUrl);

  if (!res.ok) {
    const fallbackRes = await fetch(`${API_BASE}/api/chapter/images?url=${encodeURIComponent(url)}&source=${source || ''}`);
    if (!fallbackRes.ok) throw new Error(`Failed to fetch chapter images: ${fallbackRes.status}`);
    return fallbackRes.json();
  }

  const result = await res.json();
  const html = result.html || '';
  const images = [];

  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1].trim();
    if (src && !src.includes('sprite') && !src.includes('logo') && !src.includes('banner')) {
      images.push(src);
    }
  }

  if (images.length === 0) {
    const varNames = ['ytaw', 'thzq', 'reader_data', 'chapter_images', 'image_list'];
    for (const varName of varNames) {
      const scriptMatch = html.match(new RegExp(`var\\s+${varName}\\s*=\\s*(\\[[^\\]]+\\])`));
      if (scriptMatch) {
        try {
          const rawStr = scriptMatch[1].replace(/'/g, '"').replace(/,\s*]/, ']');
          const rawUrls = JSON.parse(rawStr);
          images.push(...rawUrls.filter(u => u && typeof u === 'string'));
        } catch {}
      }
      if (images.length > 0) break;
    }
  }

  if (images.length === 0) {
    const urlRegex = /https?:\/\/[^\s"'<>]+\.(jpg|jpeg|png|webp|gif|bmp|avif)/gi;
    let urlMatch;
    while ((urlMatch = urlRegex.exec(html)) !== null) {
      const src = urlMatch[0].trim();
      if (!src.includes('sprite') && !src.includes('logo') && !src.includes('banner') && !src.includes('analytics') && !src.includes('adskeeper') && !src.includes('doubleclick')) {
        images.push(src);
      }
    }
  }

  if (images.length === 0) {
    throw new Error('No images found in chapter');
  }

  return {
    data: { images: images.map(img => proxyImage(img)), source: 'worker' },
    cached: false,
  };
}

let csrfToken = null;

export async function fetchHomeSection(sectionKey) {
  const res = await fetch(`${API_BASE}/api/home/sections/${encodeURIComponent(sectionKey)}`, {
    headers: { Accept: 'application/json' },
    credentials: 'omit',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch home section ${sectionKey}: ${res.status} - ${text}`);
  }
  return res.json();
}

export async function fetchApi(endpoint, options = {}) {
  // Fetch CSRF token if not loaded
  if (!csrfToken && ['POST', 'PUT', 'DELETE'].includes(options.method)) {
    try {
      const res = await fetch(`${API_BASE}/api/csrf-token`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        csrfToken = data.csrfToken;
      }
    } catch (err) {
      console.warn("Failed to fetch CSRF token", err);
    }
  }

  const headers = new Headers(options.headers || {});
  if (csrfToken && ['POST', 'PUT', 'DELETE'].includes(options.method)) {
    headers.set('X-CSRF-Token', csrfToken);
  }

  // Include credentials for CSRF cookies
  return fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });
}
