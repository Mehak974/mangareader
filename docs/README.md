# Manga Platform — Documentation

This directory is the source of truth for how the platform is built, run, and
deployed. Keep it synchronized with the implementation: when you change
behavior, update the relevant doc in the same change.

## Contents

- [architecture.md](architecture.md) — system overview: the two apps, data flow, and boundaries.
- [setup.md](setup.md) — local development setup, step by step.
- [environment-variables.md](environment-variables.md) — every env var, where it is used, and how to generate secrets.
- [prisma.md](prisma.md) — the app-domain data model, migrations, and conventions.
- [neon.md](neon.md) — provisioning and migrating to Neon PostgreSQL.
- [security.md](security.md) — security posture, headers, and the CSP rollout plan.
- [auth.md](auth.md) — sessions, password hashing, roles, and rate limiting.
- [admin.md](admin.md) — the admin dashboard, editorial CMS, and moderation.
- [editorial-content.md](editorial-content.md) — content model, seeding, and the AdSense/E-E-A-T strategy.
- [comments.md](comments.md) — the discussion system for manga and articles.
- [seo.md](seo.md) — metadata, JSON-LD, sitemap, robots, and GEO/AEO.

## Project layout

```
Manga/
├── frontend/   Next.js 16 app (App Router, React 19, Tailwind 4). Incremental TypeScript.
├── backend/    Express scraping server (port 3001, raw `pg`, Cheerio, sharp image proxy).
└── docs/       This documentation.
```

## Quick reference

| Concern                      | Where it lives                                             |
| ---------------------------- | --------------------------------------------------------- |
| UI, routing, pages           | `frontend/src/app`, `frontend/src/components`             |
| App data (auth, CMS, users)  | Prisma → PostgreSQL (`frontend/prisma/schema.prisma`)     |
| Manga/chapter data & images  | Express scraper (`backend/`), raw `pg` tables             |
| Client-side UI state         | `frontend/src/context/AppContext.js`                      |
