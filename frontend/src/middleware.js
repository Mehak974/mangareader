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

  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""};
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

   // Prevent search engines from indexing reader pages (duplicate content /
   // chapter images that shouldn't be crawled).
   if (request.nextUrl.pathname.startsWith("/reader/")) {
     response.headers.set("X-Robots-Tag", "noindex, nofollow");
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
