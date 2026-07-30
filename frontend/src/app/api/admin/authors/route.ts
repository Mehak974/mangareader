import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { withRole } from "@/lib/api-guard";
import { authorSchema, firstZodMessage } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/editorial";
import { audit } from "@/lib/audit";
import { clientIp, userAgent } from "@/lib/request";
import type { Prisma } from "@prisma/client";

// GET /api/admin/authors — all editorial author personas with article counts.
export const GET = withRole("EDITOR", async () => {
  const authors = await prisma.editorialAuthor.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      bio: true,
      avatarUrl: true,
      credentials: true,
      socialLinks: true,
      _count: { select: { articles: true } },
    },
  });
  return NextResponse.json({ authors });
});

// POST /api/admin/authors — create an author persona.
export const POST = withRole("EDITOR", async (req: NextRequest, { user }) => {
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

  const slug = slugify(parsed.data.slug || parsed.data.name);
  if (!slug) {
    return NextResponse.json({ error: "Name or slug must contain letters or numbers." }, { status: 422 });
  }

  const existing = await prisma.editorialAuthor.findUnique({ where: { slug }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ error: "An author with this slug already exists." }, { status: 409 });
  }

  const author = await prisma.editorialAuthor.create({
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
    action: "author.create",
    entity: "EditorialAuthor",
    entityId: author.id,
    meta: { slug: author.slug },
    ip: clientIp(req),
    userAgent: userAgent(req),
  });

  return NextResponse.json({ author }, { status: 201 });
});
