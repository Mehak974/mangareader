/**
 * GET  /api/library — fetch all libraries for the current user (auto-creates "default" if none)
 * POST /api/library — create a new library { name }
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let libraries = await prisma.library.findMany({
    where: { userId: user.id },
    include: { manga: { orderBy: { addedAt: "desc" } } },
    orderBy: { createdAt: "asc" },
  });

  // Auto-create "default" library on first access
  if (libraries.length === 0) {
    const defaultLib = await prisma.library.create({
      data: { userId: user.id, name: "default" },
      include: { manga: true },
    });
    libraries = [defaultLib];
  }

  return NextResponse.json({ data: libraries });
}

export async function POST(req) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const name = (body.name || "").trim();
  if (!name || name.length > 100) {
    return NextResponse.json({ error: "Name is required (max 100 chars)" }, { status: 400 });
  }

  try {
    const library = await prisma.library.create({
      data: { userId: user.id, name },
      include: { manga: true },
    });
    return NextResponse.json({ data: library }, { status: 201 });
  } catch (err) {
    if (err.code === "P2002") {
      return NextResponse.json({ error: "A library with this name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create library" }, { status: 500 });
  }
}
