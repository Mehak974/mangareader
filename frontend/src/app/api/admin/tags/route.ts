import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { withRole } from "@/lib/api-guard";
import { tagSchema, firstZodMessage } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/editorial";
import { audit } from "@/lib/audit";
import { clientIp, userAgent } from "@/lib/request";

// GET /api/admin/tags — all tags with article counts.
export const GET = withRole("EDITOR", async () => {
  const tags = await prisma.articleTag.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      _count: { select: { articles: true } },
    },
  });
  return NextResponse.json({ tags });
});

// POST /api/admin/tags — create a tag.
export const POST = withRole("EDITOR", async (req: NextRequest, { user }) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = tagSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodMessage(parsed.error) }, { status: 422 });
  }

  const slug = slugify(parsed.data.name);
  if (!slug) {
    return NextResponse.json({ error: "Name must contain letters or numbers." }, { status: 422 });
  }

  const existing = await prisma.articleTag.findFirst({
    where: { OR: [{ slug }, { name: parsed.data.name }] },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "A tag with this name already exists." }, { status: 409 });
  }

  const tag = await prisma.articleTag.create({
    data: { slug, name: parsed.data.name },
    select: { id: true, slug: true, name: true },
  });

  await audit({
    userId: user.id,
    action: "tag.create",
    entity: "ArticleTag",
    entityId: tag.id,
    meta: { slug: tag.slug },
    ip: clientIp(req),
    userAgent: userAgent(req),
  });

  return NextResponse.json({ tag }, { status: 201 });
});
