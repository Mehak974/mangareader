# OWASP ZAP Security Scanning Configuration

## Quick Start (Docker)

```bash
# Pull ZAP Docker image
docker pull ghcr.io/zaproxy/zaproxy:stable

# Run baseline scan against running backend
docker run --network host -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py \
  -t http://localhost:3001 \
  -r zap-report.html \
  -w zap-config.yaml
```

## Target Endpoints for Admin Routes

```
GET  /api/admin/blog
POST /api/admin/blog
PUT  /api/admin/blog/:id
DELETE /api/admin/blog/:id

GET  /api/admin/messages
GET  /api/admin/newsletter
GET  /api/admin/stats

POST /api/admin/blog-categories
POST /api/admin/blog-tags
POST /api/admin/blog-authors

PUT  /api/admin/messages/:id/resolve
PUT  /api/admin/users/:id/vip
DELETE /api/admin/users/:id

GET  /api/admin/users
GET  /api/admin/users/:id

POST /api/admin/settings/maintenance
GET  /api/settings/maintenance
```

## ZAP Configuration (zap-config.yaml)

```yaml
env:
  contexts:
    - name: "Manga Reader API"
      urls:
        - "http://localhost:3001"
      includePaths:
        - "/api/admin/.*"
      excludePaths:
        - "/api/health"
      authentication:
        method: "header"
        parameters:
          headerName: "x-admin-token"
          headerValue: "${ADMIN_TOKEN}"
      users:
        - name: "admin"
          credentials:
            token: "${ADMIN_TOKEN}"
```

## CI/CD Integration

```yaml
# .github/workflows/security.yml
name: Security Scan
on:
  schedule:
    - cron: '0 2 * * 0'  # Weekly
  push:
    branches: [main]

jobs:
  zap-scan:
    runs-on: ubuntu-latest
    services:
      db:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
      backend:
        build: ./backend
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/manga
          ADMIN_TOKEN: ${{ secrets.ADMIN_TOKEN }}
        ports: ['3001:3001']
    steps:
      - uses: actions/checkout@v4
      - name: Run ZAP Baseline Scan
        run: |
          docker pull ghcr.io/zaproxy/zaproxy:stable
          docker run --network host -t ghcr.io/zaproxy/zaproxy:stable \
            zap-baseline.py -t http://localhost:3001 -r report.html
      - name: Upload Report
        uses: actions/upload-artifact@v4
        with:
          name: zap-report
          path: report.html
```

## Key Vulnerabilities to Test

1. **Authentication Bypass**
   - Access admin endpoints without token
   - Test token timing attacks

2. **Authorization Issues**
   - IDOR on /api/admin/users/:id
   - Mass assignment on POST /api/admin/blog

3. **Input Validation**
   - SQL injection in search/query parameters
   - XSS in contact form submissions
   - Path traversal in /api/proxy-image

4. **Rate Limiting**
   - Test bypass of rate limits
   - Concurrent request handling

5. **Security Headers**
   - Missing CSP, HSTS, X-Frame-Options
   - Cache-Control on sensitive endpoints

## Expected Fixes After Scan

- Add CSRF tokens to admin forms
- Implement strict CSP headers
- Add input sanitization on all endpoints
- Strengthen rate limiting
- Add security.txt file