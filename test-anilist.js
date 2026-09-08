/**
 * Quick AniList connectivity check — 3 paths
 */
const axios = require('axios');
const API_URL = (process.env.API_URL || 'http://localhost:8080').replace(/\/$/, '');
const QUERY = `query ($search: String) { Page(perPage:2) { media(search:$search,type:MANGA){ id title { english } } } }`;
let passed = 0, failed = 0, skipped = 0;
function ok() { console.log('  PASS'); passed++; }
function bad(msg) { console.log('  FAIL:', msg); failed++; }
function skip(msg) { console.log('  SKIP:', msg); skipped++; }
function blocked(data) {
  const s = JSON.stringify(data?.errors || []).toLowerCase();
  return s.includes('manually blocked') || s.includes('temporarily disabled') || s.includes('stability issues');
}

async function testBackend() {
  console.log(`[1] POST ${API_URL}/api/anilist`);
  try {
    const r = await axios.post(`${API_URL}/api/anilist`, { query: QUERY, variables: { search: 'naruto' } }, { timeout: 20000 });
    if (r.status !== 200) return bad(`HTTP ${r.status}`);
    if (blocked(r.data)) return skip('AniList global block');
    const m = r.data?.data?.Page?.media;
    if (!Array.isArray(m) || !m.length) return bad('no media');
    ok(`got ${m.length} results`);
  } catch (e) { bad(e.message); }
}

async function testWorker() {
  console.log('[2] Cloudflare worker /api/anilist');
  const workerUrl = 'https://mangareader-proxy-v2.mehakiqbal974.workers.dev';
  try {
    const r = await axios.post(`${workerUrl}/api/anilist`, { query: QUERY, variables: { search: 'bleach' } }, { timeout: 20000 });
    if (r.status !== 200) return bad(`HTTP ${r.status}`);
    if (blocked(r.data)) return skip('AniList global block');
    const m = r.data?.data?.Page?.media;
    if (!Array.isArray(m) || !m.length) return bad('no media');
    ok(`got ${m.length} results`);
  } catch (e) { bad(e.message); }
}

(async () => {
  console.log('Testing AniList paths...');
  await testBackend();
  await testWorker();
  console.log(`\nResults: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  process.exit(failed ? 1 : 0);
})();
