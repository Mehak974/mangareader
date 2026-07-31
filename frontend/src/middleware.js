import { NextResponse } from "next/server";

/**
 * Generates a per-request CSP nonce and applies a strict script-src policy
 * (nonce + 'strict-dynamic', no 'unsafe-inline'/'unsafe-eval').
 *
 * This replaces the static CSP that used to live in next.config.mjs, which
 * had `script-src 'self' 'unsafe-eval' 'unsafe-inline'` — permissive enough
 * that the CSP provided close to no XSS mitigation. A nonce has to be
 * generated per-request, which a static next.config.mjs header can't do, so
 * this needs middleware.
 *
 * Next.js automatically attaches this nonce to the script tags it generates
 * for its own runtime/hydration payload once it detects a `nonce-` value in
 * the CSP response header — see
 * https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy
 * No changes were needed elsewhere in the app: the only manually-written
 * <script> tag in the codebase (components/JsonLd.js) uses
 * type="application/ld+json", which browsers never execute as script and
 * which CSP's script-src does not gate.
 *
 * style-src keeps 'unsafe-inline' for now — Next/Tailwind's generated inline
 * styles aren't nonce'd by the framework the way scripts are, and rather
 * than break styling, that's called out here as a known follow-up rather
 * than silently "fixed."
 *
 * TEST THIS BEFORE SHIPPING. Removing unsafe-inline/unsafe-eval is exactly
 * the kind of change that can fail closed and quietly (a blocked script
 * just doesn't run, no visible error to an end user). At minimum: load the
 * homepage, a manga page, the reader, and the admin panel with the browser
 * console open and confirm there are no CSP violation reports.
 */
export function middleware(request) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval' https: http: blob:;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' blob: data: https: http:;
    font-src 'self' data: https://fonts.gstatic.com;
    connect-src 'self' https: http: ws: wss:;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    frame-src 'self' https: http:;
    worker-src 'self' blob:;
    upgrade-insecure-requests;
  `;
  const contentSecurityPolicyHeaderValue = cspHeader.replace(/\s{2,}/g, " ").trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicyHeaderValue);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", contentSecurityPolicyHeaderValue);

  return response;
}

export const config = {
  matcher: [
    // Apply to everything except static assets and Next's own internals,
    // where a CSP header is irrelevant overhead.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
