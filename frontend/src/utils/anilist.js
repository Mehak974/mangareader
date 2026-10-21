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
  // Collect tag names (AniList tags carry an isAdult flag of their own) so the
  // classifier can inspect them alongside genres.
  const tags = (media.tags || []).map((t) => t.name);
  return {
    id: String(media.id),
    countryOfOrigin: media.countryOfOrigin || "",
    country: media.countryOfOrigin || "",
    t: media.title.english || media.title.romaji || media.title.userPreferred,
    g: media.genres && media.genres.length ? media.genres[0] : "Action",
    ch: media.chapters ? `Ch ${media.chapters}` : "Ongoing",
    hot: media.trending > 40,
    rating: media.averageScore ? media.averageScore / 20 : 4.0,
    ongoing: media.status === "RELEASING",
    cover: media.coverImage?.large || media.coverImage?.medium || "",
    genres: media.genres || [],
    tags,
    isAdult: !!media.isAdult,
  };
}

const MANGADEX_GENRE_TAGS = {
  action: "391b0423-d847-456f-aff0-8b0cfc03066b",
  adventure: "87cc87cd-a395-47af-b27a-93258283bbc6",
  comedy: "4d32cc48-9f00-4cca-9b5a-a839f0764984",
  drama: "b9af3a63-f058-46de-a9a0-e0c13906197a",
  fantasy: "cdc58573-824b-420b-ba9f-546d60590c27",
  horror: "cdad7e68-07dd-4270-a3ee-725487693895",
  mystery: "ee9634b1-6355-4270-b70c-ce589b81458c",
  psychological: "3b60b75c-a2d7-4860-ab56-05f391bb889c",
  romance: "423e2eae-a7a2-4a8b-ac03-a8351462d71d",
  "sci-fi": "256c8bd9-4904-4360-bf4f-508a76d67183",
  thriller: "07251805-a27e-4d59-b488-f0bfbec15168",
  supernatural: "eabc548c-9e9d-440f-aa32-51a44c66e2c3",
};

async function fetchMangaDexFallback(variables = {}) {
  try {
    const limit = Math.min(variables.perPage || 24, 100);
    const page = variables.page || 1;
    const offset = (page - 1) * limit;

    const params = new URLSearchParams();
    params.append("limit", String(limit));
    params.append("offset", String(offset));
    params.append("includes[]", "cover_art");
    params.append("contentRating[]", "safe");
    params.append("contentRating[]", "suggestive");

    if (variables.search && String(variables.search).trim()) {
      params.append("title", String(variables.search).trim());
    } else {
      if (variables.sort && Array.isArray(variables.sort)) {
        if (variables.sort.some((s) => String(s).includes("SCORE"))) {
          params.append("order[rating]", "desc");
        } else if (variables.sort.some((s) => String(s).includes("UPDATED"))) {
          params.append("order[latestUploadedChapter]", "desc");
        } else {
          params.append("order[followedCount]", "desc");
        }
      } else {
        params.append("order[followedCount]", "desc");
      }
    }

    if (variables.status === "RELEASING") params.append("status[]", "ongoing");
    else if (variables.status === "FINISHED") params.append("status[]", "completed");

    if (variables.genre && variables.genre !== "All") {
      const tagId = MANGADEX_GENRE_TAGS[String(variables.genre).toLowerCase()];
      if (tagId) params.append("includedTags[]", tagId);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);
    const apiUrl = `https://api.mangadex.org/manga?${params.toString()}`;
    const res = await fetch(apiUrl, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn("[MangaDex] API response not OK:", res.status);
      return null;
    }
    const json = await res.json();
    if (!json.data || !Array.isArray(json.data)) {
      console.warn("[MangaDex] No data array in response");
      return null;
    }

    const media = json.data.map((m) => {
      let enTitle = m.attributes?.title?.en;
      if (!enTitle) {
        const altEn = m.attributes?.altTitles?.find((a) => a.en)?.en;
        enTitle = altEn || (m.attributes?.title ? Object.values(m.attributes.title)[0] : "Untitled");
      }

      const coverRel = m.relationships?.find((r) => r.type === "cover_art");
      const cover = coverRel?.attributes?.fileName
        ? `https://uploads.mangadex.org/covers/${m.id}/${coverRel.attributes.fileName}.512.jpg`
        : "";

      const genres =
        m.attributes?.tags
          ?.filter((t) => t.attributes?.group === "genre")
          .map((t) => t.attributes?.name?.en)
          .filter(Boolean) || [];

      const tags =
        m.attributes?.tags?.map((t) => t.attributes?.name?.en).filter(Boolean) || [];

      const isKorean = m.attributes?.originalLanguage === "ko";
      const isAdult =
        m.attributes?.contentRating === "erotica" ||
        m.attributes?.contentRating === "pornographic";

      return {
        id: m.id,
        countryOfOrigin: isKorean ? "KR" : "JP",
        country: isKorean ? "KR" : "JP",
        t: enTitle,
        g: genres[0] || (isKorean ? "Manhwa" : "Action"),
        ch: m.attributes?.lastChapter
          ? `Ch ${m.attributes.lastChapter}`
          : m.attributes?.status === "completed"
          ? "Completed"
          : "Ongoing",
        hot: true,
        rating: 4.5,
        ongoing: m.attributes?.status === "ongoing",
        cover,
        genres,
        tags,
        isAdult,
      };
    });

    const total = json.total || media.length;
    return {
      pageInfo: {
        total,
        currentPage: page,
        lastPage: Math.ceil(total / limit) || 1,
        hasNextPage: offset + media.length < total,
        perPage: limit,
      },
      media,
    };
  } catch (err) {
    console.warn("MangaDex fallback failed:", err.message);
    return null;
  }
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
        else if (variables.sort.some((s) => String(s).includes("ID"))) q.set("sort", "New Releases");
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
    const data = await fetchAnilist(MANGA_QUERY, cleanVariables, 2, 1000);
    if (data && data.Page && data.Page.media?.length > 0) {
      return {
        pageInfo: data.Page.pageInfo,
        media: data.Page.media.map(mapAnilistMedia),
      };
    }
  } catch (err) {
    console.warn("getMangaList AniList offline:", err.message);
  }

  // Fallback to MangaDex only when AniList is offline or empty
  const dexData = await fetchMangaDexFallback(variables);
  if (dexData && dexData.media?.length > 0) {
    return dexData;
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

  // Fallback to MangaDex only when AniList is offline or empty
  const dexData = await fetchMangaDexFallback({ ...variables, sort: ["UPDATED_AT_DESC"] });
  if (dexData && dexData.media?.length > 0) {
    return dexData;
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
