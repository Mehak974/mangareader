import Link from "next/link";
import { listAdminArticles, getAdminArticleCounts } from "@/lib/editorial";
import AdminArticlesClient from "@/components/admin/AdminArticlesClient";
import AdminCategorySelect from "@/components/admin/AdminCategorySelect";

export const metadata = { title: "Articles · Admin" };
export const dynamic = "force-dynamic";

const SUB_TABS = [
  { label: "Manga", slug: "if-you-like-manga" },
  { label: "Manhwa", slug: "if-you-like-manhwa" },
  { label: "Manhua", slug: "if-you-like-manhua" },
  { label: "Web Comics", slug: "if-you-like-web-comics" },
];

const SORT_FIELDS = [
  { key: "title", label: "Title" },
  { key: "status", label: "Status" },
  { key: "publishedAt", label: "Published" },
  { key: "updatedAt", label: "Updated" },
  { key: "viewCount", label: "Views" },
];

export default async function AdminArticlesPage({ searchParams }) {
  const sp = await searchParams;
  const categorySlug = sp?.category || undefined;
  const status = sp?.status || undefined;
  const page = parseInt(sp?.page || "1", 10);
  const take = 50;
  const skip = (page - 1) * take;
  const sort = SORT_FIELDS.find(s => s.key === sp?.sort) ? sp.sort : "updatedAt";
  const order = sp?.order === "asc" ? "asc" : "desc";

  const counts = await getAdminArticleCounts();
  const { items, total } = await listAdminArticles({ categorySlug, status, take, skip, sort, order });
  const totalPages = Math.ceil(total / take);

  const STATUS_TABS = [
    { label: `All (${counts.statuses.ALL || 0})`, value: "" },
    { label: `Published (${counts.statuses.PUBLISHED || 0})`, value: "PUBLISHED" },
    { label: `Draft (${counts.statuses.DRAFT || 0})`, value: "DRAFT" },
    { label: `Scheduled (${counts.statuses.SCHEDULED || 0})`, value: "SCHEDULED" },
  ];

  const TABS = [
    { label: `All Blogs`, slug: "" },
    { label: `Beginners guides (${counts.categories["beginners-guides"] || 0})`, slug: "beginners-guides" },
    { label: `Genre Guide (${counts.categories["genre-guide"] || 0})`, slug: "genre-guide" },
    { label: `Story Type Guide (${counts.categories["story-type-guide"] || 0})`, slug: "story-type-guide" },
    { label: `Publishing & Industry Guide (${counts.categories["publishing-industry-guide"] || 0})`, slug: "publishing-industry-guide" },
    { label: `Bonus Blogs (${counts.categories["bonus-blogs"] || 0})`, slug: "bonus-blogs" },
    { label: `Creator guide (${counts.categories["creator-guide"] || 0})`, slug: "creator-guide" },
    { label: `Reading guides (${counts.categories["reading-guides"] || 0})`, slug: "reading-guides" },
    { label: `If you like series (${counts.categories["if-you-like"] || 0})`, slug: "if-you-like" },
    { label: `Ranking (${counts.categories["ranking"] || 0})`, slug: "ranking" },
  ];

  const getStatusHref = (newStatus) => {
    const params = new URLSearchParams();
    if (categorySlug) params.set("category", categorySlug);
    if (newStatus) params.set("status", newStatus);
    if (sort !== "updatedAt" || order !== "desc") {
      params.set("sort", sort);
      params.set("order", order);
    }
    const qs = params.toString();
    return `/admin/articles${qs ? `?${qs}` : ""}`;
  };

  const getCategoryHref = (newCategory) => {
    const params = new URLSearchParams();
    if (newCategory) params.set("category", newCategory);
    if (status) params.set("status", status);
    if (sort !== "updatedAt" || order !== "desc") {
      params.set("sort", sort);
      params.set("order", order);
    }
    const qs = params.toString();
    return `/admin/articles${qs ? `?${qs}` : ""}`;
  };

  const getSortHref = (field) => {
    const params = new URLSearchParams();
    if (categorySlug) params.set("category", categorySlug);
    if (status) params.set("status", status);
    if (page > 1) params.set("page", page);
    if (sort === field) {
      params.set("sort", field);
      params.set("order", order === "asc" ? "desc" : "asc");
    } else {
      params.set("sort", field);
      params.set("order", "desc");
    }
    const qs = params.toString();
    return `/admin/articles${qs ? `?${qs}` : ""}`;
  };

  const getPageHref = (newPage) => {
    const params = new URLSearchParams();
    if (categorySlug) params.set("category", categorySlug);
    if (status) params.set("status", status);
    if (sort !== "updatedAt" || order !== "desc") {
      params.set("sort", sort);
      params.set("order", order);
    }
    if (newPage > 1) params.set("page", newPage);
    const qs = params.toString();
    return `/admin/articles${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>Articles</h1>
          <p className="admin-page-sub">{total} total matching filters</p>
        </div>
        <Link href="/admin/articles/new" className="admin-btn admin-btn-primary">
          ＋ New article
        </Link>
      </div>

      <div className="admin-filter-row" style={{ flexWrap: "wrap", marginBottom: "15px" }}>
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.value || "all"}
            href={getStatusHref(tab.value)}
            className={`admin-chip ${(status || "") === tab.value ? "on" : ""}`}
            style={{ fontWeight: "bold" }}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <AdminCategorySelect 
        tabs={TABS} 
        currentCategory={categorySlug} 
        currentStatus={status} 
      />
      
      {categorySlug === "if-you-like" && (
        <div className="admin-filter-row" style={{ marginTop: "-10px", marginBottom: "20px" }}>
          {SUB_TABS.map((sub) => (
            <Link
              key={sub.slug}
              href={getCategoryHref(sub.slug)}
              className={`admin-chip`}
              style={{ padding: "4px 10px", fontSize: "12px" }}
            >
              ↳ {sub.label}
            </Link>
          ))}
        </div>
      )}
      
      {SUB_TABS.some(s => s.slug === categorySlug) && (
        <div className="admin-filter-row" style={{ marginTop: "-10px", marginBottom: "20px" }}>
          <Link href={getCategoryHref("if-you-like")} className="admin-chip">
            ← Back to If you like series
          </Link>
          {SUB_TABS.map((sub) => (
            <Link
              key={sub.slug}
              href={getCategoryHref(sub.slug)}
              className={`admin-chip ${(categorySlug || "") === sub.slug ? "on" : ""}`}
              style={{ padding: "4px 10px", fontSize: "12px" }}
            >
              {sub.label}
            </Link>
          ))}
        </div>
      )}

      <div className="admin-filter-row">
        {SORT_FIELDS.map((f) => (
          <Link
            key={f.key}
            href={getSortHref(f.key)}
            className={`admin-chip ${sort === f.key ? "on" : ""}`}
          >
            {f.label} {sort === f.key ? (order === "asc" ? "▲" : "▼") : ""}
          </Link>
        ))}
      </div>

      <AdminArticlesClient items={items} />

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "20px", paddingTop: "20px", borderTop: "1px solid var(--border)" }}>
          {page > 1 ? (
            <Link href={getPageHref(page - 1)} className="admin-btn">
              ← Previous
            </Link>
          ) : (
            <div style={{ width: "100px" }} />
          )}
          
          <div style={{ fontSize: "14px", color: "var(--text2)" }}>
            Page {page} of {totalPages}
          </div>
          
          {page < totalPages ? (
            <Link href={getPageHref(page + 1)} className="admin-btn">
              Next →
            </Link>
          ) : (
            <div style={{ width: "100px" }} />
          )}
        </div>
      )}
    </div>
  );
}
