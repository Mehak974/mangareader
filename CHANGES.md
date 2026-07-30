# Changes applied in this pass

This is a direct patch of the audited repo — not a rewrite. Everything below
was actually edited in the code (not just described). **None of this has been
run against a live database or in a browser** (this environment has neither),
so please smoke-test before deploying. Full findings/rationale are in
`mangareader-code-review.md` from the earlier audit; this file is the
"what actually changed" summary.

## Security (backend)
- `backend/index.js`, `backend/routes/auth.routes.js`: removed the hardcoded
  fallback values for `JWT_SECRET` and `ADMIN_TOKEN`. The server now exits at
  boot with a clear error if either is missing, instead of silently running
  with a public, guessable secret.
- `backend/index.js`: `/api/auth` is now rate-limited (5 attempts / 15 min)
  — previously unlimited, so the admin password was brute-forceable.
- `backend/routes/auth.routes.js`: password comparison is now constant-time
  (`crypto.timingSafeEqual`) instead of `===`.
- `backend/.env.example`: documented `JWT_SECRET` and `ADMIN_PASSWORD`
  (previously undocumented, which made the missing-secret problem above easy
  to hit by accident).

## Security (frontend)
- `frontend/create_admin.mjs`: no longer creates a fixed `admin@example.com` /
  `admin` account. Now requires an email + password (≥12 chars) as CLI args
  and refuses to run against `NODE_ENV=production` unless you explicitly set
  `ALLOW_PROD_ADMIN_SCRIPT=1`.
- `frontend/src/utils/sanitize.js`: replaced the hand-rolled regex HTML
  sanitizer with the `sanitize-html` package (added to `package.json`). The
  old version was reachable via manga descriptions rendered through
  `dangerouslySetInnerHTML` and was bypassable by design (regex-based HTML
  sanitizers generally are). Verified against common payloads
  (`<script>`, `onerror=`, `javascript:` hrefs) — all stripped correctly.
- `frontend/package.json`: bumped `next` to `16.2.12` (patches 19 high-severity
  advisories present in `16.2.10`, including an SSRF-class issue). Removed
  `@supabase/supabase-js` — present in `package.json` but not imported
  anywhere in the codebase.

## SEO
- `frontend/src/app/manga/[title]/layout.js` (new): the existing
  `page.js` for manga detail pages is a client component and can't export
  `generateMetadata`. Rather than rewrite that page, this adds a sibling
  Server Component layout that fetches the manga from AniList's public API
  and generates a unique title/description/OG image per manga, then renders
  the existing page unchanged. Falls back gracefully if AniList is slow or
  unreachable.
- `frontend/src/app/reader/[id]/layout.js` (new): same pattern, but limited —
  see the comment in the file for why the manga name can't be included yet
  (Next.js doesn't pass `searchParams` to a layout's `generateMetadata`, and
  the manga title/id currently live in the query string, not the route). Uses
  the chapter number for now and is marked `noIndex`. A full fix needs the
  manga slug moved into the URL path (e.g. `/reader/[mangaSlug]/[chapterId]`)
  — a routing change, out of scope for a drop-in metadata patch.
- `frontend/src/app/sitemap.js`: static routes no longer stamp `lastModified`
  as "now" on every request; removed `/library` and `/history` (personalized,
  non-indexable pages).
- `frontend/src/app/robots.js`: added `/library` and `/history` to `disallow`.
- `frontend/src/lib/indexnow.ts` (new): pings IndexNow (Bing/Yandex) on
  article publish/update. Wired into `frontend/src/lib/editorial.ts`.
  Requires an `INDEXNOW_KEY` env var (documented in `.env.example`) and the
  matching `public/<key>.txt` verification file (a sample one is included —
  swap it for your real key).

## Assets that were 404ing
- Generated placeholder `public/icon-192.png`, `icon-512.png`, `icon.png`,
  `screenshot-mobile.png`, `screenshot-desktop.png` — these were referenced
  by `manifest.json`, the apple-touch-icon in `layout.js`, and the JSON-LD
  `organizationSchema`/`articleSchema` logo field, but didn't exist, so all
  of them were 404ing. **These are functional placeholders (brand-colored
  "M" mark), not real design assets — swap them for your actual branding
  before shipping.** Also deleted `frontend/src/app/manifest.js`, a second,
  unused, lower-quality manifest that duplicated `public/manifest.json`.

