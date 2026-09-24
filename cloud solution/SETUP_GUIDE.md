# Multi-Domain Setup + Anti-Blocking Fix
**3 domains · 1 codebase · never get blocked**

---

## What's in this package

| File | Purpose |
|------|---------|
| `backend/extractors/antiBlock.js` | Smart HTTP layer — replaces raw axios calls |
| `backend/extractors/universalExtractor.PATCH.md` | Exactly which lines to change in your existing file |
| `backend/config/domains.js` | Per-domain backend config (CORS, sources, rate limits) |
| `backend/package.json` | Updated with `got-scraping` dep |
| `frontend/src/lib/site-config.ts` | **The config hub** — all 3 domain personalities in one file |
| `frontend/src/app/layout.tsx` | Domain-aware root layout |
| `frontend/src/app/robots.ts` | Domain-aware robots.txt |
| `frontend/src/app/sitemap.ts` | Domain-aware sitemap + IndexNow ping helper |
| `frontend/src/components/AAdsBanner.tsx` | Per-domain A-ADS unit ID + colors |
| `frontend/src/components/AdScriptLoader.tsx` | Per-domain pop-ads script |
| `domains/mangareader.pro/frontend.env` | Vercel env vars for mangareader.pro frontend |
| `domains/mangareader.pro/backend.env` | Railway/Render env vars for mangareader.pro backend |
| `domains/mangaread.pro/*.env` | Same for mangaread.pro |
| `domains/manireader.online/*.env` | Same for manireader.online |

---

## Part 1: Fix blocking (anti-blocking layer)

### Why you're getting blocked

Your current extractor uses:
- 3 static User-Agents → trivially fingerprinted
- Default Node.js TLS cipher suites → not browser-like
- No per-domain rate limiting → bulk requests trigger IP ban
- No circuit breaker → keeps hammering blocked endpoints
- No cookie persistence → looks like a fresh bot every request

### What antiBlock.js adds

| Problem | Solution |
|---------|---------|
| Fingerprinted UA | 30-UA pool rotating across Chrome/Firefox/Edge/Safari |
| Node.js TLS | `got-scraping` library mimics browser TLS handshakes |
| No rate limiting | Per-domain `Bottleneck` with tuned rates per source site |
| No circuit breaker | Opens automatically after 5 failures, tests recovery after 30s |
| No cookies | Per-domain cookie jar — persists `cf_clearance` and session cookies |
| Bad retries | Exponential backoff + jitter, rotates UA between retries |

### Step 1 — Install got-scraping

```bash
cd backend
npm install got-scraping@^4.0.4
```

> `got-scraping` is ESM-only (v4). The `antiBlock.js` uses `await import()` for it
> automatically so your CommonJS backend doesn't need any other changes.

### Step 2 — Copy antiBlock.js into your repo

```bash
cp antiBlock.js backend/extractors/antiBlock.js
cp domains.js backend/config/domains.js
```

### Step 3 — Wire antiBlock.js into universalExtractor.js

Open `backend/extractors/universalExtractor.js`.
See `universalExtractor.PATCH.md` for the exact lines.

**TL;DR:**
1. Delete the `BROWSER_HEADERS`, `getBrowserHeaders()`, `http = axios.create()`,
   `acquireFetchSlot/releaseFetchSlot`, and old `fetchHTML` blocks.
2. Add at the top:
   ```js
   const { fetchHTML: antiBlockFetch } = require('./antiBlock');
   ```
3. Wrap every `fetchHTML(url)` call in your scrapers:
   ```js
   async function smartFetch(url, extraHeaders = {}) {
     try {
       return await antiBlockFetch(url, extraHeaders);
     } catch (err) {
       if (err.cfChallenge) {
         // existing FlareSolverr / Puppeteer fallback chain
         try { return await fetchWithFlareSolverr(url); } catch (_) {}
         return await fetchWithPuppeteer(url);
       }
       throw err;
     }
   }
   ```
4. Replace all `fetchHTML(...)` calls inside `SOURCE_SCRAPERS` with `smartFetch(...)`.

### Step 4 — Wire domains.js into index.js

At the top of `backend/index.js`, add:

```js
const { getConfig, getAllowedOrigins } = require('./config/domains');
const domainCfg = getConfig();
```

Replace the hardcoded ALLOWED_ORIGINS array:
```js
// BEFORE
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,...').split(',');

// AFTER
const ALLOWED_ORIGINS = getAllowedOrigins();
```

### Step 5 — Add residential proxies (recommended for 10k/day)

Without proxies you're sharing one IP. At 10k page-views/day you'll hit
rate limits on scraped sources within hours.

