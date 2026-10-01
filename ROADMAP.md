# MangaReader Audit & Fix Roadmap

Priorities: P0 (do now) → P4 (optional later). "Consequence" = risk if NOT fixed.

---

## P0 — Critical: Do Now

### 1. AdScriptLoader.tsx: Hilltop injected on every navigation (Memory leak)
**File:** `frontend/src/components/AdScriptLoader.tsx:11-44`
**Problem:** `useEffect` depends on `[pathname]`, so every client-side navigation re-runs it. Cleanup only removes the wrapper `<script>`, NOT the `purple-text.com` script it inserted. It also resets `loaded.current = false`, so the next navigation injects another copy. After N navigations there are N copies plus their listeners.
**Fix:** Move guard to module-level flag; remove `loaded.current = false` from cleanup; remove `[pathname]` dep; also remove the injected purple-text.com script in cleanup.
**Consequence:** Unbounded memory growth on SPA navigation. Each Hilltop script loads ~100KB+ and registers message listeners. A user reading 20 chapters leaks ~2MB+ and degrades ad performance. In worst case, OOM on long sessions.

### 2. Image cache: maxKeys throws after 300 keys, so new images 502
**File:** `backend/index.js:987, 1013-1017`
**Problem:** `imageCache = new NodeCache({ stdTTL: 3600, checkperiod: 600, maxKeys: 300 })`. NodeCache throws `Cache max keys amount exceeded` on the 301st key. `imageCacheSet` has no try/catch, so every new image after 300 unique images returns 502 until restart.
**Fix:** Remove `maxKeys: 300` (rely on `IMAGE_CACHE_MAX_BYTES` byte pruning). Wrap `imageCache.set` in try/catch. Run `pruneImageCache` BEFORE setting a new key.
**Consequence:** After 300 unique chapter images, ALL new image requests 502. Users see broken images. Only a server restart fixes it. Hard outage scaling with unique images, not traffic.

### 3. NodeCache useClones default (deep-clones values)
**Files:** `backend/index.js:987`, `backend/utils/cache.js:10`
**Problem:** NodeCache defaults `useClones: true`, so every `get`/`set` deep-clones the value. For image Buffers (100KB-2MB each), this doubles memory per cache hit. Verified: returned Buffer is a different instance.
**Fix:** Set `useClones: false` on both `imageCache` and `memFallback`.
**Consequence:** Every cached image Buffer is cloned on read AND write. With 300 cached images averaging 500KB, that's 300MB of unnecessary copies against a 512MB heap cap. Directly contributes to heap exhaustion and GC pressure.

### 4. /api/chapter/images accepts any URL (SSRF)
**File:** `backend/index.js:868-910`
**Problem:** Only `helpers.isValidUrl` (http/https check) is validated. Unknown hosts go to `fetchHTML` and Puppeteer with no private-IP check. Internal hosts like `*.railway.internal` are reachable. Each new hostname also adds a Bottleneck instance, circuit breaker, and cookie jar to `antiBlock.js` Maps that never evict, plus a 1-year cache entry.
**Fix:** Add `isPrivateIP` check (already exists at line 969). Reuse the `ALLOWED_PATTERNS` list from `proxy-image`. Reject unknown hosts BEFORE any fetch or Puppeteer launch.
**Consequence:** SSRF vulnerability. Attackers can probe internal services (Railway private networking, metadata endpoints), use the server as an open proxy, trigger unbounded resource allocation in antiBlock.js Maps (memory leak), and cache malicious responses for 1 year.

### 5. Worker scraped() has no allowed() check on ?url=
**File:** `cloudflare/worker.js:388-447`
**Problem:** `scraped()` fetches any URL passed in `?url=` without calling `allowed()`. `imgProxy` has the check, but `scraped` does not.
**Fix:** Add `if (!allowed(target)) return json({ error: 'Domain not allowed' }, 403, {}, origin);` at the top of `scraped()`.
**Consequence:** The Worker becomes an open HTML proxy. Anyone can use it to fetch arbitrary URLs, bypassing the allowlist. SSRF vector from the edge; can be used to probe internal services or host malicious content.

