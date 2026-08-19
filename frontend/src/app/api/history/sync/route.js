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

    const existing = await prisma.user.findUnique({
      where: { id: user.id },
      select: { readingHistory: true, readChapters: true },
    });

    const existingHistory = Array.isArray(existing?.readingHistory) ? existing.readingHistory : [];
    const incomingHistory = Array.isArray(readingHistory) ? readingHistory : [];
    const historyMap = new Map();
    for (const entry of [...existingHistory, ...incomingHistory]) {
      const key = entry.mangaId || entry.t;
      const prev = historyMap.get(key);
      if (!prev || new Date(entry.time) > new Date(prev.time)) {
        historyMap.set(key, entry);
      }
    }
    const mergedHistory = Array.from(historyMap.values()).sort((a, b) =>
      new Date(b.time) - new Date(a.time)
    );

    const existingChapters = (existing?.readChapters && typeof existing.readChapters === "object") ? existing.readChapters : {};
    const incomingChapters = (readChapters && typeof readChapters === "object") ? readChapters : {};
    const mergedChapters = { ...existingChapters };
    for (const [mangaId, chapters] of Object.entries(incomingChapters)) {
      const set = new Set(mergedChapters[mangaId] || []);
      for (const ch of chapters) {
        set.add(ch);
      }
      mergedChapters[mangaId] = [...set].sort((a, b) => a - b);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        readingHistory: mergedHistory,
        readChapters: mergedChapters,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("History sync error:", error);
    return NextResponse.json({ error: "Failed to sync history" }, { status: 500 });
  }
}