Best options (cheapest first):
1. **BrightData Residential** (~$3/GB) — most reliable, handles Cloudflare automatically
2. **Oxylabs** (~$4/GB)
3. **SmartProxy** (~$2.5/GB)
4. **WebShare** — has a free tier (10 proxies, shared)

Set in your backend env:
```
SCRAPER_PROXY_URL=http://user:pass@gate.brightdata.com:22225
```

Or for rotation across multiple proxies:
```
SCRAPER_PROXY_ROTATION=true
SCRAPER_PROXY_LIST=[{"host":"p1.example.com","port":8080},{"host":"p2.example.com","port":8080}]
```

### Step 6 — Deploy FlareSolverr (optional but useful)

FlareSolverr is a local headless Chrome that solves CF challenges automatically.
Add it as a Railway companion service:

```
Image: ghcr.io/flaresolverr/flaresolverr:latest
Port:  8191
Env:   LOG_LEVEL=info
```

Then set in backend env:
```
FLARESOLVERR_URL=http://flaresolverr.railway.internal:8191/v1
```

---

## Part 2: Multi-domain setup (3 separate deployments)

### Architecture

```
GitHub Repo (single codebase)
    │
    ├── Vercel Project A → mangareader.pro
    │     DOMAIN_PROFILE=mangareader.pro
    │     DATABASE_URL=neon_mangareader_pro
    │     NEXT_PUBLIC_AADS_UNIT_ID=2454751
    │
    ├── Vercel Project B → mangaread.pro
    │     DOMAIN_PROFILE=mangaread.pro
    │     DATABASE_URL=neon_mangaread_pro
    │     NEXT_PUBLIC_AADS_UNIT_ID=<your_unit>
    │
    └── Vercel Project C → manireader.online
          DOMAIN_PROFILE=manireader.online
          DATABASE_URL=neon_manireader_online
          NEXT_PUBLIC_AADS_UNIT_ID=<your_unit>

Railway (backends)
    ├── Service A → api-mangareader  (DOMAIN_PROFILE=mangareader.pro, PORT=3001)
    ├── Service B → api-mangaread   (DOMAIN_PROFILE=mangaread.pro,   PORT=3002)
    └── Service C → api-manireader  (DOMAIN_PROFILE=manireader.online, PORT=3003)
```

### Frontend deployment steps

**Do this 3 times — once per domain:**

1. Go to https://vercel.com → **Add New Project** → Import your GitHub repo
2. Project Name: `mangareader-pro` (or `mangaread-pro`, `manireader-online`)
3. Framework Preset: **Next.js**
4. Environment Variables: copy from `domains/<domain>/frontend.env`
   - Fill in all `REPLACE_WITH_...` placeholders
5. Deploy
6. After deploy: **Settings → Domains** → Add your custom domain
7. For `www` redirect: add both `mangareader.pro` and `www.mangareader.pro`,
   set `www.mangareader.pro` to redirect to `mangareader.pro`

### Backend deployment steps (Railway)

**Do this 3 times — once per domain:**

1. Go to https://railway.app → **New Project** → **Deploy from GitHub Repo**
2. Select your repo → select the `backend` directory as root
   (or use a `railway.json` with `"build": { "buildCommand": "cd backend && npm install" }`)
3. Environment Variables: copy from `domains/<domain>/backend.env`
4. Add the custom API domain (for example, `https://api-manireader.railway.app` → `https://api.manireader.online`) in Railway and DNS.
5. Set the **custom API URL** as `NEXT_PUBLIC_API_URL`, `API_URL`, and `NEXT_PUBLIC_SCRAPER_URL` in your Vercel project. Do not use the generated Railway URL in production after the custom domain is active.

### Database setup (Neon)

Create **3 separate Neon projects** (one per domain) to keep data fully isolated:

1. https://neon.tech → **New Project** → Name: `mangareader-pro`
2. Run your Prisma migrations against it:
   ```bash
   DATABASE_URL="<neon_url>" npx prisma migrate deploy
   ```
3. Repeat for `mangaread-pro` and `manireader-online`

---

## Part 3: SEO — what's different per domain

### The 3 personalities

| Domain | Name | Personality | Accent | Tagline |
|--------|------|-------------|--------|---------|
| mangareader.pro | MangaReader | Premium, polished, "Netflix for manga" | Purple `#A855F7` | "The premier manga reading experience" |
| mangaread.pro | MangaRead | Fast, minimal, speed-focused | Sky blue `#38BDF8` | "Read at the speed of thought" |
| manireader.online | ManiReader | Discovery, community, vibrant | Orange `#F97316` | "Discover your next manga obsession" |

All titles, descriptions, OG images, canonical URLs, and Twitter handles are
automatically set per domain by `site-config.ts` — you don't change any page files.