### 6. Delete .env.test and .wrangler account cache
**Files:** `frontend/.env.test`, `.wrangler/cache/wrangler-account.json`
**Problem:** `frontend/.env.test` contains an expired Vercel OIDC token. `.wrangler/cache/wrangler-account.json` contains account ID and email.
**Fix:** Delete both files. Add to `.gitignore`.
**Consequence:** Secrets in the repo. The OIDC token is expired but if rotated, could be reused. The account JSON exposes internal account identifiers.

---

## P1 — Memory and Bugs

### 7. AppContext.js: likely render loop at chapter end
**File:** `frontend/src/context/AppContext.js:369-380`
**Problem:** `updateReadSet` always returns a new object, even when the set is unchanged. `markChapterRead` is recreated every render. The reader's observer effect depends on `markChapterRead`, so at chapter end: mark read → state changes → new function identity → observer rebuilt → fires again → marks read again. Infinite loop.
**Fix:** In `updateReadSet`, check if the set is unchanged and return `prev`. Wrap all actions in `useCallback`. Memoize the context value with `useMemo`.
**Consequence:** Infinite render loop when a user reaches the end of a chapter. Browser hangs, CPU spikes, page becomes unresponsive. Confirmed by React Profiler.

### 8. Reader (reader/[id]/page.js) — P1 issues
**File:** `frontend/src/app/reader/[id]/page.js`

**8a. All pages stay mounted and decoded in webtoon mode**
**Problem:** Every `<img>` is rendered, even those far off-screen. In webtoon mode with 50+ pages, this means 50+ images decoded simultaneously.
**Fix:** Only render pages within +/-3 of the current page. Use fixed-ratio placeholders for off-screen pages.
**Consequence:** High memory usage, slow scrolling, potential OOM on long chapters.

**8b. Observer effect lacks viewMode in deps**
**Problem:** The IntersectionObserver effect at line 132 has deps `[images, mangaId, id, markChapterRead]` but not `viewMode`. When toggling mode, the observer reattaches to stale elements.
**Fix:** Add `viewMode` to the deps array.
**Consequence:** Page tracking breaks after mode toggle. Chapter-read marking may not fire correctly.

**8c. Retry logic uses querySelectorAll('.reader-page img')[i], wrong in paged mode**
**Problem:** In paged mode, only one page is mounted, so `querySelectorAll` returns 1 element, but `i` can be 0-50. The retry logic targets the wrong DOM node.
**Fix:** Use a ref to the specific `<img>` element instead of querying by index.
**Consequence:** Retry-on-error fails silently in paged mode. Images that fail to load never retry.

**8d. Fetches have no AbortController**
**Problem:** `fetchChapterImagesThroughWorker` has no abort signal. A stale chapter can overwrite a newer one if the user navigates away mid-fetch.
**Fix:** Add an AbortController, cancel on cleanup.
**Consequence:** Race conditions where a slower chapter's images replace a faster one's. Users see wrong chapter content.

**8e. On error it shows fake "Demo Sandbox" panels to real users**
**Problem:** Lines 104-119 generate fake SVG "Demo Sandbox panel layout" images when the real fetch fails. Real users see placeholder content instead of an error state.
**Fix:** Remove the mock panel generation. Show a proper error message with retry button.
**Consequence:** Users think the chapter has content when it doesn't. Confusing UX and hides real failures.

### 9. AAdsBanner.tsx: double mount (P1)
**File:** `frontend/src/components/AAdsBanner.tsx:9-15`
**Problem:** `key` starts at 0, then the effect bumps it to 1 on mount. So the first ad load (key=0) is wasted and immediately replaced.
**Fix:** Use `key={pathname}` directly, or throttle refreshes to one per 30-60s.
**Consequence:** Wasted ad impressions on every page load. Revenue loss.

