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

export function proxyImage(url, width = null, quality = null) {
  if (!url) return "";
  if (url.startsWith('/') || url.startsWith('data:')) return url;

  const isAniList = ANILIST_IMAGE_DOMAINS.some(d => url.includes(d));
  if (isAniList) return url;

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
    const src = match[1];
    if (src && !src.includes('sprite') && !src.includes('logo') && !src.includes('banner')) {
      images.push(src);
    }
  }

  if (images.length === 0) {
    const scriptMatch = html.match(/var\s+ytaw\s*=\s*(\[[^\]]+\])/);
    if (scriptMatch) {
      try {
        const rawUrls = JSON.parse(scriptMatch[1]);
        images.push(...rawUrls);
      } catch {}
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
