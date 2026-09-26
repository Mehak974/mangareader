export const runtime = 'edge';
import type { NextRequest } from "next/server";
import { bytesToHex } from "@noble/hashes/utils.js";
import { prisma } from "@/lib/prisma";
import { newsletterSchema, firstZodMessage } from "@/lib/validation";
import { checkRateLimit, recordAttempt } from "@/lib/ratelimit";
import { clientIp, userAgent, jsonError } from "@/lib/request";

function randomBytes(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  return buf;
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid request body.", 400);
  }

  const parsed = newsletterSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(firstZodMessage(parsed.error), 422);
  }

  const { email } = parsed.data;

  // Blunt abuse: max 5 signups per IP per hour.
  const limit = await checkRateLimit({ ip }, 5, 3600);
  if (!limit.ok) return jsonError("Too many attempts. Try again later.", 429);

  const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } });
  if (existing?.confirmed) {
    // Already on the list — respond idempotently.
    return Response.json({ ok: true, message: "You're already subscribed." });
  }

  // No email delivery exists yet, so treat a signup as confirmed immediately.
  // The token is still generated so a future double-opt-in flow can reuse it.
  const token = bytesToHex(randomBytes(32));
  await prisma.newsletterSubscriber.upsert({
    where: { email },
    update: { confirmed: true, confirmedAt: new Date() },
    create: { email, token, confirmed: true, confirmedAt: new Date() },
  });

  // Count this signup against the fixed window. `checkRateLimit` only sees rows
  // flagged success:false, so record it that way to make the cap enforce.
  await recordAttempt({ email, ip, userAgent: userAgent(req), success: false });

  return Response.json({ ok: true, message: "Thanks for subscribing!" });
}
