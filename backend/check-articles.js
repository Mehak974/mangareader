const db = require('./db');

async function checkArticles() {
  // Check articles table structure
  const cols = await db.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'articles'
    ORDER BY ordinal_position
  `);
  console.log('articles columns:');
  cols.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type}) nullable=${r.is_nullable}`));

  // Check editorial_categories
  const catCols = await db.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'editorial_categories'
    ORDER BY ordinal_position
  `);
  console.log('\neditorial_categories columns:');
  catCols.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));

  // Check editorial_authors
  const authCols = await db.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'editorial_authors'
    ORDER BY ordinal_position
  `);
  console.log('\neditorial_authors columns:');
  authCols.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));

  // Check article_tags
  const tagCols = await db.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'article_tags'
    ORDER BY ordinal_position
  `);
  console.log('\narticle_tags columns:');
  tagCols.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));

  // Sample articles
  const articles = await db.query('SELECT * FROM articles LIMIT 5');
  console.log('\nSample articles:');
  articles.rows.forEach(r => {
    console.log(`  id=${r.id} slug=${r.slug} title=${r.title} featured_image=${r.featured_image} cover_image=${r.cover_image} og_image=${r.og_image}`);
  });
}

checkArticles().catch(err => {
  console.error(err);
  process.exit(1);
});
