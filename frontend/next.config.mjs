import withPWAInit from "@ducanh2912/next-pwa";

/** @type {import('next').NextConfig} */

// Content-Security-Policy moved to src/middleware.js — it now uses a
// per-request nonce instead of 'unsafe-inline'/'unsafe-eval', which a static
// header here can't express (a nonce has to be different on every request).
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

  turbopack: {},

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
      }
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
