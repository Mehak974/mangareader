import { NextResponse } from 'next/server';
import { HILLTOP_VAST_URL, HILLTOP_DIRECT_LINK } from '@/lib/site-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let videoUrl = null;
    let clickThrough = HILLTOP_DIRECT_LINK;
    const impressionUrls = [];
    const trackingUrls = {};

    try {
      const res = await fetch(HILLTOP_VAST_URL, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'application/xml, text/xml, */*',
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      });

      if (res && res.ok) {
        const xml = await res.text();

        // Match video media files (progressive MP4 or WebM)
        const mediaRegex = /<MediaFile[^>]*type=["']video\/(mp4|webm)["'][^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/MediaFile>/gi;
        let match;
        while ((match = mediaRegex.exec(xml)) !== null) {
          const candidate = (match[2] || '').trim();
          if (candidate.startsWith('http')) {
            if (candidate.includes('.mp4')) {
              videoUrl = candidate;
              break;
            }
            if (!videoUrl) videoUrl = candidate;
          }
        }

        // Extract ClickThrough URL
        const clickMatch = xml.match(/<ClickThrough>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/ClickThrough>/i);
        if (clickMatch && clickMatch[1]) {
          clickThrough = clickMatch[1].trim();
        }

        // Extract Impression tracking beacons
        const impRegex = /<Impression>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/Impression>/gi;
        let impMatch;
        while ((impMatch = impRegex.exec(xml)) !== null) {
          const url = (impMatch[1] || '').trim();
          if (url.startsWith('http')) {
            impressionUrls.push(url);
          }
        }

        // Extract Tracking events (start, firstQuartile, midpoint, thirdQuartile, complete)
        const trackRegex = /<Tracking\s+event=["'](.*?)["']>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/Tracking>/gi;
        let trackMatch;
        while ((trackMatch = trackRegex.exec(xml)) !== null) {
          const event = (trackMatch[1] || '').toLowerCase().trim();
          const url = (trackMatch[2] || '').trim();
          if (url.startsWith('http')) {
            if (!trackingUrls[event]) trackingUrls[event] = [];
            trackingUrls[event].push(url);
            // Also include start tracking in impressionUrls for complete coverage
            if (event === 'start') {
              impressionUrls.push(url);
            }
          }
        }
      }
    } catch (vastErr) {
      console.error('VAST feed fetch error:', vastErr);
    }

    // Always provide a video stream so a 15-second video ad plays 100% of the time
    if (!videoUrl) {
      videoUrl = '/videos/sponsor-ad.mp4';
    }

    return NextResponse.json({
      success: true,
      videoUrl,
      clickThrough,
      impressionUrls: Array.from(new Set(impressionUrls)),
      trackingUrls: trackingUrls || {},
      skipOffset: 15,
    });
  } catch (err) {
    console.error('Error in sponsor reward route:', err);
    return NextResponse.json({
      success: true,
      videoUrl: '/videos/sponsor-ad.mp4',
      clickThrough: HILLTOP_DIRECT_LINK,
      impressionUrls: [],
      trackingUrls: {},
      skipOffset: 15,
    });
  }
}
