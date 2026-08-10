import { API_BASE } from "./api";

const isServer = typeof window === 'undefined';

export async function fetchAnilist(query, variables = {}, retries = 3, delay = 1500) {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      // Server components call AniList directly (no CORS on server).
      // Client components go through the backend proxy to avoid CORS.
      // Note: we use a direct fetch (not fetchApi) here because the backend's
      // doubleCsrfProtection middleware is registered AFTER the /api/anilist
      // route, so CSRF is not enforced on this endpoint. Using fetchApi would
      // add a wasteful CSRF-token round-trip on every AniList request.
      let res;
      if (isServer) {
        res = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ query, variables }),
          signal: controller.signal,
          next: { revalidate: 86400 },
        });
      } else {
        res = await fetch(`${API_BASE}/api/anilist`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ query, variables }),
          signal: controller.signal,
        });
      }
      clearTimeout(timeoutId);
      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After");
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : delay * Math.pow(2, i);
        console.warn(`AniList Rate Limit (429) hit. Waiting ${waitTime}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Anilist API failure: ${res.status} - ${text}`);
      }
      const json = await res.json();
      return json.data;
    } catch (err) {
      if (i === retries - 1) {
        console.warn("AniList request failed completely:", err.message);
        return null;
      }
      const waitTime = delay * Math.pow(2, i);
      console.warn(`Request failed: ${err.message}. Retrying in ${waitTime}ms...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
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

export async function getMangaList(variables) {
  try {
    const data = await fetchAnilist(MANGA_QUERY, variables, 3, 1000);
    if (data && data.Page) {
      return {
        pageInfo: data.Page.pageInfo,
        media: data.Page.media.map(mapAnilistMedia),
      };
    }
  } catch (err) {
    console.warn("getMangaList failed:", err.message);
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

// Whole-word terms — matched against tokenised genres/tags/title so "sex" does
// not fire on "Middlesex" or "sexuality". "sex" and "18+" live here.
const HARD_NSFW_WORDS = ["sex", "18+"];

/**
 * Decide whether a title's cover must be hidden behind an explicit-content
 * warning.
 *
 * Rules:
 *  - AniList's own `isAdult` flag → always hide.
 *  - Any hard term/word in genres or tags → always hide.
 *  - If the genre exactly matches "adult" or "mature" (common on scraper sites for smut) -> hide.
 *
 * @param {string[]} genres
 * @param {string} title
 * @param {{ tags?: string[], isAdult?: boolean }} [extra]
 */
export function isExplicitNSFW(genres = [], title = "", extra = {}) {
  if (extra.isAdult) return true;

  const genresArr = Array.isArray(genres) ? genres : typeof genres === "string" ? [genres] : [];
  const tagsArr = Array.isArray(extra?.tags) ? extra.tags : typeof extra?.tags === "string" ? [extra.tags] : [];

  const haystack = [...genresArr, ...tagsArr].map((g) =>
    String(g).toLowerCase().trim()
  );

  // Exact genre/tag matches for common scraper adult tags
  if (haystack.includes("adult") || haystack.includes("mature")) {
    return true;
  }

  // Substring match for multi-word hard terms.
  if (haystack.some((g) => HARD_NSFW_TERMS.some((term) => g.includes(term)))) {
    return true;
  }

  // Whole-word match for short ambiguous words, across genres/tags + title.
  const words = new Set(
    [...haystack, String(title || "").toLowerCase()]
      .join(" ")
      .split(/[^a-z0-9+]+/)
      .filter(Boolean)
  );
  if (HARD_NSFW_WORDS.some((w) => words.has(w))) return true;

  return false;
}
