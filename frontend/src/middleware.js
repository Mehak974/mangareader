import { NextResponse } from "next/server";

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
  const host = request.headers.get("host") || "";

  // ── Host canonicalisation ────────────────────────────────────────────────
  // cloudflare/worker.js whitelists both the apex and www host for all three
  // domains, so both were serving identical HTML with identical self-canonicals
  // — an unmitigated duplicate-host pair. Collapse www -> apex with a single
  // 301 so link equity and crawl signals land on one host.
  //
  // Skipped in development so localhost:3000 (which includes no host match)
  // and any *.vercel.app preview deployment passes through untouched.
  if (process.env.NODE_ENV === "production") {
    const m = host.match(/^www\.(mangareader\.pro|mangaread\.pro|manireader\.online)$/i);
    if (m) {
      const url = request.nextUrl.clone();
      url.hostname = m[1].toLowerCase();
      url.port = "";
      return NextResponse.redirect(url, { status: 301 });
    }
  }

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
      return NextResponse.redirect(new URL(dest, request.url), { status: 301 });
    }
  }

  // /manga (no title slug) → /browse
  if (pathname === "/manga" || pathname === "/manga/") {
    return NextResponse.redirect(new URL("/browse", request.url), { status: 301 });
  }

  // Ad script origins. The Hilltop popunder is a two-stage loader: the inline
  // snippet in components/AdScriptLoader.tsx passes CSP via 'unsafe-inline',
  // then inserts a <script src> pointing at purple-text.com, which in turn
  // inserts another one at www.quizzical-topic.com. 'unsafe-inline' allows
  // inline code only — external script origins still need listing here, and
  // script-src-elem falls back to script-src when unset.
  //
  // A-ADS is absent on purpose: it renders inside an iframe, so it is covered
  // by frame-src rather than script-src.
  const adScriptOrigins = ['https://purple-text.com', 'https://www.quizzical-topic.com'];

  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-inline' ${adScriptOrigins.join(" ")}${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""};
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' blob: data: https: http:;
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

   // ── noindex headers ────────────────────────────────────────────────────
   // These routes are private, session-scoped, or empty ad wrappers. Most of
   // them are "use client" components and so cannot export a `metadata` object,
   // which means the root layout's `robots: { index: true }` was being inherited
   // by all of them — Google was being invited to index /library, /history,
   // /settings, /messages and friends.
   //
   // /reader/ is noindexed because its URL carries no manga identity: manga
   // details arrive via ?url=&source=&title=&mangaId= query params, so /reader/1
   // is a different chapter for every one of ~3,400 titles under one URL.
   const NOINDEX_PREFIXES = [
     "/admin",
     "/library",
     "/history",
     "/profile",
     "/settings",
     "/messages",
     "/login",
     "/signup",
     "/aads",
     "/reader/",
   ];

   if (NOINDEX_PREFIXES.some((p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p))) {
     response.headers.set("X-Robots-Tag", "noindex, follow");
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
