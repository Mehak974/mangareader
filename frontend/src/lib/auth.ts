/**
 * Authentication core.
 *
 * Opaque server-side sessions: a random token is set in an httpOnly cookie and
 * only its SHA-256 hash is stored in the DB, so a database leak cannot be
 * replayed as a login. Passwords use Node's built-in scrypt (no extra
 * dependency) with a per-user random salt and constant-time comparison.
 */
import "server-only";
import { cookies } from "next/headers";
import { randomBytes, scrypt as _scrypt, timingSafeEqual, createHash } from "crypto";
import { promisify } from "util";
import type { User, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

const scrypt = promisify(_scrypt) as (
  password: string,
  salt: string,
  keylen: number
) => Promise<Buffer>;

export const SESSION_COOKIE = "mr_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const SCRYPT_KEYLEN = 64;

// ── Password hashing ─────────────────────────────────────────────────────────

/** Hash a password as `salt:hash` (both hex). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, SCRYPT_KEYLEN);
  return `${salt}:${derived.toString("hex")}`;
}

/** Constant-time verify a password against a stored `salt:hash`. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = await scrypt(password, salt, SCRYPT_KEYLEN);
  const hashBuf = Buffer.from(hash, "hex");
  if (hashBuf.length !== derived.length) return false;
  return timingSafeEqual(hashBuf, derived);
}

// ── Session tokens ───────────────────────────────────────────────────────────

function hashToken(token: string): string {
  // The DB stores only this hash; the raw token lives solely in the cookie.
  return createHash("sha256").update(token + env.AUTH_SECRET).digest("hex");
}

/** Create a session row and set the httpOnly cookie. Returns the raw token. */
export async function createSession(
  userId: string,
  meta?: { ip?: string; userAgent?: string }
): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Resolve the current user from the session cookie, or null. */
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    // Expired — clean it up opportunistically.
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (session.user.banned) return null;

  return session.user;
}

/** Delete the current session (logout) and clear the cookie. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } }).catch(() => {});
  }
  cookieStore.delete(SESSION_COOKIE);
}

// ── Authorization ────────────────────────────────────────────────────────────

const ROLE_RANK: Record<UserRole, number> = { USER: 0, EDITOR: 1, ADMIN: 2 };

/** True if `user` holds at least the `required` role. */
export function hasRole(user: Pick<User, "role"> | null, required: UserRole): boolean {
  if (!user) return false;
  return ROLE_RANK[user.role] >= ROLE_RANK[required];
}

/** Return the current user or throw if they lack the required role. */
export async function requireRole(required: UserRole): Promise<User> {
  const user = await getCurrentUser();
  if (!hasRole(user, required)) {
    throw new AuthError(user ? "forbidden" : "unauthenticated");
  }
  return user as User;
}

export class AuthError extends Error {
  constructor(public kind: "unauthenticated" | "forbidden") {
    super(kind);
    this.name = "AuthError";
  }
}
