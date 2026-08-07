import { prisma } from "@/lib/prisma";
import TaxonomyManager from "@/components/admin/TaxonomyManager";

export const metadata = { title: "Categories & tags · Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminTaxonomyPage({ searchParams }) {
  const sp = await searchParams;
  const type = sp?.type === "tags" ? "tags" : "categories";
  const sort = ["name", "_count.articles"].includes(sp?.sort) ? sp.sort : "name";
  const order = sp?.order === "asc" ? "asc" : "desc";

  const orderBy = sort.startsWith("_count.")
    ? { [sort.split(".")[1]]: order }
    : { [sort]: order };

  const [categories, tags] = await Promise.all([
    prisma.category.findMany({
      orderBy: type === "categories" ? orderBy : { name: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        _count: { select: { articles: true } },
      },
    }),
    prisma.articleTag.findMany({
      orderBy: type === "tags" ? orderBy : { name: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        _count: { select: { articles: true } },
      },
    }),
  ]);

  const sortHref = (field) => {
    const params = new URLSearchParams();
    params.set("type", type);
    if (sort === field) {
      params.set("sort", field);
      params.set("order", order === "asc" ? "desc" : "asc");
    } else {
      params.set("sort", field);
      params.set("order", "desc");
    }
    const str = params.toString();
    return `/admin/taxonomy?${str}`;
  };

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

      <div className="admin-filter-row">
        <a href={`/admin/taxonomy?type=categories&sort=name&order=asc`} className={`admin-chip ${type === "categories" ? "on" : ""}`}>
          Categories
        </a>
        <a href={`/admin/taxonomy?type=tags&sort=name&order=asc`} className={`admin-chip ${type === "tags" ? "on" : ""}`}>
          Tags
        </a>
      </div>

      <div className="admin-filter-row">
        {["name", "_count.articles"].map((f) => (
          <a
            key={f}
            href={sortHref(f)}
            className={`admin-chip ${sort === f ? "on" : ""}`}
          >
            {f === "name" ? "Name" : "Articles"} {sort === f ? (order === "asc" ? "▲" : "▼") : ""}
          </a>
        ))}
      </div>

      <TaxonomyManager categories={categories} tags={tags} type={type} />
    </div>
  );
}
