/**
 * Achievement System
 * All logic runs client-side using localStorage.
 * Achievements are stored as { id, unlockedAt } in "mr_achievements".
 * Listeners are notified when a new achievement is unlocked.
 */

export const ACHIEVEMENTS = [
  { id: "first_chapter",       icon: "🎌", title: "First Chapter!",         desc: "Read your very first chapter.",                    trigger: "chapters_read", threshold: 1   },
  { id: "chapters_10",         icon: "📖", title: "Getting Started",         desc: "Read 10 chapters.",                                trigger: "chapters_read", threshold: 10  },
  { id: "chapters_50",         icon: "📚", title: "Bookworm",                desc: "Read 50 chapters.",                                trigger: "chapters_read", threshold: 50  },
  { id: "chapters_100",        icon: "💯", title: "Century Reader",          desc: "Read 100 chapters.",                               trigger: "chapters_read", threshold: 100 },
  { id: "chapters_500",        icon: "🔥", title: "Devoted",                 desc: "Read 500 chapters. Respect.",                      trigger: "chapters_read", threshold: 500 },
  { id: "chapters_1000",       icon: "👑", title: "Manga Royalty",           desc: "1,000 chapters read. Legendary.",                  trigger: "chapters_read", threshold: 1000},
  { id: "night_reader",        icon: "🌙", title: "Night Reader",            desc: "Read manga between midnight and 4 AM.",            trigger: "hour",          hours: [0,1,2,3]},
  { id: "weekend_warrior",     icon: "🛋️", title: "Weekend Warrior",         desc: "Read manga on a Saturday or Sunday.",              trigger: "weekday",       days: [0,6]    },
  { id: "explorer",            icon: "🧭", title: "Explorer",                desc: "Read manga from 5 different series.",              trigger: "series_count",  threshold: 5   },
  { id: "collector",           icon: "📦", title: "Collector",               desc: "Add 10 manga to your bookmarks.",                  trigger: "bookmarks",     threshold: 10  },
  { id: "bookmark_master",     icon: "🔖", title: "Bookmark Master",         desc: "Bookmark 25 manga series.",                        trigger: "bookmarks",     threshold: 25  },
  { id: "genre_hopper",        icon: "🎨", title: "Genre Hopper",            desc: "Read manga from 3 different genres.",              trigger: "genres",        threshold: 3   },
  { id: "marathon_reader",     icon: "🏃", title: "Marathon Reader",         desc: "Read 10 chapters in a single session.",            trigger: "session",       threshold: 10  },
  { id: "early_bird",          icon: "🌅", title: "Early Bird",              desc: "Read manga before 7 AM.",                          trigger: "hour",          hours: [5,6]   },
];

const STORAGE_KEY = "mr_achievements";
const STATS_KEY   = "mr_achiev_stats";

function getUnlocked() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function getStats() {
  try { return JSON.parse(localStorage.getItem(STATS_KEY) || "{}"); } catch { return {}; }
}
function saveStats(s) {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch {}
}

const listeners = new Set();
export function onAchievement(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function unlock(achievement) {
  const list = getUnlocked();
  if (list.some((a) => a.id === achievement.id)) return;
  list.push({ id: achievement.id, unlockedAt: new Date().toISOString() });
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
  listeners.forEach((fn) => fn(achievement));
}

function checkAll(stats) {
  const unlocked = getUnlocked().map((a) => a.id);
  const now = new Date();
  const hour = now.getHours();
  const day  = now.getDay();

  ACHIEVEMENTS.forEach((ach) => {
    if (unlocked.includes(ach.id)) return;
    if (ach.trigger === "chapters_read" && (stats.chapters_read || 0) >= ach.threshold) unlock(ach);
    if (ach.trigger === "hour"          && ach.hours.includes(hour))                    unlock(ach);
    if (ach.trigger === "weekday"       && ach.days.includes(day))                      unlock(ach);
    if (ach.trigger === "series_count"  && (stats.series_count || 0) >= ach.threshold)  unlock(ach);
    if (ach.trigger === "bookmarks"     && (stats.bookmarks || 0) >= ach.threshold)      unlock(ach);
    if (ach.trigger === "genres"        && (stats.genres?.length || 0) >= ach.threshold) unlock(ach);
    if (ach.trigger === "session"       && (stats.session_chapters || 0) >= ach.threshold) unlock(ach);
  });
}

/** Call when a chapter is opened */
export function trackChapterRead(mangaId, genres = []) {
  if (typeof window === "undefined") return;
  const stats = getStats();
  stats.chapters_read = (stats.chapters_read || 0) + 1;
  stats.session_chapters = (stats.session_chapters || 0) + 1;

  // Track unique series
  const series = new Set(stats.series_ids || []);
  series.add(mangaId);
  stats.series_ids = [...series];
  stats.series_count = series.size;

  // Track genres
  const genreSet = new Set(stats.genres || []);
  genres.forEach((g) => genreSet.add(g));
  stats.genres = [...genreSet];

  saveStats(stats);
  checkAll(stats);
}

/** Call when a bookmark is added */
export function trackBookmark() {
  if (typeof window === "undefined") return;
  const stats = getStats();
  stats.bookmarks = (stats.bookmarks || 0) + 1;
  saveStats(stats);
  checkAll(stats);
}

/** Get all achievements with unlock status for profile page */
export function getAllAchievements() {
  const unlocked = getUnlocked();
  const unlockedIds = new Map(unlocked.map((a) => [a.id, a.unlockedAt]));
  return ACHIEVEMENTS.map((a) => ({
    ...a,
    unlocked: unlockedIds.has(a.id),
    unlockedAt: unlockedIds.get(a.id) || null,
  }));
}

/** Get reading stats for display */
export function getReadingStats() {
  return getStats();
}

/** Reset session counter (call on page load) */
export function resetSession() {
  if (typeof window === "undefined") return;
  const stats = getStats();
  stats.session_chapters = 0;
  saveStats(stats);
}
