import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { withRole } from "@/lib/api-guard";
import { userAdminSchema, firstZodMessage } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { clientIp, userAgent } from "@/lib/request";

// PATCH /api/admin/users/:id — change role and/or ban state. ADMIN only.
// An admin cannot demote or ban themselves (compared to the acting user).
export const PATCH = withRole("ADMIN", async (req: NextRequest, { user, params }) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = userAdminSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodMessage(parsed.error) }, { status: 422 });
  }

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, role: true, banned: true, displayName: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // Self-protection: an admin cannot change their own role or ban themselves.
  if (target.id === user.id) {
    if (parsed.data.role !== undefined && parsed.data.role !== user.role) {
      return NextResponse.json({ error: "You cannot change your own role." }, { status: 403 });
    }
    if (parsed.data.banned === true) {
      return NextResponse.json({ error: "You cannot ban yourself." }, { status: 403 });
    }
  }

  const data: {
    role?: "USER" | "EDITOR" | "ADMIN";
    banned?: boolean;
    bannedReason?: string | null;
  } = {};
  if (parsed.data.role !== undefined) data.role = parsed.data.role;
  if (parsed.data.banned !== undefined) {
    data.banned = parsed.data.banned;
    data.bannedReason = parsed.data.banned ? parsed.data.bannedReason || null : null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 422 });
  }

  const updated = await prisma.user.update({
    where: { id: params.id },
    data,
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      banned: true,
      bannedReason: true,
    },
  });

  // When banning, revoke all active sessions so the user is signed out.
  if (data.banned === true) {
    await prisma.session.deleteMany({ where: { userId: params.id } }).catch(() => {});
  }

  const action =
    data.banned === true
      ? "user.ban"
      : data.banned === false
        ? "user.unban"
        : "user.role";
  await audit({
    userId: user.id,
    action,
    entity: "User",
    entityId: updated.id,
    meta: { role: updated.role, banned: updated.banned, reason: updated.bannedReason },
    ip: clientIp(req),
    userAgent: userAgent(req),
  });

  return NextResponse.json({ user: updated });
});
