# Local Development Setup

## Prerequisites

- **Node.js** 20+ (verified on v24).
- **PostgreSQL** running locally (or a Neon connection string).
- npm.

## 1. Install dependencies

```bash
cd frontend && npm install
cd ../backend && npm install
```

If Prisma's install scripts were blocked, generate the client explicitly:

```bash
cd frontend && npx prisma generate
```

## 2. Configure environment

Copy the templates and fill in values (see [environment-variables.md](environment-variables.md)):

```bash
cp frontend/.env.example frontend/.env
# backend/.env already exists; verify DATABASE_URL / PG* values
```

Generate an `AUTH_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 3. Create the database and tables

Ensure the database referenced by `DATABASE_URL` exists (e.g. `manga`). Then
create the app-domain tables:

```bash
cd frontend && npx prisma db push
```

The scraper creates its own tables automatically the first time it starts.

## 4. Run the apps

```bash
# Terminal 1 — scraper API (port 3001)
cd backend && npm run dev

# Terminal 2 — Next.js app (port 3000)
cd frontend && npm run dev
```

Visit http://localhost:3000.

## 5. Useful commands

| Command                          | Purpose                                  |
| -------------------------------- | ---------------------------------------- |
| `npm run build` (frontend)       | Production build + type check.           |
| `npx tsc --noEmit` (frontend)    | Type check only.                         |
| `npx prisma studio` (frontend)   | Browse/edit app-domain data in a GUI.    |
| `npx prisma db push` (frontend)  | Sync schema to the database.             |
| `npx prisma generate` (frontend) | Regenerate the typed client.             |
