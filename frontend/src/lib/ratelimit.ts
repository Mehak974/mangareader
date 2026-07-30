/**
 * Fixed-window rate limiter backed by the `login_attempts` table.
 *
 * Deliberately DB-backed rather than in-memory: the app may run as multiple
 * serverless instances (Vercel), where an in-process Map would not be shared.
 * The window is coarse (fixed, not sliding) which is enough to blunt
 * credential-stuffing and spam without adding a Redis dependency on the free
 * tier. ponytail: fixed window; swap for Redis sliding-window if abuse grows.
 */
import "server-only";
import { prisma } from "@/lib/prisma";

type RateResult = { ok: boolean; remaining: number; retryAfterSec: number };

/**
 * Count failed attempts for `email`/`ip` within the window and report whether
 * the caller may proceed. Recording the attempt (with its success flag) is the
 * caller's job via {@link recordAttempt} — this only reads.
 */
export async function checkRateLimit(
  { email, ip }: { email?: string; ip?: string },
  limit: number,
  windowSec: number
): Promise<RateResult> {
  const since = new Date(Date.now() - windowSec * 1000);

  // Count recent FAILED attempts matching either identifier in the window.
  const or: Array<Record<string, unknown>> = [];
  if (email) or.push({ email });
  if (ip) or.push({ ip });
  if (or.length === 0) return { ok: true, remaining: limit, retryAfterSec: 0 };

  const count = await prisma.loginAttempt.count({
    where: { success: false, createdAt: { gte: since }, OR: or },
  });

  const remaining = Math.max(0, limit - count);
  return {
    ok: count < limit,
    remaining,
    retryAfterSec: count < limit ? 0 : windowSec,
  };
}

/** Log an attempt so future {@link checkRateLimit} calls can see it. */
export async function recordAttempt(data: {
  email: string;
  ip?: string;
  userAgent?: string;
  success: boolean;
}): Promise<void> {
  await prisma.loginAttempt.create({ data }).catch(() => {});
}
