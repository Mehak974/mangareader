/**
 * PUT    /api/library/[id] — rename a library
 * DELETE /api/library/[id] — delete a library (cannot delete "default")
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req, { params }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

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

  // Verify ownership
  const library = await prisma.library.findUnique({ where: { id } });
  if (!library || library.userId !== user.id) {
    return NextResponse.json({ error: "Library not found" }, { status: 404 });
  }

  if (library.name === "default") {
    return NextResponse.json({ error: "Cannot rename the default library" }, { status: 403 });
  }

  try {
    const updated = await prisma.library.update({
      where: { id },
      data: { name },
      include: { manga: true },
    });
    return NextResponse.json({ data: updated });
  } catch (err) {
    if (err.code === "P2002") {
      return NextResponse.json({ error: "A library with this name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to rename library" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const library = await prisma.library.findUnique({ where: { id } });
  if (!library || library.userId !== user.id) {
    return NextResponse.json({ error: "Library not found" }, { status: 404 });
  }

  if (library.name === "default") {
    return NextResponse.json({ error: "Cannot delete the default library" }, { status: 403 });
  }

  await prisma.library.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
