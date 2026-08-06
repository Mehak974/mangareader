const axios = require('axios');

async function testWithDelay(title, delayMs = 3000) {
  await new Promise(r => setTimeout(r, delayMs));
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
  await testWithDelay('rezero starting life in another world', 0);
  await testWithDelay('the novels extra');
  await testWithDelay('goblins ascent from loser to winner');
  await testWithDelay('the archduchys fierce little captain');
  await testWithDelay('frieren beyond journeys end');
  await testWithDelay('omniscient readers viewpoint');
  await testWithDelay('the beginning after the end');
  await testWithDelay('the insipid princes furtive grab for the throne');
})();
