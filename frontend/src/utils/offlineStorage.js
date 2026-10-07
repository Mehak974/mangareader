/**
 * offlineStorage.js — In-browser IndexedDB storage for offline manga chapters
 * Similar to Mihon / Tachiyomi: downloaded chapters can be viewed directly
 * on the website even without an internet connection.
 */

import { proxyImage, API_BASE, WORKER_URL } from './api';

const DB_NAME = 'MangaReaderOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'downloaded_chapters';

// 24-Hour Expiration TTL (downloaded chapters delete after 24h)
export const OFFLINE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Checks if a stored offline chapter has exceeded its 24-hour lifespan
 */
export function isChapterExpired(item) {
  if (!item || !item.downloadedAt) return false;
  return Date.now() - Number(item.downloadedAt) > OFFLINE_TTL_MS;
}

// In-memory cache to eliminate any loading delays or flickering when navigating between offline chapters
const memoryChapterCache = new Map();

export function getMemoryOfflineChapter(mangaId, chapterNum, mangaTitle = '') {
  const chNum = Number(chapterNum) || chapterNum;
  const checkExpired = (item, key) => {
    if (!item) return null;
    if (isChapterExpired(item)) {
      if (key) memoryChapterCache.delete(key);
      if (item.key) memoryChapterCache.delete(item.key);
      deleteOfflineChapter(item.mangaId, item.chapterNum, item.mangaTitle).catch(() => {});
      return null;
    }
    return item;
  };

  if (mangaId) {
    const key = getChapterKey(mangaId, chNum);
    if (memoryChapterCache.has(key)) {
      const res = checkExpired(memoryChapterCache.get(key), key);
      if (res) return res;
    }
  }
  if (mangaTitle) {
    const titleKey = getChapterKey(mangaTitle, chNum);
    if (memoryChapterCache.has(titleKey)) {
      const res = checkExpired(memoryChapterCache.get(titleKey), titleKey);
      if (res) return res;
    }
  }
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const targetId = norm(mangaId);
  const targetTitle = norm(mangaTitle);

  for (const [key, item] of Array.from(memoryChapterCache.entries())) {
    const sameCh = Number(item.chapterNum) === Number(chNum);
    if (!sameCh) continue;
    let match = false;
    if (targetId && (norm(item.mangaId) === targetId || norm(item.mangaSlug) === targetId)) match = true;
    if (targetTitle && (norm(item.mangaTitle) === targetTitle || norm(item.mangaSlug) === targetTitle)) match = true;
    if (!targetId && !targetTitle) match = true;
    if (match) {
      const res = checkExpired(item, key);
      if (res) return res;
    }
  }
  return null;
}

