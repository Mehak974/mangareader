import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { withRole } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { clientIp, userAgent } from "@/lib/request";

// DELETE /api/admin/tags/:id — remove a tag. Articles keep existing; the
// implicit many-to-many rows are removed automatically.
export const DELETE = withRole("EDITOR", async (req: NextRequest, { user, params }) => {
  const existing = await prisma.articleTag.findUnique({
    where: { id: params.id },
    select: { id: true, slug: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await prisma.articleTag.delete({ where: { id: params.id } });

  await audit({
    userId: user.id,
    action: "tag.delete",
    entity: "ArticleTag",
    entityId: existing.id,
    meta: { slug: existing.slug },
    ip: clientIp(req),
    userAgent: userAgent(req),
  });

  return NextResponse.json({ ok: true });
});
