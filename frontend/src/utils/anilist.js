import { API_BASE } from "./api";

// Requests in flight for the same query+variables. The homepage, /browse,
// /trending and the header search box all mount at once on a client-side
// navigation and several of them ask for the same list, so without this the
// same GraphQL query is POSTed N times in the same tick and the proxy's
// rate-limit budget is spent on duplicates.
const IN_FLIGHT = new Map();

function inFlightKey(query, variables) {
  return `${query}::${JSON.stringify(variables ?? {})}`;
}

export async function fetchAnilist(query, variables = {}, retries = 3, delay = 1500) {
  const key = inFlightKey(query, variables);
  const existing = IN_FLIGHT.get(key);
  if (existing) return existing;

  const promise = fetchAnilistInner(query, variables, retries, delay).finally(() => {
    IN_FLIGHT.delete(key);
  });
  IN_FLIGHT.set(key, promise);
  return promise;
}

async function fetchDirectAnilist(query, variables) {
  // ponytail: browser can't call AniList directly — 403 has no CORS headers, spams console
  if (typeof window !== "undefined") return null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || null;
  } catch {
    return null;
  }
}

let backendProxyBroken = false;
let lastProxyCheck = 0;

async function fetchAnilistInner(query, variables, retries = 2, delay = 1000) {
  // If AniList is currently marked down, do a quick direct probe (server only)
  if (backendProxyBroken && (Date.now() - lastProxyCheck) < 60000) {
    // In browser, skip entirely — client-side getMangaList routes through /api/manga/browse
    if (typeof window !== "undefined") return null;
    const directData = await fetchDirectAnilist(query, variables);
    if (directData) {
      backendProxyBroken = false;
      return directData;
    }
    return null;
  }

  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const url = `${API_BASE.replace(/\/$/, '')}/api/anilist`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.status === 403) {
        backendProxyBroken = true;
        lastProxyCheck = Date.now();
        return null;
      }

      if (res.status === 429) {
        backendProxyBroken = true;
        lastProxyCheck = Date.now();
        const directData = await fetchDirectAnilist(query, variables);
        if (directData) {
          backendProxyBroken = false;
          return directData;
        }

        if (i === retries - 1) {
          console.warn("AniList rate limited — giving up until the limit resets.");
          return null;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }

      if (!res.ok) {
        backendProxyBroken = true;
        lastProxyCheck = Date.now();
        const directData = await fetchDirectAnilist(query, variables);
        if (directData) {
          backendProxyBroken = false;
          return directData;
        }

        const text = await res.text();
        throw new Error(`Anilist API failure: ${res.status} - ${text}`);
      }

      backendProxyBroken = false;
      const json = await res.json();
      return json.data;
    } catch (err) {
      backendProxyBroken = true;
      lastProxyCheck = Date.now();
      return null;
    }
  }
  return null;
}

export const MANGA_QUERY = `
  query ($page: Int, $perPage: Int, $genre: String, $search: String, $sort: [MediaSort], $status: MediaStatus, $countryOfOrigin: CountryCode, $startDate_greater: FuzzyDateInt, $startDate_lesser: FuzzyDateInt, $averageScore_greater: Int) {
    Page (page: $page, perPage: $perPage) {
      pageInfo {
        total
        currentPage
        lastPage
        hasNextPage
        perPage
      }
      media (type: MANGA, genre: $genre, search: $search, sort: $sort, status: $status, countryOfOrigin: $countryOfOrigin, startDate_greater: $startDate_greater, startDate_lesser: $startDate_lesser, averageScore_greater: $averageScore_greater) {
        id
        countryOfOrigin
        title {
          english
          romaji
          userPreferred
        }
        coverImage {
          large
          medium
          color
        }
        genres
        averageScore
        status
        chapters
        trending
        isAdult
        tags {
          name
          isAdult
        }
      }
    }
  }
`;

export const RECENT_MANGA_QUERY = `
  query ($page: Int, $perPage: Int, $genre_in: [String], $sort: [MediaSort], $countryOfOrigin: CountryCode) {
    Page (page: $page, perPage: $perPage) {
      pageInfo {
        total
        currentPage
        lastPage
        hasNextPage
        perPage
      }
      media (type: MANGA, genre_in: $genre_in, sort: $sort, countryOfOrigin: $countryOfOrigin) {
        id
        countryOfOrigin
        title {
          english
          romaji
          userPreferred
        }
        coverImage {
          large
          medium
          color
        }
        genres
        averageScore
        status
        chapters
        trending
        isAdult
        tags {
          name
          isAdult
        }
      }
    }
  }
`;

