import path from "node:path";
import { fileURLToPath } from "node:url";
import withPWAInit from "@ducanh2912/next-pwa";

/** @type {import('next').NextConfig} */

// The repo root has its own package.json/package-lock.json (cypress, percy,
// helmet) for tooling, so Turbopack inferred the repo root as the workspace
// root instead of frontend/. On Vercel that made next/font resolve
// @vercel/turbopack-next relative to the wrong tree and the build failed with
// "Module not found: Can't resolve
// '@vercel/turbopack-next/internal/font/google/font'". Pin the root to this
// config's own directory so resolution does not depend on which lockfile
// Turbopack happens to find first.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Content-Security-Policy moved to src/middleware.js — it uses
// 'unsafe-inline' rather than a per-request nonce, because ~12 routes are
// prerendered at build time and a nonce cannot be baked into their HTML.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig = {

  // Phase 0: standalone output so the app can run on Railway (or any container)
  // without `npx next start`. The standalone bundle copies only the runtime
  // deps needed to serve the app — significantly smaller than the full
  // node_modules tree.
  output: 'standalone',

  turbopack: {
    root: __dirname,
  },

  // Performance
  poweredByHeader: false,

  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['lucide-react', 'react-hot-toast', '@use-gesture/react', 'react-markdown', 'remark-gfm', 'rehype-sanitize'],
  },

  // Remote image sources — backend proxy + known CDNs
  images: {
    loader: 'custom',
    loaderFile: './src/utils/imageLoader.js',
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      // Static pages - cache forever (1 year) since content rarely changes
      {
        source: "/about",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/support",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/contact",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/faq",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/privacy",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/terms",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/dmca",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  workboxOptions: {
    disableDevLogs: true,
  },
});

export default withPWA(nextConfig);
