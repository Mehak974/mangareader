# Cloudflare Configuration

Complete settings reference for maximum performance, security, and bot protection.

---

## Initial Setup

1. Sign up at [cloudflare.com](https://cloudflare.com) (free plan is sufficient to start)
2. Add your domain → follow the nameserver instructions
3. Wait for propagation (usually 5–30 minutes)

---

## DNS Records

| Type | Name | Content | TTL | Proxy |
|---|---|---|---|---|
| CNAME | `@` | `cname.vercel-dns.com` | Auto | ✅ Proxied |
| CNAME | `www` | `cname.vercel-dns.com` | Auto | ✅ Proxied |
| CNAME | `api` | `your-app.railway.app` | Auto | ✅ Proxied |
| TXT | `@` | Google Search Console verification | Auto | — |

**Important:** The `@` record being proxied through Cloudflare means all traffic passes through Cloudflare's network before reaching Vercel. This enables CDN, WAF, and DDoS protection.

---

## SSL/TLS

Navigate to **SSL/TLS → Overview**:

| Setting | Value | Why |
|---|---|---|
| SSL/TLS encryption mode | Full (strict) | Encrypts both Cloudflare→user AND Cloudflare→Vercel connections |
| Always Use HTTPS | ON | Redirects all HTTP to HTTPS |
| HTTP Strict Transport Security (HSTS) | Enabled | Tells browsers to always use HTTPS |
| HSTS max-age | 6 months (15768000s) | Long enough for preload eligibility |
| Include subdomains | ON | Protects `api.yourdomain.com` too |
| Preload | ON (after testing) | Submit to browser preload lists |
| Minimum TLS Version | TLS 1.2 | Drops insecure TLS 1.0/1.1 |
| TLS 1.3 | ON | Modern, faster TLS |
| Opportunistic Encryption | ON | |
| TLS Client Auth | OFF | Not needed |

---

## Cache Rules

Navigate to **Caching → Cache Rules** → Create rules in this order:

### Rule 1: Cache Static Assets Permanently
- **Rule name:** Static Assets
- **When:** File extension equals `js css woff2 woff ttf eot ico png jpg jpeg gif webp svg`
- **Then:** Cache eligibility: Eligible for cache; Edge TTL: Ignore cache-control, 1 year; Browser TTL: Ignore cache-control, 1 year

### Rule 2: Cache Blog & Manga Pages
- **Rule name:** Blog and Manga Cache
- **When:** URI Path starts with `/blog` OR URI Path starts with `/manga`
- **Then:** Cache eligibility: Eligible for cache; Edge TTL: Override, 1 hour; Browser TTL: Override, 10 minutes

### Rule 3: Cache API Manga Data (Short TTL)
- **Rule name:** API Manga Cache
- **When:** URI Path starts with `/api/manga` OR URI Path starts with `/api/home`
- **Then:** Cache eligibility: Eligible for cache; Edge TTL: Override, 5 minutes; Browser TTL: Respect existing headers

### Rule 4: Bypass Auth and Admin
- **Rule name:** No Cache Auth/Admin
- **When:** URI Path starts with `/admin` OR URI Path starts with `/api/auth`
- **Then:** Cache eligibility: Bypass cache

---

## Page Rules (Legacy — use Cache Rules above instead)

If using the older Page Rules interface:

| URL Pattern | Setting | Value |
|---|---|---|
| `yourdomain.com/admin*` | Cache Level | Bypass |
| `yourdomain.com/api/auth*` | Cache Level | Bypass |
| `yourdomain.com/_next/static/*` | Cache Level | Cache Everything; Edge TTL: 1 year |

---

## Speed Settings

Navigate to **Speed → Optimization**:

| Setting | Value |
|---|---|
| Auto Minify — JavaScript | ✅ ON |
| Auto Minify — CSS | ✅ ON |
| Auto Minify — HTML | ✅ ON |
| Brotli | ✅ ON |
| Early Hints | ✅ ON |
| HTTP/2 | ✅ ON (automatic) |
| HTTP/3 (QUIC) | ✅ ON |
| 0-RTT Connection Resumption | ✅ ON |
| Enhanced HTTP/2 Prioritization | ✅ ON |

Navigate to **Speed → Rocket Loader:**
- Rocket Loader: **OFF** (interferes with Next.js hydration — leave off)

---

## WAF Rules

Navigate to **Security → WAF → Custom Rules**:

### Rule 1: Block Attack Patterns
```
Expression:
(http.request.uri.path contains "../") or
(http.request.uri.query contains "<script") or
(http.request.uri.query contains "UNION SELECT") or
(http.request.uri.query contains "' OR ") or
(http.request.uri.query contains "DROP TABLE") or
(http.request.body contains "<script") or
(http.request.uri.path contains ".php" and not http.request.uri.path contains "phpmyadmin")
```
Action: **Block**

### Rule 2: Block Suspicious User Agents
```
Expression:
(http.user_agent contains "sqlmap") or
(http.user_agent contains "nikto") or
(http.user_agent contains "nmap") or
(http.user_agent contains "masscan") or
(http.user_agent eq "")
```
Action: **Block**

### Rule 3: Challenge Unusual Countries (Optional)
If your user base is primarily a specific region, you can challenge requests from unusual countries. Set this conservatively — blocking countries hurts your SEO.
```
Expression:
(ip.geoip.country in {"XX" "YY"}) and not cf.client.bot
```
Action: **JS Challenge** (not Block)

---

## Rate Limiting

Navigate to **Security → WAF → Rate Limiting Rules**:

### Rule 1: API Rate Limit
- **Name:** API Rate Limit
- **When:** URI Path starts with `/api/`
- **Rate:** 100 requests per 60 seconds per IP
- **Action:** Block for 60 seconds

### Rule 2: Admin Login Brute Force Protection
- **Name:** Admin Login Rate Limit
- **When:** URI Path equals `/api/auth/login` AND Request Method is POST
- **Rate:** 5 requests per 60 seconds per IP
- **Action:** Block for 300 seconds (5 minutes)

---

## Bot Protection

Navigate to **Security → Bots**:

| Setting | Recommended |
|---|---|
| Bot Fight Mode | ✅ ON (free) |
| Super Bot Fight Mode (Pro) | Enable if on paid plan |
| Verified Bots | Allow (Googlebot, Bingbot need to crawl for SEO) |

**Important:** Bot Fight Mode must allow verified search engine bots. In WAF rules, ensure your blocking rules include `and not cf.client.bot` to avoid blocking Googlebot.

---

## DDoS Protection

Cloudflare provides DDoS protection automatically for all plans. For additional resilience:

Navigate to **Security → DDoS**:
- DDoS override sensitivity: **High** for non-API paths, **Medium** for `/api/*`

---

## Analytics

Navigate to **Analytics & Logs**:
- Enable **Web Analytics** (privacy-first, no cookies)
- Or integrate your own analytics via Workers (if you want custom event tracking)

---

## Performance Checklist Post-Setup

After configuring Cloudflare:

- [ ] Test `yourdomain.com` — should redirect to HTTPS
- [ ] Test `http://yourdomain.com` — should redirect to `https://yourdomain.com`
- [ ] Check [SSL Labs](https://ssllabs.com/ssltest/) — aim for A+ rating
- [ ] Check [Security Headers](https://securityheaders.com/) — aim for A rating
- [ ] Run [PageSpeed Insights](https://pagespeed.web.dev) — verify CDN is serving assets
- [ ] Check Cloudflare Analytics → verify traffic is being proxied
- [ ] Test admin login — confirm it's NOT cached (admin actions must hit origin)
