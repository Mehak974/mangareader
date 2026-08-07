import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function parseUserAgent(ua) {
  if (!ua) return {};
  let device = "Desktop";
  let browser = "Other";
  let os = "Other";

  const u = ua.toLowerCase();

  if (u.includes("windows")) os = "Windows";
  else if (u.includes("mac os")) os = "macOS";
  else if (u.includes("linux")) os = "Linux";
  else if (u.includes("android")) os = "Android";
  else if (u.includes("iphone") || u.includes("ipad") || u.includes("ios")) os = "iOS";

  if (u.includes("mobile") || u.includes("android") && !u.includes("tablet")) device = "Mobile";
  else if (u.includes("tablet") || u.includes("ipad")) device = "Tablet";
  else if (u.includes("desktop") || ["windows", "macos", "linux"].includes(os.toLowerCase())) device = "Desktop";

  if (u.includes("edg/")) browser = "Edge";
  else if (u.includes("chrome") && !u.includes("edg")) browser = "Chrome";
  else if (u.includes("safari") && !u.includes("chrome")) browser = "Safari";
  else if (u.includes("firefox")) browser = "Firefox";

  return { device, browser, os };
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const path = typeof body?.path === "string" ? body.path.slice(0, 500) : "/";
    const referrer = typeof body?.referrer === "string" ? body.referrer.slice(0, 500) || null : null;
    const userAgent = req.headers.get("user-agent")?.slice(0, 500) || null;
    const userId = req.headers.get("x-user-id") || body?.userId || null;
    const visitorId = typeof body?.visitorId === "string" ? body.visitorId.slice(0, 100) || null : null;
    const isPwa = Boolean(body?.isPwa);

    if (path.startsWith("/admin") || path.startsWith("/api/")) {
      return NextResponse.json({ ok: true });
    }

    const ua = parseUserAgent(userAgent);

    await prisma.pageView.create({
      data: {
        path,
        referrer,
        userAgent,
        userId,
        visitorId,
        device: ua.device,
        browser: ua.browser,
        os: ua.os,
        isPwa,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/page-view] track failed:", err);
    return NextResponse.json({ ok: true });
  }
}
