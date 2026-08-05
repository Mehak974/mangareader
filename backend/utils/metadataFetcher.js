const axios = require('axios');
const db = require('../db');

const ANILIST_URL = 'https://graphql.anilist.co';
const JIKAN_URL = 'https://api.jikan.moe/v4';

const ANILIST_QUERY = `
  query ($search: String, $id: Int) {
    Media (search: $search, id: $id, type: MANGA) {
      id
      idMal
      title {
        english
        romaji
        native
        userPreferred
      }
      synonyms
      coverImage {
        extraLarge
        large
        medium
      }
      bannerImage
      description
      genres
      tags {
        name
      }
      staff {
        edges {
          role
          node {
            name {
              full
            }
          }
        }
      }
      status
      startDate {
        year
        month
        day
      }
      endDate {
        year
        month
        day
      }
      averageScore
      popularity
      favourites
      chapters
      countryOfOrigin
      format
    }
  }
`;

async function fetchFromAnilist(searchQuery, id = null, retries = 3, delay = 2000) {
  const variables = id ? { id: parseInt(id) } : { search: searchQuery };
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.post(ANILIST_URL, {
        query: ANILIST_QUERY,
        variables,
      }, {
        timeout: 10000,
      });

      if (response.data && response.data.errors) {
        const has429 = response.data.errors.some(e => e.status === 429 || e.message.includes('Too Many Requests'));
        if (has429) {
          const waitTime = delay * Math.pow(2, i);
          console.warn(`AniList Backend Rate Limit (429) hit. Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }

      if (response.data && response.data.data && response.data.data.Media) {
        return response.data.data.Media;
      }
    } catch (err) {
      if (err.response && err.response.status === 429) {
        const waitTime = delay * Math.pow(2, i);
        console.warn(`AniList Backend Rate Limit (429) status hit. Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      if (i === retries - 1) {
        console.warn('AniList metadata fetch failed after retries:', err.message);
        break;
      }
      const waitTime = delay * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  return null;
}

/**
 * Fallback: Fetch metadata from MyAnimeList (via Jikan API)
 */
async function fetchFromMAL(searchQuery, malId = null) {
  try {
    let url = `${JIKAN_URL}/manga`;
    if (malId) {
      url = `${JIKAN_URL}/manga/${malId}`;
      const response = await axios.get(url, { timeout: 10000 });
      if (response.data && response.data.data) {
        return response.data.data;
      }
    } else {
      const response = await axios.get(url, {
        params: { q: searchQuery, limit: 1 },
        timeout: 10000,
      });
      if (response.data && response.data.data && response.data.data.length > 0) {
        return response.data.data[0];
      }
    }
  } catch (err) {
    console.warn('MAL metadata fetch warning:', err.message);
  }
  return null;
}

function normalizeMALData(manga) {
  if (!manga) return null;

  const title = manga.title || 'Untitled Manga';
  const description = manga.synopsis || '';
  const status = manga.status === 'Publishing' ? 'RELEASING' : (manga.status === 'Finished' ? 'FINISHED' : 'RELEASING');
  const rating = manga.score ? manga.score / 2 : 4.0;
  const popularity = manga.members || 0;
  const genres = (manga.genres || []).map(g => g.name || g).filter(Boolean);
  const authorsList = (manga.authors || []).map(a => ({
    name: a.name,
    role: a.role || 'author'
  }));

  const formatPartDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const startDate = formatPartDate(manga.published?.from);
  const endDate = formatPartDate(manga.published?.to);

  return {
    ...manga,
    _source: 'mal',
    id: manga.mal_id,
    idMal: manga.mal_id,
    title: {
      english: title,
      romaji: null,
      native: null,
      userPreferred: title,
    },
    description,
    status,
    averageScore: rating * 20,
    score: rating,
    popularity,
    genres,
    startDate: startDate ? { year: parseInt(startDate.split('-')[0]), month: parseInt(startDate.split('-')[1]), day: parseInt(startDate.split('-')[2]) } : null,
    endDate: endDate ? { year: parseInt(endDate.split('-')[0]), month: parseInt(endDate.split('-')[1]), day: parseInt(endDate.split('-')[2]) } : null,
    staff: authorsList.length > 0 ? { edges: authorsList.map(a => ({ role: a.role, node: { name: { full: a.name } } })) } : null,
    authors: authorsList,
    chapters: manga.chapters || null,
    countryOfOrigin: manga.country_of_origin || (manga.title?.match(/[\uac00-\ud7a3]/) ? 'KR' : 'JP'),
    format: manga.type ? manga.type.toUpperCase() : 'MANGA',
    favourites: manga.favorites || 0,
    synonyms: manga.synonyms || [],
  };
}

/**
 * Normalize and save/upsert a manga record in the canonical database
 */
async function saveCanonicalManga(media, sourceId = null, sourceSlug = null) {
  if (!media) return null;

  // Generate canonical ID
  const isMalSource = media._source === 'mal';
  const canonicalId = isMalSource
    ? `mal-${media.mal_id || media.id || Math.random().toString(36).substr(2, 9)}`
    : `anilist-${media.id || Math.random().toString(36).substr(2, 9)}`;
  const title = media.title?.english || media.title?.romaji || media.title?.userPreferred || media.title || 'Untitled Manga';
  const cover = media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium || '';
  const description = media.description || media.synopsis || '';
  const status = media.status || 'RELEASING';
  const rating = media.averageScore ? (media.averageScore / 20) : (media.score || 4.0);
  const popularity = media.popularity || media.members || 0;
  const country = media.countryOfOrigin || (media.authors?.some(a => a.name.includes('Korean') || media.title?.native?.match(/[\uac00-\ud7a3]/)) ? 'KR' : 'JP');
  const format = media.format || 'MANGA';
  const bannerImage = media.bannerImage || '';
  const favorites = media.favourites || media.favorites || 0;
  const totalChapters = media.chapters || null;

  // Format Dates
  const formatPartDate = (dateObj) => {
    if (!dateObj || !dateObj.year) return '';
    return `${dateObj.year}-${String(dateObj.month || 1).padStart(2, '0')}-${String(dateObj.day || 1).padStart(2, '0')}`;
  };
  const startDate = typeof media.startDate === 'object' ? formatPartDate(media.startDate) : (media.published?.from?.split('T')[0] || '');
  const endDate = typeof media.endDate === 'object' ? formatPartDate(media.endDate) : (media.published?.to?.split('T')[0] || '');

  const anilistId = !isMalSource && media.id ? String(media.id) : null;
  const malId = media.idMal ? String(media.idMal) : (media.mal_id ? String(media.mal_id) : null);

  // 1. Insert into manga table
  await db.query(`
    INSERT INTO manga (id, title, cover, description, status, rating, popularity, country, format, banner_image, start_date, end_date, favorites, total_chapters, anilist_id, mal_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      cover = EXCLUDED.cover,
      description = EXCLUDED.description,
      status = EXCLUDED.status,
      rating = EXCLUDED.rating,
      popularity = EXCLUDED.popularity,
      country = EXCLUDED.country,
      format = EXCLUDED.format,
      banner_image = EXCLUDED.banner_image,
      favorites = EXCLUDED.favorites,
      total_chapters = EXCLUDED.total_chapters
  `, [canonicalId, title, cover, description, status, rating, popularity, country, format, bannerImage, startDate, endDate, favorites, totalChapters, anilistId, malId]);

  // 2. Insert into metadata table
  const englishTitle = media.title?.english || null;
  const romajiTitle = media.title?.romaji || null;
  const nativeTitle = media.title?.native || null;
  const alternativeTitles = JSON.stringify(media.title ? Object.values(media.title).filter(Boolean) : []);
  const synonyms = JSON.stringify(media.synonyms || []);

  await db.query(`
    INSERT INTO metadata (manga_id, english_title, romaji_title, native_title, alternative_titles, synonyms)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (manga_id) DO UPDATE SET
      english_title = EXCLUDED.english_title,
      romaji_title = EXCLUDED.romaji_title,
      native_title = EXCLUDED.native_title,
      alternative_titles = EXCLUDED.alternative_titles,
      synonyms = EXCLUDED.synonyms
  `, [canonicalId, englishTitle, romajiTitle, nativeTitle, alternativeTitles, synonyms]);

  // 3. Genres mapping
  const genres = media.genres || [];
  for (const genreName of genres) {
    // Insert genre if it doesn't exist
    await db.query('INSERT INTO genres (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [genreName]);
    const genreRes = await db.query('SELECT id FROM genres WHERE name = $1', [genreName]);
    if (genreRes.rows.length > 0) {
      const genreId = genreRes.rows[0].id;
      await db.query('INSERT INTO manga_genres (manga_id, genre_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [canonicalId, genreId]);
    }
  }

  // 4. Tags mapping
  const tags = (media.tags || []).map(t => t.name || t).filter(Boolean);
  for (const tagName of tags) {
    await db.query('INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [tagName]);
    const tagRes = await db.query('SELECT id FROM tags WHERE name = $1', [tagName]);
    if (tagRes.rows.length > 0) {
      const tagId = tagRes.rows[0].id;
      await db.query('INSERT INTO manga_tags (manga_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [canonicalId, tagId]);
    }
  }

  // 5. Authors / staff mapping
  const authorsList = [];
  if (media.staff && media.staff.edges) {
    media.staff.edges.forEach(edge => {
      const name = edge.node.name.full;
      const role = edge.role ? edge.role.toLowerCase() : 'author';
      authorsList.push({ name, role });
    });
  } else if (media.authors) {
    media.authors.forEach(author => {
      authorsList.push({ name: author.name, role: 'author' });
    });
  }

  for (const author of authorsList) {
    await db.query('INSERT INTO authors (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [author.name]);
    const authorRes = await db.query('SELECT id FROM authors WHERE name = $1', [author.name]);
    if (authorRes.rows.length > 0) {
      const authorId = authorRes.rows[0].id;
      const role = author.role.includes('artist') ? 'artist' : 'author';
      await db.query('INSERT INTO manga_authors (manga_id, author_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [canonicalId, authorId, role]);
    }
  }

  // 6. Source Mapping (if sourceId and sourceSlug are passed)
  if (sourceId && sourceSlug) {
    await db.query(`
      INSERT INTO source_mappings (manga_id, source_id, source_slug)
      VALUES ($1, $2, $3)
      ON CONFLICT (manga_id, source_id) DO UPDATE SET
        source_slug = EXCLUDED.source_slug
    `, [canonicalId, sourceId, sourceSlug]);
  }

  return canonicalId;
}

/**
 * Main public entrypoint to find or fetch and normalize manga metadata
 */
async function getOrFetchMangaMetadata(title, sourceId = null, sourceSlug = null) {
  // Check if mapping or title already exists in DB
  let existingManga = null;

  if (sourceId && sourceSlug) {
    const mappingRes = await db.query('SELECT manga_id FROM source_mappings WHERE source_id = $1 AND source_slug = $2', [sourceId, sourceSlug]);
    if (mappingRes.rows.length > 0) {
      existingManga = mappingRes.rows[0].manga_id;
    }
  }

  if (!existingManga) {
    const titleRes = await db.query(`
      SELECT m.id FROM manga m
      LEFT JOIN metadata md ON m.id = md.manga_id
      WHERE m.title ILIKE $1 
         OR md.english_title ILIKE $1 
         OR md.romaji_title ILIKE $1
         OR md.native_title ILIKE $1
      LIMIT 1
    `, [title]);
    if (titleRes.rows.length > 0) {
      existingManga = titleRes.rows[0].id;
      if (sourceId && sourceSlug) {
        // Create source mapping for the existing manga
        await db.query(`
          INSERT INTO source_mappings (manga_id, source_id, source_slug)
          VALUES ($1, $2, $3) ON CONFLICT DO NOTHING
        `, [existingManga, sourceId, sourceSlug]);
      }
    }
  }

  if (existingManga) {
    return existingManga;
  }

  // If not found in DB, fetch from external services
  console.log(`Fetching metadata for "${title}" from external APIs...`);
  let media = await fetchFromAnilist(title);
  
  if (!media) {
    console.log(`AniList failed for "${title}", trying MyAnimeList fallback...`);
    const malRaw = await fetchFromMAL(title);
    if (malRaw) {
      media = normalizeMALData(malRaw);
    }
  }
  
  if (media) {
    const savedId = await saveCanonicalManga(media, sourceId, sourceSlug);
    return savedId;
  }

  // fallback to generic local entry if all lookups failed
  const fallbackId = `local-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  await db.query(`
    INSERT INTO manga (id, title, status, cover, description, banner_image, rating, popularity, country, format)
    VALUES ($1, $2, 'RELEASING', $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      status = EXCLUDED.status,
      cover = COALESCE(manga.cover, EXCLUDED.cover),
      description = COALESCE(manga.description, EXCLUDED.description),
      banner_image = COALESCE(manga.banner_image, EXCLUDED.banner_image),
      rating = COALESCE(manga.rating, EXCLUDED.rating),
      popularity = COALESCE(manga.popularity, EXCLUDED.popularity),
      country = COALESCE(manga.country, EXCLUDED.country),
      format = COALESCE(manga.format, EXCLUDED.format)
  `, [fallbackId, title, '', 'No description available.', '', 4.5, 0, 'JP', 'MANGA']);

  if (sourceId && sourceSlug) {
    await db.query(`
      INSERT INTO source_mappings (manga_id, source_id, source_slug)
      VALUES ($1, $2, $3) ON CONFLICT DO NOTHING
    `, [fallbackId, sourceId, sourceSlug]);
  }

  return fallbackId;
}

module.exports = {
  fetchFromAnilist,
  fetchFromMAL,
  saveCanonicalManga,
  getOrFetchMangaMetadata,
};
