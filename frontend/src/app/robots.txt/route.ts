import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'mangareader.pro';
  let domain = 'mangareader.pro';
  if (host.includes('mangaread.pro')) {
    domain = 'mangaread.pro';
  } else if (host.includes('manireader.online') || host.includes('manireader.pro')) {
    domain = 'manireader.online';
  }

  const siteUrl = `https://${domain}`;

  const body = `User-agent: *
Allow: /
Allow: /api/og
Disallow: /admin
Disallow: /api
Disallow: /api/auth
Disallow: /_next
Disallow: /static
Disallow: /login
Disallow: /signup
Disallow: /settings
Disallow: /profile
Disallow: /library
Disallow: /history
Disallow: /reader/
Disallow: /series/
Disallow: /manga/series/
Crawl-delay: 2

Sitemap: ${siteUrl}/sitemap.xml
Host: ${siteUrl}
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=86400',
    },
  });
}
