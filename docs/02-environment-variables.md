# Environment Variables

Complete reference for all environment variables required by the merged project.

---

## Frontend (`frontend/.env.local`)

```bash
# ── DATABASE ──────────────────────────────────────────────────────────────────
# Neon PostgreSQL connection string. Use the "pooled" connection for production.
# Format: postgresql://user:password@host/dbname?sslmode=require
DATABASE_URL="postgresql://neondb_owner:xxxx@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"

# ── BACKEND API ───────────────────────────────────────────────────────────────
# The URL of your Express scraper backend (e.g. on Railway or Render)
NEXT_PUBLIC_API_URL="https://your-backend.railway.app"
# Same value but accessible server-side only (not prefixed with NEXT_PUBLIC_)
API_URL="https://your-backend.railway.app"

# ── AUTH ─────────────────────────────────────────────────────────────────────
# Used to sign session tokens. Generate with:
#   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
AUTH_SECRET="your-64-byte-hex-secret"

# Cookie domain (set to your root domain in production for subdomain sharing)
# COOKIE_DOMAIN=".yourdomain.com"

# ── SITE ─────────────────────────────────────────────────────────────────────
NEXT_PUBLIC_SITE_URL="https://yourdomain.com"
NEXT_PUBLIC_SITE_NAME="MangaKakalot"

# ── ADSENSE (optional) ────────────────────────────────────────────────────────
# Your AdSense publisher ID (e.g. ca-pub-1234567890)
# NEXT_PUBLIC_ADSENSE_ID="ca-pub-xxxx"

# ── ANALYTICS (optional) ─────────────────────────────────────────────────────
# Vercel Analytics is enabled automatically on Vercel deployments.
# For Google Analytics:
# NEXT_PUBLIC_GA_ID="G-XXXXXXXXXX"
```

---

## Backend (`backend/.env`)

```bash
# ── SERVER ───────────────────────────────────────────────────────────────────
PORT=3001
NODE_ENV=production

# ── DATABASE (same Neon DB as frontend, separate connection) ──────────────────
DATABASE_URL="postgresql://neondb_owner:xxxx@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"

# ── SECURITY ─────────────────────────────────────────────────────────────────
# Admin token for protected backend routes. Generate:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ADMIN_TOKEN="your-32-byte-hex-token"

# Comma-separated list of allowed frontend origins (no trailing slash)
ALLOWED_ORIGINS="https://yourdomain.com,https://www.yourdomain.com"

# ── MAINTENANCE MODE ─────────────────────────────────────────────────────────
# Set to "true" to enable maintenance mode globally (admin bypass still works)
MAINTENANCE_MODE="false"

# ── IMAGE PROXY ──────────────────────────────────────────────────────────────
# Optional: Cloudflare Images account hash for additional image optimization
# CF_IMAGES_ACCOUNT_HASH=""
```

---

## Vercel Project Settings

Set these in the Vercel dashboard under **Settings → Environment Variables**:

| Variable | Scope | Notes |
|---|---|---|
| `DATABASE_URL` | Production, Preview | Neon pooled connection URL |
| `AUTH_SECRET` | Production | Keep separate from Preview (use different secret) |
| `NEXT_PUBLIC_API_URL` | All | Your Railway/Render backend URL |
| `NEXT_PUBLIC_SITE_URL` | Production | Your actual domain |
| `NEXT_PUBLIC_SITE_NAME` | All | Display name |

### Preview Environments

For Preview deployments, set `NEXT_PUBLIC_SITE_URL` to `https://*.vercel.app` (Vercel substitutes the actual URL). Use a separate Neon branch database for Preview to avoid polluting production data.

---

## Neon Branch Strategy

```
neon project
├── main branch          → Production (DATABASE_URL in Vercel Production env)
├── preview branch       → Preview deployments
└── dev branch           → Local development
```

Create branches from the Neon dashboard. Each branch is an isolated copy of the schema.

---

## Security Notes

1. **Never commit `.env` or `.env.local` files.** Both are in `.gitignore`.
2. **Rotate `AUTH_SECRET`** if you suspect compromise — all sessions will be invalidated.
3. **Rotate `ADMIN_TOKEN`** separately from `AUTH_SECRET`.
4. **`DATABASE_URL` on Neon** uses SSL by default (`?sslmode=require`). Never remove this.
5. Use **Vercel's encrypted environment variable storage** — do not store secrets in `vercel.json`.
