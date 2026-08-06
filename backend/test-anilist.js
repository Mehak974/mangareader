const axios = require('axios');

async function testAnilist() {
  const titles = ['Frieren', 'Omniscient Reader\'s Viewpoint', 'Death Note', 'The Beginning After the End'];
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
      console.log(`${title}:`, media ? `Found - ${media.title.english || media.title.romaji} | ${media.coverImage?.large}` : 'Not found');
    } catch (err) {
      console.error(`${title}: Error -`, err.response?.status, err.message);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

testAnilist();
