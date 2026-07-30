# Manga Reader — Production Build

> Merged from `Manga` (base) + `Manga-Reader-New` (security/UX additions)
> Lighthouse target: **95+** Performance · Accessibility · Best Practices · SEO

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 + React 19 + Tailwind v4 + TypeScript |
| Backend | Express (Node.js) with security hardening |
| Database | PostgreSQL via Neon + Prisma ORM |
| CDN / WAF | Cloudflare |
| Deploy | Vercel (frontend) + Railway (backend) |

## Quick Start

```bash
# 1. Install
cd backend && npm install
cd ../frontend && npm install

# 2. Configure
cp backend/.env.example backend/.env       # edit with your values
cp frontend/.env.example frontend/.env.local  # edit with your values

# 3. Database setup
cd frontend
npx prisma generate
npx prisma db push
npx prisma db seed

# 4. Run (two terminals)
cd backend && npm run dev     # → http://localhost:3001
cd frontend && npm run dev    # → http://localhost:3000

# 5. Import 326 blog posts
cd blog-import && npm install
node parse-articles.js        # regenerate articles-data.json (already included)
node import-blogs.js          # import to database
```

## What Was Merged

### From `Manga` (base repo — everything)
- Prisma schema (User, Session, Article, Review, Comment, AuditLog, LoginAttempt...)
- TypeScript API routes (auth, admin, comments, contact, newsletter)
- Full 13-page admin CMS
- `lib/` (auth, validation, seo, env, api-guard, ratelimit, prisma)
- Threaded comment system
- Review scoring system

### Added from `Manga-Reader-New`
- Security headers on Express backend
- CORS allowlist (`ALLOWED_ORIGINS` env var)
- Per-route rate limiting
- SSRF guard on `/api/proxy-image`
- `MaintenanceGuard.js` with admin toggle
- `AdBanner.js` (VIP bypass)
- `AchievementToast.js` + `achievements.js`
- `PWAInstall.js` + `manifest.json`
- `/api/source/:sourceId/home`, `/api/inspect`, `/api/sources` routes

## Documentation

| File | Topic |
|---|---|
| `docs/01-merge-plan-and-architecture.md` | Architecture, security model |
| `docs/02-environment-variables.md` | All env vars |
| `docs/03-local-setup.md` | Local dev guide |
| `docs/04-deployment.md` | Vercel + Railway + Neon |
| `docs/05-cloudflare.md` | DNS, SSL, WAF, cache rules |
| `docs/06-performance-optimization.md` | Lighthouse 95+ checklist |
| `docs/07-troubleshooting.md` | Common issues |
| `docs/final-comparison-table.md` | Full feature comparison |

## Blog System

326 blog posts auto-scheduled 25 hours apart — no cron job needed.

```
blog-import/
├── articles-data.json    ← 326 parsed articles (ready to import)
├── parse-articles.js     ← regenerates articles-data.json from source files
└── import-blogs.js       ← imports to database
```

Posts auto-publish when `scheduledFor <= NOW()` via ISR revalidation.
