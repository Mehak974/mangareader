const cheerio = require('cheerio');
const {
  fetchHTML,
  strategy1_embeddedJSON,
  strategy2_nextData,
  strategy3_domSelectors,
} = require('./universalExtractor');

module.exports = async ({ url }) => {
  try {
    const html = await fetchHTML(url);
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
