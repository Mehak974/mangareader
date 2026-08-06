const axios = require('axios');
const db = require('./db');

async function testBlogImages() {
  const result = await db.query(`
    SELECT id, slug, title, cover_image, og_image
    FROM articles
    WHERE cover_image IS NOT NULL AND cover_image != ''
    LIMIT 10
  `);
  
  console.log('Testing blog cover images...');
  let broken = 0;
  let working = 0;
  
  for (const row of result.rows) {
    try {
      const response = await axios.head(row.cover_image, { timeout: 10000 });
      if (response.status === 200) {
        working++;
      } else {
        console.log(`  BROKEN (${response.status}): ${row.title} | ${row.cover_image}`);
        broken++;
      }
    } catch (err) {
      console.log(`  BROKEN (${err.response?.status || 'ERR'}): ${row.title} | ${row.cover_image}`);
      broken++;
    }
  }
  
  console.log(`\nWorking: ${working}, Broken: ${broken}`);
}

testBlogImages().catch(err => {
  console.error(err);
  process.exit(1);
});
