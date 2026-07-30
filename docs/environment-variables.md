# Environment Variables

All variables are validated at startup by `frontend/src/lib/env.ts`, which fails
fast with a clear message if a required variable is missing or malformed. Never
commit `.env` files — only `.env.example`.

## Frontend (`frontend/.env`)

| Variable                  | Required | Exposed to browser | Purpose                                                                 |
| ------------------------- | -------- | ------------------ | ----------------------------------------------------------------------- |
| `DATABASE_URL`            | Yes      | No                 | Prisma connection to the app-domain database (auth, CMS, community).    |
| `AUTH_SECRET`             | Yes      | No                 | Signs/verifies session cookies and CSRF tokens. ≥32 chars in production.|
| `NEXT_PUBLIC_SITE_URL`    | Yes      | Yes                | Canonical base URL for SEO, sitemaps, OG images, email links.           |
| `NEXT_PUBLIC_SCRAPER_URL` | Yes      | Yes                | Base URL of the Express scraper (manga data + image proxy).             |

Only variables prefixed with `NEXT_PUBLIC_` reach the browser bundle. Secrets
(`DATABASE_URL`, `AUTH_SECRET`) must never carry that prefix.

## Backend (`backend/.env`)

| Variable       | Required | Purpose                                                    |
| -------------- | -------- | ---------------------------------------------------------- |
| `PORT`         | No       | Scraper port (defaults to 3001).                           |
| `DATABASE_URL` | Yes\*    | Single connection string for the scraper's `pg` pool.      |
| `PGHOST`       | Yes\*    | Alternative to `DATABASE_URL`: host.                       |
| `PGUSER`       | Yes\*    | Alternative to `DATABASE_URL`: user.                       |
| `PGPASSWORD`   | Yes\*    | Alternative to `DATABASE_URL`: password.                   |
| `PGDATABASE`   | Yes\*    | Alternative to `DATABASE_URL`: database name.              |
| `PGPORT`       | Yes\*    | Alternative to `DATABASE_URL`: port.                       |

\* Provide **either** `DATABASE_URL` **or** the `PG*` set. `DATABASE_URL` wins.

## Generating secrets

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Notes on shared database

Both apps typically point at the same database. In production on Neon, set both
`DATABASE_URL` values to the same Neon connection string (with
`?sslmode=require`). See [neon.md](neon.md).
