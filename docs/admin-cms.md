# Admin Panel & Editorial CMS

A role-gated admin surface under `/admin` for managing editorial content, the
community, and users.

## Access control

`frontend/src/app/admin/layout.js` is a server component that calls
`getCurrentUser()` and redirects anyone below `EDITOR` to `/login?next=/admin`
**before any admin UI renders** — the check is a real DB session lookup, not
client state, so it cannot be bypassed. The `System` nav group (users, audit)
is additionally gated to `ADMIN`.

Admin API routes are wrapped with `withRole("EDITOR", …)` (or `"ADMIN"`) from
`frontend/src/lib/api-guard.ts`, which returns 401/403 JSON for unauthorized
callers. Every privileged mutation writes an entry via `audit()`
(`frontend/src/lib/audit.ts`) to the `audit_logs` table.

## Modules

| Area        | Pages                                              | API                              |
| ----------- | -------------------------------------------------- | -------------------------------- |
| Dashboard   | `/admin`                                           | (reads via Prisma directly)      |
| Articles    | `/admin/articles`, `/new`, `/[id]/edit`            | `/api/admin/articles[/:id]`      |
| Taxonomy    | `/admin/taxonomy`                                  | `/api/admin/categories`, `/tags` |
| Authors     | `/admin/authors`, `/new`, `/[id]/edit`             | `/api/admin/authors[/:id]`       |
| Messages    | `/admin/messages`                                  | `/api/admin/messages/:id`        |
| Newsletter  | `/admin/newsletter`                                | `/api/admin/newsletter/:id`, `/export` |
| Users       | `/admin/users` (ADMIN)                             | `/api/admin/users/:id`           |
| Audit log   | `/admin/audit` (ADMIN)                             | (reads via Prisma directly)      |

## Content model

Editorial content is one `Article` model (`frontend/prisma/schema.prisma`) with a
`contentType` discriminator: `BLOG`, `REVIEW`, `GUIDE`, `RECOMMENDATION`,
`EDITORIAL`, `NEWS`. `REVIEW` articles have a 1:1 `Review` row with per-axis
scores (story/characters/artwork/world/pacing/overall), strengths, weaknesses,
and a verdict.

Lifecycle: `DRAFT → SCHEDULED → PUBLISHED → ARCHIVED`. Publishing stamps
`publishedAt` once; scheduling stores `scheduledFor`. All write logic (slug
uniqueness, reading-time estimate, tag upsert-and-connect, review upsert) lives
in `frontend/src/lib/editorial.ts` and is shared by create and update so the two
paths can't drift.

## Public rendering

Published articles surface at `/blog` (list) and `/blog/[slug]` (detail), both
server-rendered from the DB with full SEO metadata and JSON-LD. Markdown bodies
render through `frontend/src/components/Markdown.js` (gfm + sanitize).

## Seeding

`frontend/prisma/seed.js` inserts an editorial author, categories, and six
full-length E-E-A-T articles (guides, a review, recommendations, an editorial).
Run with `npx prisma db seed`. Idempotent — upserts by slug.
