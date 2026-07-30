import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminArticle } from "@/lib/editorial";
import ArticleEditor from "@/components/admin/ArticleEditor";

export const metadata = { title: "Edit article · Admin", robots: { index: false } };

// Edit screen. Loads the article plus category/author options.
export default async function EditArticlePage({ params }) {
  const { id } = await params;
  const [article, categories, authors] = await Promise.all([
    getAdminArticle(id),
    prisma.category.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.editorialAuthor.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  if (!article) notFound();

  // Shape the DB record into the flat form the editor expects.
  const initial = {
    id: article.id,
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt ?? "",
    body: article.body,
    coverImage: article.coverImage ?? "",
    contentType: article.contentType,
    status: article.status,
    bylineId: article.bylineId ?? "",
    categoryId: article.categoryId ?? "",
    tagSlugs: article.tags.map((t) => t.slug),
    scheduledFor: article.scheduledFor ? article.scheduledFor.toISOString().slice(0, 16) : "",
    seoTitle: article.seoTitle ?? "",
    seoDescription: article.seoDescription ?? "",
    canonicalUrl: article.canonicalUrl ?? "",
    ogImage: article.ogImage ?? "",
    relatedMangaIds: article.relatedMangaIds ?? [],
    review: article.review
      ? {
          mangaId: article.review.mangaId ?? "",
          storyScore: article.review.storyScore,
          charactersScore: article.review.charactersScore,
          artworkScore: article.review.artworkScore,
          worldScore: article.review.worldScore,
          pacingScore: article.review.pacingScore,
          overallScore: article.review.overallScore,
          strengths: article.review.strengths ?? [],
          weaknesses: article.review.weaknesses ?? [],
          verdict: article.review.verdict ?? "",
        }
      : null,
  };

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <h1>Edit article</h1>
        <p>{article.title}</p>
      </header>
      <ArticleEditor initial={initial} categories={categories} authors={authors} />
    </div>
  );
}
