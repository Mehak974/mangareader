import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withRole } from "@/lib/api-guard";
import { firstZodMessage } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { clientIp, userAgent } from "@/lib/request";

const patchSchema = z.object({
  status: z.enum(["NEW", "IN_PROGRESS", "RESOLVED", "SPAM"]),
});

// PATCH /api/admin/messages/:id — change a contact message's status.
export const PATCH = withRole("EDITOR", async (req: NextRequest, { user, params }) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodMessage(parsed.error) }, { status: 422 });
  }

  const existing = await prisma.contactMessage.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Message not found." }, { status: 404 });
  }

  const message = await prisma.contactMessage.update({
    where: { id: params.id },
    data: { status: parsed.data.status },
    select: { id: true, status: true },
  });

  await audit({
    userId: user.id,
    action: "message.status",
    entity: "ContactMessage",
    entityId: message.id,
    meta: { status: message.status },
    ip: clientIp(req),
    userAgent: userAgent(req),
  });

  return NextResponse.json({ message });
});

// DELETE /api/admin/messages/:id — remove a contact message.
export const DELETE = withRole("EDITOR", async (req: NextRequest, { user, params }) => {
  const existing = await prisma.contactMessage.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Message not found." }, { status: 404 });
  }

  await prisma.contactMessage.delete({ where: { id: params.id } });

  await audit({
    userId: user.id,
    action: "message.delete",
    entity: "ContactMessage",
    entityId: params.id,
    ip: clientIp(req),
    userAgent: userAgent(req),
  });

  return NextResponse.json({ ok: true });
});
