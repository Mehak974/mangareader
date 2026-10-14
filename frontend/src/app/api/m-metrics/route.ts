import { NextRequest, NextResponse } from "next/server";

// Target Umami instance
const UMAMI_HOST = "https://analytics.mangareader.pro";

export async function GET(request: NextRequest) {
  try {
    const res = await fetch(`${UMAMI_HOST}/script.js`, {
      headers: {
        "User-Agent": request.headers.get("user-agent") || "",
      },
      next: { revalidate: 86400 }, // Cache script for 24h
    });

    const script = await res.text();
    return new NextResponse(script, {
      status: res.status,
      headers: {
        "Content-Type": "application/javascript; charset=UTF-8",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=86400",
      },
    });
  } catch (err: any) {
    return new NextResponse(`// Failed to fetch script: ${err.message}`, {
      status: 500,
      headers: { "Content-Type": "application/javascript" },
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    // Extract real client IP provided by Cloudflare or proxy
    const clientIp =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-real-ip") ||
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      "";

    const userAgent = request.headers.get("user-agent") || "";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": userAgent,
    };

    if (clientIp) {
      headers["CF-Connecting-IP"] = clientIp;
      headers["X-Forwarded-For"] = clientIp;
      headers["X-Real-IP"] = clientIp;
    }

    const res = await fetch(`${UMAMI_HOST}/api/send`, {
      method: "POST",
      headers,
      body,
    });

    const data = await res.text();

    return new NextResponse(data, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") || "application/json",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