export function mapAnilistMedia(media) {
  if (!media) return null;
  // Collect tag names (AniList tags carry an isAdult flag of their own) so the
  // classifier can inspect them alongside genres.
  const tags = (media.tags || []).map((t) => t.name || t);
  const mediaTitle = media.title?.english || media.title?.romaji || media.title?.userPreferred || media.t || "Untitled";
  return {
    id: String(media.id),
    countryOfOrigin: media.countryOfOrigin || "",
    country: media.countryOfOrigin || "",
    t: mediaTitle,
    g: media.genres && media.genres.length ? media.genres[0] : (media.g || "Action"),
    ch: media.chapters ? `Ch ${media.chapters}` : (media.ch || "Ongoing"),
    hot: (media.trending || 0) > 40,
    rating: media.averageScore ? media.averageScore / 20 : (media.rating || 4.0),
    ongoing: media.status === "RELEASING",
    cover: media.coverImage?.large || media.coverImage?.medium || media.cover || "",
    genres: media.genres || (media.g ? [media.g] : []),
    tags,
    isAdult: !!media.isAdult,
  };
}

async function fetchKitsuFallback(variables = {}) {
  try {
    const requestedPerPage = Math.min(variables.perPage || 24, 40);
    const page = variables.page || 1;
    // Kitsu enforces max limit=20 per query. We fetch in chunks of up to 20.
    const primaryLimit = Math.min(requestedPerPage, 20);
    const secondaryLimit = requestedPerPage > 20 ? Math.min(requestedPerPage - 20, 20) : 0;
    const baseOffset = (page - 1) * requestedPerPage;

    const buildUrl = (limit, offset) => {
      const params = new URLSearchParams();
      params.set("page[limit]", String(limit));
      params.set("page[offset]", String(offset));

      if (variables.search && String(variables.search).trim()) {
        params.set("filter[text]", String(variables.search).trim());
      } else {
        const sortArr = Array.isArray(variables.sort)
          ? variables.sort.map((s) => String(s).toUpperCase())
          : [];
        if (sortArr.some((s) => s.includes("SCORE"))) {
          params.set("sort", "-averageRating");
        } else if (
          sortArr.some(
            (s) =>
              s.includes("ID") ||
              s.includes("UPDATED") ||
              s.includes("START_DATE") ||
              s.includes("LATEST")
          )
        ) {
          params.set("sort", "-startDate");
          if (!variables.status) params.set("filter[status]", "current,finished");
        } else if (sortArr.some((s) => s.includes("ROMAJI") || s.includes("TITLE"))) {
          params.set("sort", "canonicalTitle");
        } else {
          // Default: Trending (sorted by popularityRank)
          params.set("sort", "popularityRank");
        }
      }

      if (variables.status === "RELEASING") params.set("filter[status]", "current");
      else if (variables.status === "FINISHED") params.set("filter[status]", "finished");

      if (variables.countryOfOrigin === "KR") params.set("filter[subtype]", "manhwa");
      else if (variables.countryOfOrigin === "CN") params.set("filter[subtype]", "manhua");

      if (variables.genre && variables.genre !== "All") {
        params.set("filter[categories]", String(variables.genre).toLowerCase());
      }

      return `https://kitsu.io/api/edge/manga?${params.toString()}`;
    };

    const fetchChunk = async (url) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      try {
        const res = await fetch(url, {
          headers: { Accept: "application/vnd.api+json" },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!res.ok) return null;
        return await res.json();
      } catch {
        clearTimeout(timeoutId);
        return null;
      }
    };

    const firstJson = await fetchChunk(buildUrl(primaryLimit, baseOffset));
    if (!firstJson || !Array.isArray(firstJson.data)) return null;

    let allItems = [...firstJson.data];
    const totalCount = firstJson.meta?.count || allItems.length;

    if (secondaryLimit > 0 && allItems.length === primaryLimit && (baseOffset + primaryLimit) < totalCount) {
      const secondJson = await fetchChunk(buildUrl(secondaryLimit, baseOffset + primaryLimit));
      if (secondJson && Array.isArray(secondJson.data)) {
        allItems = allItems.concat(secondJson.data);
      }
    }

    const media = allItems.map((m) => {
      const attr = m.attributes || {};
      const title = attr.titles?.en || attr.canonicalTitle || "Untitled";
      const isKorean = attr.subtype === "manhwa";
      const isChinese = attr.subtype === "manhua";
      const country = isKorean ? "KR" : isChinese ? "CN" : "JP";
      const cover =
        attr.posterImage?.large ||
        attr.posterImage?.medium ||
        attr.posterImage?.original ||
        attr.posterImage?.small ||
        "";

      let defaultGenre = "Action";
      if (isKorean) defaultGenre = "Manhwa";
      else if (isChinese) defaultGenre = "Manhua";
      else if (variables.genre && variables.genre !== "All") defaultGenre = variables.genre;

      const ratingVal = attr.averageRating ? parseFloat(attr.averageRating) / 20 : 4.5;
      // Only R18 is pornography/explicit. Standard R in Kitsu is for regular shonen/seinen action (Tokyo Ghoul, AoT)
      const isAdult = attr.ageRating === "R18";

      return {
        id: `kitsu-${m.id}`,
        countryOfOrigin: country,
        country,
        t: title,
        g: defaultGenre,
        ch: attr.chapterCount ? `Ch ${attr.chapterCount}` : "Ongoing",
        hot: (attr.userCount || 0) > 2000,
        rating: Math.min(5, Math.max(1, Number(ratingVal.toFixed(1)))),
        ongoing: attr.status === "current",
        cover,
        genres: [defaultGenre],
        tags: [],
        isAdult,
      };
    });

    return {
      pageInfo: {
        total: totalCount,
        currentPage: page,
        lastPage: Math.ceil(totalCount / requestedPerPage) || 1,
        hasNextPage: baseOffset + media.length < totalCount,
        perPage: requestedPerPage,
      },
      media,
    };
  } catch (err) {
    console.warn("Kitsu fallback failed:", err.message);
    return null;
  }
}

