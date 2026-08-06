const axios = require('axios');
const db = require('./db');

async function testCoverUrls() {
  const result = await db.query(`
    SELECT id, title, cover
    FROM manga
    WHERE cover LIKE '%anilist.co%'
    ORDER BY created_at DESC
    LIMIT 20
  `);
  
  console.log(`Testing ${result.rows.length} AniList covers...`);
  let broken = 0;
  let working = 0;
  
  for (const row of result.rows) {
    try {
      const response = await axios.head(row.cover, { timeout: 10000 });
      if (response.status === 200) {
        working++;
      } else {
        console.log(`  BROKEN (${response.status}): ${row.title} | ${row.cover}`);
        broken++;
      }
    } catch (err) {
      console.log(`  BROKEN (${err.response?.status || 'ERR'}): ${row.title} | ${row.cover}`);
      broken++;
    }
  }
  
  console.log(`\nWorking: ${working}, Broken: ${broken}`);
}

testCoverUrls().catch(err => {
  console.error(err);
  process.exit(1);
});
