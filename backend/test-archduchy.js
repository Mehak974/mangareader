const axios = require('axios');

async function testTitle(title) {
  try {
    const response = await axios.post('https://graphql.anilist.co', {
      query: `query ($search: String) { Media (search: $search, type: MANGA) { id title { english romaji } coverImage { large } } }`,
      variables: { search: title },
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });
    const media = response.data?.data?.Media;
    console.log(`${title}:`, media ? `Found - ${media.title.english || media.title.romaji}` : 'Not found (200)');
  } catch (err) {
    console.error(`${title}: Error -`, err.response?.status, err.response?.data?.errors?.[0]?.message || err.message);
  }
}

(async () => {
  await testTitle('the archduchys fierce little captain');
  await new Promise(r => setTimeout(r, 3000));
  await testTitle('The Archduchy\'s Fierce Little Captain');
  await new Promise(r => setTimeout(r, 3000));
  await testTitle('the tyrants overprotective contract mother');
  await new Promise(r => setTimeout(r, 3000));
  await testTitle('The Tyrant\'s Overprotective Contract Mother');
})();
