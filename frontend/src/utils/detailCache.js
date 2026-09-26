/**
 * detailCache.js — sessionStorage SWR cache for manga detail pages.
 *
 * The detail page used to refetch everything on every mount: two sequential
 * AniList round trips, the chapter list, and the view tracker. Navigating into
 * a chapter and back re-ran the whole chain, so every back-navigation was a
 * full cold load (and often a 429 from AniList, which left the cover blank).
 *
 * This cache stores the resolved payload per slug so the page can hydrate
 * instantly from cache and revalidate in the background.
 */

const PREFIX = "mdetail:";
const COVER_PREFIX = "cover_";
const MAX_ENTRIES = 30;
// 12h, matching the backend's chapter_list TTL so the client cache can never
// outlive the server data it mirrors.
const FRESH_MS = 12 * 60 * 60 * 1000;

const memory = new Map();

function available() {
  return typeof window !== "undefined" && !!window.sessionStorage;
}

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function prune() {
  if (!available()) return;
  const keys = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (k && k.startsWith(PREFIX)) keys.push(k);
  }
  // Drop the oldest writes first; insertion order in sessionStorage is stable.
  while (keys.length > MAX_ENTRIES) {
    const k = keys.shift();
    sessionStorage.removeItem(k);
  }
}

export function readDetail(slug) {
  if (!slug) return null;
  const mem = memory.get(slug);
  if (mem) return mem;
  if (!available()) return null;
  const entry = safeParse(sessionStorage.getItem(PREFIX + slug));
  if (entry && entry.manga) {
    memory.set(slug, entry);
    return entry;
  }
  return null;
}

export function writeDetail(slug, data) {
  if (!slug || !data || !data.manga) return;
  const entry = { ...data, savedAt: Date.now() };
  memory.set(slug, entry);
  if (!available()) return;
  try {
    sessionStorage.setItem(PREFIX + slug, JSON.stringify(entry));
  } catch {
    // Quota exceeded — the in-memory copy still serves this tab.
  }
  prune();
}

export function isFresh(entry) {
  return !!entry && Date.now() - (entry.savedAt || 0) < FRESH_MS;
}

export function clearDetail(slug) {
  memory.delete(slug);
  if (available()) sessionStorage.removeItem(PREFIX + slug);
}

// ── Cover helpers ────────────────────────────────────────────────────────────
// The cover is the one thing that must never flash empty, so it gets its own
// tiny store keyed by the slug in the URL. The reader appends `cover=` to its
// links, which lets us seed this even before AniList answers.

export function readCover(slug) {
  if (!slug) return "";
  if (memory.has(slug)) {
    const m = memory.get(slug).manga;
    if (m && m.cover) return m.cover;
  }
  if (!available()) return "";
  return sessionStorage.getItem(COVER_PREFIX + slug) || "";
}

export function writeCover(slug, cover) {
  if (!slug || !cover || !available()) return;
  try {
    sessionStorage.setItem(COVER_PREFIX + slug, cover);
  } catch {
    // ignore quota errors — cover is a nicety, not critical
  }
}

export function seedCover(slug, cover) {
  if (!slug || !cover) return;
  writeCover(slug, cover);
  const entry = readDetail(slug);
  if (entry && entry.manga && !entry.manga.cover) {
    writeDetail(slug, { ...entry, manga: { ...entry.manga, cover } });
  }
}

// ── View tracker dedupe ──────────────────────────────────────────────────────
// track-view writes to Postgres on every hit. One write per slug per session is
// enough signal; without this, every back-navigation added a row write.

const viewed = new Set();

export function markViewedOnce(slug) {
  if (!slug || viewed.has(slug)) return false;
  viewed.add(slug);
  return true;
}
