import { prisma } from "@/lib/prisma";
import NewsletterRowActions from "@/components/admin/NewsletterRowActions";

export const metadata = { title: "Newsletter · Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const SORT_FIELDS = [
  { key: "email", label: "Email" },
  { key: "confirmed", label: "Status" },
  { key: "createdAt", label: "Subscribed" },
];

function fmt(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function AdminNewsletterPage({ searchParams }) {
  const sp = await searchParams;
  const sort = SORT_FIELDS.find(s => s.key === sp?.sort) ? sp.sort : "createdAt";
  const order = sp?.order === "asc" ? "asc" : "desc";

  const orderBy = { [sort]: order };

  const [items, total, confirmed] = await Promise.all([
    prisma.newsletterSubscriber.findMany({
      orderBy,
      take: 500,
      select: { id: true, email: true, confirmed: true, confirmedAt: true, createdAt: true },
    }),
    prisma.newsletterSubscriber.count(),
    prisma.newsletterSubscriber.count({ where: { confirmed: true } }),
  ]);

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
    return `/admin/newsletter?${str}`;
  };

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Newsletter</h1>
          <p className="admin-page-sub">
            {total} subscriber{total === 1 ? "" : "s"} · {confirmed} confirmed
          </p>
        </div>
        <a href="/api/admin/newsletter/export" className="admin-btn admin-btn-primary" download>
          Export CSV
        </a>
      </header>

      <div className="admin-filter-row">
        {SORT_FIELDS.map((f) => (
          <a
            key={f.key}
            href={sortHref(f.key)}
            className={`admin-chip ${sort === f.key ? "on" : ""}`}
          >
            {f.label} {sort === f.key ? (order === "asc" ? "▲" : "▼") : ""}
          </a>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="admin-empty">No subscribers yet.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Status</th>
                <th>
                  <a href={sortHref("createdAt")} className="admin-sort-link">
                    Subscribed {sort === "createdAt" ? (order === "asc" ? "▲" : "▼") : ""}
                  </a>
                </th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id}>
                  <td className="cell-strong">{s.email}</td>
                  <td>
                    <span className={`admin-badge admin-badge-${s.confirmed ? "published" : "draft"}`}>
                      {s.confirmed ? "Confirmed" : "Pending"}
                    </span>
                  </td>
                  <td>{fmt(s.createdAt)}</td>
                  <td>
                    <NewsletterRowActions id={s.id} email={s.email} />
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
