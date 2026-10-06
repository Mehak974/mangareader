import { isWorkerAvailable, WORKER_URL, API_BASE } from './api';

export default function myImageLoader({ src, width, quality }) {
  if (src.startsWith('/')) return src;

  if (WORKER_URL && src.startsWith(WORKER_URL)) return src;

  if (src.includes('/img-proxy?') || src.includes('/api/proxy-image?')) return src;

  const ANILIST_DOMAINS = ['anilist.co', 's4.anilist.co', 's5.anilist.co'];
  if (ANILIST_DOMAINS.some(d => src.includes(d))) return src;

  const TRACKING_DOMAINS = ['yandex.ru', 'yandex.com', 'google-analytics.com', 'doubleclick.net', 'googletagmanager.com', 'hotjar.com', 'cloudflareinsights.com', 'cloudflare-analytics.com'];
  if (TRACKING_DOMAINS.some(d => src.includes(d))) return src;

  let actualUrl = src;

  try {
    const urlObj = new URL(src);
    if (urlObj.pathname === '/api/proxy-image') {
      actualUrl = urlObj.searchParams.get('url') || src;
    }
  } catch (e) {
    // If it's not a valid URL (e.g. relative path), keep it
  }

  const isBypassWorkerImage = ['mangakatana', 'mkklcdnv', 'xfs'].some(d => actualUrl.includes(d));
  if (isBypassWorkerImage) {
    return `${API_BASE}/api/proxy-image?url=${encodeURIComponent(actualUrl)}&w=${width}${quality ? `&q=${quality}` : ''}`;
  }

  if (isWorkerAvailable()) {
    return `${WORKER_URL}/img-proxy?url=${encodeURIComponent(actualUrl)}`;
  }

  return `${API_BASE}/api/proxy-image?url=${encodeURIComponent(actualUrl)}&w=${width}${quality ? `&q=${quality}` : ''}`;
}
