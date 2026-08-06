const db = require('./db');

async function checkBlogImages() {
  const result = await db.query(`
    SELECT bp.id, bp.slug, bp.title, bp.featured_image, bp.og_image, bp.cover_image
    FROM blog_posts bp
    WHERE bp.featured_image IS NOT NULL AND bp.featured_image != ''
       OR bp.og_image IS NOT NULL AND bp.og_image != ''
       OR bp.cover_image IS NOT NULL AND bp.cover_image != ''
    ORDER BY bp.published_at DESC
    LIMIT 20
  `);
  
  console.log('Blog posts with images:');
  result.rows.forEach(row => {
    console.log(`  ${row.slug} | featured: ${row.featured_image || 'none'} | og: ${row.og_image || 'none'} | cover: ${row.cover_image || 'none'}`);
  });

  const nullResult = await db.query(`
    SELECT COUNT(*) as count
    FROM blog_posts
    WHERE featured_image IS NULL OR featured_image = ''
  `);
  console.log(`\nBlog posts without featured_image: ${nullResult.rows[0].count}`);
}

checkBlogImages().catch(err => {
  console.error(err);
  process.exit(1);
});
