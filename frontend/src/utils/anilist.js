import { fetchApi } from "./api";

export async function fetchAnilist(query, variables = {}, retries = 3, delay = 1500) {
  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 3600 },
  };

  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch('https://graphql.anilist.co', options);
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

    // Fallback: Query MyAnimeList (Jikan API)
    console.warn("AniList returned empty/rate-limited. Falling back to MyAnimeList Jikan API...");
    let jikanUrl = "https://api.jikan.moe/v4/manga";
    if (variables.search) {
      jikanUrl += `?q=${encodeURIComponent(variables.search)}&limit=${variables.perPage || 12}`;
    } else if (variables.sort && variables.sort.includes("UPDATED_AT_DESC")) {
      jikanUrl += `?order_by=start_date&sort=desc&status=publishing&limit=${variables.perPage || 12}`;
    } else if (variables.sort && variables.sort.includes("TRENDING_DESC")) {
      jikanUrl += `?order_by=score&sort=desc&status=publishing&limit=${variables.perPage || 12}`;
    } else {
      jikanUrl += `?order_by=popularity&limit=${variables.perPage || 12}`;
    }

    const jikanRes = await fetch(jikanUrl);
    if (jikanRes.ok) {
      const jikanData = await jikanRes.json();
      if (jikanData.data) {
        const mapped = jikanData.data.map(item => ({
          id: `mal-${item.mal_id}`,
          t: item.title_english || item.title,
          ch: item.chapters ? `Ch ${item.chapters}` : "Ongoing",
          hot: item.popularity < 1000,
          rating: item.score ? item.score / 2 : 4.0,
          ongoing: item.publishing,
          cover: item.images?.jpg?.image_url || "",
          genres: (item.genres || []).map(g => g.name),
        }));
        return {
          pageInfo: { total: jikanData.pagination?.items?.total || 100, currentPage: 1, lastPage: 1, hasNextPage: false },
          media: mapped
        };
      }
    }
  } catch (err) {
    console.warn("Jikan MyAnimeList fallback failed:", err.message);
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
