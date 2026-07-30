# Visual Regression Testing with Percy

## Setup

```bash
# Install Percy CLI
npm install --save-dev @percy/cli @percy/cypress

# Install Cypress Percy adapter
npm install --save-dev @percy/cypress
```

## Percy Configuration

Create `.percy.yml`:

```yaml
version: 2
snapshot:
  widths: [375, 768, 1280, 1920]
  min-height: 800
  percy-css: |
    /* Hide dynamic elements during snapshot */
    .reader-prog-bar,
    .reader-float,
    .brightness-pop,
    .loader,
    [data-testid="search-box"] {
      visibility: hidden !important;
    }
    /* Freeze animations */
    *, *::before, *::after {
      animation-duration: 0s !important;
      transition-duration: 0s !important;
    }
```

## Cypress Integration

In `cypress/support/e2e.js`:

```javascript
import '@percy/cypress';
```

In `cypress.config.js`:

```javascript
import percy from '@percy/cypress';

export default {
  e2e: {
    setupNodeEvents(on, config) {
      percy.setupNodeEvents(on, config);
    },
  },
};
```

## Visual Test Scenarios

Create `cypress/integration/visual.spec.js`:

```javascript
describe('Visual Regression Tests', () => {
  const viewports = [
    'iphone-se',
    'ipad-2',
    'macbook-15',
    [1920, 1080]
  ];

  viewports.forEach(vp => {
    describe(`Viewport: ${vp}`, () => {
      beforeEach(() => {
        cy.viewport(vp);
        cy.percySnapshot('Initial Load');
      });

      it('Homepage', () => {
        cy.visit('/');
        cy.waitForImages();
        cy.percySnapshot('Homepage');
      });

      it('Browse Page', () => {
        cy.visit('/browse');
        cy.waitForImages();
        cy.percySnapshot('Browse Page');
      });

      it('Manga Detail', () => {
        cy.visit('/manga/solo-leveling');
        cy.waitForImages();
        cy.percySnapshot('Manga Detail');
      });

      it('Reader - Single Page', () => {
        cy.visit('/reader/1?url=https://example.com/ch1&source=coffeemanga&title=Solo%20Leveling');
        cy.waitForImages();
        cy.percySnapshot('Reader Single Page');
      });

      it('Reader - Multi Page Spread', () => {
        cy.visit('/reader/1?url=https://example.com/ch1&source=coffeemanga&title=Solo%20Leveling');
        cy.get('[data-testid="reader-image"]').first().should('be.visible');
        cy.percySnapshot('Reader Multi-Page');
      });

      it('Library Page', () => {
        cy.visit('/library');
        cy.percySnapshot('Library');
      });

      it('History Page', () => {
        cy.visit('/history');
        cy.percySnapshot('History');
      });

      it('Admin Dashboard', () => {
        cy.visit('/admin');
        cy.percySnapshot('Admin Dashboard');
      });

      it('Dark Mode', () => {
        cy.visit('/');
        cy.get('html').invoke('attr', 'class', 'dark');
        cy.percySnapshot('Dark Mode Homepage');
      });

      it('Light Mode', () => {
        cy.visit('/');
        cy.get('html').invoke('attr', 'class', '');
        cy.percySnapshot('Light Mode Homepage');
      });
    });
  });
});
```

## Custom Commands

In `cypress/support/commands.js`:

```javascript
Cypress.Commands.add('waitForImages', () => {
  cy.get('img').then($imgs => {
    const promises = [...$imgs].map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => {
        img.onload = img.onerror = resolve;
      });
    });
    return Promise.all(promises);
  });
});
```

## CI/CD Pipeline

```yaml
# .github/workflows/visual.yml
name: Visual Regression
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  visual-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - run: npm run start &
      - run: npx wait-on http://localhost:3000
      - run: npx percy exec -- cypress run
        env:
          PERCY_TOKEN: ${{ secrets.PERCY_TOKEN }}
```

## Required Screenshots (Baseline)

| Component | States | Viewports |
|-----------|--------|-----------|
| Homepage | Default, Dark, Empty | 4 |
| Browse | Grid, List, Filtered | 4 |
| Manga Detail | Default, With Chapters | 4 |
| Reader | Single, Spread, Controls | 4 |
| Library | Grid, List, Empty | 4 |
| History | With Items, Empty | 4 |
| Admin | Dashboard, Articles, Users | 4 |
| Auth | Login, Signup, Error | 4 |
| Settings | Profile, Notifications | 4 |

## Budget Alerts

Configure in Percy Dashboard:
- Fail build if > 2% visual diff
- Max 50 snapshots per build
- Monthly limit: 5000 snapshots

## Troubleshooting

```bash
# Debug snapshots locally
npx percy exec -- cypress run --headed

# Update baselines
npx percy exec -- cypress run --config updateSnapshots=true
```