const axios = require('axios');
const db = require('./db');

const ANILIST_URL = 'https://graphql.anilist.co';
const ANILIST_QUERY_ALL = `
  query ($search: String) {
    Media (search: $search) {
      id
      type
      coverImage {
        extraLarge
        large
        medium
      }
    }
  }
`;

function titleCase(str) {
  return str.replace(/\w\S*/g, (txt) => {
    const exceptions = ['a', 'an', 'the', 'and', 'but', 'for', 'nor', 'or', 'so', 'yet', 'at', 'by', 'in', 'of', 'on', 'to', 'up', 'via'];
    const words = str.toLowerCase().split(' ');
    return words.map((word, index) => {
      if (index > 0 && exceptions.includes(word)) return word;
      return word.charAt(0).toUpperCase() + word.substr(1);
    }).join(' ');
  });
}

function addApostrophes(title) {
  return title
    .replace(/\b(\w+)s\b/g, (match, word) => {
      if (match.toLowerCase().endsWith('ss') || match.toLowerCase().endsWith('is') || match.toLowerCase().endsWith('us')) {
        return match;
      }
      return word + "'s";
    });
}

function generateSearchVariants(title) {
  const variants = new Set();
  variants.add(title);
  
  const titleCased = titleCase(title);
  if (titleCased !== title) variants.add(titleCased);
  
  const withApostrophes = addApostrophes(titleCased);
  if (withApostrophes !== titleCased) variants.add(withApostrophes);
  
  const withApostrophesLower = addApostrophes(title);
  if (withApostrophesLower !== title) variants.add(withApostrophesLower);
  
  const cleaned = title
    .replace(/\s*chapter\s*\d+.*$/i, '')
    .replace(/\s*-\s*chapter\s*\d+.*$/i, '')
    .replace(/\s*vol\.?\s*\d+.*$/i, '')
    .replace(/\s*\(.*?\)/g, '')
    .replace(/\s*-\s*.*$/g, '')
    .trim();
  
  if (cleaned !== title && cleaned.length > 3) {
    variants.add(cleaned);
    variants.add(titleCase(cleaned));
    variants.add(addApostrophes(titleCase(cleaned)));
  }
  
  return Array.from(variants);
}

async function fetchCoverFromAnilist(title) {
  const variants = generateSearchVariants(title);
  
  for (const searchTitle of variants) {
    try {
      const response = await axios.post(ANILIST_URL, {
        query: ANILIST_QUERY_ALL,
        variables: { search: searchTitle },
      }, {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.data && response.data.data && response.data.data.Media) {
        const media = response.data.data.Media;
        console.log(`  Found type: ${media.type} for "${searchTitle}"`);
        return media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium || null;
      }
    } catch (err) {
      if (err.response && err.response.status === 429) {
        console.warn('Rate limited, waiting 5s...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }
      if (err.response && err.response.status === 404) {
        continue;
      }
      console.warn(`AniList fetch failed for "${searchTitle}":`, err.message);
    }
  }
  return null;
}

async function backfillCovers() {
  const result = await db.query(`
    SELECT id, title, cover
    FROM manga
    WHERE cover IS NULL OR cover = ''
    ORDER BY created_at DESC
  `);

  console.log(`Found ${result.rows.length} manga with NULL/empty covers`);

  let updated = 0;
  let failed = 0;
  const failures = [];

  for (const row of result.rows) {
    console.log(`[${updated + failed + 1}/${result.rows.length}] Fetching cover for: ${row.title}`);
    const cover = await fetchCoverFromAnilist(row.title);

    if (cover) {
      await db.query('UPDATE manga SET cover = $1 WHERE id = $2', [cover, row.id]);
      console.log(`  ✓ Updated: ${cover}`);
      updated++;
    } else {
      console.log(`  ✗ No cover found`);
      failed++;
      failures.push(row.title);
    }

    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  console.log(`\nBackfill complete: ${updated} updated, ${failed} failed`);
  if (failures.length > 0) {
    console.log('\nFailed titles:');
    failures.forEach(t => console.log('  -', t));
  }
}

backfillCovers().catch(err => {
  console.error('Backfill error:', err);
  process.exit(1);
});
