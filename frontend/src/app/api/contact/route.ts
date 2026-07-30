import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { contactSchema, firstZodMessage } from "@/lib/validation";
import { checkRateLimit, recordAttempt } from "@/lib/ratelimit";
import { clientIp, userAgent, jsonError } from "@/lib/request";
import type { MessageType } from "@prisma/client";

/** Map the human-facing subject choices to the ContactMessage.type enum. */
function messageTypeFor(subject: string): MessageType {
  const s = subject.toLowerCase();
  if (s.includes("bug")) return "BUG_REPORT";
  if (s.includes("content") || s.includes("dmca")) return "COMPLAINT";
  if (s.includes("partnership") || s.includes("feature")) return "FEATURE_REQUEST";
  return "CONTACT";
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid request body.", 400);
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(firstZodMessage(parsed.error), 422);
  }

  const { name, email, subject, message, website } = parsed.data;

  // Honeypot: real users leave `website` empty. Bots fill it. Silently drop
  // by returning a fake success so the bot cannot distinguish rejection.
  if (website) {
    return Response.json({ ok: true });
  }

  // Blunt spam: max 5 messages per IP per hour.
  const limit = await checkRateLimit({ ip }, 5, 3600);
  if (!limit.ok) return jsonError("Too many messages. Try again later.", 429);

  await prisma.contactMessage.create({
    data: {
      type: messageTypeFor(subject),
      name,
      email,
      subject,
      message,
      ip,
      userAgent: userAgent(req),
    },
  });

  // Count this submission against the fixed window. `checkRateLimit` only sees
  // rows flagged success:false, so record it that way to make the cap enforce.
  await recordAttempt({ email, ip, userAgent: userAgent(req), success: false });

  return Response.json({ ok: true });
}
