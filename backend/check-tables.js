const db = require('./db');

async function checkTables() {
  const result = await db.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);
  
  console.log('Tables in database:');
  result.rows.forEach(row => {
    console.log(`  ${row.table_name}`);
  });
}

checkTables().catch(err => {
  console.error(err);
  process.exit(1);
});
