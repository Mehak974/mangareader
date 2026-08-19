import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withRole } from "@/lib/api-guard";
import { firstZodMessage } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { clientIp, userAgent } from "@/lib/request";

const replySchema = z.object({
  text: z.string().trim().min(1, "Reply cannot be empty.").max(5000, "Reply is too long."),
});

export const POST = withRole("EDITOR", async (req: NextRequest, { user, params }) => {
  const parsed = replySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodMessage(parsed.error) }, { status: 422 });
  }

  const message = await prisma.contactMessage.findUnique({
    where: { id: params.id },
    select: { id: true, status: true, replies: true },
  });

  if (!message) {
    return NextResponse.json({ error: "Message not found." }, { status: 404 });
  }

  const reply = {
    id: crypto.randomUUID(),
    sender: "admin" as const,
    text: parsed.data.text,
    createdAt: new Date().toISOString(),
  };

  const existingReplies = Array.isArray(message.replies) ? message.replies : [];
  const updated = await prisma.contactMessage.update({
    where: { id: params.id },
    data: {
      replies: [...existingReplies, reply],
      status: message.status === "NEW" ? "IN_PROGRESS" : message.status,
    },
    select: { id: true, replies: true, status: true },
  });

  await audit({
    userId: user.id,
    action: "message.reply",
    entity: "ContactMessage",
    entityId: message.id,
    meta: { replyId: reply.id },
    ip: clientIp(req),
    userAgent: userAgent(req),
  });

  return NextResponse.json({ message: updated });
});
