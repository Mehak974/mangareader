const cheerio = require('cheerio');
const {
  fetchHTML,
  fetchWithFlareSolverr,
  strategy1_embeddedJSON,
  strategy2_nextData,
  strategy3_domSelectors,
} = require('./universalExtractor');

module.exports = async ({ url }) => {
  try {
    let html;
    try {
      html = await fetchHTML(url);
    } catch (err) {
      console.warn(`[worker] fetchHTML failed for ${url}, trying FlareSolverr: ${err.message}`);
      try {
        html = await fetchWithFlareSolverr(url);
      } catch (fsErr) {
        throw new Error(`fetchHTML and FlareSolverr both failed: ${err.message}; ${fsErr.message}`);
      }
    }
    const $ = cheerio.load(html);

    let imgs = strategy1_embeddedJSON($);
    if (imgs.length < 3) {
      const s2 = strategy2_nextData($);
      if (s2.length > imgs.length) imgs = s2;
    }
    if (imgs.length < 3) {
      const s3 = strategy3_domSelectors($);
      if (s3.length > imgs.length) imgs = s3;
    }

    return imgs;
  } catch (error) {
    throw new Error(`Worker Extraction Failed: ${error.message}`);
  }
};
