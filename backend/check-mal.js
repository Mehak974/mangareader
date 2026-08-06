const db = require('./db');

async function checkMalCover() {
  const result = await db.query(`
    SELECT id, title, cover
    FROM manga
    WHERE cover LIKE '%myanimelist.net%' OR cover LIKE '%cdn.myanimelist.net%'
  `);
  
  console.log('MAL covers:');
  result.rows.forEach(row => {
    console.log(row.id, '|', row.title, '|', row.cover);
  });
}

checkMalCover().catch(err => {
  console.error(err);
  process.exit(1);
});