export async function preloadOfflineChapter(mangaId, chapterNum, mangaTitle = '') {
  return getOfflineChapter(mangaId, chapterNum, mangaTitle);
}

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('mangaId', 'mangaId', { unique: false });
        store.createIndex('downloadedAt', 'downloadedAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Key helper: composite unique key
 */
export function getChapterKey(mangaId, chapterNum) {
  return `${String(mangaId || 'manga').trim()}_ch_${String(chapterNum).trim()}`;
}

/**
 * Validates that a string is a real image (never an HTML error string)
 */
function isValidImageData(str) {
  if (!str || typeof str !== 'string') return false;
  if (str.startsWith('data:image/')) return true;
  if (str.startsWith('blob:')) return true;
  // Discard any data URLs that are text/html (such as "Error proxying image")
  if (str.startsWith('data:text/html') || str.startsWith('data:application/')) return false;
  if (str.startsWith('http://') || str.startsWith('https://')) {
    const lower = str.toLowerCase();
    if (lower.includes('loading') || lower.includes('spinner') || lower.includes('placeholder')) return false;
    // Discard thumbnails, user avatars, or widget images
    if (/[_-]\d{2,4}x\d{2,4}\.(?:jpg|jpeg|png|webp|avif)/i.test(str)) return false;
    if (/\b(?:avatar|logo|banner|icon|thumb)\b/i.test(str)) return false;
    return true;
  }
  return false;
}

/**
 * Fetches an image URL and converts it into a persistent Base64 Data URL.
 * Strictly verifies HTTP status and Content-Type so error pages are NEVER stored.
 */
async function fetchImageAsDataUrl(imgUrl) {
  if (!imgUrl || typeof imgUrl !== 'string') return null;
  if (imgUrl.startsWith('data:image/') || imgUrl.startsWith('blob:')) {
    return imgUrl;
  }
  if (imgUrl.startsWith('data:')) {
    // Corrupted non-image data URL (e.g. data:text/html)
    return null;
  }

  // Reject relative paths, spinners, or loading gif placeholders
  if (!imgUrl.startsWith('http://') && !imgUrl.startsWith('https://')) {
    return null;
  }
  const lowerUrl = imgUrl.toLowerCase();
  if (lowerUrl.includes('loading') || lowerUrl.includes('spinner') || lowerUrl.includes('placeholder') || lowerUrl.endsWith('.gif')) {
    return null;
  }

  // Extract raw upstream URL if already wrapped inside a proxy parameter
  let rawUrl = imgUrl;
  if (imgUrl.includes('/img-proxy?url=') || imgUrl.includes('/api/proxy-image?url=')) {
    try {
      const u = new URL(imgUrl);
      const inner = u.searchParams.get('url');
      if (inner && (inner.startsWith('http://') || inner.startsWith('https://'))) {
        rawUrl = inner;
      }
    } catch {}
  }

  // Build list of candidate proxy URLs in priority order:
  // 1. Direct proxy URL if imgUrl is already pointing to our Cloudflare Worker CDN (fastest edge cache)
  // 2. Fresh worker proxy URL for rawUrl
  // 3. Backend proxy for rawUrl (using rawUrl, NEVER wrapping worker domain in backend!)
  const candidates = [];

  if (imgUrl.includes('/img-proxy?') || (WORKER_URL && imgUrl.startsWith(WORKER_URL))) {
    candidates.push(imgUrl);
  }

  try {
    const p = proxyImage(rawUrl);
    if (p && !candidates.includes(p)) candidates.push(p);
  } catch {}

  const backendProxy = `${API_BASE || ''}/api/proxy-image?url=${encodeURIComponent(rawUrl)}`;
  if (!candidates.includes(backendProxy)) candidates.push(backendProxy);

  for (const targetUrl of candidates) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      let res;
      try {
        res = await fetch(targetUrl, { signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!res.ok) {
        // If upstream or worker returns 404, image does not exist — don't stall on fallback
        if (res.status === 404) break;
        continue;
      }

      const ct = (res.headers.get('content-type') || '').toLowerCase();
      // Reject HTML / JSON error bodies
      if (ct.includes('html') || ct.includes('json') || ct.includes('text')) {
        continue;
      }

      const blob = await res.blob();
      // Ensure the blob is not text or empty
      if (blob.size < 100) continue;
      if (blob.type && !blob.type.startsWith('image/') && blob.type !== 'application/octet-stream') {
        continue;
      }

      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const resStr = reader.result;
          if (typeof resStr === 'string' && resStr.startsWith('data:image/')) {
            resolve(resStr);
          } else {
            reject(new Error('Invalid data url'));
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      if (dataUrl) return dataUrl;
    } catch {
      // Try next candidate or skip if timed out
    }
  }

  return null;
}

/**
 * Saves a chapter into IndexedDB for offline reading
 */
export async function saveOfflineChapter({
  mangaId,
  mangaTitle,
  chapterNum,
  chapterTitle,
  images,
  cover,
}) {
  try {
    const db = await openDB();
    const key = getChapterKey(mangaId, chapterNum);

    // Filter to only valid image entries
    const sanitizedImages = (images || []).filter(isValidImageData);

    const record = {
      key,
      mangaId: String(mangaId || 'manga'),
      mangaTitle: mangaTitle || 'Manga',
      chapterNum: Number(chapterNum) || chapterNum,
      chapterTitle: chapterTitle || `Chapter ${chapterNum}`,
      images: sanitizedImages,
      pageCount: sanitizedImages.length,
      cover: cover || '',
      downloadedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);

      req.onsuccess = () => {
        memoryChapterCache.set(key, record);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('offline-chapters-updated', {
              detail: { key, mangaId, chapterNum, action: 'save' },
            })
          );
        }
        resolve(record);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to save chapter for offline reading:', err);
    throw err;
  }
}

/**
 * Checks if a chapter is available offline
 */
export async function isChapterOffline(mangaId, chapterNum, mangaTitle = '') {
  try {
    const ch = await getOfflineChapter(mangaId, chapterNum, mangaTitle);
    return Boolean(ch && ch.images && ch.images.length > 0);
  } catch {
    return false;
  }
}

/**
 * Retrieves an offline chapter from IndexedDB and cleans any stale non-image data
 */
export async function getOfflineChapter(mangaId, chapterNum, mangaTitle = '') {
  try {
    const mem = getMemoryOfflineChapter(mangaId, chapterNum, mangaTitle);
    if (mem && mem.images && mem.images.length > 0) return mem;

    const db = await openDB();
    const chNum = Number(chapterNum) || chapterNum;

    // 1. Direct O(1) key lookups for fast retrieval
    const candidateKeys = [];
    if (mangaId) candidateKeys.push(getChapterKey(mangaId, chNum));
    if (mangaTitle) candidateKeys.push(getChapterKey(mangaTitle, chNum));

    for (const key of candidateKeys) {
      const direct = await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
      if (direct) {
        if (isChapterExpired(direct)) {
          deleteOfflineChapter(direct.mangaId, direct.chapterNum, direct.mangaTitle).catch(() => {});
        } else if (direct.images) {
          direct.images = direct.images.filter(isValidImageData);
          if (direct.images.length > 0) {
            memoryChapterCache.set(key, direct);
            if (mangaId) memoryChapterCache.set(getChapterKey(mangaId, chNum), direct);
            if (mangaTitle) memoryChapterCache.set(getChapterKey(mangaTitle, chNum), direct);
            return direct;
          }
        }
      }
    }

    // 2. Scan store if primary key was different
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const list = req.result || [];
        const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const targetId = norm(mangaId);
        const targetTitle = norm(mangaTitle);

        const match = list.find((item) => {
          const sameCh = Number(item.chapterNum) === Number(chNum);
          if (!sameCh) return false;
          if (targetId && (norm(item.mangaId) === targetId || norm(item.mangaSlug) === targetId)) return true;
          if (targetTitle && (norm(item.mangaTitle) === targetTitle || norm(item.mangaSlug) === targetTitle)) return true;
          return false;
        });
        if (match) {
          if (isChapterExpired(match)) {
            deleteOfflineChapter(match.mangaId, match.chapterNum, match.mangaTitle).catch(() => {});
            resolve(null);
            return;
          }
          if (match.images) {
            match.images = match.images.filter(isValidImageData);
            if (match.key) memoryChapterCache.set(match.key, match);
            if (mangaId) memoryChapterCache.set(getChapterKey(mangaId, chNum), match);
            if (mangaTitle) memoryChapterCache.set(getChapterKey(mangaTitle, chNum), match);
          }
          resolve(match);
          return;
        }
        resolve(null);
      };
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn('Failed to get offline chapter:', err);
    return null;
  }
}

