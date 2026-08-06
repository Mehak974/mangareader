const db = require('./db');

async function checkCovers() {
  const result = await db.query(`
    SELECT id, title, cover
    FROM manga
    WHERE cover IS NULL OR cover = ''
    ORDER BY created_at DESC
    LIMIT 20
  `);
  console.log('NULL/empty covers:', result.rows.length);
  result.rows.forEach(row => {
    console.log(row.id, '|', row.title, '|', JSON.stringify(row.cover));
  });

  const allResult = await db.query(`
    SELECT id, title, cover
    FROM manga
    ORDER BY created_at DESC
    LIMIT 10
  `);
  console.log('\nRecent covers:');
  allResult.rows.forEach(row => {
    console.log(row.id, '|', row.title, '|', JSON.stringify(row.cover));
  });
}

checkCovers().catch(err => {
  console.error(err);
  process.exit(1);
});
