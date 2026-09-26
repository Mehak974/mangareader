/**
 * Authentication core.
 *
 * Opaque server-side sessions: a random token is set in an httpOnly cookie and
 * only its SHA-256 hash is stored in the DB, so a database leak cannot be
 * replayed as a login. Passwords use @noble/hashes scrypt (pure JS, works on
 * both Node.js and the Cloudflare edge runtime) with a per-user random salt
 * and constant-time comparison.
 */
import "server-only";
import { cookies } from "next/headers";
import { scryptAsync } from "@noble/hashes/scrypt.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import type { User, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

export const SESSION_COOKIE = "mr_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const SCRYPT_N = 1 << 15; // 32768
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;

// ── Helpers ────────────────────────────────────────────────────────────────────

function randomBytes(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  return buf;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a[i] ^ b[i];
  return out === 0;
}

function sha256Hex(input: string): string {
  return bytesToHex(sha256(new TextEncoder().encode(input)));
}

// ── Password hashing ───────────────────────────────────────────────────────────

/** Hash a password as `salt:hash` (both hex). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(
    new TextEncoder().encode(password),
    salt,
    { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, dkLen: SCRYPT_KEYLEN }
  );
  return `${bytesToHex(salt)}:${bytesToHex(derived)}`;
}

/** Constant-time verify a password against a stored `salt:hash`. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = hexToBytes(saltHex);
  const hashBuf = hexToBytes(hashHex);
  const derived = await scryptAsync(
    new TextEncoder().encode(password),
    salt,
    { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, dkLen: SCRYPT_KEYLEN }
  );
  if (hashBuf.length !== derived.length) return false;
  return timingSafeEqual(hashBuf, derived);
}

// ── Session tokens ────────────────────────────────────────────────────────────

function hashToken(token: string): string {
  // The DB stores only this hash; the raw token lives solely in the cookie.
  return sha256Hex(token + env.AUTH_SECRET);
}

/** Create a session row and set the httpOnly cookie. Returns the raw token. */
export async function createSession(
  userId: string,
  meta?: { ip?: string; userAgent?: string }
): Promise<void> {
  const token = bytesToHex(randomBytes(32));
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
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) {
      console.warn("[auth] no session cookie found");
      return null;
    }

    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });

    if (!session) {
      console.warn("[auth] session not found for token hash");
      return null;
    }
    if (session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      console.warn("[auth] session expired");
      return null;
    }
    if (session.user.banned) {
      console.warn("[auth] user is banned");
      return null;
    }

    return session.user;
  } catch (err) {
    console.error("[auth] getCurrentUser error:", err);
    return null;
  }
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

// ── Authorization ──────────────────────────────────────────────────────────────

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