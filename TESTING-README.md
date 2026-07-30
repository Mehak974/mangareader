# Manga Reader Testing Configuration

## 1. E2E Tests

- Framework: Cypress
- Specs: `frontend/cypress/integration/*.spec.js`
- Key Test Suites:
  - Reading Flow: Opens, navigates chapters, tracks history
  - Admin CMS: Management dashboard, blog management
  - Library: Search, filter, bookmarking
  - Search: Full-text, autocomplete, filters

## 2. Visual Regression

- Tool: Percy
- Baseline: All UI states across 4 viewports
- Customization: Auto-hides dynamic elements
- CI: Fails on >2% visual diff

## 3. Security Testing

- Tool: OWASP ZAP
- Configured Endpoints: 15+ admin API routes
- Automated Scan Schedule: Weekly + PR triggers
- Key Vulnerabilities Tested:
  - Authentication bypass
  - IDOR vulnerabilities
  - XSS in contact forms
  - Missing security headers

## 4. Load Testing

- Tool: k6
- Script: `k6/load-test.js`
- Stages: Gradual load increase to 100 users
- Thresholds: 95th percentile < 500ms
- Monitoring: Response time, error rates, resource usage

## 5. Results & Dashboards

- Visual Tests: Percy.io dashboard
- Security Tests: OWASP ZAP report (HTML)
- Performance Tests: k6 summary report
- Test Coverage: Cumulocity dashboard

## 6. CI/CD Integration

```yaml
# .github/workflows/
├─ e2e.yml           # Run Cypress tests
├─ visual.yml        # Run Percy tests
├─ security.yml      # Run ZAP scans
└─ performance.yml   # Run k6 load tests
```

## 7. Local Execution

```bash
# Run E2E tests
cd frontend && npm run test:e2e

# Run Visual Tests
cd frontend && npx percy exec -- cypress run

# Run Load Tests
cd backend && k6 run k6/load-test.js

# Run Security Test (when ZAP available)
cd backend && zap-baseline.py -t http://localhost:3001 -r report.html
```

## 8. Coverage Requirements

- E2E Tests: 80%+ critical user flows
- Visual Tests: 100% key UI states
- Security Tests: All admin endpoints covered
- Load Tests: 95th percentile < 500ms