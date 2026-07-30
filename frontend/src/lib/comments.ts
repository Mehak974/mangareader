/**
 * Comment data-access + helpers.
 *
 * Comments attach to either a scraper manga (by id, cross-owner so no FK) or an
 * editorial article. Threading is one level deep: a reply carries parentId, and
 * we fetch top-level comments with their replies in a single query to keep the
 * free-tier query budget predictable.
 */
import "server-only";
import type { CommentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const AUTHOR_SELECT = {
  id: true,
  displayName: true,
  avatarUrl: true,
  role: true,
} satisfies Prisma.UserSelect;

/** Count how many comments a user has posted since `since` (spam throttle). */
export async function recentCommentCount(userId: string, sinceMs: number): Promise<number> {
  return prisma.comment.count({
    where: { userId, createdAt: { gte: new Date(Date.now() - sinceMs) } },
  });
}

/** Public shape for one comment plus its author + replies. */
export const COMMENT_SELECT = {
  id: true,
  body: true,
  status: true,
  parentId: true,
  createdAt: true,
  user: { select: AUTHOR_SELECT },
} satisfies Prisma.CommentSelect;

type Target = { mangaId?: string; articleId?: string };

function targetWhere(target: Target): Prisma.CommentWhereInput {
  if (target.articleId) return { articleId: target.articleId };
  return { mangaId: target.mangaId };
}

/**
 * List visible top-level comments for a target, newest first, each with its
 * visible replies (oldest first, so a thread reads top to bottom).
 */
export async function listComments(target: Target, opts?: { take?: number; skip?: number }) {
  const base = targetWhere(target);
  const where: Prisma.CommentWhereInput = { ...base, parentId: null, status: "VISIBLE" };

  const [items, total] = await Promise.all([
    prisma.comment.findMany({
      where,
      select: {
        ...COMMENT_SELECT,
        replies: {
          where: { status: "VISIBLE" },
          select: COMMENT_SELECT,
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: opts?.take ?? 50,
      skip: opts?.skip ?? 0,
    }),
    prisma.comment.count({ where: { ...base, status: "VISIBLE" } }),
  ]);
  return { items, total };
}

/** Create a comment. Validates the parent belongs to the same target if given. */
export async function createComment(input: {
  userId: string;
  body: string;
  mangaId?: string;
  articleId?: string;
  parentId?: string;
}) {
  if (input.parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: input.parentId },
      select: { id: true, mangaId: true, articleId: true, parentId: true },
    });
    // Parent must exist, be a top-level comment, and share this target.
    if (
      !parent ||
      parent.parentId !== null ||
      (input.articleId ? parent.articleId !== input.articleId : parent.mangaId !== input.mangaId)
    ) {
      return null;
    }
  }

  return prisma.comment.create({
    data: {
      userId: input.userId,
      body: input.body,
      mangaId: input.articleId ? null : input.mangaId ?? null,
      articleId: input.articleId ?? null,
      parentId: input.parentId ?? null,
    },
    select: { ...COMMENT_SELECT, replies: { select: COMMENT_SELECT } },
  });
}

/**
 * Delete a comment if it belongs to `userId`, unless `force` (moderator).
 * Returns true when something was removed. Replies cascade via the schema.
 */
export async function deleteComment(id: string, userId: string, force = false) {
  const comment = await prisma.comment.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });
  if (!comment) return false;
  if (!force && comment.userId !== userId) return false;
  await prisma.comment.delete({ where: { id } });
  return true;
}

/** Moderator: set a comment's status (e.g. HIDDEN for abuse). */
export async function setCommentStatus(id: string, status: CommentStatus) {
  await prisma.comment.update({ where: { id }, data: { status } }).catch(() => {});
}