### 10. AchievementToast.js: timer cleared by its own re-render
**File:** `frontend/src/components/AchievementToast.js:16-23`
**Problem:** The effect sets a 3.5s timer to clear the current toast. But `setQueue` triggers a re-render, which re-runs the effect, which clears the old timer and sets a new one. The toast never dismisses.
**Fix:** Use a ref for the timer, or move the timer logic outside the effect. Don't clear the timer in the cleanup unless the component unmounts.
**Consequence:** Achievement toasts never auto-dismiss. They pile up and block UI.

### 11. Worker MEM holds up to 300 full-HTML entries in a ~128MB isolate
**File:** `cloudflare/worker.js:21-22`
**Problem:** `MEM_MAX = 300`. Each scraped HTML entry can be 100KB-5MB. 300 entries = 30-1500MB, but the isolate is capped at ~128MB.
**Fix:** Cap MEM near 30, or skip L1 caching for HTML entirely (only cache JSON/image responses in MEM).
**Consequence:** Worker isolate OOM errors. Edge 500s for all traffic routed through that isolate.

### 12. Railway: Heap cap vs RSS
**File:** `backend/index.js` (various)
**Problem:** `--max-old-space-size=512` limits V8 heap only. Chrome (child process) and sharp native memory are outside it.
**Fix:** Set `PUPPETEER_CONCURRENCY=1` and monitor RSS (not just heap). Add a memory watchdog.
**Consequence:** RSS can exceed the container limit even when V8 heap is fine. OOM kills from the orchestrator.

---

## P2 — Edge Requests

### 13. Homepage revalidate = 0, middleware on every request
**Files:** `frontend/src/app/page.js:15`, `frontend/src/middleware.js`
**Problem:** `export const revalidate = 0` renders the homepage on every request and fans out 4 backend calls. `middleware.js` runs on every page request (CSP header, 5 301s, X-Robots-Tag).
**Fix:** Set `revalidate = 300` and `next: { revalidate: 300 }` in `fetchHomeSection`. Delete `middleware.js`; move CSP and 301s into `next.config.js` `redirects()` and `headers()`.
**Consequence:** Every homepage request hits the backend 4 times. High origin cost and slow TTFB. Middleware adds latency to every page.

### 14. Prefetch: Sidebar (21 links), Footer (12), MobileNav, Header, card grids
**Fix:** Add `prefetch={false}` outside primary nav.
**Consequence:** Excessive bandwidth usage and unnecessary backend requests for low-value navigation links.

### 15. /api/auth/me on every full load, even for anonymous visitors
**Fix:** Set a non-httpOnly `mr_auth=1` cookie at login and skip the call without it.
**Consequence:** Anonymous users generate unnecessary auth check requests on every page load.

### 16. Vercel Analytics + Speed Insights both beacon to /_vercel/*
**Fix:** Keep only one. GA already covers pageviews.
**Consequence:** Double beaconing, extra requests, and potential data inconsistency.

### 17. /api/history/sync fires 3s after any state change
**Fix:** Debounce to ~30s and flush with `sendBeacon` on pagehide.
**Consequence:** Excessive API calls during active reading sessions. Backend load spike.

### 18. MaintenanceGuard polls every 60s per tab, including hidden tabs
**Fix:** Check once, pause when hidden. Add `Cache-Control: public, s-maxage=60` server-side.
**Consequence:** Hidden tabs still generate DB queries every 60s. Wasted database load.

### 19. Maintenance route: s-maxage=60
**Fix:** Already noted; ensure it's set.
**Consequence:** Without caching, maintenance status hits the DB on every request.

### 20. HTML pages: replace immutable 1y with s-maxage plus SWR
**Fix:** Use `public, max-age=0, s-maxage=86400, stale-while-revalidate=604800` instead of `immutable, max-age=1y`.
**Consequence:** `immutable, max-age=1y` pins stale pages and old chunk hashes. A deploy breaks users for a year until they hard-refresh.

### 21. AniList search is an uncacheable POST per debounced keystroke
**Fix:** Require 3+ characters, then move to a cacheable GET.
**Consequence:** Every keystroke hits AniList. Rate limit risk and poor performance.

