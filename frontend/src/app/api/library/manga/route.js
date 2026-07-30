/**
 * POST   /api/library/manga — add a manga to a library
 *        body: { libraryId, manga: { id, t, cover, ongoing, rating, g } }
 * DELETE /api/library/manga — remove a manga from a library
 *        body: { libraryId, mangaId }
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  const { libraryId, manga } = body;
  if (!libraryId || !manga?.id || !manga?.t) {
    return NextResponse.json({ error: "libraryId and manga (with id, t) are required" }, { status: 400 });
  }

  // Verify library belongs to user
  const library = await prisma.library.findUnique({ where: { id: libraryId } });
  if (!library || library.userId !== user.id) {
    return NextResponse.json({ error: "Library not found" }, { status: 404 });
  }

  try {
    const entry = await prisma.libraryManga.create({
      data: {
        libraryId,
        mangaId: String(manga.id),
        title: manga.t,
        cover: manga.cover || null,
        ongoing: manga.ongoing !== false,
        rating: manga.rating ? parseFloat(manga.rating) : null,
        genre: manga.g || null,
      },
    });
    return NextResponse.json({ data: entry }, { status: 201 });
  } catch (err) {
    if (err.code === "P2002") {
      return NextResponse.json({ error: "Manga already in this library" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to add manga" }, { status: 500 });
  }
}

export async function DELETE(req) {
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

  const { libraryId, mangaId } = body;
  if (!libraryId || !mangaId) {
    return NextResponse.json({ error: "libraryId and mangaId are required" }, { status: 400 });
  }

  // Verify library belongs to user
  const library = await prisma.library.findUnique({ where: { id: libraryId } });
  if (!library || library.userId !== user.id) {
    return NextResponse.json({ error: "Library not found" }, { status: 404 });
  }

  await prisma.libraryManga.deleteMany({
    where: { libraryId, mangaId: String(mangaId) },
  });

  return NextResponse.json({ success: true });
}
