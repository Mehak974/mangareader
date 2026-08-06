const db = require('./db');

async function fixCovers() {
  // Remove MAL cover - user wants AniList only
  const malResult = await db.query(`
    SELECT id, title, cover
    FROM manga
    WHERE cover LIKE '%myanimelist.net%' OR cover LIKE '%cdn.myanimelist.net%'
  `);
  
  console.log('MAL covers to remove:');
  for (const row of malResult.rows) {
    console.log(`  ${row.id} | ${row.title} | ${row.cover}`);
    await db.query('UPDATE manga SET cover = NULL WHERE id = $1', [row.id]);
    console.log(`  → Set to NULL`);
  }

  // Count remaining null covers
  const nullResult = await db.query(`
    SELECT COUNT(*) as count
    FROM manga
    WHERE cover IS NULL OR cover = ''
  `);
  console.log(`\nRemaining NULL/empty covers: ${nullResult.rows[0].count}`);
  console.log('These will show gradient fallback in UI.');
}

fixCovers().catch(err => {
  console.error(err);
  process.exit(1);
});
