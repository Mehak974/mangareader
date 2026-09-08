/**
 * Refresh all 4 homepage sections from AniList and store in DB.
 * 
 * Usage:
 *   ADMIN_TOKEN="65e831db1096581739ee721291a306554a2ee5b984c010ecc96dfbb2ebdfef5f" API_URL="https://api.mangareader.pro" node scripts/refresh-home-sections.js
 */

const axios = require('axios');

const API_URL = (process.env.API_URL || 'http://localhost:3003').replace(/\/$/, '');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

if (!ADMIN_TOKEN) {
  console.error('ADMIN_TOKEN env var is required');
  process.exit(1);
}

const sections = [
  { key: 'popular_now', label: 'Popular Right Now' },
  { key: 'readers_also_love', label: 'Readers Also Love' },
  { key: 'trending', label: 'Trending This Week' },
  { key: 'recently_added', label: 'Recently Added' },
];

async function refreshSection(section) {
  try {
    const url = `${API_URL}/api/admin/home/sections/${section.key}/refresh`;
    const res = await axios.post(url, {}, {
      headers: {
        'X-Admin-Token': ADMIN_TOKEN,
      },
      timeout: 60000,
    });
    console.log(`✅ ${section.label}: ${res.data.count || 0} items (section_key=${res.data.section_key || section.key})`);
    return res.data;
  } catch (err) {
    console.error(`❌ ${section.label}: ${err.response?.status || 'ERR'} ${err.response?.data?.error || err.message}`);
    return null;
  }
}

async function main() {
  console.log(`Refreshing homepage sections at ${API_URL}...`);
  
  const results = await Promise.allSettled(
    sections.map(refreshSection)
  );
  
  const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
  const failed = results.length - successful;
  
  console.log(`\nDone: ${successful} succeeded, ${failed} failed`);
  
  if (failed > 0) {
    console.log('\nCheck backend logs for details. Common issues:');
    console.log('  - AniList rate limit (429) → wait 60s and retry');
    console.log('  - Invalid ADMIN_TOKEN');
    console.log('  - Backend not running / unreachable');
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

main();
