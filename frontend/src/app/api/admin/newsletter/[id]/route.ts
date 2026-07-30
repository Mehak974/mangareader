import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { withRole } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { clientIp, userAgent } from "@/lib/request";

// DELETE /api/admin/newsletter/:id — remove a subscriber.
export const DELETE = withRole("EDITOR", async (req: NextRequest, { user, params }) => {
  const existing = await prisma.newsletterSubscriber.findUnique({
    where: { id: params.id },
    select: { id: true, email: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Subscriber not found." }, { status: 404 });
  }

  await prisma.newsletterSubscriber.delete({ where: { id: params.id } });

  await audit({
    userId: user.id,
    action: "newsletter.delete",
    entity: "NewsletterSubscriber",
    entityId: params.id,
    meta: { email: existing.email },
    ip: clientIp(req),
    userAgent: userAgent(req),
  });

  return NextResponse.json({ ok: true });
});