### Google Search Console

1. Go to https://search.google.com/search-console
2. Add property for each domain → choose **Domain** type
3. Verify via DNS TXT record (easiest)
4. Copy the verification code into `NEXT_PUBLIC_GOOGLE_VERIFICATION` for each domain

### Bing Webmaster Tools

1. https://www.bing.com/webmasters → Add a site for each domain
2. Get the `msvalidate.01` code → `NEXT_PUBLIC_BING_VERIFICATION`

### IndexNow (instant indexing)

1. Generate a key: `node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"`
2. Set `INDEXNOW_KEY=<key>` in each Vercel project
3. Create `/public/<key>.txt` containing just the key string
4. In your article/manga publish API route, call:
   ```ts
   import { pingIndexNow } from '@/app/sitemap';
   await pingIndexNow([`${SITE_URL}/manga/${slug}`]);
   ```

### Google Ads / ad platform meta tags

If your ad platform requires a meta tag (e.g. `<meta name="google-adsense-account">`),
add it to `layout.tsx` in the `<head>` section, reading from the env var:

```tsx
{AD_CONFIG.adsenseId && (
  <meta name="google-adsense-account" content={AD_CONFIG.adsenseId} />
)}
```

---

## Part 4: A-ADS setup per domain

1. Log into https://a-ads.com
2. **Sites → New Site** → enter domain → verify ownership
3. Create an **Advertising Unit** for each domain
4. Note the unit ID (number in the iframe URL)
5. Set `NEXT_PUBLIC_AADS_UNIT_ID=<id>` in that domain's Vercel env vars
6. Set `NEXT_PUBLIC_AADS_BG_COLOR` to match the domain's `bgDark` color (from `site-config.ts`)
7. Set `NEXT_PUBLIC_AADS_TITLE_COLOR` to the domain's `accentColor` (without #)

---

## Part 5: Pop-ads setup per domain

1. Sign up at your pop-ads network (Propeller, PopAds, PopCash, etc.)
2. Add each domain as a separate site
3. Get the script for each domain
4. In `AdScriptLoader.tsx`, add the script URL to `POP_ADS_SCRIPTS`:
   ```ts
   const POP_ADS_SCRIPTS = {
     'mangareader_pro': 'https://your-pop-network.com/script-for-mangareader',
     'mangaread_pro':   'https://your-pop-network.com/script-for-mangaread',
     'manireader':      'https://your-pop-network.com/script-for-manireader',
   };
   ```
5. Set `NEXT_PUBLIC_POP_ADS_KEY` to the matching key in each domain's env vars

---

## Checklist: ready to deploy

### Anti-blocking
- [ ] `npm install got-scraping@^4.0.4` in `backend/`
- [ ] `antiBlock.js` copied to `backend/extractors/`
- [ ] `universalExtractor.js` patched (see PATCH.md)
- [ ] `domains.js` wired into `backend/index.js`
- [ ] Proxy set in backend env (or accepted risk of IP blocks)
- [ ] FlareSolverr deployed (optional)

### Frontend files (replace in repo)
- [ ] `src/lib/site-config.ts` → added
- [ ] `src/app/layout.tsx` → replaced
- [ ] `src/app/robots.ts` → replaced (delete old robots.js)
- [ ] `src/app/sitemap.ts` → replaced (delete old sitemap.js)
- [ ] `src/components/AAdsBanner.tsx` → replaced (delete old .js)
- [ ] `src/components/AdScriptLoader.tsx` → replaced (delete old .js)

### Vercel (do per domain)
- [ ] 3 Vercel projects created, each connected to the same GitHub repo
- [ ] `DOMAIN_PROFILE` set correctly in each
- [ ] All `REPLACE_WITH_...` placeholders filled in
- [ ] Custom domain added and SSL working
- [ ] Google Search Console verified

### Railway/Render (do per domain)
- [ ] 3 backend services deployed
- [ ] `DOMAIN_PROFILE` set correctly in each
- [ ] `ALLOWED_ORIGINS` matches the frontend domain
- [ ] Redis connected (Upstash free tier works)

### Database (Neon)
- [ ] 3 Neon projects created (one per domain)
- [ ] Prisma migrations run on each
- [ ] `DATABASE_URL` set in both frontend AND backend envs for each domain

### Ads
- [ ] A-ADS units created for each domain and unit IDs set
- [ ] Pop-ads scripts registered and keys set
- [ ] Google/Bing verification codes set

### SEO
- [ ] Google Search Console verified for all 3 domains
- [ ] Bing Webmaster Tools verified for all 3 domains
- [ ] IndexNow keys set and key files deployed to `/public/`
- [ ] `pingIndexNow()` called from publish routes
