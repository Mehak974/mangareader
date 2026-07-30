import { prisma } from "@/lib/prisma";
import NewsletterRowActions from "@/components/admin/NewsletterRowActions";

export const metadata = { title: "Newsletter · Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

function fmt(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function AdminNewsletterPage() {
  const [items, total, confirmed] = await Promise.all([
    prisma.newsletterSubscriber.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { id: true, email: true, confirmed: true, confirmedAt: true, createdAt: true },
    }),
    prisma.newsletterSubscriber.count(),
    prisma.newsletterSubscriber.count({ where: { confirmed: true } }),
  ]);

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

      {items.length === 0 ? (
        <div className="admin-empty">No subscribers yet.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Status</th>
                <th>Subscribed</th>
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
