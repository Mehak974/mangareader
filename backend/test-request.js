const axios = require('axios');

async function testRequest() {
  try {
    const response = await axios.post('https://graphql.anilist.co', {
      query: `query ($search: String) { Media (search: $search, type: MANGA) { id title { english romaji } } }`,
      variables: { search: 'rezero' },
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2).slice(0, 500));
  } catch (err) {
    console.error('Status:', err.response?.status);
    console.error('Data:', JSON.stringify(err.response?.data, null, 2).slice(0, 500));
    console.error('Message:', err.message);
  }
}

testRequest();
