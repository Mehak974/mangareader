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
const ANILIST_CLIENT_ID = process.env.ANILIST_CLIENT_ID || '50507';
const USER_AGENT = `Mangareader.pro/${ANILIST_CLIENT_ID} (+https://www.mangareader.pro)`;

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
});

let lastRetryAfter = 0;

async function post(query, variables, headers = {}) {
  return axios.post(ANILIST_URL, { query, variables }, {
    headers: { ...ANILIST_HEADERS, ...headers },
    timeout: 15000,
  });
}

async function callAniList(query, variables) {
  return anilistLimiter.schedule(async () => {
    try {
      const r = await post(query, variables);
      return r.data;
    } catch (err) {
      if (!err.response) throw err;

      if (err.response.status === 429) {
        const retryAfter = parseInt(err.response.headers['retry-after'] || '0', 10);
        const waitMs = retryAfter
          ? retryAfter * 1000
          : Math.max(Date.now() - lastRetryAfter, 1000) * 2;
        lastRetryAfter = Date.now();
        console.warn(`[anilist] 429 rate limit hit, retrying after ${waitMs}ms`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        return (await post(query, variables)).data;
      }

      err._anilistStatus = err.response.status;
      err._anilistData = err.response.data;
      throw err;
    }
  });
}

async function callAniListUser(query, variables, accessToken) {
  return anilistLimiter.schedule(async () => {
    try {
      const r = await post(query, variables, { Authorization: `Bearer ${accessToken}` });
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