function getSearchVariations(query) {
  const q = String(query || "").trim();
  if (!q) return [];
  const candidates = [];

  // 1. "I am" / "I'm" / "Im" contractions (e.g. "I am max level newbie" -> "I'm max level newbie", "max level newbie")
  if (/\bi\s*am\b/i.test(q)) {
    candidates.push(q.replace(/\bi\s*am\b/gi, "I'm"));
    candidates.push(q.replace(/\bi\s*am\s+(the\s+)?/gi, ""));
    candidates.push(q.replace(/\bi\s*am\b/gi, "I'm the"));
  }
  if (/\bi'?m\b/i.test(q)) {
    candidates.push(q.replace(/\bi'?m\b/gi, "I am"));
    candidates.push(q.replace(/\bi'?m\s+(the\s+)?/gi, ""));
    candidates.push(q.replace(/\bi'?m\b/gi, "I'm the"));
  }

  // 2. Trailing 's / plural
  const withApostrophe = q.replace(/([a-zA-Z]{3,})s\b/g, "$1's");
  if (withApostrophe !== q) candidates.push(withApostrophe);
  const withoutS = q.replace(/([a-zA-Z]{3,})s\b/g, "$1");
  if (withoutS !== q && withoutS !== withApostrophe) candidates.push(withoutS);

  // 3. Leading "the ", "a ", "an "
  if (/^(the|a|an)\s+/i.test(q)) {
    const noArticle = q.replace(/^(the|a|an)\s+/i, '');
    candidates.push(noArticle);
    candidates.push(noArticle.replace(/([a-zA-Z]{3,})s\b/g, "$1's"));
  }

  // 4. "Solo " prefix (common in Korean manhwa, e.g. "Solo Max-Level Newbie")
  if (/^solo\s+/i.test(q)) {
    candidates.push(q.replace(/^solo\s+/i, ''));
  }

  // 5. Hyphens vs spaces (e.g. "max-level" vs "max level")
  if (q.includes('-')) {
    candidates.push(q.replace(/-/g, ' '));
  } else if (/\b(max|high|low|mid|top|first|second)\s+(level|tier|class|rank)\b/i.test(q)) {
    candidates.push(q.replace(/\b(max|high|low|mid|top|first|second)\s+(level|tier|class|rank)\b/gi, '$1-$2'));
  }

  // 6. Clean punctuation
  const cleanPunct = q.replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (cleanPunct !== q) {
    candidates.push(cleanPunct);
  }

  return [...new Set(candidates.filter(c => c && c.toLowerCase() !== q.toLowerCase()))];
}

export async function getMangaList(variables = {}) {
  // In the browser, route through the internal Next.js API route to guarantee ad-blocker immunity and avoid CORS/aborts
  if (typeof window !== "undefined") {
    try {
      const q = new URLSearchParams();
      if (variables.page) q.set("page", String(variables.page));
      if (variables.perPage) q.set("perPage", String(variables.perPage));
      if (variables.genre) q.set("genre", String(variables.genre));
      if (variables.search) q.set("search", String(variables.search));
      if (variables.status) q.set("status", String(variables.status));
      if (variables.countryOfOrigin) q.set("countryOfOrigin", String(variables.countryOfOrigin));
      if (variables.sort && Array.isArray(variables.sort)) {
        if (variables.sort.some((s) => String(s).includes("SCORE"))) q.set("sort", "Top Rated");
        else if (variables.sort.some((s) => String(s).includes("ID") || String(s).includes("UPDATED") || String(s).includes("START_DATE"))) q.set("sort", "New Releases");
        else if (variables.sort.some((s) => String(s).includes("TRENDING"))) q.set("sort", "Trending");
        else if (variables.sort.some((s) => String(s).includes("ROMAJI"))) q.set("sort", "A–Z");
      }
      const res = await fetch(`/api/manga/browse?${q.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json && json.media && json.media.length > 0) {
          return json;
        }
      }
    } catch (err) {
      console.warn("Client /api/manga/browse failed, attempting direct:", err.message);
    }
  }

  try {
    const cleanVariables = { ...variables };
    if (cleanVariables.search && String(cleanVariables.search).trim()) {
      delete cleanVariables.sort;
    }
    let data = await fetchAnilist(MANGA_QUERY, cleanVariables, 2, 1000);
    if (!data?.Page?.media?.length && cleanVariables.search) {
      const variations = getSearchVariations(cleanVariables.search);
      for (const variant of variations) {
        const vData = await fetchAnilist(MANGA_QUERY, { ...cleanVariables, search: variant }, 1, 600);
        if (vData?.Page?.media?.length > 0) {
          data = vData;
          break;
        }
      }
    }
    if (data && data.Page && data.Page.media?.length > 0) {
      return {
        pageInfo: data.Page.pageInfo,
        media: data.Page.media.map(mapAnilistMedia),
      };
    }
  } catch (err) {
    console.warn("getMangaList AniList offline:", err.message);
  }

  // Fallback to Kitsu only when AniList is offline or empty
  const kitsuData = await fetchKitsuFallback(variables);
  if (kitsuData && kitsuData.media?.length > 0) {
    return kitsuData;
  }

  return {
    pageInfo: { total: 0, currentPage: 1, lastPage: 1, hasNextPage: false, perPage: 10 },
    media: [],
  };
}

export async function getRecentMangaList(variables) {
  try {
    const data = await fetchAnilist(RECENT_MANGA_QUERY, variables, 2, 1000);
    if (data && data.Page && data.Page.media?.length > 0) {
      return {
        pageInfo: data.Page.pageInfo,
        media: data.Page.media.map(mapAnilistMedia),
      };
    }
  } catch (err) {
    console.warn("getRecentMangaList AniList offline:", err.message);
  }

  // Fallback to Kitsu only when AniList is offline or empty
  const kitsuData = await fetchKitsuFallback({ ...variables, sort: ["UPDATED_AT_DESC"] });
  if (kitsuData && kitsuData.media?.length > 0) {
    return kitsuData;
  }

  return {
    pageInfo: { total: 0, currentPage: 1, lastPage: 1, hasNextPage: false, perPage: 10 },
    media: [],
  };
}

// Hard signals: their mere presence always hides the cover behind a warning.
// Matched as substrings against lowercased genres + tags (e.g. "Full Nudity",
// "Sexual Abuse", "BDSM" all trip their entry).
const HARD_NSFW_TERMS = [
  "hentai", "pornographic", "erotica", "explicit sexual", "smut", "hardcore",
  "adult video", "full nudity", "incest", "rape", "bestiality", "futanari",
  "lolicon", "shotacon", "bdsm", "sexual violence", "extreme fetish", "ecchi",
  "sexual abuse", "nsfw", "uncensored", "doujinshi",
];

const HARD_TERMS_REGEX = new RegExp(
  HARD_NSFW_TERMS.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
  "i"
);

// Whole-word terms — matched against tokenised genres/tags/title so "sex" does
// not fire on "Middlesex" or "sexuality".
const HARD_WORDS_REGEX = /\b(sex|18\+|hentai|erotica|smut|porn)\b/i;

/**
 * Decide whether a title's cover must be hidden behind an explicit-content warning.
 *
 * Rules:
 *  - AniList's own `isAdult` flag → always hide.
 *  - Genuine explicit terms/words in genres or tags (hentai, smut, erotica, etc.) → hide.
 *  - Note: Generic "mature" is NOT hidden because mainstream action series
 *    (Solo Leveling, One Piece, Berserk) are tagged "mature" for violence/action.
 *
 * @param {string[]} genres
 * @param {string} title
 * @param {{ tags?: string[], isAdult?: boolean }} [extra]
 */
export function isExplicitNSFW(genres = [], title = "", extra = {}) {
  if (extra?.isAdult) return true;

  const genresArr = Array.isArray(genres) ? genres : typeof genres === "string" ? [genres] : [];
  const tagsArr = Array.isArray(extra?.tags) ? extra.tags : typeof extra?.tags === "string" ? [extra.tags] : [];

  if (genresArr.length === 0 && tagsArr.length === 0 && !title) return false;

  const combined = `${genresArr.join(" ")} ${tagsArr.join(" ")}`.toLowerCase();

  // Multi-word hard terms (hentai, ecchi, erotica, etc.)
  if (HARD_TERMS_REGEX.test(combined)) return true;

  // Whole-word match for explicit terms
  if (HARD_WORDS_REGEX.test(combined) || (title && HARD_WORDS_REGEX.test(title))) return true;

  return false;
}
