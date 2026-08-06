const db = require('./db');

async function check() {
  const r = await db.query('SELECT id, slug, title, cover_image, og_image FROM articles WHERE cover_image IS NOT NULL AND cover_image != \'\' LIMIT 5');
  r.rows.forEach(row => console.log(row.slug, '|', row.cover_image, '|', row.og_image));
}

check().catch(e => console.error(e));