# Performance Optimization Checklist

Target: Lighthouse **95+** across Performance, Accessibility, Best Practices, SEO.

---

## Next.js Configuration (`frontend/next.config.js`)

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for catching issues early
  reactStrictMode: true,

  // Compress responses
  compress: true,

  // Image optimization
  images: {
    // Allow images from your backend proxy + AniList CDN
    remotePatterns: [
      { protocol: 'https', hostname: 'api.yourdomain.com' },
      { protocol: 'https', hostname: 's4.anilist.co' },
      { protocol: 'https', hostname: 'media.kitsu.app' },
      { protocol: 'https', hostname: '**.mangadex.org' },
    ],
    // Serve WebP by default
    formats: ['image/avif', 'image/webp'],
    // Cache optimized images for 1 year
    minimumCacheTTL: 31536000,
  },

  // Enable experimental features for performance
  experimental: {
    optimizeCss: true,   // Inline critical CSS
    optimizePackageImports: ['lucide-react'],  // Tree-shake icon libraries
  },

  // Headers are set in vercel.json for Vercel deployments
};

module.exports = nextConfig;
```

---

## Performance Checklist by Category

### LCP (Largest Contentful Paint) — Target < 1.8s

- [ ] **Hero images use `priority` prop** — `<Image src="..." priority />` on above-fold images
- [ ] **Images are sized correctly** — Pass `width` and `height` to `<Image>`. Never use unspecified dimensions.
- [ ] **Cover images are WebP** — Backend proxy converts to WebP via `sharp`. Verify with Network tab.
- [ ] **Blog featured images are 1200×630** — This is the OG image size and also renders well in hero slots.
- [ ] **Fonts preloaded** — Add `<link rel="preload">` for your primary font in `layout.js`
- [ ] **Cloudflare cache is warm** — First load on new edge node is slower. Use Cloudflare's cache warming if on paid plan.

```jsx
// layout.js — preload your main font
<link
  rel="preload"
  href="/fonts/inter.woff2"
  as="font"
  type="font/woff2"
  crossOrigin="anonymous"
/>
```

### CLS (Cumulative Layout Shift) — Target < 0.05

- [ ] **All `<Image>` components have explicit `width` and `height`**
- [ ] **Manga card thumbnails have fixed height** — Don't let images reflow on load
- [ ] **AdBanner has fixed dimensions** — Ads that load late and push content down are a major CLS source
- [ ] **Font loading uses `font-display: swap`** — Prevents FOIT/FOUT layout shifts
- [ ] **Skeleton screens for dynamic content** — Show placeholder UI while data loads

```css
/* globals.css — prevent font layout shift */
@font-face {
  font-family: 'Inter';
  font-display: swap;
  src: url('/fonts/inter.woff2') format('woff2');
}
```

### INP (Interaction to Next Paint) — Target < 150ms

- [ ] **Heavy components are lazy-loaded** — `const HeavyComponent = dynamic(() => import('./HeavyComponent'), { ssr: false })`
- [ ] **Comment section lazy-loaded** — Load `<CommentSection>` only when scrolled into view
- [ ] **No synchronous localStorage in render** — Move to `useEffect`
- [ ] **Achievement toasts are async** — Never block rendering for analytics/achievements

### JavaScript Bundle

- [ ] **Run `next build` and check bundle sizes** — `npx next build && npx next analyze`
- [ ] **Target: < 100kb initial JS** — Next.js code splitting should handle most of this automatically
- [ ] **Remove unused dependencies** — `npx depcheck` to find unused packages
- [ ] **Lodash: import specific functions** — `import debounce from 'lodash/debounce'` not `import _ from 'lodash'`

### Accessibility — Target 95+

- [ ] **All interactive elements are keyboard focusable**
- [ ] **Images have descriptive alt text** — Including cover images in blog posts
- [ ] **Color contrast ≥ 4.5:1** — Check with [contrast checker](https://webaim.org/resources/contrastchecker/)
- [ ] **Form inputs have associated labels** — `<label htmlFor="email">` paired with `<input id="email">`
- [ ] **Modal dialogs trap focus** — When admin modal opens, Tab should cycle within it
- [ ] **Skip navigation link** — `<a href="#main-content" className="sr-only focus:not-sr-only">Skip to content</a>`
- [ ] **ARIA roles on custom components** — Chapter navigation arrows need `aria-label="Previous chapter"` etc.

### SEO — Target 95+

- [ ] **Every page has unique `<title>` and `<meta name="description">`**
- [ ] **`canonical` URL on every page** — Prevent duplicate content penalties
- [ ] **Structured data (JSON-LD) on blog posts** — Article + FAQPage + BreadcrumbList
- [ ] **Sitemap is valid** — Test at `https://yourdomain.com/sitemap.xml`
- [ ] **robots.txt is correct** — Test at `https://yourdomain.com/robots.txt`
- [ ] **No broken internal links** — Run link checker: `npx broken-link-checker https://yourdomain.com`
- [ ] **Heading hierarchy** — One `<h1>` per page, logical `<h2>` → `<h3>` nesting

### Database Performance

- [ ] **Add indexes for common queries** (already in Prisma schema, but verify):
  ```sql
  -- Check in Neon console that these indexes exist:
  -- articles: (status, published_at), (content_type, status), (category_id)
  -- sessions: (user_id), (expires_at)
  -- comments: (manga_id, status, created_at), (article_id, status, created_at)
  ```
- [ ] **Use connection pooling** — Neon pooled connection URL (`?pgbouncer=true`)
- [ ] **Paginate large result sets** — Never fetch all articles; use `LIMIT` + `OFFSET` or cursor pagination
- [ ] **Add `scheduledFor` index** for the scheduled post query:
  ```sql
  -- Add to schema.prisma Article model:
  @@index([status, scheduledFor])
  ```

---

## Measuring Performance

### Local (Development)

```bash
# Install Lighthouse CLI
npm install -g lighthouse

# Run audit against local dev server
lighthouse http://localhost:3000 --output=html --output-path=./lighthouse-local.html
open lighthouse-local.html
```

### Production

Use [PageSpeed Insights](https://pagespeed.web.dev) — it tests from Google's servers and reflects real-world performance more accurately than a local Lighthouse run.

**Weekly check:** Run PageSpeed Insights on:
1. Homepage
2. A blog post with images
3. A manga detail page
4. The browse/search page

### Core Web Vitals in Search Console

After deploying and getting some traffic:
1. Google Search Console → Core Web Vitals
2. Address any "Poor" or "Needs improvement" URLs immediately
3. Core Web Vitals are a ranking signal — fixing them improves organic traffic

---

## Image Optimization Reference

### Backend Proxy (`/api/proxy-image`)

The backend proxy already uses `sharp` to convert images to WebP. Ensure:
- Request includes `?w=WIDTH` param so `sharp` resizes to the correct display size
- The SSRF guard (`isSafeProxyUrl`) is applied (see backend-patches/)

### Blog Cover Images

- **Dimensions:** 1200×630px (OG standard, also good for blog hero)
- **Format:** WebP (compress to ~80% quality)
- **File size:** Target < 150KB per image
- **Naming:** Descriptive slugs: `one-piece-reading-order-guide.webp` not `img1234.webp`

### Manga Thumbnails

- **Dimensions:** 300×400px (or keep aspect ratio, clamp height)
- **Format:** WebP via backend proxy
- **Lazy load:** All thumbnails below the fold should use `loading="lazy"` (Next.js `<Image>` does this automatically unless `priority` is set)
