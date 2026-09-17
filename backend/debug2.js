const axios = require('axios');
const cheerio = require('cheerio');

(async () => {
  console.log('=== MangaDex real One Piece ===');
  // Real One Piece on MangaDex
  try {
    const searchRes = await axios.get('https://api.mangadex.org/manga?title=one%20piece&limit=1&contentRating[]=safe', {timeout: 10000});
    const realId = searchRes.data.data[0].id;
    console.log('real One Piece id:', realId);
    const r = await axios.get('https://api.mangadex.org/manga/' + realId + '/feed?translatedLanguage[]=en&limit=500&offset=0&order[chapter]=desc', {timeout: 15000});
    console.log('feed count:', r.data.data?.length);
    if (r.data.data?.length) console.log('first chapter:', r.data.data[0].attributes.chapter);
  } catch(e) { console.log('err:', e.response?.status, e.message); }

  console.log('\n=== MangaKatana real URL ===');
  try {
    const r = await axios.get('https://mangakatana.com/manga/tensei-shitara-ken-deshita.17971/', {timeout: 10000, headers: {'User-Agent':'Mozilla/5.0'}, validateStatus: () => true});
    console.log('direct status:', r.status, 'len:', r.data?.length);
    const $ = cheerio.load(r.data);
    console.log('title:', $('h1.heading, h1').first().text().trim());
    const chapters = [];
    $('.chapters a').each((_, el) => {
      const href = $(el).attr('href') || '';
      chapters.push({title: $(el).text().trim(), href});
    });
    console.log('chapters found:', chapters.length, 'first:', JSON.stringify(chapters[0]));
  } catch(e) { console.log('err:', e.message); }
})();