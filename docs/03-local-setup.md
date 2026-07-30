# Local Development Setup

Get the merged project running on your machine in under 15 minutes.

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| npm | 10+ | Bundled with Node |
| Git | any | [git-scm.com](https://git-scm.com) |
| PostgreSQL (local) | 15+ OR Neon free tier | [neon.tech](https://neon.tech) |

---

## Step 1 — Clone & Install

```bash
# Clone the merged repo (or your forked version)
git clone https://github.com/YOUR_USERNAME/manga-reader.git
cd manga-reader

# Install backend dependencies
cd backend
npm install
cd ..

# Install frontend dependencies
cd frontend
npm install
```

---

## Step 2 — Configure Environment

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your values (see docs/02-environment-variables.md)

# Frontend
cp frontend/.env.example frontend/.env.local
# Edit frontend/.env.local with your values
```

For local development, use a Neon free-tier database or a local PostgreSQL instance:

**Neon (recommended — matches production exactly):**
1. Go to [console.neon.tech](https://console.neon.tech)
2. Create a free project
3. Copy the connection string into `DATABASE_URL`

**Local PostgreSQL:**
```bash
# macOS
brew install postgresql@15
brew services start postgresql@15
createdb manga_reader_dev

# DATABASE_URL for local:
DATABASE_URL="postgresql://localhost/manga_reader_dev"
```

---

## Step 3 — Database Setup

```bash
cd frontend

# Generate Prisma client
npx prisma generate

# Push schema to database (creates all tables)
npx prisma db push

# Seed with default data (admin user + sample categories)
npx prisma db seed
```

After seeding, a default admin account is created:
- **Email:** `admin@localhost`
- **Password:** `changeme123`

**Change this password immediately** after first login via the admin panel.

---

## Step 4 — Run Development Servers

Open two terminal windows:

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev   # uses nodemon for hot reload
```

Backend runs at `http://localhost:3001`

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Frontend runs at `http://localhost:3000`

---

## Step 5 — Verify Setup

Open `http://localhost:3000` in your browser. You should see:
- ✅ Homepage with manga listings (or empty state if no manga scraped yet)
- ✅ Blog page at `/blog`
- ✅ Admin panel at `/admin` (login with seeded credentials)

**Admin panel checklist:**
- [ ] Login works
- [ ] Articles page loads
- [ ] Create a test article and save as draft
- [ ] Users page shows admin account

---

## Step 6 — Import Blog Posts (Optional at Setup)

```bash
cd blog-import
# Edit import-blogs.js to set your domain
node import-blogs.js
```

This imports all blog posts from the uploaded content files as scheduled posts.

---

## Common Issues

### `Error: Cannot find module '@prisma/client'`
```bash
cd frontend && npx prisma generate
```

### Database connection refused
- Check `DATABASE_URL` is set correctly in `frontend/.env.local`
- For Neon: ensure you're using `?sslmode=require` at the end of the connection string
- For local Postgres: ensure the server is running (`brew services start postgresql@15`)

### Backend CORS error in browser
- Ensure `ALLOWED_ORIGINS` in `backend/.env` includes `http://localhost:3000`
- Restart the backend after changing `.env`

### `next: command not found`
```bash
cd frontend && npm install
```

### Port already in use
```bash
# Kill processes on ports 3000 and 3001
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

---

## Development Workflow

```bash
# Format code
cd frontend && npm run lint

# Type check
cd frontend && npx tsc --noEmit

# Check Prisma schema
cd frontend && npx prisma validate

# Open Prisma Studio (visual DB browser)
cd frontend && npx prisma studio
```

Prisma Studio runs at `http://localhost:5555` and lets you view/edit all database records directly — very useful for debugging blog import issues.
