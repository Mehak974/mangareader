# Backend Deployment Guide

The Manga Reader backend relies heavily on Puppeteer/Cheerio for scraping third-party manga sources. These tasks are synchronous, computationally expensive, and can take 10-30 seconds to complete per request.

**CRITICAL:** Do NOT deploy this backend to Serverless environments (e.g., Vercel Serverless Functions, AWS Lambda, Netlify Functions). Serverless environments have strict timeouts (often 10s on hobby tiers) and will kill your scraping tasks mid-flight.

## Recommended Hosting Providers

You must use a provider that offers persistent containers or VMs:

1. **Railway (Recommended)**
   - Excellent GitHub integration.
   - You can easily provision a PostgreSQL database and a Redis instance within the same project.
   - Build Command: `npm install`
   - Start Command: `npm start` (ensure your `package.json` has `"start": "node index.js"`)

2. **Render**
   - Similar to Railway, offers "Web Services" which run persistently.
   - Also offers managed PostgreSQL and Redis.

3. **Fly.io**
   - Great for deploying containerized apps globally. 
   - Requires generating a `Dockerfile`.

## Environment Variables

Regardless of where you deploy, ensure the following environment variables are set securely:

```env
# Database (Neon or Railway Postgres)
# IMPORTANT: If using Neon, ensure `?pgbouncer=true` is appended to the URL to prevent connection exhaustion.
DATABASE_URL=postgresql://user:pass@host/dbname?pgbouncer=true

# Redis (For Rate Limiting)
REDIS_URL=redis://user:pass@host:port

# JWT Authentication
JWT_SECRET=your_super_secret_jwt_key
```

## Scaling Considerations

If traffic grows, the bottleneck will be the scraping logic. In the future, we recommend decoupling the Express API from the Scraper using a job queue like **BullMQ**. The Express API would simply add a "scrape job" to the queue, and background worker threads would process the jobs and update the database, returning a socket or polling response to the client.
