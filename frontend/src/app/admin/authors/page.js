import Link from "next/link";
import { prisma } from "@/lib/prisma";
import AuthorRowActions from "@/components/admin/AuthorRowActions";

export const metadata = { title: "Authors · Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminAuthorsPage() {
  const authors = await prisma.editorialAuthor.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      credentials: true,
      _count: { select: { articles: true } },
    },
  });

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
                <th>Articles</th>
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
