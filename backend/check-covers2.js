const db = require('./db');

async function check() {
  const r = await db.query(`
    SELECT id, title, cover
    FROM manga
    WHERE cover IS NOT NULL AND cover != ''
      AND (cover NOT LIKE '%anilist.co%' AND cover NOT LIKE '%s4.anilist.co%')
    ORDER BY created_at DESC
    LIMIT 20
  `);
  console.log('Non-AniList covers:');
  r.rows.forEach(row => console.log(`  ${row.id} | ${row.title} | ${row.cover}`));
  console.log(`\nTotal: ${r.rows.length}`);
}

check().catch(e => console.error(e));