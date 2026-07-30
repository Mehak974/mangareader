# Security

Security posture for the platform. This document tracks what is implemented and
what is planned, so the two never drift apart.

## HTTP response headers — implemented

Set globally in `frontend/next.config.mjs` (`headers()`), applied to `/:path*`:

| Header                         | Value                                              | Protects against            |
| ------------------------------ | -------------------------------------------------- | --------------------------- |
| `Strict-Transport-Security`    | `max-age=63072000; includeSubDomains; preload`     | Protocol downgrade / MITM   |
| `X-Content-Type-Options`       | `nosniff`                                           | MIME sniffing               |
| `X-Frame-Options`              | `SAMEORIGIN`                                        | Clickjacking                |
| `Referrer-Policy`              | `strict-origin-when-cross-origin`                   | Referrer leakage            |
| `Permissions-Policy`           | `camera=(), microphone=(), geolocation=(), browsing-topics=()` | Unwanted feature access |
| `Cross-Origin-Opener-Policy`   | `same-origin`                                       | Cross-origin popup attacks  |
| `X-XSS-Protection`             | `1; mode=block`                                     | Legacy reflected XSS        |

`poweredByHeader` is disabled so the framework version is not leaked.

## Content-Security-Policy — implemented (nonce-based)

Set per-request in `frontend/src/middleware.js`. A previous version of this
policy shipped with `script-src 'self' 'unsafe-eval' 'unsafe-inline'`, which
provided close to no XSS mitigation despite `next.config.mjs` presenting it
as an active header — this doc was out of sync with that code for a while;
it now reflects what's actually enforced.

Current policy: `script-src 'self' 'nonce-<random>' 'strict-dynamic'` — a
fresh nonce is generated per request in middleware and Next.js automatically
attaches it to the script tags it renders for its own hydration payload. The
only manually-written `<script>` tag in the app (`components/JsonLd.js`) uses
`type="application/ld+json"`, which isn't gated by `script-src` since
browsers never execute it as script.

`style-src` still includes `unsafe-inline` — Next/Tailwind's generated inline
styles aren't nonce'd by the framework the way scripts are, and removing it
needs its own validation pass. Tracked as a follow-up, not silently dropped.

## CSRF — implemented (double-submit cookie)

`backend/index.js` uses `csrf-csrf` (the actively-maintained successor to the
archived `csurf` package) for state-changing requests. `GET /api/csrf-token`
issues a token; the frontend sends it back via the `X-CSRF-Token` header on
POST/PUT/DELETE (see `frontend/src/utils/api.js`). Requires `CSRF_SECRET` in
the environment — the server refuses to start without it.

## Admin authentication — implemented

`JWT_SECRET`, `ADMIN_TOKEN`, and `ADMIN_PASSWORD` are all required env vars;
the server exits at boot if any are missing rather than falling back to a
default. `/api/auth/login` is rate-limited (5 attempts / 15 min), and the
password comparison is constant-time (`crypto.timingSafeEqual`).

## Authentication & sessions — planned foundation in place

- The Prisma schema models `User` (with `passwordHash`, roles) and `Session`
  (storing only the **hash** of the session token; the raw token lives in an
  HttpOnly, Secure, SameSite cookie).
- `LoginAttempt` records every attempt for rate limiting and credential-stuffing
  defense; indexed by email and IP over time.
- `AuditLog` records privileged actions for the security dashboard.

## Input handling

- **SQL injection:** Prisma parameterizes all queries; the scraper uses
  parameterized `pg` queries. Never interpolate user input into SQL.
- **XSS:** editorial content is markdown rendered with `react-markdown` +
  `rehype-sanitize` (already a dependency). Never render untrusted HTML raw.
  Manga descriptions (sourced from external metadata, not markdown) are
  sanitized separately via the `sanitize-html` package
  (`frontend/src/utils/sanitize.js`) before being rendered with
  `dangerouslySetInnerHTML` — a previous hand-rolled regex sanitizer here was
  replaced since regex-based HTML sanitization is reliably bypassable.
- **Validation:** all inputs validated server-side before persistence.

## Environment validation

`frontend/src/lib/env.ts` validates required variables at startup and enforces a
minimum `AUTH_SECRET` length in production.

## Secrets

`.env` files are git-ignored. Only `NEXT_PUBLIC_`-prefixed variables are exposed
to the browser; secrets must never carry that prefix.
