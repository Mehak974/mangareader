const axios = require('axios');

async function testTitle(title) {
  try {
    const response = await axios.post('https://graphql.anilist.co', {
      query: `query ($search: String) { Media (search: $search, type: MANGA) { id title { english romaji } } }`,
      variables: { search: title },
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });
    const media = response.data?.data?.Media;
    console.log(`${title}:`, media ? `Found - ${media.title.english || media.title.romaji}` : 'Not found (200)');
  } catch (err) {
    console.error(`${title}: Status=${err.response?.status} Message=${err.message}`);
    if (err.response?.data) {
      console.error('  Response:', JSON.stringify(err.response.data).slice(0, 200));
    }
  }
}

(async () => {
  await testTitle('rezero');
  await new Promise(r => setTimeout(r, 2000));
  await testTitle('rezero starting life in another world');
})();
