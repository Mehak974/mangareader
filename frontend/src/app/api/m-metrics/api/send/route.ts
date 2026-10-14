import { NextRequest, NextResponse } from "next/server";

const UMAMI_HOST = "https://analytics.mangareader.pro";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

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
