const db = require('./db');

async function checkOtherCovers() {
  const result = await db.query(`
    SELECT id, title, cover
    FROM manga
    WHERE cover IS NOT NULL AND cover != ''
      AND cover NOT LIKE '%anilist.co%'
      AND cover NOT LIKE '%myanimelist.net%'
      AND cover NOT LIKE '%cdn.myanimelist.net%'
    ORDER BY created_at DESC
    LIMIT 20
  `);
  
  console.log('Non-AniList/non-MAL covers:');
  result.rows.forEach(row => {
    console.log(`  ${row.id} | ${row.title} | ${row.cover}`);
  });
  
  if (result.rows.length === 0) {
    console.log('  None found - all covers are from AniList or MAL');
  }
}

checkOtherCovers().catch(err => {
  console.error(err);
  process.exit(1);
});