/**
 * Gets all offline chapters for a specific manga and warms the in-memory cache.
 * Automatically evicts any records older than 24 hours.
 */
export async function getOfflineChaptersForManga(mangaId, mangaTitle = '') {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const list = [];
      const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const targetId = norm(mangaId);
      const targetTitle = norm(mangaTitle);

      const req = store.openCursor();
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const item = cursor.value;
          let isMatch = false;
          if (targetId && (norm(item.mangaId) === targetId || norm(item.mangaSlug) === targetId)) isMatch = true;
          if (targetTitle && (norm(item.mangaTitle) === targetTitle || norm(item.mangaSlug) === targetTitle)) isMatch = true;

          if (isMatch) {
            if (isChapterExpired(item)) {
              deleteOfflineChapter(item.mangaId, item.chapterNum, item.mangaTitle).catch(() => {});
            } else {
              // Lightweight metadata only: avoids cloning 50-100MB of image arrays into RAM on page navigation!
              list.push({
                key: item.key,
                mangaId: item.mangaId,
                mangaTitle: item.mangaTitle,
                chapterNum: Number(item.chapterNum) || item.chapterNum,
                chapterTitle: item.chapterTitle,
                pageCount: item.pageCount || (item.images ? item.images.length : 0),
                cover: item.cover,
                downloadedAt: item.downloadedAt,
              });
            }
          }
          cursor.continue();
        } else {
          resolve(list);
        }
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * Gets all offline chapters stored in the browser (filters expired)
 */
