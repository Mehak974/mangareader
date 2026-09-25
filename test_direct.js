const q = `query ($page: Int, $perPage: Int, $sort: [MediaSort]) {
  Page (page: $page, perPage: $perPage) {
    media (type: MANGA, sort: $sort) {
      id title { english }
    }
  }
}`;
fetch('https://graphql.anilist.co', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: q, variables: { page: 1, perPage: 16, sort: ['TRENDING_DESC'] } })
}).then(r => r.text()).then(console.log);
