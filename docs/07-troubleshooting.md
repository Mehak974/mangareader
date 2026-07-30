# Troubleshooting Guide

Common problems and their solutions across local dev, production, and the blog import.

---

## Local Development

### `Error: Cannot find module '@prisma/client'`
```bash
cd frontend && npx prisma generate
```
This must be re-run any time you change `schema.prisma`.

### `PrismaClientKnownRequestError: Can't reach database server`
- Check `DATABASE_URL` in `frontend/.env.local`
- For Neon: ensure `?sslmode=require` is at the end
- For local Postgres: `brew services start postgresql@15` (macOS) or `sudo service postgresql start` (Linux)
- Neon free tier hibernates after 5 minutes of inactivity — the first query after hibernate may take 2–3 seconds

### `Error: Invalid DATABASE_URL`
The URL must be in the form: `postgresql://user:password@host/dbname?sslmode=require`
Never add `?pgbouncer=true` to the local or development URL — only production pooled URLs use pgbouncer.

### Backend returns CORS error
- Ensure `ALLOWED_ORIGINS=http://localhost:3000` is set in `backend/.env`
- Restart the backend after changing `.env` (nodemon watches `.js` files, not `.env`)
- Check that the frontend `NEXT_PUBLIC_API_URL` matches the port the backend is actually running on (default 3001)

### `next: command not found`
```bash
cd frontend && npm install
```

### Port already in use
```bash
lsof -ti:3000 | xargs kill -9   # Kill whatever is on port 3000
lsof -ti:3001 | xargs kill -9   # Kill whatever is on port 3001
```

### Prisma Studio won't start
```bash
cd frontend && npx prisma studio
```
Prisma Studio only works with a running database. Ensure `DATABASE_URL` is set.

### Admin panel shows "401 Unauthorized"
The session cookie may have expired or be missing. Try:
1. Log out via `/admin` → logout button
2. Clear cookies for `localhost` in DevTools (Application → Cookies)
3. Log in again at `/login`

---

## Production (Vercel + Railway)

### Vercel build fails with `Environment variable not found`
Go to Vercel dashboard → Settings → Environment Variables and ensure all required variables are set for the Production environment. Variables set for Preview don't automatically apply to Production.

### Railway backend crashes on startup
Check Railway logs (Deployments → latest → Logs):
- `ADMIN_TOKEN not set` — set `ADMIN_TOKEN` in Railway Variables
- `DATABASE_URL not set` — copy Neon connection string to Railway Variables
- Port conflict — Railway sets `PORT` automatically; ensure your code reads `process.env.PORT`

### `Application error: a client-side exception has occurred`
This is a Next.js hydration error. Common causes:
1. Browser extension injecting content (test in incognito)
2. Date rendering mismatch (use `suppressHydrationWarning` on date elements)
3. Conditional rendering based on `typeof window !== 'undefined'` missing

Check the browser console for the actual error.

### Images not loading in production
- Ensure the image domain is in `next.config.js` → `images.remotePatterns`
- Ensure the backend proxy is running (check Railway deployment)
- Check Cloudflare isn't blocking the image requests (check WAF activity log)

### Cloudflare is caching admin pages
Check your Cache Rules — the "No Cache Auth/Admin" rule should match `/admin*` and `/api/auth*`. If pages are still being cached:
1. In Cloudflare → Cache → Configuration → Purge Cache → Custom Purge → enter `/admin*`
2. Verify the rule is in the correct order (Cloudflare applies Cache Rules in order; higher rules win)

### Lighthouse score below 95

**Performance below 95:**
- Run `npx next build && npx next analyze` — look for large chunks
- Check that above-fold images have `priority` prop
- Verify Cloudflare CDN is working: response headers should include `CF-Cache-Status: HIT` on second load
- Check Core Web Vitals in Search Console for real-user data

**SEO below 95:**
- Every page needs a unique `<title>` and `<meta name="description">`
- Check for missing canonical tags (Lighthouse flags duplicate content)
- Verify sitemap is accessible at `/sitemap.xml` and contains all pages
- Test structured data at [Rich Results Test](https://search.google.com/test/rich-results)

**Accessibility below 95:**
- Run `npx axe-core https://yourdomain.com` for detailed violations
- Common issues: missing `alt` text on images, low colour contrast, missing form labels
- Use browser DevTools → Accessibility panel for per-element audits

---

## Blog Import

### `Cannot find module '@prisma/client'`
```bash
cd frontend && npx prisma generate
cd ../blog-import && npm install
```

### `Error: P2002 Unique constraint failed on slug`
The article slug already exists. Either:
1. The article was already imported — skip it (the import script handles this automatically)
2. Two articles in your source files share the same slug — the parser auto-appends `-2`, `-3` etc.

### Import script runs but articles don't appear on the blog
Articles are imported as `SCHEDULED`. They appear on the blog when `scheduledFor <= NOW()`. The first post is scheduled for tomorrow at 10:00 UTC. To test immediately:
```sql
-- In Neon SQL Editor or Prisma Studio:
UPDATE "Article" SET status = 'PUBLISHED', published_at = NOW() WHERE slug = 'your-slug';
```
Or through the admin panel: Articles → find the article → Edit → Status → Published → Save.

### Import stops partway through
The import script uses individual upserts, not a single transaction. Partial imports are safe — re-running the script will skip already-imported articles and continue from where it left off.

### `articles-data.json not found`
Run the parser first:
```bash
cd blog-import && node parse-articles.js
```

---

## Database

### Neon database is hibernated / slow first query
Neon free tier hibernates after 5 minutes of inactivity. Add this to `frontend/src/lib/prisma.ts` to keep it warm:
```typescript
// Ping the database every 4 minutes in production
if (process.env.NODE_ENV === 'production') {
  setInterval(async () => {
    await prisma.$queryRaw`SELECT 1`;
  }, 4 * 60 * 1000);
}
```
Or upgrade to Neon's paid tier for always-on connections.

### `SSL connection error`
Ensure `?sslmode=require` is at the end of your Neon connection string. Neon requires SSL for all connections.

### Running out of Neon free tier connections
Neon free tier allows 10 concurrent connections. If you hit this limit:
1. Ensure you're using the **pooled** connection URL (with pgBouncer) — this multiplexes many app connections into a pool
2. Ensure Prisma client is a singleton (not re-instantiated on every request) — `lib/prisma.ts` should use the pattern: `globalThis.prisma = globalThis.prisma || new PrismaClient()`

### Schema migration issues
```bash
# Check what migrations are pending
cd frontend && npx prisma migrate status

# Apply pending migrations (production)
npx prisma migrate deploy

# Reset database (DANGER: destroys all data — dev only)
npx prisma migrate reset
```

---

## Cloudflare

### DNS not propagating
- Propagation can take up to 48 hours, though usually 5–30 minutes
- Check at [whatsmydns.net](https://whatsmydns.net) — enter your domain and select CNAME
- If you see Cloudflare's nameservers in your registrar, the change is correctly configured

### SSL certificate error after adding domain
- Go to Cloudflare → SSL/TLS → ensure mode is "Full (strict)"
- Cloudflare issues certificates within 5–15 minutes of a domain being added
- If still failing after 24h: SSL/TLS → Edge Certificates → re-issue

### WAF is blocking legitimate traffic (false positives)
In Cloudflare → Security → WAF → Activity:
- Find the blocked request
- Click on it → check which rule triggered
- Either widen the rule condition or add the IP/path to an allowlist

### Purging cache for specific files
```
Cloudflare → Cache → Configuration → Purge Cache → Custom Purge
Enter paths like: /blog/best-manga-of-all-time, /_next/static/chunks/
```
