import Link from "next/link";
import { prisma } from "@/lib/prisma";
import AuthorRowActions from "@/components/admin/AuthorRowActions";

export const metadata = { title: "Authors · Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const SORT_FIELDS = [
  { key: "name", label: "Name" },
  { key: "_count.articles", label: "Articles" },
];

export default async function AdminAuthorsPage({ searchParams }) {
  const sp = await searchParams;
  const sort = SORT_FIELDS.find(s => s.key === sp?.sort) ? sp.sort : "name";
  const order = sp?.order === "asc" ? "asc" : "desc";

  const orderBy = sort.startsWith("_count.")
    ? { [sort.split(".")[1]]: order }
    : { [sort]: order };

  const authors = await prisma.editorialAuthor.findMany({
    orderBy,
    select: {
      id: true,
      slug: true,
      name: true,
      credentials: true,
      _count: { select: { articles: true } },
    },
  });

  const sortHref = (field) => {
    const params = new URLSearchParams();
    if (sort === field) {
      params.set("sort", field);
      params.set("order", order === "asc" ? "desc" : "asc");
    } else {
      params.set("sort", field);
      params.set("order", "desc");
    }
    const str = params.toString();
    return `/admin/authors?${str}`;
  };

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Authors</h1>
          <p className="admin-page-sub">
            {authors.length} byline person{authors.length === 1 ? "a" : "as"}
          </p>
        </div>
        <Link href="/admin/authors/new" className="admin-btn admin-btn-primary">
          ＋ New author
        </Link>
      </header>

      <div className="admin-filter-row">
        {SORT_FIELDS.map((f) => (
          <Link
            key={f.key}
            href={sortHref(f.key)}
            className={`admin-chip ${sort === f.key ? "on" : ""}`}
          >
            {f.label} {sort === f.key ? (order === "asc" ? "▲" : "▼") : ""}
          </Link>
        ))}
      </div>

      {authors.length === 0 ? (
        <div className="admin-empty">No authors yet. Create your first byline persona.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Credentials</th>
                <th>
                  <a href={sortHref("_count.articles")} className="admin-sort-link">
                    Articles {sort === "_count.articles" ? (order === "asc" ? "▲" : "▼") : ""}
                  </a>
                </th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {authors.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link href={`/admin/authors/${a.id}/edit`} className="admin-table-link">
                      {a.name}
                    </Link>
                  </td>
                  <td>{a.slug}</td>
                  <td className="admin-table-sub">{a.credentials || "—"}</td>
                  <td>{a._count.articles}</td>
                  <td>
                    <AuthorRowActions id={a.id} count={a._count.articles} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
