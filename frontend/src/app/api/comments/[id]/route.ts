import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { deleteComment, setCommentStatus } from "@/lib/comments";
import { audit } from "@/lib/audit";
import { clientIp, userAgent, jsonError } from "@/lib/request";

type Ctx = { params: Promise<{ id: string }> };

// DELETE /api/comments/:id — author removes their own; editors remove any.
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return jsonError("You must be signed in.", 401);

  const { id } = await ctx.params;
  const isMod = hasRole(user, "EDITOR");
  const removed = await deleteComment(id, user.id, isMod);
  if (!removed) return jsonError("Comment not found or not yours to remove.", 404);

  if (isMod) {
    await audit({
      userId: user.id,
      action: "comment.delete",
      entity: "Comment",
      entityId: id,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
  }
  return NextResponse.json({ ok: true });
}

// PATCH /api/comments/:id — moderators hide/show a comment. Body: { status }.
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!hasRole(user, "EDITOR")) return jsonError("Not allowed.", 403);

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid request body.", 400);
  }

  const status = (body as { status?: string }).status;
  if (status !== "VISIBLE" && status !== "HIDDEN") {
    return jsonError("Status must be VISIBLE or HIDDEN.", 422);
  }

  await setCommentStatus(id, status);
  await audit({
    userId: user!.id,
    action: "comment.moderate",
    entity: "Comment",
    entityId: id,
    meta: { status },
    ip: clientIp(req),
    userAgent: userAgent(req),
  });
  return NextResponse.json({ ok: true });
}
