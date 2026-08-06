const db = require('./db');

async function checkCoverDomains() {
  const result = await db.query(`
    SELECT 
      id,
      title,
      cover,
      CASE 
        WHEN cover LIKE '%anilist.co%' THEN 'anilist'
        WHEN cover LIKE '%myanimelist.net%' THEN 'mal'
        WHEN cover LIKE '%cdn.myanimelist.net%' THEN 'mal-cdn'
        WHEN cover LIKE '%pinimg.com%' THEN 'pinimg'
        WHEN cover IS NULL OR cover = '' THEN 'null'
        ELSE 'other'
      END as domain
    FROM manga
    WHERE cover IS NOT NULL AND cover != ''
    ORDER BY created_at DESC
    LIMIT 50
  `);
  
  console.log('Recent covers by domain:');
  result.rows.forEach(row => {
    console.log(`${row.domain.padEnd(10)} | ${row.id.padEnd(30)} | ${row.title.slice(0, 40).padEnd(40)} | ${row.cover.slice(0, 60)}`);
  });

  const domainCounts = await db.query(`
    SELECT 
      CASE 
        WHEN cover LIKE '%anilist.co%' THEN 'anilist'
        WHEN cover LIKE '%myanimelist.net%' THEN 'mal'
        WHEN cover LIKE '%cdn.myanimelist.net%' THEN 'mal-cdn'
        WHEN cover LIKE '%pinimg.com%' THEN 'pinimg'
        WHEN cover IS NULL OR cover = '' THEN 'null'
        ELSE 'other'
      END as domain,
      COUNT(*) as count
    FROM manga
    GROUP BY 1
    ORDER BY count DESC
  `);
  
  console.log('\nCover domain distribution:');
  domainCounts.rows.forEach(row => {
    console.log(`${row.domain.padEnd(10)}: ${row.count}`);
  });
}

checkCoverDomains().catch(err => {
  console.error(err);
  process.exit(1);
});
