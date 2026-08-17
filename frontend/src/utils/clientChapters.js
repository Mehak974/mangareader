/**
 * clientChapters.js — fetch chapters from the browser with:
 * 1. Client-side FIRST (bypasses Railway IP blocks)
 * 2. Multiple source fallback (try all sources if one fails)
 * 3. localStorage caching (6h TTL)
 * 4. CORS proxy fallback via clientProxy
 * 5. Pagination support for sources that need it (manganato)
 */

import { clientFetchHTML, clientFetchJSON } from './clientProxy';

const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours
const SOURCES = [
  { id: 'mangaread', name: 'Server 1', base: 'https://www.mangaread.org' },
  { id: 'coffeemanga', name: 'Server 2', base: 'https://coffeemanga.net' },
  { id: 'manganato', name: 'Server 5', base: 'https://www.manganato.gg' },
];

function getCacheKey(sourceId, title) {
  return `chapters_${sourceId}_${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
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

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function extractChaptersFromHTML(html, source, title) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const chapters = [];

  if (source === 'mangaread' || source === 'coffeemanga') {
    const items = doc.querySelectorAll('li.wp-manga-chapter');
    for (const item of items) {
      const link = item.querySelector('a');
      if (!link) continue;
      const href = link.getAttribute('href') || '';
      const chTitle = link.textContent.trim();
      const dateEl = item.querySelector('.chapter-release-date');
      const date = dateEl ? dateEl.textContent.trim() : null;
      if (href && !chapters.some(c => c.href === href)) {
        chapters.push({ title: chTitle, href, date: date || null });
      }
    }
  } else if (source === 'manganato') {
    const items = doc.querySelectorAll('.chapter-list-container .chapter-item, .chapter-item');
    for (const item of items) {
      const link = item.querySelector('a');
      if (!link) continue;
      const href = link.getAttribute('href') || '';
      const chTitle = link.textContent.trim();
      if (href && !chapters.some(c => c.href === href)) {
        chapters.push({ title: chTitle, href });
      }
    }

    // Fallback selectors for manganato
    if (chapters.length === 0) {
      const links = doc.querySelectorAll('a[href*="chapter-"]');
      for (const link of links) {
        const href = link.getAttribute('href') || '';
        const chTitle = link.textContent.trim();
        if (href && href.includes('/manga/') && chTitle && !chapters.some(c => c.href === href)) {
          chapters.push({ title: chTitle, href });
        }
      }
    }
  }

  return chapters;
}

function extractMetaFromHTML(html, source, title) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  let pageTitle = title;
  let cover = '';

  if (source === 'mangaread' || source === 'coffeemanga') {
    const titleEl = doc.querySelector('h1.post-title, .manga-title');
    if (titleEl) pageTitle = titleEl.textContent.trim();

    const coverEl = doc.querySelector('.summary_image img');
    if (coverEl) {
      cover = coverEl.getAttribute('data-src') || coverEl.getAttribute('src') || '';
    }
  } else if (source === 'manganato') {
    const titleEl = doc.querySelector('h1');
    if (titleEl) pageTitle = titleEl.textContent.trim();

    const coverEl = doc.querySelector('.summary_image img, .manga-info-pic img, .cover img');
    if (coverEl) {
      cover = coverEl.getAttribute('data-src') || coverEl.getAttribute('src') || '';
    }
  }

  return { title: pageTitle, cover };
}

async function fetchMangareadChapters(title) {
  const slug = slugify(title);
  const urls = [
    `https://www.mangaread.org/manga/${slug}/`,
    `https://www.mangaread.org/manga/${slug}-manga/`,
  ];

  for (const url of urls) {
    try {
      const html = await clientFetchHTML(url);
      let chapters = extractChaptersFromHTML(html, 'mangaread', title);

      // If static HTML has no chapters, try the AJAX endpoint
      if (chapters.length === 0) {
        try {
          const mangaIdMatch = html.match(/"manga_id"\s*:\s*"?(\d+)"?/);
          const bodyClassMatch = html.match(/postid-(\d+)/);
          const mangaId = mangaIdMatch?.[1] || bodyClassMatch?.[1];
          
          if (mangaId) {
            const ajaxUrl = `${url.replace(/\/$/, '')}/ajax/load_chapters/`;
            const ajaxHTML = await clientFetchHTML(ajaxUrl, {
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              'X-Requested-With': 'XMLHttpRequest',
            });
            chapters = extractChaptersFromHTML(ajaxHTML, 'mangaread', title);
          }
        } catch {
          // ignore AJAX failure, use static HTML
        }
      }

      if (chapters.length > 0) {
        const meta = extractMetaFromHTML(html, 'mangaread', title);
        return {
          sourceId: 'mangaread',
          url,
          title: meta.title,
          cover: meta.cover,
          chapters,
        };
      }
    } catch (e) {
      continue;
    }
  }
  return null;
}

