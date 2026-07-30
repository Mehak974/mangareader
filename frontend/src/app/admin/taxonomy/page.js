import { prisma } from "@/lib/prisma";
import TaxonomyManager from "@/components/admin/TaxonomyManager";

export const metadata = { title: "Categories & tags · Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminTaxonomyPage() {
  const [categories, tags] = await Promise.all([
    prisma.category.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        _count: { select: { articles: true } },
      },
    }),
    prisma.articleTag.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        _count: { select: { articles: true } },
      },
    }),
  ]);

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Categories &amp; tags</h1>
          <p className="admin-page-sub">
            {categories.length} categor{categories.length === 1 ? "y" : "ies"} · {tags.length} tag
            {tags.length === 1 ? "" : "s"}
          </p>
        </div>
      </header>

      <TaxonomyManager categories={categories} tags={tags} />
    </div>
  );
}
