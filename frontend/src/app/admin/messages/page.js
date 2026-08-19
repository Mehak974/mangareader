import { prisma } from "@/lib/prisma";
import MessageRowActions from "@/components/admin/MessageRowActions";

export const metadata = { title: "Contact messages · Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUSES = ["NEW", "IN_PROGRESS", "RESOLVED", "SPAM"];
const TYPES = ["CONTACT", "BUG_REPORT", "FEATURE_REQUEST", "COMPLAINT"];

const SORT_FIELDS = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "type", label: "Type" },
  { key: "status", label: "Status" },
  { key: "createdAt", label: "Received" },
];

function fmt(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function AdminMessagesPage({ searchParams }) {
  const sp = await searchParams;
  const status = STATUSES.includes(sp?.status) ? sp.status : undefined;
  const type = TYPES.includes(sp?.type) ? sp.type : undefined;
  const sort = SORT_FIELDS.find(s => s.key === sp?.sort) ? sp.sort : "createdAt";
  const order = sp?.order === "asc" ? "asc" : "desc";

  const where = {
    ...(status ? { status } : {}),
    ...(type ? { type } : {}),
  };

  const orderBy = { [sort]: order };

  const [items, total] = await Promise.all([
    prisma.contactMessage.findMany({
      where,
      orderBy,
      take: 200,
      select: {
        id: true,
        type: true,
        name: true,
        email: true,
        subject: true,
        message: true,
        status: true,
        replies: true,
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
    if (sort !== "createdAt" || order !== "desc") {
      params.set("sort", sort);
      params.set("order", order);
    }
    const str = params.toString();
    return str ? `/admin/messages?${str}` : "/admin/messages";
  };

  const sortHref = (field) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (type) params.set("type", type);
    if (sort === field) {
      params.set("sort", field);
      params.set("order", order === "asc" ? "desc" : "asc");
    } else {
      params.set("sort", field);
      params.set("order", "desc");
    }
    const str = params.toString();
    return `/admin/messages?${str}`;
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
                <th>
                  <a href={sortHref("createdAt")} className="admin-sort-link">
                    Received {sort === "createdAt" ? (order === "asc" ? "â–²" : "â–¼") : ""}
                  </a>
                </th>
                <th>Replies</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {items.map((m) => {
                const replyCount = Array.isArray(m.replies) ? m.replies.length : 0;
                return (
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
                    {replyCount > 0 ? (
                      <span className="admin-badge admin-badge-published">{replyCount}</span>
                    ) : (
                      <span style={{ color: "var(--text3)" }}>—</span>
                    )}
                  </td>
                  <td>
                    <MessageRowActions id={m.id} status={m.status} message={m} />
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
