import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const path = typeof body?.path === "string" ? body.path.slice(0, 500) : "/";
    const referrer = typeof body?.referrer === "string" ? body.referrer.slice(0, 500) || null : null;
    const userAgent = req.headers.get("user-agent")?.slice(0, 500) || null;
    const userId = req.headers.get("x-user-id") || null;

    await prisma.pageView.create({
      data: { path, referrer, userAgent, userId },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/page-view] track failed:", err);
    return NextResponse.json({ ok: true });
  }
}
