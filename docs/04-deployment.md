# Production Deployment

Recommended stack: **Vercel** (frontend) + **Railway** (backend) + **Neon** (database) + **Cloudflare** (CDN/DNS/WAF)

---

## Architecture Overview

```
User
  ↓
Cloudflare (DNS + CDN + WAF + DDoS protection)
  ↓
Vercel Edge Network (Next.js frontend)
  ↓ (API calls for manga data)
Railway (Express backend)
  ↓ (both services read/write)
Neon PostgreSQL (database)
```

---

## 1. Database — Neon

### Create Production Database

1. Go to [console.neon.tech](https://console.neon.tech) and create a new project
2. Name it `manga-reader-production`
3. Choose the region closest to your users (us-east-1 for US, eu-central-1 for Europe)
4. Copy the **pooled connection string** (use this as `DATABASE_URL`)

### Run Migrations

```bash
# From frontend/
DATABASE_URL="your-neon-production-url" npx prisma migrate deploy
DATABASE_URL="your-neon-production-url" npx prisma db seed
```

### Enable Connection Pooling

In the Neon dashboard → Connection Details:
- Toggle **Pooled connection** ON
- Use this URL (with `?pgbouncer=true`) as your `DATABASE_URL`

This allows hundreds of simultaneous connections without hitting Postgres limits.

---

## 2. Backend — Railway

### Deploy

1. Go to [railway.app](https://railway.app) and create a new project
2. Connect your GitHub repository
3. Set the **root directory** to `backend`
4. Railway auto-detects Node.js and runs `npm start`

### Environment Variables on Railway

Set all variables from `backend/.env` in Railway's Variables panel:

```
PORT=3001
NODE_ENV=production
DATABASE_URL=<neon-production-url>
ADMIN_TOKEN=<your-32-byte-token>
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### Custom Domain (Optional)

In Railway → Settings → Networking → Add custom domain: `api.yourdomain.com`

Then in Cloudflare DNS, add a CNAME: `api` → `your-app.railway.app` (proxied)

---

## 3. Frontend — Vercel

### Deploy

1. Go to [vercel.com](https://vercel.com) and import your repository
2. Set **Root Directory** to `frontend`
3. Framework preset: **Next.js** (auto-detected)
4. Add all environment variables from `frontend/.env.local` (production values)

### `vercel.json` (place in `frontend/`)

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "SAMEORIGIN" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://pagead2.googlesyndication.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; connect-src 'self' https://api.yourdomain.com https://graphql.anilist.co; frame-src https://googleads.g.doubleclick.net;"
        },
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" }
      ]
    },
    {
      "source": "/_next/static/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

### Automatic Deployments

Every push to `main` triggers a Vercel deployment. Preview deployments are created for every PR automatically.

---

## 4. Cloudflare — DNS, CDN, WAF

### DNS Setup

1. Add your domain to Cloudflare (free plan works)
2. Update your registrar's nameservers to Cloudflare's
3. Add DNS records:

| Type | Name | Value | Proxy |
|---|---|---|---|
| CNAME | `@` (or `www`) | `cname.vercel-dns.com` | ✅ Proxied |
| CNAME | `www` | `cname.vercel-dns.com` | ✅ Proxied |
| CNAME | `api` | `your-app.railway.app` | ✅ Proxied |

### SSL/TLS Settings

In Cloudflare → SSL/TLS:
- **Mode:** Full (strict)
- **Always Use HTTPS:** ON
- **HSTS:** Enabled, max-age 6 months, include subdomains
- **Minimum TLS Version:** TLS 1.2
- **TLS 1.3:** ON

### Cache Rules (Cloudflare → Cache Rules)

**Rule 1 — Cache static assets forever**
- Condition: File extension matches `js, css, woff2, woff, ttf, png, jpg, webp, svg, ico`
- Action: Cache Everything, Edge TTL: 1 year

**Rule 2 — Cache blog and manga pages**
- Condition: URI Path matches `/blog/*` OR `/manga/*`
- Action: Cache Everything, Edge TTL: 1 hour, Browser TTL: 10 minutes

**Rule 3 — Don't cache auth or admin routes**
- Condition: URI Path matches `/admin*` OR `/api/auth*`
- Action: Bypass cache

### WAF Rules

In Cloudflare → Security → WAF:

**Rule 1 — Block common attack patterns**
```
(http.request.uri.path contains "../" OR
 http.request.uri.query contains "<script" OR
 http.request.uri.query contains "UNION SELECT" OR
 http.request.uri.query contains "' OR '1'='1")
→ Block
```

**Rule 2 — Rate limit API**
- Path: `/api/*`
- Rate: 100 requests per 1 minute per IP
- Action: Block for 1 minute

**Rule 3 — Block bad bots**
- Enable **Bot Fight Mode** (free) or **Super Bot Fight Mode** (Pro)

### Performance Settings

In Cloudflare → Speed:
- **Auto Minify:** Enable JS, CSS, HTML
- **Brotli:** ON
- **Early Hints:** ON
- **HTTP/2:** ON (automatic)
- **HTTP/3 (with QUIC):** ON

---

## 5. Post-Deployment Checklist

### First Deploy

- [ ] Run `prisma migrate deploy` against production database
- [ ] Run `prisma db seed` to create admin user
- [ ] Change default admin password
- [ ] Set `ADMIN_TOKEN` in Railway environment
- [ ] Verify `ALLOWED_ORIGINS` includes your production domain
- [ ] Test auth: register, login, logout
- [ ] Test admin: create a draft article, publish it
- [ ] Submit sitemap to Google Search Console: `https://yourdomain.com/sitemap.xml`
- [ ] Verify in Google Rich Results Test that JSON-LD is detected

### Lighthouse Verification

Run after deploy:
```bash
npx lighthouse https://yourdomain.com --output=html --output-path=./lighthouse-report.html
```

Or use [PageSpeed Insights](https://pagespeed.web.dev) for a quick score.

Target: **95+** on all four categories on mobile.

### Ongoing

- [ ] Set up Vercel Analytics (enabled by default on Vercel)
- [ ] Connect Google Search Console (verify via DNS TXT record in Cloudflare)
- [ ] Set up Sentry for error tracking (optional but recommended)
- [ ] Enable Neon automatic backups (Settings → Backup)
