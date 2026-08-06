const db = require('./db');

async function checkLocalBlogImages() {
  const result = await db.query(`
    SELECT id, slug, title, cover_image, og_image
    FROM articles
    WHERE cover_image LIKE '/%' OR og_image LIKE '/%'
  `);
  
  console.log('Blog posts with local image paths:');
  result.rows.forEach(row => {
    console.log(`  ${row.slug} | cover: ${row.cover_image} | og: ${row.og_image}`);
  });

  if (result.rows.length === 0) {
    console.log('  None found');
  }
}

checkLocalBlogImages().catch(err => {
  console.error(err);
  process.exit(1);
});
