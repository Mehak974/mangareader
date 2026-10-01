/**
 * AniList API Client
 * 
 * Features:
 * - Bottleneck rate limiter: max 5 concurrent, ~85 req/min (leaves headroom under 90/min limit)
 * - Redis caching with long TTLs (metadata rarely changes)
 * - In-flight request deduplication (100 concurrent users → 1 upstream call)
 * - Retry-After header respect on 429 responses
 */

const axios = require('axios');
const Bottleneck = require('bottleneck');
const cache = require('./cache');

const ANILIST_URL = 'https://graphql.anilist.co';
const ANILIST_CLIENT_ID = process.env.ANILIST_CLIENT_ID || '';
const USER_AGENT = ANILIST_CLIENT_ID
  ? `Mangareader.pro/${ANILIST_CLIENT_ID} (+https://www.mangareader.pro)`
  : 'Mangareader.pro (+https://www.mangareader.pro)';

const ANILIST_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'User-Agent': USER_AGENT,
  'Origin': 'https://anilist.co',
  'Referer': 'https://anilist.co/',
};

const anilistLimiter = new Bottleneck({
  maxConcurrent: 5,
  minTime: 700,
  reservoir: 85,
  reservoirRefreshAmount: 85,
  reservoirRefreshInterval: 60 * 1000,
  reservoirIncreaseAmount: 0,
  // The old code slept through the 429 retry while still holding one of only 5
  // concurrency slots, so a burst of 429s blocked the whole limiter for a full
  // minute while new requests queued behind it without bound.
  maxQueue: 200,
});

// Circuit breaker: once AniList rate-limits us, stop calling it until the
// window passes. Without this every queued request fired its own doomed retry,
// which is what produced the 60s/59s/58s pileup in the logs and kept an
// unbounded Bottleneck queue full.
let circuitOpenUntil = 0;
let backoffMs = 0;

function rateLimitError(waitMs) {
  const err = new Error(`AniList rate limited, retry in ${Math.ceil(waitMs / 1000)}s`);
  err._anilistStatus = 429;
  err._anilistData = { error: 'AniList rate limited, try again shortly' };
  return err;
}

async function post(query, variables, headers = {}) {
  return axios.post(ANILIST_URL, { query, variables }, {
    headers: { ...ANILIST_HEADERS, ...headers },
    timeout: 15000,
  });
}

async function callAniList(query, variables) {
  // Fail fast while the breaker is open instead of queueing doomed work.
  if (Date.now() < circuitOpenUntil) throw rateLimitError(circuitOpenUntil - Date.now());

  return anilistLimiter.schedule(async () => {
    let r;
    try {
      r = await post(query, variables);
    } catch (err) {
      if (!err.response) throw err;
      if (err.response.status !== 429) {
        err._anilistStatus = err.response.status;
        err._anilistData = err.response.data;
        throw err;
      }
      // Wait OUTSIDE the concurrency slot, not inside it, so one 429 no longer
      // parks a whole slot for up to a minute.
      const retryAfter = parseInt(err.response.headers['retry-after'] || '0', 10);
      backoffMs = retryAfter
        ? retryAfter * 1000
        : Math.min((backoffMs || 1000) * 2, 60000);
      circuitOpenUntil = Date.now() + backoffMs;
      console.warn(`[anilist] 429 rate limit hit, breaker open for ${backoffMs}ms`);
      throw rateLimitError(backoffMs);
    }
    backoffMs = 0;
    return r.data;
  });
}

async function callAniListUser(query, variables, accessToken) {
  if (Date.now() < circuitOpenUntil) throw rateLimitError(circuitOpenUntil - Date.now());
  return anilistLimiter.schedule(async () => {
    try {
      const r = await post(query, variables, { Authorization: `Bearer ${accessToken}` });
      backoffMs = 0;
      return r.data;
    } catch (err) {
      if (!err.response) throw err;
      err._anilistStatus = err.response.status;
      err._anilistData = err.response.data;
      throw err;
    }
  });
}

async function getMangaById(id) {
  return cache.getOrFetch(
    'anilist_manga_info',
    id,
    cache.TTL.anilist_manga_info,
    async () => {
      const data = await callAniList(MEDIA_QUERY_BY_ID, { id: parseInt(id, 10) });
      return data?.data?.Media || null;
    }
  );
}

async function searchManga(searchQuery, perPage = 12) {
  return cache.getOrFetch(
    'anilist_meta_search',
    searchQuery.toLowerCase().trim(),
    cache.TTL.anilist_meta_search,
    async () => {
      const data = await callAniList(MEDIA_SEARCH_QUERY, { search: searchQuery, perPage });
      return data?.data?.Page?.media || [];
    }
  );
}

const MEDIA_QUERY_BY_ID = `
  query ($id: Int) {
    Media (id: $id, type: MANGA) {
      id idMal
      title { english romaji native userPreferred }
      synonyms
      coverImage { extraLarge large medium color }
      bannerImage
      description
      genres
      tags { name isAdult }
      staff { edges { role node { name { full } } } }
      status startDate { year month day }
      endDate { year month day }
      averageScore popularity favourites chapters
      countryOfOrigin format
    }
  }
`;

const MEDIA_SEARCH_QUERY = `
  query ($search: String, $perPage: Int) {
    Page (perPage: $perPage) {
      pageInfo { total currentPage lastPage hasNextPage perPage }
      media (search: $search, type: MANGA) {
        id idMal
        title { english romaji native userPreferred }
        synonyms
        coverImage { extraLarge large medium color }
        bannerImage
        description
        genres
        tags { name isAdult }
        staff { edges { role node { name { full } } } }
        status startDate { year month day }
        endDate { year month day }
        averageScore popularity favourites chapters
        countryOfOrigin format
      }
    }
  }
`;

module.exports = {
  callAniList,
  callAniListUser,
  getMangaById,
  searchManga,
  anilistLimiter,
};