### 22. proxy-image: drop dead Redis read, WAF rate limit
**Fix:** Remove the Redis key read that is never written, and the express-rate-limit command (2 Upstash commands per image).
**Consequence:** 2 unnecessary Redis commands per image request. Significant overhead at scale.

### 23. Verify cf-cache-status: HIT on /_next/static
**Fix:** Ensure static assets are served from Cloudflare cache.
**Consequence:** If not HIT, every static asset request hits Vercel. High bandwidth cost.

---

## P3 — Third-Party and Metadata

### 24. Remove PostHog and the three opentelemetry packages
**Files:** `frontend/src/components/AnalyticsProvider.tsx`, `frontend/src/instrumentation.ts`, `package.json`
**Problem:** PostHog client SDK (only if `NEXT_PUBLIC_POSTHOG_KEY` is set) plus a server OTLP exporter in `instrumentation.ts` with a hardcoded fallback token (`phc_oVw8...`). `__posthogLogger` is never used.
**Fix:** Remove `posthog-js`, three `@opentelemetry/*` packages, `AnalyticsProvider.tsx`, and `instrumentation.ts`.
**Consequence:** Unnecessary third-party data collection. Hardcoded token in source. Server-side telemetry overhead on every request.

### 25. Decide: keep or remove Bing meta and IndexNow
**Fix:** Evaluate if Bing verification meta (`msvalidate.01`) and IndexNow (server ping to `api.indexnow.org` plus three hex `.txt` key files in `public/`) are needed.
**Consequence:** If not needed, they add clutter and unnecessary server pings.

### 26. Check GA env var name
**Problem:** `cloud solution/frontend.env` uses `NEXT_PUBLIC_GA_ID`, but the code uses `NEXT_PUBLIC_GA_MEASUREMENT_ID`. Mismatch means GA never loads.
**Fix:** Align env var names.
**Consequence:** Google Analytics silently not firing. No pageview data.

### 27. Fix hreflang keys and canonical conflict
**Problem:** hreflang keys include domain names (not valid language codes). `en`, `en-US`, `en-GB` all point at the primary while each domain self-canonicalizes: conflicting signals.
**Fix:** Use valid language codes, or remove hreflang entirely if all domains serve the same content.
**Consequence:** Search engines may show the wrong domain in results or ignore the canonical signal.

### 28. Remove keywords meta
**Fix:** Delete it. Google ignores it.
**Consequence:** Clutter. No SEO benefit.

### 29. Add apple-icon.png or remove reference
**Fix:** Either add the file or remove the reference.
**Consequence:** 404 on iOS home screen icon. Broken bookmark experience.

### 30. Keep one manifest
**Problem:** Manifest declared three ways: `manifest.js`, `manifest.ts`, `public/manifest.json`. Icons list only `favicon.ico`.
**Fix:** Keep one manifest, add proper icon sizes.
**Consequence:** Conflicting manifest declarations. PWA install may break.

### 31. /aads: noindex
**Fix:** Set `noindex` on `/aads` (thin ad page).
**Consequence:** Search engines index a thin ad page. SEO penalty risk.

### 32. One font instead of three
**Problem:** Three Google Fonts x 4 weights instantiated at module scope, probably all preloaded.
**Fix:** Use one font family.
**Consequence:** Extra font downloads, slower page load.

### 33. Tighten CSP
**Problem:** `vercel.live` in `font-src`; `connect-src https: http: ws: wss:` and `frame-src https:` are wide open.
**Fix:** Narrow to specific origins.
**Consequence:** Open CSP allows connections to any host. XSS risk.

### 34. Delete stale clutter files
**Files:** `cloud solution/` and `zip` (stale copies), `tsconfig.tsbuildinfo`, `gitlog.txt`, `fix.py`, `test-sources.js`, `mangaread.env`, unused `@cloudflare/next-on-pages`, dead `PWAInstallPrompt.js`.
**Fix:** Delete all.
**Consequence:** Repo bloat. Confusion about which files are active. Potential secret leakage from `mangaread.env`.

