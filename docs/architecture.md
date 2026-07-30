# Architecture

The platform is two cooperating applications sharing one PostgreSQL database but
owning **disjoint sets of tables**.

## Components

### 1. Frontend — `frontend/`

- **Framework:** Next.js 16 (App Router), React 19, Tailwind CSS 4.
- **Language:** Incremental TypeScript. Existing files remain `.js`; all new code
  is strict `.ts`/`.tsx`. Converted opportunistically when a file is edited.
- **Client state:** `src/context/AppContext.js` holds UI/session state in memory
  (theme, sidebar, reading preferences). This is presentation state, not the
  source of truth for persisted data.
- **App data access:** Prisma client (`src/lib/prisma.ts`) for auth, editorial
  content, community messages, and audit logs.
- **Manga data access:** the browser and server call the Express scraper for
  manga metadata, chapters, and proxied images.

### 2. Backend scraper — `backend/`

- **Framework:** Express on port 3001.
- **Database access:** raw `pg` (`backend/db.js`), not Prisma.
- **Responsibilities:** scraping manga sources, an AniList/Jikan proxy, chapter
  caching, and a `sharp`-based image proxy.
- **Owns tables:** `manga`, `metadata`, `source_mappings`, `chapters`,
  `chapters_cache`, `latest_chapter_cache`, `genres`, `manga_genres`, `tags`,
  `manga_tags`, `authors`, `manga_authors`, `reading_history`, `bookmarks`,
  `collections`, `collection_manga`.

## Database ownership boundary

Both apps connect to the same database. To keep them from clashing:

- The scraper auto-creates its tables on startup (`backend/db.js`).
- Prisma owns only the **app-domain** tables, each mapped to an explicit,
  app-scoped name: `users`, `sessions`, `editorial_authors`,
  `editorial_categories`, `article_tags`, `articles`, `reviews`,
  `contact_messages`, `newsletter_subscribers`, `audit_logs`, `login_attempts`.
- Cross-domain references (e.g. an article about a manga) are stored as **plain
  id references** (`Review.mangaId`, `Article.relatedMangaIds`) with **no foreign
  key**, because the referenced tables are owned by the other app. Integrity is
  enforced in application code, not the schema.

> When running `prisma db push`/`migrate`, Prisma only touches models it knows
> about. It will not drop or alter the scraper's tables.

## Data flow (reading a manga)

```
Browser ──► Next.js page ──► Express scraper (:3001) ──► source sites / AniList
                                     │
                                     └──► PostgreSQL (scraper tables) for caching
```

## Data flow (editorial article)

```
Browser ──► Next.js route handler / server action ──► Prisma ──► PostgreSQL (app tables)
```

## Why this split

- The scraper is I/O-heavy, long-running, and independent of the request
  lifecycle — it belongs in its own process.
- App data (auth, CMS) benefits from Prisma's typing and migrations and lives
  close to the Next.js server for server actions and SSR.
- Migrating the app database to Neon is a `DATABASE_URL` swap with no
  architectural change (see [neon.md](neon.md)).
