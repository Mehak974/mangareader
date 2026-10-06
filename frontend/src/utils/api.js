/**
 * api.js — central API helper
 *
 * Use API_BASE for client-side fetch calls to the Express scraper backend.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_SCRAPER_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3001";

// Image/scraper host. Deliberately NOT falling back to NEXT_PUBLIC_SCRAPER_URL:
// that is the Express backend, which serves /api/proxy-image and has no
// /img-proxy at all. With the old fallback, an unset NEXT_PUBLIC_WORKER_URL
// built `${BACKEND}/img-proxy?...`, which 404s every image on the site.
// With no value here, proxyImage() drops through to the backend's
// /api/proxy-image, which does exist.
const formatUrl = (urlStr) => {
  if (!urlStr) return "";
  let trimmed = urlStr.trim().replace(/\/$/, "");
  if (!trimmed) return "";
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }
  return trimmed;
};

export const WORKER_URL = formatUrl(process.env.NEXT_PUBLIC_WORKER_URL) || "https://cdn.mangareader.pro";

export function isWorkerAvailable() {
  if (!WORKER_URL) return false;
  try {
    new URL(WORKER_URL);
    return true;
  } catch {
    return false;
  }
}

const ANILIST_IMAGE_DOMAINS = ['anilist.co', 's4.anilist.co', 's5.anilist.co'];

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.bmp', '.svg'];
const SKIP_DOMAINS = ['yandex.ru', 'yandex.com', 'google-analytics.com', 'doubleclick.net', 'googletagmanager.com', 'hotjar.com', 'cloudflareinsights.com', 'cloudflare-analytics.com'];

export function proxyImage(url, width = null, quality = null) {
  if (!url) return "";
  if (url.startsWith('/') || url.startsWith('data:')) return url;

  const cleanUrl = url.split('#')[0];

  if (WORKER_URL && cleanUrl.startsWith(WORKER_URL)) return url;
  if (cleanUrl.includes('/img-proxy?')) return url;
  if (cleanUrl.includes('/api/proxy-image?')) return url;

  const isAniList = ANILIST_IMAGE_DOMAINS.some(d => cleanUrl.includes(d));
  if (isAniList) return url;

  const isSkipped = SKIP_DOMAINS.some(d => cleanUrl.includes(d));
  if (isSkipped) return url;

  const isImageExt = IMAGE_EXTENSIONS.some(ext => cleanUrl.toLowerCase().includes(ext));
  const isKnownImageDomain = ['mkklcdnv', '2xstorage', 'mangakatana', 'xfs', 'uploads', 'media.mangaka', 'anilist.co', 'waitst'].some(d => cleanUrl.includes(d));
  if (!isImageExt && !isKnownImageDomain) return url;

  const isBypassWorkerImage = ['mangakatana', 'mkklcdnv', 'xfs'].some(d => cleanUrl.includes(d)) && !ANILIST_IMAGE_DOMAINS.some(d => cleanUrl.includes(d));
  if (isBypassWorkerImage) {
    let target = `${API_BASE}/api/proxy-image?url=${encodeURIComponent(cleanUrl)}`;
    if (width) target += `&w=${width}`;
    if (quality) target += `&q=${quality}`;
    return target;
  }

  if (isWorkerAvailable()) {
    return `${buildWorkerUrl('/img-proxy')}?url=${encodeURIComponent(cleanUrl)}`;
  }

  let target = `${API_BASE}/api/proxy-image?url=${encodeURIComponent(cleanUrl)}`;
  if (width) target += `&w=${width}`;
  if (quality) target += `&q=${quality}`;
  return target;
}

const WORKER_SOURCE_MAP = {
  manganato: '/api/manganato',
  mangakatana: '/api/mangakatana',
  mangaread: '/api/mangaread',
  mdr: '/api/mangaread',
};

function getWorkerSourceRoute(source, url) {
  if (!source) source = url.includes('mangakatana') ? 'mangakatana' : url.includes('manganato') ? 'manganato' : url.includes('mangaread') ? 'mangaread' : 'manganato';
  return WORKER_SOURCE_MAP[source] || '/api/manganato';
}

function buildWorkerUrl(route) {
  const base = (WORKER_URL || '').replace(/\/$/, '');
  const path = route.startsWith('/') ? route : `/${route}`;
  return `${base}${path}`;
}

export async function fetchChapterImagesThroughWorker(url, source) {
  // Mangakatana: JS-loaded images — route through the backend's scraper
  // (Consumet API + DOM fallback), not the Worker's static HTML extraction.
  const bypassWorker = source === 'mangakatana' || url.includes('mangakatana');

  if (bypassWorker) {
    const res = await fetch(`${API_BASE}/api/chapter/images?url=${encodeURIComponent(url)}&source=${source || ''}`);
    if (!res.ok) throw new Error(`Failed to fetch chapter images: ${res.status}`);
    return res.json();
  }

  // If the worker URL is not configured or is unreachable, fall back to the
  // backend scraper directly. This handles the case where NEXT_PUBLIC_WORKER_URL
  // points to a domain that doesn't resolve (e.g. cdn.mangareader.pro in an
  // environment without DNS for it) — the fetch would throw a TypeError, and
  // without this guard every reader page would show mock panels.
  const isWorkerUnreachable = !WORKER_URL;

  if (isWorkerUnreachable) {
    const fallbackRes = await fetch(`${API_BASE}/api/chapter/images?url=${encodeURIComponent(url)}&source=${source || ''}`);
    if (!fallbackRes.ok) throw new Error(`Failed to fetch chapter images: ${fallbackRes.status}`);
    return fallbackRes.json();
  }

  const workerRoute = getWorkerSourceRoute(source, url);
  const workerUrl = `${buildWorkerUrl(workerRoute)}?url=${encodeURIComponent(url)}`;

  let res;
  try {
    res = await fetch(workerUrl);
  } catch (fetchErr) {
    // DNS failure, connection refused, timeout, etc. — the worker host is
    // unreachable from this network. Fall back to the backend scraper.
    console.warn(`Worker unreachable (${fetchErr.message}), falling back to backend proxy`);
    const fallbackRes = await fetch(`${API_BASE}/api/chapter/images?url=${encodeURIComponent(url)}&source=${source || ''}`);
    if (!fallbackRes.ok) throw new Error(`Failed to fetch chapter images: ${fallbackRes.status}`);
    return fallbackRes.json();
  }

  // Fallback to backend proxy on worker 5xx errors
  if (res.status >= 500 && res.status < 600) {
    console.warn(`Worker returned ${res.status}, falling back to backend proxy`);
    const fallbackRes = await fetch(`${API_BASE}/api/chapter/images?url=${encodeURIComponent(url)}&source=${source || ''}`);
    if (!fallbackRes.ok) throw new Error(`Failed to fetch chapter images: ${fallbackRes.status}`);
    return fallbackRes.json();
  }

  if (!res.ok) {
    throw new Error(`Failed to fetch chapter images: ${res.status}`);
  }

  const result = await res.json();
  const html = result.html || '';
  const images = [];

  const SKIP_DOMAINS = ['gravatar.com', 's.w.org', 'wp-includes/images/smilies', 'emoji', 'avatar'];
  const SKIP_PATTERNS = ['sprite', 'logo', 'banner', 'analytics', 'adskeeper', 'doubleclick', 'gravatar', 'emoji', 'smilies', 'wp-emoji', 'avatar'];

  function shouldSkip(src) {
    if (!src) return true;
    const lower = src.toLowerCase();
    if (SKIP_DOMAINS.some(d => lower.includes(d))) return true;
    if (SKIP_PATTERNS.some(p => lower.includes(p))) return true;
    return false;
  }

  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1].trim();
    if (src && !shouldSkip(src)) {
      images.push(src);
    }
  }

  if (images.length === 0) {
    const cdnMatch = html.match(/(?:var|const|let)\s+cdns\s*=\s*\["([^"]+)"/i) || html.match(/cdns\s*=\s*\["([^"]+)"/i);
    const rawCdn = cdnMatch ? cdnMatch[1].replace(/\\/g, '') : '';
    const cdnBase = rawCdn ? (rawCdn.endsWith('/') ? rawCdn : rawCdn + '/') : '';

    const varNames = ['chapterImages', 'chapter_images', 'ytaw', 'thzq', 'reader_data', 'image_list'];
    for (const varName of varNames) {
      const scriptMatch = html.match(new RegExp(`(?:var|const|let|window\\.)\\s*${varName}\\s*=\\s*(\\[[^\\]]+\\])`, 'i'));
      if (scriptMatch) {
        try {
          const rawStr = scriptMatch[1].replace(/'/g, '"').replace(/,\s*]/, ']');
          const rawUrls = JSON.parse(rawStr);
          for (const u of rawUrls) {
            if (u && typeof u === 'string' && !shouldSkip(u)) {
              const cleanPath = u.replace(/\\/g, '').replace(/^\/+/, '');
              const fullUrl = (/^https?:\/\//i.test(cleanPath)) ? cleanPath : (cdnBase ? `${cdnBase}${cleanPath}` : cleanPath);
              images.push(fullUrl);
            }
          }
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
      if (!shouldSkip(src)) {
        images.push(src);
      }
    }
  }

  if (images.length === 0) {
    const directImgRegex = /https?:\/\/[^\s"'<>]+manga_[a-f0-9]+\/[a-f0-9]+\/\d+\.(webp|jpg|jpeg|png)/gi;
    let directMatch;
    while ((directMatch = directImgRegex.exec(html)) !== null) {
      const src = directMatch[0].trim();
      if (!shouldSkip(src)) {
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
