import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { withRole } from "@/lib/api-guard";
import { categorySchema, firstZodMessage } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/editorial";
import { audit } from "@/lib/audit";
import { clientIp, userAgent } from "@/lib/request";

// GET /api/admin/categories — all categories with article counts.
export const GET = withRole("EDITOR", async () => {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      _count: { select: { articles: true } },
    },
  });
  return NextResponse.json({ categories });
});

// POST /api/admin/categories — create a category.
export const POST = withRole("EDITOR", async (req: NextRequest, { user }) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodMessage(parsed.error) }, { status: 422 });
  }

  const slug = slugify(parsed.data.name);
  if (!slug) {
    return NextResponse.json({ error: "Name must contain letters or numbers." }, { status: 422 });
  }

  const existing = await prisma.category.findFirst({
    where: { OR: [{ slug }, { name: parsed.data.name }] },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "A category with this name already exists." }, { status: 409 });
  }

  const category = await prisma.category.create({
    data: { slug, name: parsed.data.name, description: parsed.data.description || null },
    select: { id: true, slug: true, name: true, description: true },
  });

  await audit({
    userId: user.id,
    action: "category.create",
    entity: "Category",
    entityId: category.id,
    meta: { slug: category.slug },
    ip: clientIp(req),
    userAgent: userAgent(req),
  });

  return NextResponse.json({ category }, { status: 201 });
});
