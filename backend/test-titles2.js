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
    console.error(`${title}: Error -`, err.response?.status, err.message);
  }
}

(async () => {
  await testTitle('rezero starting life in another world');
  await new Promise(r => setTimeout(r, 2000));
  await testTitle('the novels extra');
  await new Promise(r => setTimeout(r, 2000));
  await testTitle('goblins ascent from loser to winner');
  await new Promise(r => setTimeout(r, 2000));
  await testTitle('the archduchys fierce little captain');
  await new Promise(r => setTimeout(r, 2000));
  await testTitle('the beginning after the end');
})();