export async function getAllOfflineChapters() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const raw = req.result || [];
        const list = [];
        for (const ch of raw) {
          if (isChapterExpired(ch)) {
            deleteOfflineChapter(ch.mangaId, ch.chapterNum, ch.mangaTitle).catch(() => {});
          } else {
            if (ch.images) ch.images = ch.images.filter(isValidImageData);
            list.push(ch);
          }
        }
        resolve(list);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * Scans IndexedDB and deletes all chapters downloaded more than 24 hours ago.
 */
export async function cleanupExpiredChapters() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();
      let purgedCount = 0;

      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const item = cursor.value;
          if (isChapterExpired(item)) {
            cursor.delete();
            purgedCount++;
            if (item.key) memoryChapterCache.delete(item.key);
          }
          cursor.continue();
        } else {
          if (purgedCount > 0 && typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('offline-chapters-updated', {
                detail: { action: 'cleanup', purgedCount },
              })
            );
          }
          resolve(purgedCount);
        }
      };
      req.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}

// Background sweep for expired chapters in browser
if (typeof window !== 'undefined') {
  setTimeout(() => {
    cleanupExpiredChapters().catch(() => {});
  }, 3000);
}

/**
 * Deletes an offline chapter from storage (IndexedDB + memory cache).
 * Matches by exact key, candidate keys, and scans for any records matching mangaId/title and chapterNum.
 */
export async function deleteOfflineChapter(mangaId, chapterNum, mangaTitle = '') {
  try {
    const chNum = Number(chapterNum) || chapterNum;
    const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const targetId = norm(mangaId);
    const targetTitle = norm(mangaTitle);

    // Collect all candidate keys
    const candidateKeys = new Set();
    if (mangaId) {
      candidateKeys.add(getChapterKey(mangaId, chNum));
      candidateKeys.add(getChapterKey(mangaId, chapterNum));
      candidateKeys.add(getChapterKey(norm(mangaId), chNum));
    }
    if (mangaTitle) {
      candidateKeys.add(getChapterKey(mangaTitle, chNum));
      candidateKeys.add(getChapterKey(mangaTitle, chapterNum));
      candidateKeys.add(getChapterKey(norm(mangaTitle), chNum));
    }
    candidateKeys.add(getChapterKey('manga', chNum));
    candidateKeys.add(getChapterKey('manga', chapterNum));

    const db = await openDB();

    await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      // 1. Delete all direct candidate keys
      candidateKeys.forEach((key) => {
        try { store.delete(key); } catch {}
      });

      // 2. Open a cursor to find and delete ANY matching records for this chapter and manga
      const req = store.openCursor();
      req.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const item = cursor.value;
          const sameCh = Number(item.chapterNum) === Number(chNum) || String(item.chapterNum) === String(chapterNum);
          if (sameCh) {
            let isMatch = false;
            const itemMangaId = norm(item.mangaId);
            const itemMangaTitle = norm(item.mangaTitle);
            const itemSlug = norm(item.mangaSlug);

            if (targetId && (itemMangaId === targetId || itemSlug === targetId || itemMangaTitle === targetId)) {
              isMatch = true;
            }
            if (targetTitle && (itemMangaTitle === targetTitle || itemSlug === targetTitle || itemMangaId === targetTitle)) {
              isMatch = true;
            }
            if (!targetId && !targetTitle) {
              isMatch = true;
            }

            if (isMatch) {
              if (item.key) candidateKeys.add(item.key);
              cursor.delete();
            }
          }
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });

    // 3. Clear all matching keys and records from in-memory cache
    candidateKeys.forEach((key) => memoryChapterCache.delete(key));

    for (const [key, item] of Array.from(memoryChapterCache.entries())) {
      const sameCh = Number(item.chapterNum) === Number(chNum) || String(item.chapterNum) === String(chapterNum);
      if (sameCh) {
        let isMatch = false;
        const itemMangaId = norm(item.mangaId);
        const itemMangaTitle = norm(item.mangaTitle);
        const itemSlug = norm(item.mangaSlug);

        if (targetId && (itemMangaId === targetId || itemSlug === targetId || itemMangaTitle === targetId)) isMatch = true;
        if (targetTitle && (itemMangaTitle === targetTitle || itemSlug === targetTitle || itemMangaId === targetTitle)) isMatch = true;
        if (!targetId && !targetTitle) isMatch = true;

        if (isMatch || candidateKeys.has(key) || key.endsWith(`_ch_${chapterNum}`) || key.endsWith(`_ch_${chNum}`)) {
          memoryChapterCache.delete(key);
        }
      }
    }

    // 4. Notify all components across the app
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('offline-chapters-updated', {
          detail: { mangaId, mangaTitle, chapterNum: chNum, action: 'delete' },
        })
      );
    }

    return true;
  } catch (err) {
    console.warn('Failed to delete offline chapter:', err);
    return false;
  }
}

