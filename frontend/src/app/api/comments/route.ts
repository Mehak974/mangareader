import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { commentSchema, firstZodMessage } from "@/lib/validation";
import { listComments, createComment, recentCommentCount } from "@/lib/comments";
import { jsonError } from "@/lib/request";

// GET /api/comments?mangaId=… | ?articleId=… — visible thread for a target.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mangaId = searchParams.get("mangaId") || undefined;
  const articleId = searchParams.get("articleId") || undefined;

  if (!mangaId && !articleId) {
    return jsonError("A mangaId or articleId is required.", 400);
  }

  const comments = await listComments({ mangaId, articleId });
  return NextResponse.json({ comments });
}

// POST /api/comments — create a comment (must be signed in).
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError("You must be signed in to comment.", 401);
  if (user.banned) return jsonError("Your account cannot post comments.", 403);

  // Spam guard: max 8 comments per user per 5 minutes.
  const recent = await recentCommentCount(user.id, 300);
  if (recent >= 8) return jsonError("You're commenting too fast. Try again shortly.", 429);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid request body.", 400);
  }

  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) return jsonError(firstZodMessage(parsed.error), 422);

  const { mangaId, articleId, parentId } = parsed.data;
  if ((!mangaId && !articleId) || (mangaId && articleId)) {
    return jsonError("A comment must target exactly one manga or article.", 422);
  }

  const comment = await createComment({
    userId: user.id,
    body: parsed.data.body,
    mangaId: mangaId || undefined,
    articleId: articleId || undefined,
    parentId: parentId || undefined,
  });
  if (!comment) {
    return jsonError("Could not post — the parent comment is invalid.", 422);
  }

  return NextResponse.json({ comment }, { status: 201 });
}
