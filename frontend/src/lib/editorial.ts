/**
 * Editorial content data-access + helpers.
 *
 * Central place for slug generation, reading-time estimation, and the Prisma
 * queries the admin CMS and public pages share, so list/detail shapes stay
 * consistent and query costs stay predictable on the free-tier DB.
 */
import "server-only";
import { cache } from "react";
import type { ContentType, ContentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ArticleInput } from "@/lib/validation";
import { submitUrlToIndexNow } from "@/lib/indexnow";
import { SITE_URL } from "@/lib/seo";

/** Turn a title into a URL-safe slug. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Estimate reading time in minutes from markdown body (~200 wpm, min 1). */
export function readingMinutes(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/**
 * Produce a slug unique across articles. If `base` is taken, appends -2, -3, …
 * `exceptId` lets an article keep its slug when editing.
 */
export async function uniqueSlug(base: string, exceptId?: string): Promise<string> {
  const root = slugify(base) || "post";
  let candidate = root;
  let n = 1;
  // Loop terminates: each miss increments the suffix against a finite table.
  while (true) {
    const existing = await prisma.article.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing || existing.id === exceptId) return candidate;
    n += 1;
    candidate = `${root}-${n}`;
  }
}

/** Fields safe to expose on public list cards. */
export const ARTICLE_CARD_SELECT = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  coverImage: true,
  contentType: true,
  publishedAt: true,
  readingMinutes: true,
  viewCount: true,
  byline: { select: { name: true, slug: true, avatarUrl: true } },
  category: { select: { name: true, slug: true } },
} satisfies Prisma.ArticleSelect;