/**
 * Deletes all offline chapters for a specific manga
 */
export async function deleteOfflineManga(mangaId, mangaTitle = '') {
  try {
    const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const targetId = norm(mangaId);
    const targetTitle = norm(mangaTitle);

    const db = await openDB();

    await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();
      req.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const item = cursor.value;
          let isMatch = false;
          const itemMangaId = norm(item.mangaId);
          const itemMangaTitle = norm(item.mangaTitle);
          const itemSlug = norm(item.mangaSlug);

          if (targetId && (itemMangaId === targetId || itemSlug === targetId || itemMangaTitle === targetId)) isMatch = true;
          if (targetTitle && (itemMangaTitle === targetTitle || itemSlug === targetTitle || itemMangaId === targetTitle)) isMatch = true;

          if (isMatch) {
            cursor.delete();
          }
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });

    for (const [key, item] of Array.from(memoryChapterCache.entries())) {
      let isMatch = false;
      const itemMangaId = norm(item.mangaId);
      const itemMangaTitle = norm(item.mangaTitle);
      const itemSlug = norm(item.mangaSlug);
      if (targetId && (itemMangaId === targetId || itemSlug === targetId || itemMangaTitle === targetId)) isMatch = true;
      if (targetTitle && (itemMangaTitle === targetTitle || itemSlug === targetTitle || itemMangaId === targetTitle)) isMatch = true;
      if (isMatch) {
        memoryChapterCache.delete(key);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('offline-chapters-updated', {
          detail: { mangaId, mangaTitle, action: 'deleteAll' },
        })
      );
    }

    return true;
  } catch (err) {
    console.warn('Failed to delete offline manga chapters:', err);
    return false;
  }
}

/**
 * Pre-caches all pages for offline reading.
 * Runs with a controlled concurrency of 3 and slight backoff to avoid upstream rate-limits.
 */
export async function makeChapterAvailableOffline({
  mangaId,
  mangaTitle,
  chapterNum,
  chapterTitle,
  images,
  cover,
  onProgress,
}) {
  if (!images || images.length === 0) {
    throw new Error('No images available to cache offline');
  }

  const total = images.length;
  let cachedCount = 0;
  const storedImages = new Array(total);

  onProgress?.(5, `Pre-caching ${total} pages for offline reading...`);

  // Concurrency of 3 to prevent server 502 / upstream rate-limiting
  const CONCURRENCY = 3;
  for (let i = 0; i < total; i += CONCURRENCY) {
    const batch = images.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (img, batchIdx) => {
        const index = i + batchIdx;
        try {
          const dataUrl = await fetchImageAsDataUrl(img);
          if (dataUrl) {
            storedImages[index] = dataUrl;
          } else {
            console.warn(`Could not cache page ${index + 1} as data URL, keeping URL`);
            storedImages[index] = isValidImageData(img) ? img : null;
          }
        } catch (err) {
          console.warn(`Failed page ${index + 1}:`, err.message);
          storedImages[index] = isValidImageData(img) ? img : null;
        } finally {
          cachedCount++;
          const progress = Math.min(92, Math.round((cachedCount / total) * 92));
          onProgress?.(progress, `Saved page ${cachedCount} of ${total} to offline storage...`);
        }
      })
    );

    // 50ms pause between batches to protect proxy concurrency pool
    if (i + CONCURRENCY < total) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  onProgress?.(95, 'Saving to offline database...');

  const validImages = storedImages.filter(isValidImageData);
  const record = await saveOfflineChapter({
    mangaId,
    mangaTitle,
    chapterNum,
    chapterTitle,
    images: validImages.length > 0 ? validImages : storedImages.filter(Boolean),
    cover,
  });

  onProgress?.(100, `Chapter ${chapterNum} is now ready for offline reading!`);
  return record;
}
