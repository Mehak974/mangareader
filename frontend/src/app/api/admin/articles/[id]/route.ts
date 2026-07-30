import { NextResponse } from "next/server";
import { withRole } from "@/lib/api-guard";
import { articleSchema, firstZodMessage } from "@/lib/validation";
import { getAdminArticle, updateArticle, deleteArticle } from "@/lib/editorial";
import { audit } from "@/lib/audit";
import { clientIp, userAgent } from "@/lib/request";

// GET /api/admin/articles/:id — full article for the editor.
export const GET = withRole("EDITOR", async (_req, { params }) => {
  const article = await getAdminArticle(params.id);
  if (!article) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ article });
});

// PUT /api/admin/articles/:id — update.
export const PUT = withRole("EDITOR", async (req, { user, params }) => {
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

  const result = await updateArticle(params.id, parsed.data);
  if (!result) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await audit({
    userId: user.id,
    action: "article.update",
    entity: "Article",
    entityId: result.id,
    ip: clientIp(req),
    userAgent: userAgent(req),
  });

  return NextResponse.json({ article: result });
});

// DELETE /api/admin/articles/:id — remove.
export const DELETE = withRole("EDITOR", async (req, { user, params }) => {
  await deleteArticle(params.id);
  await audit({
    userId: user.id,
    action: "article.delete",
    entity: "Article",
    entityId: params.id,
    ip: clientIp(req),
    userAgent: userAgent(req),
  });
  return NextResponse.json({ ok: true });
});
