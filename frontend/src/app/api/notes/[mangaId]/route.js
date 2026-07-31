import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req, { params }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resolvedParams = await params;
  const { mangaId } = resolvedParams;
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

  const resolvedParams = await params;
  const { mangaId } = resolvedParams;
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
  console.log(`[API POST /api/notes/${mangaId}] Extracted content:`, content);

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
    // Ensure the table exists, just in case Prisma or the backend hasn't created it yet
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS manga_notes (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        manga_id VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, manga_id)
      );
    `);

    // Drop the problematic foreign key constraint if it exists (from a previous broken migration)
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE manga_notes DROP CONSTRAINT IF EXISTS manga_notes_manga_id_fkey;
      `);
    } catch(e) {
      // ignore
    }

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
    return NextResponse.json({ error: err.message || "Failed to save note" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resolvedParams = await params;
  const { mangaId } = resolvedParams;
  
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
