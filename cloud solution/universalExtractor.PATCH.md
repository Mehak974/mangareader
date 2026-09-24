# universalExtractor.js — 3-line patch to use antiBlock.js

The existing `universalExtractor.js` defines its own `fetchHTML` using a
plain axios instance.  Replace just that function with the one from `antiBlock.js`.

---

## What to delete (lines ~55–210 of current universalExtractor.js)

Remove the entire block that starts with:

```js
const http = axios.create({ ... });
```

…and ends just before `const REFERERS = {`.  That is:

- `const BROWSER_HEADERS = [...]`  (lines ~10-40)
- `let headerIndex = 0; function getBrowserHeaders() {...}` (~40-45)
- `const PROXY_URL / PROXY_ROTATION / PROXY_LIST / proxyIndex` (~46-52)
- `function getProxy() {...}` (~53-58)
- `const http = axios.create({...})` (~60-68)
- `let fetchHtmlBusy / FETCH_HTML_LIMIT / fetchHtmlQueue` (~200-210)
- `function acquireFetchSlot / releaseFetchSlot` (~212-225)
- The old `async function fetchHTML(url, extraHeaders = {}) {...}` (~227-275)

Keep everything else unchanged.

---

## What to add at the top (after the existing require statements)

```js
// ── Anti-blocking HTTP layer ─────────────────────────────────────────────────
const { fetchHTML } = require('./antiBlock');
```

---

## Keep these unchanged

- `REFERERS` object
- `getPuppeteer()`, `fetchWithPuppeteer()`
- `fetchWithJinaAI()`
- `fetchWithFlareSolverr()` / `checkFlareSolverrHealth()`
- `isCloudflareChallenge()` → rename/alias to `detectBlock()` if desired, or keep for backward compat
- All `strategy1_embeddedJSON / strategy2_nextData / strategy3_domSelectors`
- All `SOURCE_SCRAPERS` entries
- All helper functions

---

## Integration wiring (in universalExtractor.js, around the old fetchHTML)

The old fallback logic (Jina AI → FlareSolverr → Puppeteer) should now live
**outside** antiBlock.js and be called when antiBlock.js throws `{ cfChallenge: true }`.

Wrap every `fetchHTML` call site inside SOURCE_SCRAPERS like this:

```js
async function fetchWithFullFallback(url, extraHeaders = {}) {
  const { fetchHTML: antiBlockFetch } = require('./antiBlock');
  try {
    return await antiBlockFetch(url, extraHeaders);
  } catch (err) {
    if (err.cfChallenge) {
      // Tier 2: Jina AI (free, no infra required)
      try {
        const md = await fetchWithJinaAI(url);
        if (md && md.length > 200) return markdownToHtml(md);
      } catch (_) {}
      // Tier 3: FlareSolverr (self-hosted or managed)
      try {
        return await fetchWithFlareSolverr(url, extraHeaders);
      } catch (_) {}
      // Tier 4: Headless Puppeteer (last resort — slow + expensive)
      return await fetchWithPuppeteer(url, extraHeaders);
    }
    throw err;
  }
}
```

Then replace all `fetchHTML(url, ...)` calls inside SOURCE_SCRAPERS with
`fetchWithFullFallback(url, ...)`.  The proxy / retries / rate-limiting are
all handled inside antiBlock.js; the fallback chain is your existing code.
