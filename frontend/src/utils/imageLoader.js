export default function myImageLoader({ src, width, quality }) {
  if (src.startsWith('/')) return src;

  const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || "";
  if (WORKER_URL && src.startsWith(WORKER_URL)) return src;

  if (src.includes('/img-proxy?') || src.includes('/api/proxy-image?')) return src;

  let actualUrl = src;
  let maxWidth = width;
  let extraParams = '';

  try {
    const urlObj = new URL(src);
    if (urlObj.pathname === '/api/proxy-image') {
      actualUrl = urlObj.searchParams.get('url') || src;
      const proxyW = urlObj.searchParams.get('w');
      if (proxyW) maxWidth = Math.min(width, parseInt(proxyW));
      const proxyQ = urlObj.searchParams.get('q');
      if (proxyQ) extraParams += `&q=${proxyQ}`;
    }
  } catch (e) {
    // If it's not a valid URL (e.g. relative path), keep it
  }

  const API_BASE = process.env.NEXT_PUBLIC_SCRAPER_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  return `${API_BASE}/api/proxy-image?url=${encodeURIComponent(actualUrl)}&w=${maxWidth}${extraParams}`;
}
