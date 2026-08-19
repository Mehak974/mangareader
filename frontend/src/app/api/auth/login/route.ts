import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSession } from "@/lib/auth";
import { loginSchema, publicUser } from "@/lib/validation";
import { checkRateLimit, recordAttempt } from "@/lib/ratelimit";
import { clientIp, userAgent, jsonError } from "@/lib/request";

export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid request body.", 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid input.", 422);
  }

  const { email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  // Credential-stuffing guard: 10 failed attempts per email/IP per 15 min.
  const limit = await checkRateLimit({ email: normalizedEmail, ip }, 10, 900);
  if (!limit.ok) return jsonError("Too many attempts. Try again later.", 429);

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  // Generic error for both "no such user" and "wrong password" to avoid
  // account enumeration. Still runs a hash to keep timing roughly constant.
  const ok = user?.passwordHash
    ? await verifyPassword(password, user.passwordHash)
    : (await verifyPassword(password, "0:0"), false);

  await recordAttempt({
    email: normalizedEmail,
    ip,
    userAgent: userAgent(req),
    success: !!(ok && user),
  });

  if (!ok || !user) {
    return jsonError("Invalid email or password.", 401);
  }
  if (user.banned) {
    return jsonError("This account has been suspended.", 403);
  }

  await createSession(user.id, { ip, userAgent: userAgent(req) });

  return Response.json({
    user: publicUser(user),
  });
}
