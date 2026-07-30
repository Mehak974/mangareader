import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { withRole } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { clientIp, userAgent } from "@/lib/request";

// DELETE /api/admin/categories/:id — remove a category. Articles keep their
// content but have categoryId nulled (onDelete: SetNull in the schema).
export const DELETE = withRole("EDITOR", async (req: NextRequest, { user, params }) => {
  const existing = await prisma.category.findUnique({ where: { id: params.id }, select: { id: true, slug: true } });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await prisma.category.delete({ where: { id: params.id } });

  await audit({
    userId: user.id,
    action: "category.delete",
    entity: "Category",
    entityId: params.id,
    meta: { slug: existing.slug },
    ip: clientIp(req),
    userAgent: userAgent(req),
  });

  return NextResponse.json({ ok: true });
});
