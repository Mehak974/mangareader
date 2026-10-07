import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const urls = body?.urls;

    if (Array.isArray(urls) && urls.length > 0) {
      const clientIp =
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.headers.get('x-real-ip') ||
        '';
      const userAgent =
        req.headers.get('user-agent') ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

      // Dispatch tracking beacons to ad network with client headers
      urls.forEach((url) => {
        if (typeof url === 'string' && url.startsWith('http')) {
          fetch(url, {
            headers: {
              'User-Agent': userAgent,
              ...(clientIp ? { 'X-Forwarded-For': clientIp } : {}),
            },
            signal: AbortSignal.timeout(5000),
          }).catch(() => {});
        }
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
