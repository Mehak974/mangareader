# SEO / GEO / AEO

The platform targets search engines (Google, Bing) and answer/generative
engines (AI Overview, ChatGPT, Gemini, Perplexity) through structured metadata,
JSON-LD, and clean crawlability.

## Central helpers

`frontend/src/lib/seo.ts` is the single source for SEO output:

- `buildMetadata({ title, description, path, type, image, noIndex })` — returns a
  Next.js `Metadata` object with canonical URL, OpenGraph, and Twitter cards.
  Every page's `metadata`/`generateMetadata` should go through this.
- `organizationSchema()`, `websiteSchema()` — site-wide JSON-LD, rendered once in
  the root layout. `websiteSchema` includes a `SearchAction` for sitelinks.
- `articleSchema(article)` — `Article` JSON-LD for editorial detail pages.
- `breadcrumbSchema(items)`, `faqSchema(items)` — supporting schema types.

JSON-LD is emitted with `frontend/src/components/JsonLd.js`, which escapes `<` so
string values can't break out of the `<script>` tag.

## Crawl surface

- `frontend/src/app/robots.js` → `/robots.txt`. Allows everything except
  `/admin`, `/api`, `/login`, `/signup`, `/settings`, `/profile`. Points at the
  sitemap.
- `frontend/src/app/sitemap.js` → `/sitemap.xml`. Static routes plus every
  `PUBLISHED` article, queried from the DB at request time.
- `frontend/src/app/manifest.js` → `/manifest.webmanifest` (PWA install metadata).

## Conventions

- Set `NEXT_PUBLIC_SITE_URL` to the canonical production origin — every absolute
  URL in metadata, sitemap, and JSON-LD derives from it.
- Admin pages set `robots: { index: false }`; never expose them to crawlers.
- Editorial pages carry `Article` + `BreadcrumbList` JSON-LD; reviews additionally
  benefit from the structured score data in the body.
- Prefer server rendering for anything that should be indexed; client-only content
  is invisible to most crawlers.
