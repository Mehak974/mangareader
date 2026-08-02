import { fetchApi } from "./api";

const isServer = typeof window === 'undefined';

export async function fetchAnilist(query, variables = {}, retries = 3, delay = 1500) {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      // Server components call AniList directly (no CORS on server).
      // Client components go through the backend proxy to avoid CORS.
      let res;
      if (isServer) {
        res = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ query, variables }),
          signal: controller.signal,
          next: { revalidate: 3600 },
        });
      } else {
        res = await fetchApi('/api/anilist', {
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
  query ($page: Int, $perPage: Int, $genre: String, $search: String, $sort: [MediaSort], $status: MediaStatus, $countryOfOrigin: CountryCode) {
    Page (page: $page, perPage: $perPage) {
      pageInfo {
        total
        currentPage
        lastPage
        hasNextPage
        perPage
      }
      media (type: MANGA, genre: $genre, search: $search, sort: $sort, status: $status, countryOfOrigin: $countryOfOrigin) {
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
    const data = await fetchAnilist(MANGA_QUERY, variables);
    if (data && data.Page) {
      return {
        pageInfo: data.Page.pageInfo,
        media: data.Page.media.map(mapAnilistMedia),
      };
    }

    // Fallback: Official MyAnimeList API v2
    console.warn("AniList unavailable. Falling back to official MAL API...");
    const malClientId = process.env.MAL_CLIENT_ID;
    if (!malClientId) {
      console.warn("MAL_CLIENT_ID not set, skipping MAL fallback.");
      return { pageInfo: { total: 0, currentPage: 1, lastPage: 1, hasNextPage: false, perPage: 10 }, media: [] };
    }

    const limit = variables.perPage || 12;
    const malHeaders = { 'X-MAL-CLIENT-ID': malClientId };
    let malUrl;

    if (variables.search) {
      malUrl = `https://api.myanimelist.net/v2/manga?q=${encodeURIComponent(variables.search)}&limit=${limit}&fields=id,title,main_picture,mean,num_chapters,status,genres`;
    } else {
      // Map AniList sort to MAL ranking_type
      let rankingType = 'all';
      if (variables.sort?.includes('TRENDING_DESC') || variables.sort?.includes('POPULARITY_DESC')) {
        rankingType = 'bypopularity';
      }
      if (variables.sort?.includes('SCORE_DESC')) {
        rankingType = 'all'; // MAL default = by score
      }
      malUrl = `https://api.myanimelist.net/v2/manga/ranking?ranking_type=${rankingType}&limit=${limit}&fields=id,title,main_picture,mean,num_chapters,status,genres`;
    }

    try {
      const malRes = await fetch(malUrl, { headers: malHeaders });
      if (malRes.ok) {
        const malData = await malRes.json();
        const items = malData.data || [];
        const mapped = items.map(entry => {
          const item = entry.node || entry;
          return {
            id: `mal-${item.id}`,
            t: item.title,
            ch: item.num_chapters ? `Ch ${item.num_chapters}` : "Ongoing",
            hot: false,
            rating: item.mean ? item.mean / 2 : 4.0,
            ongoing: item.status === 'currently_publishing',
            cover: item.main_picture?.large || item.main_picture?.medium || "",
            genres: (item.genres || []).map(g => g.name),
          };
        });
        return {
          pageInfo: { total: mapped.length, currentPage: 1, lastPage: 1, hasNextPage: false },
          media: mapped
        };
      }
    } catch (malErr) {
      console.warn("MAL fallback failed:", malErr.message);
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

// Soft signals: alone they do NOT hide the cover. Only when a hard signal is
// also present do they contribute. (adult / mature / josei / seinen.)
const SOFT_NSFW_TERMS = ["adult", "mature", "josei", "seinen"];

/**
 * Decide whether a title's cover must be hidden behind an explicit-content
 * warning.
 *
 * Rules:
 *  - AniList's own `isAdult` flag → always hide.
 *  - Any hard term/word in genres or tags → always hide.
 *  - Soft terms (adult/mature/josei) alone → do NOT hide.
 *
 * @param {string[]} genres
 * @param {string} title
 * @param {{ tags?: string[], isAdult?: boolean }} [extra]
 */
export function isExplicitNSFW(genres = [], title = "", extra = {}) {
  if (extra.isAdult) return true;

  const haystack = [...(genres || []), ...(extra.tags || [])].map((g) =>
    String(g).toLowerCase()
  );

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

  // Soft terms alone never hide — they only mattered above alongside a hard hit.
  return false;
}
