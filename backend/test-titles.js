const axios = require('axios');

async function testTitles() {
  const titles = [
    'the novels extra',
    'goblins ascent from loser to winner',
    'the archduchys fierce little captain',
    'Komi-san wa, Comyushou desu.',
    'Billionaire Girl',
    'Frieren: Beyond Journey\'s End',
    'Omniscient Reader\'s Viewpoint',
    'The Beginning After the End',
    'the insipid princes furtive grab for the throne',
    'rezero starting life in another world',
  ];

  for (const title of titles) {
    try {
      const response = await axios.post('https://graphql.anilist.co', {
        query: `query ($search: String) { Media (search: $search, type: MANGA) { id title { english romaji } coverImage { large } } }`,
        variables: { search: title },
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });
      const media = response.data?.data?.Media;
      console.log(`${title}:`, media ? `Found - ${media.title.english || media.title.romaji}` : 'Not found');
    } catch (err) {
      console.error(`${title}: Error -`, err.response?.status, err.message);
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

testTitles();
