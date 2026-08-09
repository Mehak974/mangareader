export default function myImageLoader({ src, width, quality }) {
  if (src.startsWith('/')) return src; // local images

  // If the src is already wrapped by proxyImage, unwrap it
  let actualUrl = src;
  try {
    const urlObj = new URL(src);
    if (urlObj.pathname === '/api/proxy-image') {
      actualUrl = urlObj.searchParams.get('url') || src;
    }
  } catch (e) {
    // If it's not a valid URL (e.g. relative path), keep it
  }

  // Ensure it goes through our proxy with the requested Next.js width
  // Our proxy supports the 'w' query parameter to resize using sharp.
  const API_BASE = process.env.NEXT_PUBLIC_SCRAPER_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  return `${API_BASE}/api/proxy-image?url=${encodeURIComponent(actualUrl)}&w=${width}`;
}
