import { prisma } from "@/lib/prisma";
import ArticleEditor from "@/components/admin/ArticleEditor";

export const metadata = { title: "New article · Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

// New-article screen. Loads categories + authors for the select inputs.
export default async function NewArticlePage() {
  const [categories, authors] = await Promise.all([
    prisma.category.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.editorialAuthor.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <h1>New article</h1>
        <p>Draft, schedule, or publish editorial content.</p>
      </header>
      <ArticleEditor initial={null} categories={categories} authors={authors} />
    </div>
  );
}
