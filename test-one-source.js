/**
 * Single candidate-source viability test.
 *
 * Usage:
 *   node test-one-source.js <siteUrl> <chapterDetailUrl> <chapterImageUrl>
 *
 * Checks, in order:
 *   1. Site URL            - reachable, real HTML (not a challenge/JS shell)
 *   2. Chapter detail URL  - title + chapter list extractable
 *   3. Chapter reader URL - page-image list extractable
 *   4. Image URL           - returns bytes of type image/*, with and without Referer
 *                           (hotlink protection test)
 */

const path = require('path');
const {
  fetchHTML,
  strategy1_embeddedJSON,
  strategy2_nextData,
  strategy3_domSelectors,
} = require(path.join(__dirname, 'backend', 'extractors', 'universalExtractor.js'));

const cheerio = require(path.join(__dirname, 'backend', 'node_modules', 'cheerio'));
const axios = require(path.join(__dirname, 'backend', 'node_modules', 'axios'));

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const results = [];

function report(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}: ${detail}`);
}

function isChallenge(html) {
  return /cf-browser-verification|cf_chl_|Just a moment|challenge-platform|__cf_chl|DDoS protection by Cloudflare/i.test(html);
}

async function testSite(siteUrl) {
  let html;
  try {
    html = await fetchHTML(siteUrl);
  } catch (e) {
    report('site', false, `fetch threw: ${e.message}`);
    return null;
  }
  if (!html || html.length < 500) {
    report('site', false, `response too small (${html ? html.length : 0} bytes) - likely blocked`);
    return html;
  }
  if (isChallenge(html)) {
    report('site', false, `Cloudflare/anti-bot challenge served (${html.length} bytes)`);
    return html;
  }
  const $ = cheerio.load(html);
  const links = $('a[href]').length;
  report('site', links > 10, `${html.length} bytes, ${links} links, title="${$('title').text().trim().slice(0, 60)}"`);
  return html;
}

function extractDetail(html) {
  const $ = cheerio.load(html);
  let data = strategy1_embeddedJSON($);
  if (!data) data = strategy2_nextData($);
  if (!data) data = strategy3_domSelectors($);
  return data;
}

async function testDetail(detailUrl) {
  let html;
  try {
    html = await fetchHTML(detailUrl);
  } catch (e) {
    report('detail', false, `fetch threw: ${e.message}`);
    return null;
  }
  if (!html || html.length < 500 || isChallenge(html)) {
    report('detail', false, `blocked or empty (${html ? html.length : 0} bytes)`);
    return null;
  }
  const data = extractDetail(html);
  const chapters = (data && (data.chapters || (data.details && data.details.chapters))) || [];
  const title = (data && (data.title || (data.details && data.details.title))) || '';
  report('detail', chapters.length > 0, `${chapters.length} chapters, title="${String(title).slice(0, 50)}"`);
  if (chapters.length > 0) {
    console.log(`       sample chapter: ${JSON.stringify(chapters[0]).slice(0, 160)}`);
  }
  return data;
}

async function testChapterImages(chapterUrl) {
  let html;
  try {
    html = await fetchHTML(chapterUrl);
  } catch (e) {
    report('chapter-images', false, `fetch threw: ${e.message}`);
    return [];
  }
  if (!html || html.length < 500 || isChallenge(html)) {
    report('chapter-images', false, `blocked or empty (${html ? html.length : 0} bytes)`);
    return [];
  }
  const data = extractDetail(html);
  const images = (data && data.images) || [];
  report('chapter-images', images.length >= 3, `${images.length} images`);
  if (images.length > 0) {
    console.log(`       sample image: ${images[0]}`);
  }
  return images;
}

async function testImage(imageUrl, referer) {
  const headers = { 'User-Agent': USER_AGENT };
  if (referer) headers.Referer = referer;
  try {
    const res = await axios.get(imageUrl, {
      headers,
      responseType: 'arraybuffer',
      timeout: 20000,
      maxRedirects: 5,
      validateStatus: () => true,
    });
    const type = res.headers['content-type'] || '';
    const bytes = res.data ? res.data.length : 0;
    const ok = res.status === 200 && /^image\//i.test(type) && bytes > 5000;
    return { ok, status: res.status, type, bytes, referer: !!referer };
  } catch (e) {
    return { ok: false, status: 0, type: '', bytes: 0, error: e.message, referer: !!referer };
  }
}

async function testImageHotlink(imageUrl, referer) {
  const withRef = await testImage(imageUrl, referer);
  const noRef = await testImage(imageUrl, null);
  const needReferer = withRef.ok && !noRef.ok;
  report(
    'image',
    withRef.ok,
    `with referer: HTTP ${withRef.status} ${withRef.type} ${withRef.bytes}B` +
      ` | without: HTTP ${noRef.status} ${noRef.type} ${noRef.bytes}B` +
      (needReferer ? ' | REFERER REQUIRED' : '')
  );
  return { withRef, noRef, needReferer };
}

(async () => {
  const [siteUrl, detailUrl, imageUrl] = process.argv.slice(2);
  if (!siteUrl || !detailUrl || !imageUrl) {
    console.error('Usage: node test-one-source.js <siteUrl> <chapterDetailUrl> <chapterImageUrl>');
    process.exit(2);
  }

  console.log('='.repeat(60));
  console.log(`SITE    : ${siteUrl}`);
  console.log(`DETAIL  : ${detailUrl}`);
  console.log(`IMAGE   : ${imageUrl}`);
  console.log('='.repeat(60));

  const siteDomain = new URL(siteUrl).origin;

  await testSite(siteUrl);
  const detail = await testDetail(detailUrl);

  let chapterUrl = imageUrl;
  if (detail && detail.chapters && detail.chapters[0] && detail.chapters[0].href) {
    chapterUrl = detail.chapters[0].href;
  }
  const images = await testChapterImages(chapterUrl);
  await testImageHotlink(imageUrl, siteDomain + '/');

  const score = results.filter(r => r.ok).length;
  console.log('='.repeat(60));
  console.log(`${score}/${results.length} checks passed`);
  results.forEach(r => console.log(`  ${r.ok ? 'OK  ' : 'FAIL'} ${r.name}`));
  console.log(images.length > 0 ? `Chapter image list usable (${images.length})` : 'Chapter image list NOT usable');
  process.exit(score === results.length ? 0 : 1);
})();
