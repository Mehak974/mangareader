import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { readingHistory, readChapters } = body;

    if (!readingHistory && !readChapters) {
      return NextResponse.json({ error: "No data provided" }, { status: 400 });
    }

    const data = {};
    if (readingHistory !== undefined) data.readingHistory = readingHistory;
    if (readChapters !== undefined) data.readChapters = readChapters;

    await prisma.user.update({
      where: { id: user.id },
      data,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("History sync error:", error);
    return NextResponse.json({ error: "Failed to sync history" }, { status: 500 });
  }
}
