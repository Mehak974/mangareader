import { prisma } from "@/lib/prisma";
import MessageRowActions from "@/components/admin/MessageRowActions";

export const metadata = { title: "Contact messages · Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUSES = ["NEW", "IN_PROGRESS", "RESOLVED", "SPAM"];
const TYPES = ["CONTACT", "BUG_REPORT", "FEATURE_REQUEST", "COMPLAINT"];

function fmt(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function AdminMessagesPage({ searchParams }) {
  const sp = await searchParams;
  const status = STATUSES.includes(sp?.status) ? sp.status : undefined;
  const type = TYPES.includes(sp?.type) ? sp.type : undefined;

  const where = {
    ...(status ? { status } : {}),
    ...(type ? { type } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.contactMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        type: true,
        name: true,
        email: true,
        subject: true,
        message: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.contactMessage.count({ where }),
  ]);

  const qs = (patch) => {
    const params = new URLSearchParams();
    const s = patch.status ?? status;
    const t = patch.type ?? type;
    if (s) params.set("status", s);
    if (t) params.set("type", t);
    const str = params.toString();
    return str ? `/admin/messages?${str}` : "/admin/messages";
  };

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Contact messages</h1>
          <p className="admin-page-sub">{total} message{total === 1 ? "" : "s"}</p>
        </div>
      </header>

      <div className="admin-filter-row">
        <a href={qs({ status: "" })} className={`admin-chip ${!status ? "on" : ""}`}>All statuses</a>
        {STATUSES.map((s) => (
          <a key={s} href={qs({ status: s })} className={`admin-chip ${status === s ? "on" : ""}`}>
            {s.replace("_", " ")}
          </a>
        ))}
      </div>
      <div className="admin-filter-row">
        <a href={qs({ type: "" })} className={`admin-chip ${!type ? "on" : ""}`}>All types</a>
        {TYPES.map((t) => (
          <a key={t} href={qs({ type: t })} className={`admin-chip ${type === t ? "on" : ""}`}>
            {t.replace("_", " ")}
          </a>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="admin-empty">No messages match this filter.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>From</th>
                <th>Type</th>
                <th>Subject / message</th>
                <th>Status</th>
                <th>Received</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div className="cell-strong">{m.name}</div>
                    <div className="admin-table-sub">{m.email}</div>
                  </td>
                  <td>{m.type.replace("_", " ")}</td>
                  <td>
                    {m.subject && <div className="cell-strong">{m.subject}</div>}
                    <div className="admin-table-sub admin-clamp">{m.message}</div>
                  </td>
                  <td>
                    <span className={`admin-badge admin-badge-${m.status.toLowerCase()}`}>
                      {m.status.replace("_", " ")}
                    </span>
                  </td>
                  <td>{fmt(m.createdAt)}</td>
                  <td>
                    <MessageRowActions id={m.id} status={m.status} message={m} />
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
