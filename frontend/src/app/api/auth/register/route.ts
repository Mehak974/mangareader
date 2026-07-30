import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSession } from "@/lib/auth";
import { registerSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/ratelimit";
import { clientIp, userAgent, jsonError } from "@/lib/request";

export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  // Blunt abuse: max 5 signups per IP per hour.
  const limit = await checkRateLimit({ ip }, 5, 3600);
  if (!limit.ok) return jsonError("Too many attempts. Try again later.", 429);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid request body.", 400);
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid input.", 422);
  }

  const { email, password, displayName } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    // Do not reveal which emails are registered beyond what signup inherently leaks.
    return jsonError("An account with that email already exists.", 409);
  }

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash: await hashPassword(password),
      displayName,
    },
  });

  await createSession(user.id, { ip, userAgent: userAgent(req) });

  return Response.json({
    user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
  });
}