## Repo hygiene
- Deleted `step587.txt`, `old_page.js.txt`, `frontend/page_history.txt`
  (leaked AI-coding-session transcripts containing a local file path and
  username — no product value) and `frontend/fix_all.js` (a half-applied
  patch for the exact JWT/timing-safe issues fixed properly above).
- Added `.gitignore` patterns so this class of file doesn't get committed again.

## Security — CSP hardening (now done)
- Added `frontend/src/middleware.js`: generates a per-request nonce and sets
  `script-src 'self' 'nonce-<random>' 'strict-dynamic'`, replacing the
  previous `'unsafe-inline' 'unsafe-eval'` policy that provided close to no
  real XSS mitigation. `next.config.mjs` no longer sets a static CSP header
  (moved to middleware, since a nonce has to be per-request). Verified the
  only manually-written `<script>` tag in the app (`JsonLd.js`) uses
  `type="application/ld+json"`, which CSP's `script-src` doesn't gate, so no
  other code needed to change for this to work.
- **`style-src` still keeps `unsafe-inline`** — Next/Tailwind's generated
  inline styles aren't nonce'd by the framework, and removing this needs a
  dedicated pass. Not silently dropped, just out of scope here.
- **Test before shipping**: load the homepage, a manga page, the reader, and
  admin panel with devtools open and confirm zero CSP violations in the
  console. A blocked script fails silently to an end user, so this needs a
  real look, not just a code read.

## Security — CSRF migration (now done)
- Replaced `csurf` (archived upstream) with `csrf-csrf`, the actively
  maintained package implementing the same double-submit-cookie pattern.
  **Client-facing behavior is unchanged** — `GET /api/csrf-token` still
  returns `{ csrfToken }`, mutating requests still send it via the
  `X-CSRF-Token` header — so `frontend/src/utils/api.js` needed no changes.
- Added a lightweight anonymous `sid` cookie (backend has no session store,
  so this gives `csrf-csrf`'s session-binding a real per-browser identifier
  instead of a constant).
- Added `CSRF_SECRET` to `backend/.env.example`; server now refuses to start
  without it.
- **Verified with an isolated test** (not the full app, which needs a live
  DB): a POST without a CSRF token got `403`, a POST with a valid token got
  `200`. The core double-submit logic works. What I *couldn't* test here:
  the real frontend↔backend flow end to end, or cross-origin cookie behavior
  in your actual deployment topology (same-domain subdomains vs. separate
  domains — see the `sameSite` comment in `backend/index.js` if frontend and
  backend end up on unrelated domains in production).

## Deliberately NOT changed (flagged, not fixed — needs your judgment + testing)
- Other one-off scripts at the repo root (`import_*.mjs`, `insert_blogs.mjs`,
  `fix_mapping.mjs`, etc.) were left alone — some may still be needed to
  finish the 326-post blog rollout. Worth a manual pass to archive the ones
  you've already run.

## Before you deploy
1. Replace the placeholder icons/screenshots in `public/` with real assets.
2. Generate real values for `JWT_SECRET`, `ADMIN_TOKEN`, `ADMIN_PASSWORD`,
   `CSRF_SECRET`, `INDEXNOW_KEY` and set the matching `public/<key>.txt`.
3. Run `npm install` in both `frontend/` and `backend/` (lockfiles weren't
   regenerated here — this sandbox couldn't reach `binaries.prisma.sh` or
   `fonts.googleapis.com` to complete a full `next build`/`prisma generate`).
4. Smoke-test admin login, a manga page, a reader page, and any form that
   submits data (contact, newsletter, comments) — the CSRF migration and CSP
   nonce change both touch those paths.
5. With devtools open, check the console on a few key pages for CSP
   violation warnings before considering the CSP change done.