async function fetchManganatoChapters(title) {
  const slug = slugify(title);
  const url = `https://www.manganato.gg/manga/${slug}`;

  try {
    const allChapters = [];
    const PAGE_SIZE = 100;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      try {
        const apiUrl = `https://www.manganato.gg/api/manga/${slug}/chapters?limit=${PAGE_SIZE}&offset=${offset}`;
        const apiData = await clientFetchJSON(apiUrl, {
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'X-Requested-With': 'XMLHttpRequest',
        });

        if (apiData.success && apiData.data?.chapters?.length > 0) {
          const batch = apiData.data.chapters.map(ch => ({
            title: ch.chapter_name || `Chapter ${ch.chapter_num || ''}`,
            href: `https://www.manganato.gg/manga/${slug}/${ch.chapter_slug || ''}`,
          })).filter(ch => ch.href && ch.href !== `https://www.manganato.gg/manga/${slug}/`);
          
          allChapters.push(...batch);

          hasMore = apiData.data.pagination?.has_more === true;
          offset += PAGE_SIZE;
        } else {
          hasMore = false;
        }
      } catch (e) {
        hasMore = false;
      }
    }

    if (allChapters.length > 0) {
      const seen = new Set();
      const uniqueChapters = allChapters.filter(ch => {
        if (seen.has(ch.href)) return false;
        seen.add(ch.href);
        return true;
      });

      const html = await clientFetchHTML(url);
      const meta = extractMetaFromHTML(html, 'manganato', title);
      return {
        sourceId: 'manganato',
        url,
        title: meta.title,
        cover: meta.cover,
        chapters: uniqueChapters,
      };
    }

    const html = await clientFetchHTML(url);
    const chapters = extractChaptersFromHTML(html, 'manganato', title);
    if (chapters.length > 0) {
      const meta = extractMetaFromHTML(html, 'manganato', title);
      return {
        sourceId: 'manganato',
        url,
        title: meta.title,
        cover: meta.cover,
        chapters,
      };
    }
  } catch (e) {
    // ignore
  }
  return null;
}

async function fetchCoffeemangaChapters(title) {
  const slug = slugify(title);
  const url = `https://coffeemanga.net/manga/${slug}/`;

  try {
    const html = await clientFetchHTML(url);
    const chapters = extractChaptersFromHTML(html, 'coffeemanga', title);
    if (chapters.length > 0) {
      const meta = extractMetaFromHTML(html, 'coffeemanga', title);
      return {
        sourceId: 'coffeemanga',
        url,
        title: meta.title,
        cover: meta.cover,
        chapters,
      };
    }
  } catch (e) {
    // ignore
  }
  return null;
}

const FETCHERS = {
  mangaread: fetchMangareadChapters,
  manganato: fetchManganatoChapters,
  coffeemanga: fetchCoffeemangaChapters,
};

export async function fetchChaptersFromSource(sourceId, title) {
  const cacheKey = getCacheKey(sourceId, title);
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const fetcher = FETCHERS[sourceId];
  if (!fetcher) return null;

  const result = await fetcher(title);
  if (result && result.chapters.length > 0) {
    setCache(cacheKey, result);
  }
  return result;
}

export async function fetchChaptersWithFallback(title, preferredSource = null) {
  if (preferredSource) {
    const prefResult = await fetchChaptersFromSource(preferredSource, title);
    if (prefResult && prefResult.chapters.length > 0) {
      return prefResult;
    }
  }

  for (const source of SOURCES) {
    if (source.id === preferredSource) continue;
    const result = await fetchChaptersFromSource(source.id, title);
    if (result && result.chapters.length > 0) {
      return result;
    }
  }

  return null;
}
