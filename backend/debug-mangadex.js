const axios = require('axios');
const cheerio = require('cheerio');

(async () => {
  console.log('=== MangaDex API tests ===');
  const uuid = 'b70113a5-32a3-44e8-a28f-0e88392808ba';
  try {
    const r = await axios.get('https://api.mangadex.org/manga/' + uuid, {timeout: 10000});
    console.log('manga detail status:', r.status);
    console.log('title:', Object.values(r.data.data.attributes.title)[0]);
  } catch(e) { console.log('manga detail err:', e.response?.status, e.message); }

  try {
    const r = await axios.get('https://api.mangadex.org/manga/' + uuid + '/feed?translatedLanguage[]=en&limit=500&offset=0&order[chapter]=desc', {timeout: 15000});
    console.log('feed status:', r.status, 'count:', r.data.data?.length);
    if (r.data.data?.length) console.log('first chapter:', r.data.data[0].attributes.chapter, r.data.data[0].id);
  } catch(e) { console.log('feed err:', e.response?.status, e.message, JSON.stringify(e.response?.data)?.slice(0,200)); }
})();