### 35. Update cookies page
**Problem:** Cookies page only mentions A-ADS and Hilltop. PostHog cookies are missing.
**Fix:** Update after removing PostHog.
**Consequence:** Privacy policy mismatch with actual cookies set.

### 36. Check Cloudflare dashboard for injected beacons
**Fix:** Verify no Web Analytics or Rocket Loader auto-injection is active.
**Consequence:** Unexpected third-party scripts firing without repo visibility.

---

## P4 — Railway Frontend, Worker, R2 (Architecture Migration)

### Phase 0: make the app portable
**Fix:**
- Set `output: 'standalone'` in `next.config.js`
- Dockerfile copies `.next/standalone`, `.next/static`, `public`; CMD `["node","server.js"]` (drop `npx`)
- Add `/api/health` route
- Remove Vercel-only packages (`@vercel/analytics`, `@vercel/speed-insights`, `/_vercel/insights` does not exist off Vercel)
- Prisma binary target for alpine: `linux-musl-openssl-3.0.x`
- Domains driven by `DOMAIN_PROFILE`: three Railway services from one Dockerfile, or refactor to Host-based config

**Consequence:** Without this, the app cannot run on Railway. Vercel lock-in.

### Phase 1: parallel run
**Fix:**
- Deploy to `origin.<domain>`
- Worker sends `x-origin-secret`, Railway rejects requests without it
- Key `express-rate-limit` on `CF-Connecting-IP`. With `trust proxy 1` behind Cloudflare, `req.ip` is probably the edge IP, so one colo shares a bucket (verify).

**Consequence:** Without the secret header, the origin is exposed. Without rate-limit verification, a single Cloudflare colo could exhaust a rate-limit bucket.

### Phase 2: Worker as front door for HTML
**Fix:**
- Bypass `/api/*`, `/admin`, `/login`, `/library`, `/profile`, `/settings`, `/messages`, non-GET, and requests with an auth cookie
- Cache GETs for `/`, `/browse`, `/trending`, `/blog*`, `/manga/*`, legal pages
- Normalize keys (strip `utm_*`, `fbclid`, ignore cookies)
- Lookup order: `caches.default`, then R2, then origin, with stale-while-revalidate via `ctx.waitUntil`
- Prefix keys with the build ID so deploys invalidate everything
- Add an HMAC `/__purge` endpoint called after publishing
- A Worker on every route will exceed the free 100k requests/day: budget for the paid plan, and add a no-Worker route for `/_next/static/*`

**Consequence:** Without bypass rules, authenticated pages and API calls go through the Worker cache (data leakage). Without build-ID prefix, deploys don't invalidate cached HTML. Without the no-Worker static route, you exceed the free tier.

### Phase 3: images and chapters in R2
**Fix:**
- `img.<domain>/{hash}.webp`: Worker checks R2; on miss asks Railway's sharp route once, stores in R2, replies
- Use `body.tee()` rather than `arrayBuffer()` (128MB isolate limit)
- Key on the stable image path, not MangaKatana's tokenized URL
- R2 lifecycle rule to expire objects after 30-90 days
- Layout `img/{source}/{mangaId}/{chapter}/{n}` makes a DMCA takedown one prefix delete
- Durable copies change your risk versus transient proxying, so build that tool early
- Worker-cache chapter-image JSON: 10 minutes for tokenized sources, 7 days for the rest

**Consequence:** Without `tee()`, large images can OOM the Worker isolate. Without stable keys, tokenized URLs 403 after expiry. Without lifecycle rules, R2 costs grow unbounded. Without the DMCA tool, takedowns are per-file.

### Phase 4: cutover
**Fix:**
- `ORIGIN` variable in the Worker for instant rollback
- Ramp 5%, 50%, 100%; keep Vercel warm about two weeks
- Log an `x-cache` value (`EDGE`, `R2`, `MISS`, `BYPASS`); alert on Railway RSS

**Consequence:** Without the ORIGIN variable, rollback requires a Worker deploy. Without gradual ramp, a regression affects all users immediately.

### Optional later
- Upload `.next/static` to R2 on deploy and set `assetPrefix` to a static subdomain