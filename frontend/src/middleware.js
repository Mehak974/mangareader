import { NextResponse } from "next/server";
import { isBlockedManga } from "./lib/dmcaBlacklist";

/**
 * Applies the site Content-Security-Policy.
 *
 * script-src deliberately uses 'unsafe-inline' rather than a per-request nonce.
 * A nonce was tried here first and broke the site two ways:
 *
 *  1. Nonce-based CSP requires a fresh nonce per response, but ~12 routes are
 *     prerendered at build time (/trending, /about, /privacy, /faq, /login,
 *     /signup, ...). Their HTML is baked with no nonce, so the browser compared
 *     a build-time-absent nonce against a per-request one and blocked all 30 of
 *     their script tags. Those pages were fully unhydrated.
 *  2. The Hilltop popunder is injected as an inline script, so it was blocked
 *     outright and no popunder ever loaded.
 *
 * The usual fix for (1) is `export const dynamic = 'force-dynamic'` on every
 * affected route, which gives up static generation and has to be re-applied to
 * each new page or it silently breaks again. 'unsafe-inline' needs no per-page
 * bookkeeping.
 *
 * The trade-off: 'unsafe-inline' weakens XSS mitigation. That costs less here
 * than it would elsewhere, because connect-src already permits https:/http: and
 * ws:/wss: to any host, and style-src is 'unsafe-inline' too — so a nonce was
 * not meaningfully hardening this policy. Tightening XSS protection properly
 * means narrowing connect-src and img-src first, then adding a nonce back.
 *
 * style-src keeps 'unsafe-inline' because Next/Tailwind's generated inline
 * styles aren't nonce'd by the framework the way scripts are.
 */
export function middleware(request) {
  const { pathname } = request.nextUrl;
  // Canonical domain redirect: www.* -> root domain (unifies Umami analytics & SEO rank)
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1");

  const buildRedirectUrl = (destPath) => {
    const url = new URL(request.url);
    if (destPath) url.pathname = destPath;
    if (!isLocal) {
      url.protocol = "https:";
      url.hostname = host.replace(/^www\./, "").split(":")[0];
      url.port = "";
    }
    return url;
  };

  // (Canonical www -> apex redirect is handled at Cloudflare edge)

  // ── Redirect legacy URL patterns to current routes ──────────────────
  // Old genre/platform/origin filter URLs that no longer exist as routes
  // (they were 404-ing → contributing to 4xx crawl errors in GSC).
  // Redirect to /browse which now handles all filtering via query params.
  const legacyPatterns = [
    /^\/manga\/genre\/(.+)$/,
    /^\/manga\/platform\/(.+)$/,
    /^\/manga\/origin\/(.+)$/,
    /^\/genre\/(.+)$/,
    /^\/reading-guides\/(.+)$/,
  ];

  for (const pattern of legacyPatterns) {
    const match = pathname.match(pattern);
    if (match) {
      const dest = pathname.startsWith("/reading-guides") ? "/blog" : "/browse";
      return NextResponse.redirect(buildRedirectUrl(dest), { status: 301 });
    }
  }

  // /manga (no title slug) → /browse
  if (pathname === "/manga" || pathname === "/manga/") {
    return NextResponse.redirect(buildRedirectUrl("/browse"), { status: 301 });
  }

  // ── Blocked / DMCA protected titles: return 404 page for /manga/:slug ─────
  const mangaMatch = pathname.match(/^\/manga\/([^/]+)\/?$/);
  if (mangaMatch && isBlockedManga(mangaMatch[1])) {
    return NextResponse.rewrite(new URL("/not-found", request.url), { status: 404 });
  }

  // Ad script origins. The Hilltop popunder is a three-stage loader: the inline
  // snippet in components/AdScriptLoader.tsx passes CSP via 'unsafe-inline',
  // then inserts a <script src> pointing at purple-text.com (the hub), which in
  // turn inserts the real payload script. That payload host is NOT stable — the
  // zone config advertises it in its "script" setting, and it rotates (it was
  // www.quizzical-topic.com, now www.untimely-promotion.com). 'unsafe-inline'
  // allows inline code only — external script origins still need listing here,
  // and script-src-elem falls back to script-src when unset. When Hilltop
  // rotates again, find the current payload host with:
  //   curl -s 'https://purple-text.com/c.DB9/6Cbj2W5VlOSkW-QR9/NAzQM/y/MnDiUkyTOXS/0B3SMNzDIAw-NxTgMszu' | grep -oP '"script":"[^"]*"'
  // then add the hostname from that URL to adScriptOrigins below, or the payload is blocked and no popunder
  // ever fires.
  //
  // A-ADS is absent on purpose: it renders inside an iframe, so it is covered
  // by frame-src rather than script-src.
  const adScriptOrigins = [
    'https://purple-text.com',
    'https://*.purple-text.com',
    'https://www.untimely-promotion.com',
    'https://*.untimely-promotion.com',
    'https://www.quizzical-topic.com',
    'https://*.quizzical-topic.com',
    'https://pl30844032.profitableratecpmnetwork.com',
    'https://*.profitableratecpmnetwork.com',
    'https://va.vercel-scripts.com',
    'https://www.googletagmanager.com',
    'https://www.google-analytics.com',
    'https://www.elderly-craft.com',
    'https://*.elderly-craft.com',
    'https://static.cloudflareinsights.com',
    'https://cloudflareinsights.com',
    'https://analytics.mangareader.pro',
    'https://*.mangareader.pro',
    'https://umami-production-30dc.up.railway.app',
    'https://*.up.railway.app',
    'https://dcbbwymp1bhlf.cloudfront.net',
    'https://*.cloudfront.net',
    'https://abscloud.org',
    'https://*.abscloud.org',
    'https://bauval.org',
    'https://*.bauval.org',
  ];

  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-inline' https: ${adScriptOrigins.join(" ")}${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""};
    script-src-elem 'self' 'unsafe-inline' https: ${adScriptOrigins.join(" ")}${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""};
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' blob: data: https: http:;
    media-src 'self' blob: data: https: http:;
    font-src 'self' data: https://fonts.gstatic.com https://vercel.live;
    connect-src 'self' https: http: ws: wss:;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'self';
    frame-src 'self' https:;
    worker-src 'self' blob:;
    upgrade-insecure-requests;
  `;
  const contentSecurityPolicyHeaderValue = cspHeader.replace(/\s{2,}/g, " ").trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicyHeaderValue);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", contentSecurityPolicyHeaderValue);

  // Geo detection: Pass country from Cloudflare/Vercel edge to client for smart ad routing
  const country = request.headers.get("cf-ipcountry") || request.headers.get("x-vercel-ip-country");
  if (country && country !== "XX" && country !== "T1") {
    response.cookies.set("user_country", country.toUpperCase(), {
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      httpOnly: false,
      sameSite: "lax",
    });
  }

   // Prevent search engines from indexing reader and protected/unindexed series pages.
   if (
     pathname.startsWith("/reader/") ||
     pathname.startsWith("/manga/series/") ||
     pathname.startsWith("/series/")
   ) {
     response.headers.set("X-Robots-Tag", "noindex, nofollow, noimageindex");
   }

   return response;
}

export const config = {
  matcher: [
    // Apply to everything except API routes, static assets and Next's own internals,
    // where a CSP header is irrelevant overhead.
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
