# Prisma & the App-Domain Data Model

Prisma manages the **application** database (auth, editorial CMS, community,
security). The manga scraper manages its own tables via raw `pg` — Prisma never
touches those (see [architecture.md](architecture.md#database-ownership-boundary)).

Schema: `frontend/prisma/schema.prisma`. Client singleton: `frontend/src/lib/prisma.ts`.

## Models

### Auth
- **User** — accounts. `role` is `USER | EDITOR | ADMIN`. `passwordHash` is null
  for OAuth-only accounts. Soft-ban via `banned`/`bannedReason`.
- **Session** — server-side sessions. Only the **hash** of the session token is
  stored; the raw token lives in the cookie. Indexed by `expiresAt` for cleanup.

### Editorial (E-E-A-T / Helpful Content)
- **EditorialAuthor** — public byline/persona with `credentials` and
  `socialLinks` for author authority signals. Optionally linked to a `User`.
- **Article** — the core content unit. `contentType` covers
  `BLOG | REVIEW | GUIDE | RECOMMENDATION | EDITORIAL | NEWS`; `status` covers
  `DRAFT | SCHEDULED | PUBLISHED | ARCHIVED`. Carries SEO fields (`seoTitle`,
  `seoDescription`, `canonicalUrl`, `ogImage`) and `relatedMangaIds` (plain id
  refs, no FK). Body is markdown.
- **Review** — 1:1 with a `REVIEW` article. Component scores (0–100) for story,
  characters, artwork, world, pacing, overall, plus `strengths`/`weaknesses`/`verdict`.
- **Category**, **ArticleTag** — taxonomy.

### Community
- **ContactMessage** — contact / bug report / feature request / complaint, with
  a `status` workflow and spam flag.
- **NewsletterSubscriber** — double-opt-in via `confirmed` + `token`.

### Security
- **AuditLog** — records privileged actions (`action`, `entity`, `entityId`, `meta`).
- **LoginAttempt** — records login attempts for rate limiting and the security
  dashboard; indexed by `(email, createdAt)` and `(ip, createdAt)`.

## Conventions

- Every model maps to an explicit snake_case table name via `@@map`, and columns
  via `@map`, so table names stay app-scoped and readable in SQL.
- IDs are `cuid()` strings.
- Cross-domain references to scraper tables are **plain ids without foreign
  keys**; enforce integrity in application code.
- Add indexes for every column used in a `WHERE`/`ORDER BY` on a hot path.

## Workflow

```bash
# after editing schema.prisma
npx prisma generate      # regenerate the typed client
npx prisma db push       # sync schema to DB (dev)
npx prisma studio        # inspect data
```

For production, prefer versioned migrations:

```bash
npx prisma migrate dev --name <change>   # create + apply a migration locally
npx prisma migrate deploy                # apply pending migrations in prod/CI
```

## Free-tier storage discipline (Neon 500 MB)

- Store only essential fields; keep large derived data in the scraper's cache tables.
- Prefer browser storage for anonymous reading history (already the pattern in
  `AppContext`); persist to the DB only for authenticated users.
- Periodically prune expired `Session` and old `LoginAttempt`/`AuditLog` rows.
