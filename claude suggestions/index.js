/**
 * lib/sources/index.js
 * Unified source router — all sources, caching, fallback.
 */

import { mangakatanaPages } from './mangakatana.js';
export { mangakatanaPages };

const WORKER = process.env.WORKER_URL;
const MEM    = new Map();

function memGet(key) {
  const e = MEM.get(key);
  if (!e) return null;
  if (Date.now() > e.exp) { MEM.delete(key); return null; }
  return e.val;
}
function memSet(key, val, ttlMs) {
  if (MEM.size > 500) MEM.delete(MEM.keys().next().value);
  MEM.set(key, { val, exp: Date.now() + ttlMs });
}

// ── Image proxy helper ────────────────────────────────────────────────────────
export function proxyImageUrl(url) {
  if (!url || url === '#' || url.startsWith('data:')) return '/placeholder.png';
  const abs = url.startsWith('//') ? 'https:' + url : url;
  if (!/^https?:\/\//i.test(abs)) return '/placeholder.png';
  if (abs.startsWith(WORKER)) return abs;
  return `${WORKER}/img-proxy?url=${encodeURIComponent(abs)}`;
}
export const proxyChapterPages = (pages = []) =>
  pages.map(proxyImageUrl).filter(u => u !== '/placeholder.png');

// ── AniList ───────────────────────────────────────────────────────────────────
export async function anilistQuery(query, variables = {}) {
  const ck = `al:${JSON.stringify({ query, variables })}`;
  const hit = memGet(ck);
  if (hit) return hit;

  const res = await fetch(`${WORKER}/api/anilist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error(`AniList ${res.status}`);
  const data = await res.json();
  memSet(ck, data, 24 * 3600 * 1000);
  return data;
}

export const getMangaById = (id) => anilistQuery(`
  query ($id: Int) {
    Media(id: $id, type: MANGA) {
      id siteUrl status format chapters
      title { romaji english native userPreferred }
      description(asHtml: false)
      coverImage { extraLarge large medium }
      bannerImage genres tags { name }
      averageScore popularity
      startDate { year month day }
      endDate   { year month day }
    }
  }`, { id });

export const getMangaByTitle = (search) => anilistQuery(`
  query ($search: String) {
    Media(search: $search, type: MANGA, sort: SEARCH_MATCH) {
      id siteUrl status format chapters
      title { romaji english native userPreferred }
      description(asHtml: false)
      coverImage { extraLarge large medium }
      genres averageScore popularity
    }
  }`, { search });

// ── MangaDex ──────────────────────────────────────────────────────────────────
export async function mdChapterPages(chapterId) {
  const ck = `md-pages:${chapterId}`;
  const hit = memGet(ck);
  if (hit) return hit;

  const res = await fetch(`${WORKER}/api/mangadex/at-home/server/${chapterId}`, {
    next: { revalidate: 3600 },
  });
  const data = await res.json();
  const { baseUrl, chapter: { hash, data: pages, dataSaver } } = data;

  const result = {
    pages:     proxyChapterPages(pages.map(p => `${baseUrl}/data/${hash}/${p}`)),
    dataSaver: proxyChapterPages((dataSaver || []).map(p => `${baseUrl}/data-saver/${hash}/${p}`)),
  };
  memSet(ck, result, 3600 * 1000);
  return result;
}

// ── Manganato ─────────────────────────────────────────────────────────────────
export async function manganatoPages(chapterUrl) {
  const ck = `mnt:${chapterUrl}`;
  const hit = memGet(ck);
  if (hit) return hit;

  const res = await fetch(`${WORKER}/api/manganato?url=${encodeURIComponent(chapterUrl)}`, {
    next: { revalidate: 86400 },
  });
  const { html } = await res.json();

  const pages = [...html.matchAll(/class="container-chapter-reader"[\s\S]*?<img[^>]+src="([^"#][^"]*)"/g)]
    .map(m => m[1])
    .filter(u => /^https?:\/\//i.test(u));

  const proxied = proxyChapterPages(pages);
  memSet(ck, proxied, 24 * 3600 * 1000);
  return proxied;
}

// ── MangaRead ─────────────────────────────────────────────────────────────────
export async function mangareadPages(chapterUrl) {
  const ck = `mr:${chapterUrl}`;
  const hit = memGet(ck);
  if (hit) return hit;

  const res = await fetch(`${WORKER}/api/mangaread?url=${encodeURIComponent(chapterUrl)}`, {
    next: { revalidate: 86400 },
  });
  const { html } = await res.json();

  const pages = [...html.matchAll(/data-src="([^"#][^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/gi)]
    .map(m => m[1])
    .concat(
      [...html.matchAll(/class="[^"]*wp-manga-chapter-img[^"]*"[^>]+src="([^"#][^"]*)"/gi)].map(m => m[1])
    )
    .filter(u => /^https?:\/\//i.test(u));

  const proxied = proxyChapterPages(pages);
  memSet(ck, proxied, 24 * 3600 * 1000);
  return proxied;
}

// ── Fallback router ───────────────────────────────────────────────────────────
export async function getChapterPages({ mangadexId, manganatoUrl, mangakatanaUrl, mangareadUrl }) {
  const sources = [
    mangadexId     && (async () => { const r = await mdChapterPages(mangadexId); return r.pages; }),
    manganatoUrl   && (() => manganatoPages(manganatoUrl)),
    mangakatanaUrl && (() => mangakatanaPages(mangakatanaUrl)),
    mangareadUrl   && (() => mangareadPages(mangareadUrl)),
  ].filter(Boolean);

  for (const attempt of sources) {
    try {
      const pages = await attempt();
      if (pages?.length > 0) return pages;
    } catch (err) {
      console.warn('[source-fallback]', err.message);
    }
  }
  throw new Error('All sources failed for this chapter');
}
