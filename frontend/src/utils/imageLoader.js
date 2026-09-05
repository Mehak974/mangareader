export default function myImageLoader({ src, width, quality }) {
  if (src.startsWith('/')) return src;

  const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || "";
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

  if (WORKER_URL) {
    return `${WORKER_URL}/img-proxy?url=${encodeURIComponent(actualUrl)}`;
  }

  const API_BASE = process.env.NEXT_PUBLIC_SCRAPER_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  return `${API_BASE}/api/proxy-image?url=${encodeURIComponent(actualUrl)}&w=${width}${quality ? `&q=${quality}` : ''}`;
}
