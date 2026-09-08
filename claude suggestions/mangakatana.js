/**
 * lib/sources/mangakatana.js
 *
 * BUGS FIXED:
 *   1. src="#" placeholder images were passed to proxy → now filtered
 *   2. JSON.parse failed on single-quoted JS arrays (JS ≠ JSON) → fixed
 *   3. Protocol-relative URLs (//xfs...) weren't prefixed → fixed
 *   4. Variable name changes (ytaw → wtu etc) → now catches ANY js array
 *
 * Extraction priority:
 *   1. Any JS array variable with image URLs  (most reliable)
 *   2. data-src lazy-loading attributes       (skip src="#")
 *   3. Full-HTML URL scan                     (last resort)
 */

const WORKER = process.env.WORKER_URL;

function proxyImageUrl(url) {
  if (!url || url === '#') return null;
  const abs = url.startsWith('//') ? 'https:' + url : url;
  if (!/^https?:\/\//.test(abs)) return null;
  return `${WORKER}/img-proxy?url=${encodeURIComponent(abs)}`;
}

/**
 * Extract chapter page image URLs from MangaKatana HTML.
 * Handles all known structural patterns.
 * Returns proxied URLs only — never returns "#" or empty strings.
 */
export function parseMangaKatanaImages(html) {
  // ── Method 1: JS array variable (var ytaw / var wtu / etc.) ────────────────
  // MangaKatana embeds images in a JS array with single quotes.
  // Single-quoted JS arrays are NOT valid JSON — must replace quotes first.
  const jsArrayRx = /var\s+\w+\s*=\s*(\[['"][^[\]]+['"]\])/g;
  let m;
  while ((m = jsArrayRx.exec(html)) !== null) {
    try {
      const asJson = m[1].replace(/'/g, '"'); // JS single → JSON double quotes
      const urls = JSON.parse(asJson);
      const imgs = urls
        .map(u => (u.startsWith('//') ? 'https:' + u : u))  // fix protocol-relative
        .filter(u => /^https?:\/\//i.test(u) && /\.(jpg|jpeg|png|webp|gif)/i.test(u));
      if (imgs.length > 0) {
        return { urls: imgs.map(proxyImageUrl).filter(Boolean), method: 'js-array' };
      }
    } catch {}
  }

  // ── Method 2: data-src lazy loading (src="#" is always the placeholder) ─────
  // MangaKatana sets src="#" on img tags and fills data-src with the real URL.
  // We read data-src and completely ignore src (which is always "#").
  const dataSrcs = [...html.matchAll(/data-src="([^"#][^"]*)"/g)]
    .map(m => m[1].trim())
    .map(u => u.startsWith('//') ? 'https:' + u : u)
    .filter(u => /^https?:\/\//i.test(u) && /\.(jpg|jpeg|png|webp|gif)/i.test(u));
  if (dataSrcs.length > 0) {
    return { urls: dataSrcs.map(proxyImageUrl).filter(Boolean), method: 'data-src' };
  }

  // ── Method 3: Full HTML scan for image URLs ──────────────────────────────────
  const allImgs = [...html.matchAll(/https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp|gif)[^\s"'<>]*/gi)]
    .map(m => m[0])
    .filter(u => u.includes('xfs.') || u.includes('mangakatana'));
  const unique = [...new Set(allImgs)];
  if (unique.length > 0) {
    return { urls: unique.map(proxyImageUrl).filter(Boolean), method: 'scan' };
  }

  return { urls: [], method: 'failed' };
}

/**
 * Fetch chapter pages from MangaKatana.
 * All 3 extraction methods attempted in order.
 */
export async function mangakatanaPages(chapterUrl) {
  const MEM = globalThis.__mktCache ?? (globalThis.__mktCache = new Map());
  const ck = 'mkt:' + chapterUrl;
  const cached = MEM.get(ck);
  if (cached && Date.now() < cached.exp) return cached.pages;

  const res = await fetch(`${WORKER}/api/mangakatana?url=${encodeURIComponent(chapterUrl)}`);
  if (!res.ok) throw new Error(`Worker returned ${res.status} for MangaKatana`);

  const { html } = await res.json();
  if (!html) throw new Error('Empty HTML from MangaKatana');

  const { urls, method } = parseMangaKatanaImages(html);
  console.info(`[MangaKatana] ${urls.length} pages via ${method} — ${chapterUrl}`);

  if (urls.length === 0) throw new Error('MangaKatana: no images found in page');

  MEM.set(ck, { pages: urls, exp: Date.now() + 86400_000 }); // 24h
  return urls;
}
