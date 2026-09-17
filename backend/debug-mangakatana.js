const axios = require('axios');
const cheerio = require('cheerio');

(async () => {
  console.log('=== MangaKatana tests ===');
  // Test Consumet
  try {
    const r = await axios.get('https://api.consumet.org/manga/mangakatana/tensei-shitara-ken-deshita', {timeout: 10000, validateStatus: () => true});
    console.log('consumet status:', r.status, 'data type:', typeof r.data);
    console.log('data keys:', Object.keys(r.data || {}).slice(0,5));
    if (r.data?.chapters) console.log('chapters:', r.data.chapters.length);
    if (r.data?.results) console.log('results:', r.data.results.length);
  } catch(e) { console.log('consumet err:', e.message); }
  // Test direct URL
  try {
    const r = await axios.get('https://mangakatana.com/manga/tensei-shitara-ken-deshita/', {timeout: 10000, headers: {'User-Agent':'Mozilla/5.0'}, validateStatus: () => true});
    console.log('direct status:', r.status, 'len:', r.data?.length);
  } catch(e) { console.log('direct err:', e.message); }
  // Try search
  try {
    const r = await axios.get('https://mangakatana.com/?search=tensei%20shitara%20ken%20deshita', {timeout: 10000, headers: {'User-Agent':'Mozilla/5.0'}, validateStatus: () => true});
    console.log('search status:', r.status, 'len:', r.data?.length);
    const $ = cheerio.load(r.data);
    const links = [];
    $('a[href*="/manga/"]').each((_,el) => { links.push($(el).attr('href')); });
    console.log('found manga links:', links.slice(0,5));
  } catch(e) { console.log('search err:', e.message); }
})();