import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { firstZodMessage } from "@/lib/validation";
import { prisma } from "@/lib/prisma";

const replySchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email."),
  text: z.string().trim().min(1, "Reply cannot be empty.").max(5000, "Reply is too long."),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const thread = await prisma.contactMessage.findFirst({
    where: { id, email },
    select: {
      id: true,
      type: true,
      subject: true,
      message: true,
      status: true,
      replies: true,
      createdAt: true,
    },
  });

  if (!thread) {
    return NextResponse.json({ error: "Thread not found." }, { status: 404 });
  }

  return NextResponse.json({ thread });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = replySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodMessage(parsed.error) }, { status: 422 });
  }

  const message = await prisma.contactMessage.findFirst({
    where: { id, email: parsed.data.email },
    select: { id: true, status: true, replies: true },
  });

  if (!message) {
    return NextResponse.json({ error: "Thread not found." }, { status: 404 });
  }

  const reply = {
    id: crypto.randomUUID(),
    sender: "user" as const,
    text: parsed.data.text,
    createdAt: new Date().toISOString(),
  };

  const existingReplies = Array.isArray(message.replies) ? message.replies : [];
  const updated = await prisma.contactMessage.update({
    where: { id },
    data: {
      replies: [...existingReplies, reply],
      status: "IN_PROGRESS",
    },
    select: { id: true, replies: true, status: true },
  });

  return NextResponse.json({ thread: updated });
}
