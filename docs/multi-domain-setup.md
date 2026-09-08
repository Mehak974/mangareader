# Multi-Domain Deployment & Setup Guide

This guide outlines how to run multiple independent websites (e.g. `mangareader.pro`, `mangaread.pro`, `manireader.online`) using **a single Git codebase**.

By using an **Environment-driven Deployment Strategy**, you maintain 1 GitHub repository while deploying separate frontend and backend instances with isolated databases, proxies, ad scripts, and search console metadata.

---

## Strategy Overview

```
                        ┌─── Frontend 1 (mangareader.pro)  ──► Backend 1 ──► DB 1 + Proxy 1
                        │
[1 Single Git Repo] ────┼─── Frontend 2 (mangaread.pro)   ──► Backend 2 ──► DB 2 + Proxy 2
                        │
                        └─── Frontend 3 (manireader.online) ──► Backend 3 ──► DB 3 + Proxy 3
```

---

## Step 1: Database Provisioning

Create 3 separate PostgreSQL databases (e.g., on Neon Tech, Supabase, or Railway):
1. **Database 1**: `postgresql://.../mangareader_db`
2. **Database 2**: `postgresql://.../mangaread_db`
3. **Database 3**: `postgresql://.../manireader_db`

Run Prisma schema migrations for each database so all databases share the target schema:
```bash
cd frontend
npx prisma db push
```

---

## Step 2: Deploy 3 Backend Server Instances

On Railway (or Render/VPS), create **3 separate backend services** connected to the same GitHub repo's `/backend` directory.

### **Backend 1 (`api.mangareader.pro`)**
- `PORT`: `3001`
- `DATABASE_URL`: Database 1 URL
- `ALLOWED_ORIGINS`: `https://mangareader.pro,https://www.mangareader.pro`
- `SCRAPER_PROXY_URL`: `http://user:pass@proxy1.com:port`
- `ANILIST_HTTP_PROXY`: `http://user:pass@proxy1.com:port`

### **Backend 2 (`api.mangaread.pro`)**
- `PORT`: `3001`
- `DATABASE_URL`: Database 2 URL
- `ALLOWED_ORIGINS`: `https://mangaread.pro,https://www.mangaread.pro`
- `SCRAPER_PROXY_URL`: `http://user:pass@proxy2.com:port`
- `ANILIST_HTTP_PROXY`: `http://user:pass@proxy2.com:port`

### **Backend 3 (`api.manireader.online`)**
- `PORT`: `3001`
- `DATABASE_URL`: Database 3 URL
- `ALLOWED_ORIGINS`: `https://manireader.online,https://www.manireader.online`
- `SCRAPER_PROXY_URL`: `http://user:pass@proxy3.com:port`
- `ANILIST_HTTP_PROXY`: `http://user:pass@proxy3.com:port`

> **Note on Proxies**: Assigning dedicated proxies per backend ensures target services (AniList, manga sources) view requests originating from distinct IP addresses, shielding your infrastructure from cascading IP bans.

---

## Step 3: Frontend Dynamic Meta Tags & Ad Scripts

Support dynamic configuration for Search Console verification and ad script tags:

1. **Google Search Console & Ads Meta Tags**:
   In `frontend/src/app/layout.js`:
   ```javascript
   {process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION && (
     <meta name="google-site-verification" content={process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION} />
   )}
   {process.env.NEXT_PUBLIC_ADS_META_TAG_NAME && (
     <meta name={process.env.NEXT_PUBLIC_ADS_META_TAG_NAME} content={process.env.NEXT_PUBLIC_ADS_META_TAG_CONTENT} />
   )}
   ```

---

## Step 4: Deploy 3 Frontend Instances

On Vercel (or Railway), create **3 separate frontend projects** pointing to the `/frontend` directory of your repository.

### **Frontend 1 (`mangareader.pro`)**
- `NEXT_PUBLIC_SITE_NAME`: `MangaReader`
- `NEXT_PUBLIC_SITE_URL`: `https://mangareader.pro`
- `NEXT_PUBLIC_API_URL`: `https://api.mangareader.pro`
- `DATABASE_URL`: Database 1 URL
- `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`: `gsc-key-for-mangareader`

### **Frontend 2 (`mangaread.pro`)**
- `NEXT_PUBLIC_SITE_NAME`: `MangaRead`
- `NEXT_PUBLIC_SITE_URL`: `https://mangaread.pro`
- `NEXT_PUBLIC_API_URL`: `https://api.mangaread.pro`
- `DATABASE_URL`: Database 2 URL
- `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`: `gsc-key-for-mangaread`

### **Frontend 3 (`manireader.online`)**
- `NEXT_PUBLIC_SITE_NAME`: `ManiReader`
- `NEXT_PUBLIC_SITE_URL`: `https://manireader.online`
- `NEXT_PUBLIC_API_URL`: `https://api.manireader.online`
- `DATABASE_URL`: Database 3 URL
- `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`: `gsc-key-for-manireader`

---

## Step 5: Summary Matrix

| Component | Site 1 (`mangareader.pro`) | Site 2 (`mangaread.pro`) | Site 3 (`manireader.online`) |
| :--- | :--- | :--- | :--- |
| **Frontend** | Vercel Project 1 | Vercel Project 2 | Vercel Project 3 |
| **Backend** | Railway Service 1 | Railway Service 2 | Railway Service 3 |
| **Database** | Database 1 | Database 2 | Database 3 |
| **Proxy IP** | Proxy Set 1 | Proxy Set 2 | Proxy Set 3 |
| **GSC Verification** | Key 1 (`.env`) | Key 2 (`.env`) | Key 3 (`.env`) |
| **Ad Tags & Scripts** | Config 1 (`.env`) | Config 2 (`.env`) | Config 3 (`.env`) |
