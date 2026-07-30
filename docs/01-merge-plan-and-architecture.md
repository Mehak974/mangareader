# Merged Project — Architecture & Implementation Plan

> **Base repo:** `Manga` (github.com/Mehak974/Manga)  
> **Feature donor:** `Manga-Reader-New` (github.com/Mehak974/Manga-Reader-New)  
> **Goal:** Production-grade manga reader with Lighthouse 95+ and a full blog CMS

---

## Decision: Why Manga is the Base

| Criterion | Manga | Manga-Reader-New |
|---|---|---|
| Auth security | ✅ scrypt + httpOnly cookies + DB sessions | ❌ localStorage tokens |
| TypeScript | ✅ API routes & lib/ | ❌ JS only |
| ORM / schema | ✅ Prisma + seed | ❌ manual SQL |
| CMS | ✅ 13 admin pages, 6 content types | ❌ 1 single-page dashboard |
| Comment system | ✅ threaded | ❌ absent |
| Audit logs | ✅ AuditLog model | ❌ absent |
| Login protection | ✅ LoginAttempt model | ❌ absent |
| Review scores | ✅ 5-dimension model | ❌ absent |
| Source selector | ✅ sourceSelector.js | ❌ absent |
| File count | 129 | 66 |

**Verdict:** Manga is the base. We cherry-pick three things from Manga-Reader-New:
1. Security headers + CORS allowlist (backend)
2. Rate limiter (backend)
3. MaintenanceGuard component (frontend)

---

## Project Structure (Merged)

```
manga-reader/
├── backend/                    ← Express scraper (Node.js)
│   ├── index.js                ← PATCHED with MRN security
│   ├── db.js
│   ├── extractors/
│   │   └── universalExtractor.js
│   └── utils/
│       ├── metadataFetcher.js
│       └── sourceSelector.js   ← from Manga (better)
│
├── frontend/                   ← Next.js 16 + React 19 + Tailwind v4
│   ├── prisma/
│   │   ├── schema.prisma       ← from Manga (full schema)
│   │   └── seed.js
│   ├── src/
│   │   ├── app/
│   │   │   ├── admin/          ← from Manga (13-page CMS)
│   │   │   ├── api/            ← from Manga (TypeScript routes)
│   │   │   ├── blog/           ← from Manga
│   │   │   └── ...all pages
│   │   ├── components/
│   │   │   ├── MaintenanceGuard.js   ← ADDED from MRN
│   │   │   ├── AdBanner.js           ← ADDED from MRN
│   │   │   ├── AchievementToast.js   ← ADDED from MRN
│   │   │   └── ...all Manga components
│   │   ├── lib/                ← from Manga (TypeScript)
│   │   └── utils/
│   │       ├── achievements.js  ← ADDED from MRN
│   │       └── ...
│   └── package.json
│
├── docs/                       ← Complete documentation (this folder)
└── blog-import/                ← Blog SQL seed + import scripts
```

---

## What to Merge: Step-by-Step

### Step 1 — Patch `backend/index.js` (15 min)

Replace the first ~30 lines (app creation → first route) with the patched version from `backend-patches/index-patch.diff`.

Key changes:
- Add security headers middleware (5 headers)
- Replace `app.use(cors())` → CORS allowlist from `ALLOWED_ORIGINS` env var
- Add `rateLimit()` function and apply per-route limits
- Keep Manga's existing `cache` system and `sourceSelector`

### Step 2 — Add Frontend Components (5 min)

Copy from Manga-Reader-New into `frontend/src/components/`:
- `MaintenanceGuard.js` — update `API_BASE` import path if needed
- `AdBanner.js`
- `AchievementToast.js`

Copy `frontend/src/utils/achievements.js` from MRN.

Wrap `frontend/src/app/layout.js` root layout with `<MaintenanceGuard>`.

### Step 3 — Run Database Setup

```bash
cd frontend
npx prisma generate
npx prisma db push        # or prisma migrate deploy in production
npx prisma db seed        # creates default admin user
```

### Step 4 — Import Blog Posts

Run the blog import script (see `blog-import/` folder):
```bash
cd blog-import
node import-blogs.js
```

This imports all blog posts as `DRAFT` with `scheduledFor` timestamps set 24h apart, starting from next day at 10:00 UTC. The Next.js API route `GET /api/blog` filters by `status = PUBLISHED OR (status = SCHEDULED AND scheduledFor <= NOW())`, so posts auto-publish on schedule without a cron job.

### Step 5 — Environment Variables

Set all variables per `docs/02-environment-variables.md`.

### Step 6 — Deploy

See `docs/03-deployment.md` for Vercel + Neon + Cloudflare setup.

---

## Security Architecture (Merged)

