const db = require('./db');

async function checkCovers() {
  const result = await db.query(`
    SELECT COUNT(*) as count
    FROM manga
    WHERE cover IS NULL OR cover = ''
  `);
  console.log('Remaining NULL/empty covers:', result.rows[0].count);
}

checkCovers().catch(err => {
  console.error(err);
  process.exit(1);
});
