const db = require('./db');
db.query("SELECT COUNT(*) as c FROM manga WHERE cover = ''").then(r => {
  console.log('Empty string covers:', r.rows[0].c);
  process.exit(0);
}).catch(e => console.error(e));