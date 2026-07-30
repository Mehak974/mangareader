import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { withRole } from "@/lib/api-guard";
import { authorSchema, firstZodMessage } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/editorial";
import { audit } from "@/lib/audit";
import { clientIp, userAgent } from "@/lib/request";

// GET /api/admin/authors/:id — single author persona for the editor.
export const GET = withRole("EDITOR", async (_req, { params }) => {
  const author = await prisma.editorialAuthor.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      slug: true,
      name: true,
      bio: true,
      avatarUrl: true,
      credentials: true,
      socialLinks: true,
    },
  });
  if (!author) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ author });
});

// PUT /api/admin/authors/:id — update.
export const PUT = withRole("EDITOR", async (req: NextRequest, { user, params }) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = authorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodMessage(parsed.error) }, { status: 422 });
  }

  const existing = await prisma.editorialAuthor.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const slug = slugify(parsed.data.slug || parsed.data.name);
  if (!slug) {
    return NextResponse.json({ error: "Name or slug must contain letters or numbers." }, { status: 422 });
  }

  const slugClash = await prisma.editorialAuthor.findUnique({ where: { slug }, select: { id: true } });
  if (slugClash && slugClash.id !== params.id) {
    return NextResponse.json({ error: "An author with this slug already exists." }, { status: 409 });
  }

  const author = await prisma.editorialAuthor.update({
    where: { id: params.id },
    data: {
      slug,
      name: parsed.data.name,
      bio: parsed.data.bio || null,
      avatarUrl: parsed.data.avatarUrl || null,
      credentials: parsed.data.credentials || null,
      socialLinks: (parsed.data.socialLinks ?? undefined) as Prisma.InputJsonValue | undefined,
    },
    select: { id: true, slug: true, name: true },
  });

  await audit({
    userId: user.id,
    action: "author.update",
    entity: "EditorialAuthor",
    entityId: author.id,
    ip: clientIp(req),
    userAgent: userAgent(req),
  });

  return NextResponse.json({ author });
});

// DELETE /api/admin/authors/:id — remove an author persona. Articles keep
// their bylineId nulled via the schema's onDelete: SetNull.
export const DELETE = withRole("EDITOR", async (req: NextRequest, { user, params }) => {
  const existing = await prisma.editorialAuthor.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await prisma.editorialAuthor.delete({ where: { id: params.id } });

  await audit({
    userId: user.id,
    action: "author.delete",
    entity: "EditorialAuthor",
    entityId: params.id,
    ip: clientIp(req),
    userAgent: userAgent(req),
  });

  return NextResponse.json({ ok: true });
});
