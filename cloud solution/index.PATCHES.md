# backend/index.js — patches needed

This file shows exactly 4 code blocks to change. Everything else in `index.js` stays the same.

---

## PATCH 1 — Add domains config import (near top, after existing requires)

```js
// ADD after existing require() calls, around line 15
const { getConfig, getAllowedOrigins } = require('./config/domains');
const domainCfg = getConfig();
```

---

## PATCH 2 — Replace hardcoded ALLOWED_ORIGINS (around line 85)

**BEFORE:**
```js
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,https://www.mangareader.pro,...')
  .replace(/^"|"$/g, '')
  .split(',').map(s => s.trim().replace(/^"|"$/g, ''));
```

**AFTER:**
```js
const ALLOWED_ORIGINS = getAllowedOrigins();
const ALLOWED_ORIGIN_PATTERNS = ALLOWED_ORIGINS.map(o => {
  if (o.startsWith('https://*.') || o.startsWith('http://*.')) {
    const domain = o.split('*.')[1];
    const escapedDomain = domain.replace(/\./g, '\\.');
    return new RegExp(`^https?://([^.]+\\.)*${escapedDomain}$`);
  }
  return null;
}).filter(Boolean);
```

---

## PATCH 3 — Replace hardcoded CORS check (around line 100)

**BEFORE:**
```js
} else if (origin.endsWith('.mangareader.pro') || origin === 'https://mangareader.pro') {
```

**AFTER:**
```js
} else if (domainCfg.allowedOrigins.some(o => origin === o || origin.endsWith('.' + o.replace(/^https?:\/\//, '')))) {
```

---

## PATCH 4 — Add health endpoint that includes domain info (new endpoint)

Add anywhere after the existing `/health` route (or create it if missing):

```js
app.get('/health', (req, res) => {
  const { getConfig, getAllStats } = require('./config/domains');
  const cfg = getConfig();
  res.json({
    status: 'ok',
    domain: cfg.siteName,
    profile: process.env.DOMAIN_PROFILE || 'unknown',
    uptime: process.uptime(),
    // Anti-blocking circuit breaker stats (add if you wire antiBlock.js)
    // scraperStats: require('./extractors/antiBlock').getAllStats(),
  });
});
```

---

## PATCH 5 — Rate limit override from domain config (optional)

If you want per-domain API rate limits, find your rate limiter setup and replace:

**BEFORE:**
```js
const limiter = rateLimit({ windowMs: 60000, max: 100 });
```

**AFTER:**
```js
const cfg = getConfig();
const limiter = rateLimit({
  windowMs: cfg.rateLimit.windowMs,
  max:      cfg.rateLimit.max,
});
```
