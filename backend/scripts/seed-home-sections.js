/**
 * Seed homepage sections from AniList into the database.
 *
 * Usage:
 *   API_URL="https://api.mangareader.pro" DATABASE_URL="postgresql://..." node backend/scripts/seed-home-sections.js
 */

require('dotenv').config();
const axios = require('axios');
const db = require('../db');

const API_BASE = (process.env.API_URL || 'http://localhost:3003').replace(/\/$/, '');

const SECTIONS = [
  {
    key: 'popular_now',
    query: `
      query ($perPage: Int) {
        Page (perPage: $perPage) {
          media (type: MANGA, genre: "Fantasy", countryOfOrigin: "KR", sort: [POPULARITY_DESC]) {
            id
            title { english romaji userPreferred }
            coverImage { large medium color }
            genres averageScore status chapters trending isAdult
            tags { name isAdult }
          }
        }
      }
    `,
    variables: { perPage: 12 },
  },
  {
    key: 'readers_also_love',
    query: `
      query ($perPage: Int) {
        Page (perPage: $perPage) {
          media (type: MANGA, sort: [POPULARITY_DESC]) {
            id
            title { english romaji userPreferred }
            coverImage { large medium color }
            genres averageScore status chapters trending isAdult
            tags { name isAdult }
          }
        }
      }
    `,
    variables: { perPage: 12 },
  },
];

function mapMedia(media) {
  return {
    id: media.id,
    t: media.title?.userPreferred || media.title?.english || media.title?.romaji || 'Unknown',
    title: media.title?.english || media.title?.romaji || media.title?.userPreferred || 'Unknown',
    cover: media.coverImage?.large || media.coverImage?.medium || '',
    ch: media.chapters ? `Ch ${media.chapters}` : '',
    g: media.genres?.[0] || 'Action',
    hot: media.trending ? Math.round(media.trending) : undefined,
    rating: media.averageScore ? (media.averageScore / 10).toFixed(1) : undefined,
    genres: media.genres || [],
    isAdult: !!media.isAdult,
    tags: media.tags || [],
    ongoing: media.status === 'RELEASING',
  };
}

async function fetchFromAniList(query, variables) {
  const res = await axios.post(`${API_BASE}/api/anilist`, { query, variables }, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000,
  });
  return res.data?.data?.Page?.media || [];
}

async function seedSection(section) {
  console.log(`\nFetching ${section.key}...`);
  const media = await fetchFromAniList(section.query, section.variables);
  const mapped = media.map(mapMedia);

  if (mapped.length === 0) {
    console.warn(`  No media returned for ${section.key}`);
    return false;
  }

  console.log(`  Got ${mapped.length} items, inserting into DB...`);
  await db.query(
    `INSERT INTO home_sections (section_key, media, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (section_key) DO UPDATE SET media = EXCLUDED.media, updated_at = CURRENT_TIMESTAMP`,
    [section.key, JSON.stringify(mapped)]
  );
  console.log(`  ✅ ${section.key}: ${mapped.length} items saved`);
  return true;
}

async function main() {
  console.log('Seeding homepage sections from AniList...');
  console.log(`API: ${API_BASE}`);

  try {
    await db.ensureConnection();
  } catch (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }

  const results = await Promise.allSettled(SECTIONS.map(seedSection));
  const failed = results.filter(r => r.status === 'rejected').length;

  console.log(`\nDone: ${results.length - failed} succeeded, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
