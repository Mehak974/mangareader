# Neon PostgreSQL

The platform targets **Neon PostgreSQL Free (500 MB)** until it generates
revenue. The architecture is designed so moving to Neon — or to a larger plan —
requires only changing `DATABASE_URL`, with no code or schema changes.

## Provisioning

1. Create a project at https://neon.tech.
2. Copy the pooled connection string. It looks like:

   ```
   postgresql://<user>:<password>@<host>-pooler.<region>.neon.tech/<db>?sslmode=require
   ```

3. Set it as `DATABASE_URL` in `frontend/.env` (and in the backend's env if the
   scraper shares the database).

## Applying the schema

```bash
cd frontend
npx prisma db push        # or: npx prisma migrate deploy
```

The scraper creates its own tables on first startup against the same database.

## Connection pooling

- Use Neon's **pooled** endpoint (`-pooler` host) for the serverless Next.js
  runtime to avoid exhausting connections.
- The Prisma client singleton (`src/lib/prisma.ts`) prevents connection blow-up
  during local hot-reload.

## Staying under 500 MB

- Keep only essential columns in app tables; large/derived manga data lives in
  the scraper's cache tables and can be regenerated.
- Prune expired sessions and old audit/login rows on a schedule.
- Anonymous reading history stays in the browser; only authenticated users'
  data is persisted.

## Upgrading plans

Increasing the Neon plan requires no code changes — capacity and limits change
server-side. The same `DATABASE_URL` continues to work.
