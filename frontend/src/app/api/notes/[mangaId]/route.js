import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req, { params }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { mangaId } = params;
  if (!mangaId) {
    return NextResponse.json({ error: "mangaId is required" }, { status: 400 });
  }

  try {
    const note = await prisma.mangaNote.findUnique({
      where: {
        userId_mangaId: {
          userId: user.id,
          mangaId,
        },
      },
    });

    return NextResponse.json({ data: note });
  } catch (err) {
    console.error("Failed to fetch note:", err);
    return NextResponse.json({ error: "Failed to fetch note" }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { mangaId } = params;
  if (!mangaId) {
    return NextResponse.json({ error: "mangaId is required" }, { status: 400 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const content = (body.content || "").trim();

  // If content is completely empty and they hit save, let's delete the note.
  if (!content) {
    try {
      await prisma.mangaNote.delete({
        where: {
          userId_mangaId: {
            userId: user.id,
            mangaId,
          },
        },
      });
      return NextResponse.json({ data: null });
    } catch (err) {
      // If it doesn't exist to delete, ignore the error
      if (err.code !== "P2025") {
        console.error("Failed to delete empty note:", err);
        return NextResponse.json({ error: "Failed to delete empty note" }, { status: 500 });
      }
      return NextResponse.json({ data: null });
    }
  }

  if (content.length > 5000) {
    return NextResponse.json({ error: "Note is too long (max 5000 chars)" }, { status: 400 });
  }

  try {
    const note = await prisma.mangaNote.upsert({
      where: {
        userId_mangaId: {
          userId: user.id,
          mangaId,
        },
      },
      update: {
        content,
      },
      create: {
        userId: user.id,
        mangaId,
        content,
      },
    });

    return NextResponse.json({ data: note });
  } catch (err) {
    console.error("Failed to save note:", err);
    return NextResponse.json({ error: "Failed to save note" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { mangaId } = params;
  
  try {
    await prisma.mangaNote.delete({
      where: {
        userId_mangaId: {
          userId: user.id,
          mangaId,
        },
      },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err.code === "P2025") {
      return NextResponse.json({ success: true }); // Already doesn't exist
    }
    console.error("Failed to delete note:", err);
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  }
}