/** Published articles for public listing, newest first. Optional type/category filter. */
export const listPublishedArticles = cache(async function listPublishedArticles(opts?: {
  contentType?: ContentType;
  categorySlug?: string;
  categorySlugs?: string[];
  take?: number;
  skip?: number;
}) {
  const where: Prisma.ArticleWhereInput = {
    status: "PUBLISHED",
    publishedAt: { lte: new Date() },
    ...(opts?.contentType ? { contentType: opts.contentType } : {}),
    ...(opts?.categorySlug ? { category: { slug: opts.categorySlug } } : {}),
    ...(opts?.categorySlugs?.length ? { category: { slug: { in: opts.categorySlugs } } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.article.findMany({
      where,
      select: ARTICLE_CARD_SELECT,
      orderBy: { publishedAt: "desc" },
      take: opts?.take ?? 24,
      skip: opts?.skip ?? 0,
    }),
    prisma.article.count({ where }),
  ]);
  return { items, total };
});

/** Resolve tag slugs to connect clauses, creating any that don't exist yet. */
async function resolveTags(tagSlugs?: string[]) {
  if (!tagSlugs?.length) return [];
  const unique = [...new Set(tagSlugs.map((t) => slugify(t)).filter(Boolean))];
  return Promise.all(
    unique.map(async (slug) => {
      const name = slug.replace(/-/g, " ");
      const tag = await prisma.articleTag.upsert({
        where: { slug },
        create: { slug, name },
        update: {},
        select: { id: true },
      });
      return { id: tag.id };
    })
  );
}

/**
 * Derive the publishedAt/scheduledFor lifecycle fields from a target status.
 * PUBLISHED stamps publishedAt once (kept if already set); SCHEDULED needs a
 * future date; DRAFT/ARCHIVED clear scheduling.
 */
function lifecycleFields(
  status: ContentStatus,
  scheduledFor: string | undefined,
  existingPublishedAt: Date | null
): { publishedAt: Date | null; scheduledFor: Date | null } {
  if (status === "PUBLISHED") {
    return { publishedAt: existingPublishedAt ?? new Date(), scheduledFor: null };
  }
  if (status === "SCHEDULED") {
    return {
      publishedAt: null,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
    };
  }
  return { publishedAt: null, scheduledFor: null };
}

/** Build the review nested-write from validated input, or undefined to skip. */
function reviewWrite(review: ArticleInput["review"]) {
  if (!review) return undefined;
  const data = {
    mangaId: review.mangaId || null,
    storyScore: review.storyScore ?? null,
    charactersScore: review.charactersScore ?? null,
    artworkScore: review.artworkScore ?? null,
    worldScore: review.worldScore ?? null,
    pacingScore: review.pacingScore ?? null,
    overallScore: review.overallScore ?? null,
    strengths: review.strengths ?? [],
    weaknesses: review.weaknesses ?? [],
    verdict: review.verdict || null,
  };
  return { create: data, update: data };
}

/** Create an article from validated input. Returns the new id + slug. */
export async function createArticle(input: ArticleInput, createdById: string) {
  const slug = await uniqueSlug(input.slug || input.title);
  const tags = await resolveTags(input.tagSlugs);
  const life = lifecycleFields(input.status, input.scheduledFor || undefined, null);

  const article = await prisma.article.create({
    data: {
      slug,
      title: input.title,
      excerpt: input.excerpt || null,
      body: input.body,
      coverImage: input.coverImage || null,
      contentType: input.contentType,
      status: input.status,
      bylineId: input.bylineId || null,
      createdById,
      categoryId: input.categoryId || null,
      seoTitle: input.seoTitle || null,
      seoDescription: input.seoDescription || null,
      canonicalUrl: input.canonicalUrl || null,
      ogImage: input.ogImage || null,
      relatedMangaIds: input.relatedMangaIds ?? [],
      readingMinutes: readingMinutes(input.body),
      ...life,
      ArticleToArticleTag: {
        create: tags.map((t) => ({
          article_tags: { connect: { id: t.id } },
        })),
      },
      ...(reviewWrite(input.review) ? { review: { create: reviewWrite(input.review)!.create } } : {}),
    },
    select: { id: true, slug: true },
  });
  if (article && input.status === "PUBLISHED") {
    void submitUrlToIndexNow(`${SITE_URL}/blog/${article.slug}`);
  }
  return article;
}

/** Update an existing article. Returns the id + (possibly new) slug, or null if missing. */
export async function updateArticle(id: string, input: ArticleInput) {
  const existing = await prisma.article.findUnique({
    where: { id },
    select: { id: true, publishedAt: true },
  });
  if (!existing) return null;

  const slug = await uniqueSlug(input.slug || input.title, id);
  const tags = await resolveTags(input.tagSlugs);
  const life = lifecycleFields(
    input.status,
    input.scheduledFor || undefined,
    existing.publishedAt
  );
  const review = reviewWrite(input.review);

  const article = await prisma.article.update({
    where: { id },
    data: {
      slug,
      title: input.title,
      excerpt: input.excerpt || null,
      body: input.body,
      coverImage: input.coverImage || null,
      contentType: input.contentType,
      status: input.status,
      bylineId: input.bylineId || null,
      categoryId: input.categoryId || null,
      seoTitle: input.seoTitle || null,
      seoDescription: input.seoDescription || null,
      canonicalUrl: input.canonicalUrl || null,
      ogImage: input.ogImage || null,
      relatedMangaIds: input.relatedMangaIds ?? [],
      readingMinutes: readingMinutes(input.body),
      ...life,
      ArticleToArticleTag: {
        deleteMany: {},
        create: tags.map((t) => ({
          article_tags: { connect: { id: t.id } },
        })),
      },
      ...(review ? { review: { upsert: { create: review.create, update: review.update } } } : {}),
    },
    select: { id: true, slug: true },
  });
  if (article && input.status === "PUBLISHED") {
    void submitUrlToIndexNow(`${SITE_URL}/blog/${article.slug}`);
  }
  return article;
}

/** Delete an article (cascades to its review). */
export async function deleteArticle(id: string) {
  await prisma.article.delete({ where: { id } }).catch(() => {});
}

export async function getAdminArticleCounts() {
  const statusCounts = await prisma.article.groupBy({ by: ['status'], _count: true });
  const categoryCounts = await prisma.article.groupBy({ by: ['categoryId'], _count: true });
  const categories = await prisma.category.findMany({ select: { id: true, slug: true } });
  
  const total = await prisma.article.count();
  
  const statusMap: Record<string, number> = { ALL: total, PUBLISHED: 0, DRAFT: 0, SCHEDULED: 0 };
  statusCounts.forEach(c => statusMap[c.status] = c._count);
  
  const catSlugMap: Record<string, string> = {};
  categories.forEach(c => catSlugMap[c.id] = c.slug);
  
  const categoryMap: Record<string, number> = { ALL: total };
  categoryCounts.forEach(c => {
    if (c.categoryId) {
      const slug = catSlugMap[c.categoryId];
      if (slug) categoryMap[slug] = c._count;
    }
  });
  
  return { statuses: statusMap, categories: categoryMap };
}

/** Admin listing — any status, newest first, with lightweight fields + filters. */
export async function listAdminArticles(opts?: {
  status?: ContentStatus;
  contentType?: ContentType;
  categorySlug?: string;
  take?: number;
  skip?: number;
  sort?: string;
  order?: "asc" | "desc";
}) {
  const where: Prisma.ArticleWhereInput = {
    ...(opts?.status ? { status: opts.status } : {}),
    ...(opts?.contentType ? { contentType: opts.contentType } : {}),
    ...(opts?.categorySlug ? { category: { slug: opts.categorySlug } } : {}),
  };

  let orderBy: Prisma.ArticleOrderByWithRelationInput = { updatedAt: "desc" };
  if (opts?.sort) {
    const dir = opts.order === "asc" ? "asc" : "desc";
    if (opts.sort === "title") orderBy = { title: dir };
    else if (opts.sort === "status") orderBy = { status: dir };
    else if (opts.sort === "publishedAt") orderBy = { publishedAt: dir };
    else if (opts.sort === "viewCount") orderBy = { viewCount: dir };
    else orderBy = { updatedAt: dir };
  }

  const [items, total] = await Promise.all([
    prisma.article.findMany({
      where,
      select: {
        id: true,
        slug: true,
        title: true,
        contentType: true,
        status: true,
        publishedAt: true,
        scheduledFor: true,
        updatedAt: true,
        viewCount: true,
        byline: { select: { name: true } },
        category: { select: { name: true, slug: true } },
      },
      orderBy,
      take: opts?.take ?? 50,
      skip: opts?.skip ?? 0,
    }),
    prisma.article.count({ where }),
  ]);
  return { items, total };
}

/** Full article for the admin editor (any status). */
export async function getAdminArticle(id: string) {
  const article = await prisma.article.findUnique({
    where: { id },
    include: {
      ArticleToArticleTag: { include: { article_tags: true } },
      review: true,
      byline: true,
      category: true,
    },
  });
  if (!article) return null;
  return { ...article, tags: article.ArticleToArticleTag.map((r) => r.article_tags) };
}

/** A single published article by slug (public detail). Increments view count. */
export const getPublishedArticle = cache(async function getPublishedArticle(slug: string) {
  const article = await prisma.article.findFirst({
    where: { slug, status: "PUBLISHED", publishedAt: { lte: new Date() } },
    include: {
      byline: true,
      category: true,
      ArticleToArticleTag: { include: { article_tags: true } },
      review: true,
    },
  });
  if (!article) return null;
  return { ...article, tags: article.ArticleToArticleTag.map((r) => r.article_tags) };
});