### Backend (Express)

```
Request
  → Security headers middleware  (X-Frame, XSS, CSP, Referrer, Permissions)
  → CORS allowlist               (ALLOWED_ORIGINS env var)
  → Body parser limit            (2mb)
  → Per-route rateLimit()        (custom windows per endpoint sensitivity)
  → Route handler
  → ADMIN_TOKEN check            (requireAdmin middleware on write routes)
```

### Frontend (Next.js)

```
Request
  → next.config.js security headers  (Content-Security-Policy, HSTS, etc.)
  → middleware.ts                     (session check, redirect unauthenticated)
  → API route
    → lib/api-guard.ts               (role check)
    → lib/validation.ts              (input sanitisation)
    → lib/prisma.ts                  (parameterised queries — no SQL injection)
    → Response
```

### Auth Flow

```
POST /api/auth/login
  → LoginAttempt logged
  → Check lockout (5 failures in 15 min → 429)
  → scrypt verify(passwordHash, candidate)
  → Create Session (random token → SHA-256 hash stored in DB)
  → Set __session cookie (httpOnly, Secure, SameSite=Strict, 30d)
  → Return user object (no token in body)

Subsequent requests
  → Cookie read server-side
  → SHA-256(cookie) compared to sessions.token_hash
  → Session expiry checked
  → user attached to request context
```

### Threat Coverage

| Threat | Mitigation |
|---|---|
| SQL Injection | Prisma parameterised queries; raw pg uses `$1` placeholders |
| XSS | `X-XSS-Protection` header; react-markdown + rehype-sanitize; CSP header |
| CSRF | SameSite=Strict cookies; custom header check on mutations |
| SSRF | Backend proxy-image validates URL against allowlist before fetching |
| Brute force | LoginAttempt model + lockout; per-IP rate limiting |
| Session fixation | New session token generated on every login |
| Clickjacking | `X-Frame-Options: SAMEORIGIN` |
| Sensitive data exposure | Passwords never returned in API; tokens hashed in DB |
| Rate limit bypass | IP extracted from `x-forwarded-for` correctly (split + trim first element) |
| Bot abuse | Cloudflare Bot Management (see docs/06-cloudflare.md) |
| DDoS | Cloudflare proxying absorbs volumetric attacks before origin |

---

## Performance Architecture

### Target: Lighthouse 95+ on all four metrics

| Metric | Strategy |
|---|---|
| **Performance 95+** | Static generation for blog/manga pages; ISR for dynamic; image WebP via backend proxy + `next/image`; no render-blocking resources |
| **Accessibility 95+** | Semantic HTML throughout; ARIA labels on interactive elements; colour contrast ≥ 4.5:1; keyboard navigation |
| **Best Practices 95+** | HTTPS everywhere; no mixed content; security headers; no deprecated APIs |
| **SEO 95+** | Unique title+description per page; canonical URLs; JSON-LD structured data; sitemap.xml; robots.txt; breadcrumbs |

### Core Web Vitals Targets

| Metric | Target | How |
|---|---|---|
| LCP | < 1.8s | Static HTML + Cloudflare CDN cache; priority image preload on above-fold images |
| CLS | < 0.05 | Explicit `width`/`height` on all images; no dynamic content insertion above fold |
| INP | < 150ms | Minimal client JS; React Server Components where possible; code-split heavy pages |

### Caching Strategy

```
Cloudflare Edge Cache
  → Static assets (JS/CSS/images): Cache-Control: public, max-age=31536000, immutable
  → Blog pages (SSG): Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400
  → Manga pages (ISR 1h): Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400
  → API routes (manga data): Cache-Control: public, s-maxage=300 (5 min)
  → Auth API routes: Cache-Control: no-store

Backend In-Memory Cache
  → Home page aggregates: 24h TTL (existing from Manga repo)
  → Manga metadata: 24h TTL
  → Source chapter lists: 20 req/min rate limit per IP
```

---

## Blog Scheduling Logic

The `Article` model has:
- `status: ContentStatus` (DRAFT | SCHEDULED | PUBLISHED | ARCHIVED)
- `scheduledFor: DateTime?`

The blog listing API query:
```sql
WHERE status = 'PUBLISHED'
   OR (status = 'SCHEDULED' AND scheduled_for <= NOW())
ORDER BY published_at DESC NULLS LAST, scheduled_for DESC NULLS LAST
```

No cron job needed. The import script sets:
- `status = 'SCHEDULED'`
- `scheduledFor = NOW() + (index * 25h)` — one post every 25 hours (within the 24–26h requirement)

When a reader hits the blog page, the query naturally surfaces any posts whose `scheduledFor` has passed. Next.js ISR means this check runs at most once per 5 minutes per edge node.
