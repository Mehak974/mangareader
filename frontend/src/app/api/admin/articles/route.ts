import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { withRole } from "@/lib/api-guard";
import { articleSchema, firstZodMessage } from "@/lib/validation";
import { createArticle, listAdminArticles } from "@/lib/editorial";
import { audit } from "@/lib/audit";
import { clientIp, userAgent } from "@/lib/request";
import type { ContentStatus, ContentType } from "@prisma/client";

// GET /api/admin/articles — list all articles (any status), with optional filters.
export const GET = withRole("EDITOR", async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as ContentStatus | null;
  const contentType = searchParams.get("type") as ContentType | null;
  const take = Math.min(100, Number(searchParams.get("take")) || 50);
  const skip = Math.max(0, Number(searchParams.get("skip")) || 0);

  const { items, total } = await listAdminArticles({
    status: status || undefined,
    contentType: contentType || undefined,
    take,
    skip,
  });
  return NextResponse.json({ items, total });
});

// POST /api/admin/articles — create a new article.
export const POST = withRole("EDITOR", async (req: NextRequest, { user }) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = articleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodMessage(parsed.error) }, { status: 422 });
  }

  const article = await createArticle(parsed.data, user.id);

  await audit({
    userId: user.id,
    action: "article.create",
    entity: "Article",
    entityId: article.id,
    meta: { slug: article.slug, status: parsed.data.status },
    ip: clientIp(req),
    userAgent: userAgent(req),
  });

  return NextResponse.json({ article }, { status: 201 });
});
