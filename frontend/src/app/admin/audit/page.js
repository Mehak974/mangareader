import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/auth";

export const metadata = { title: "Audit log · Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const SORT_FIELDS = [
  { key: "action", label: "Action" },
  { key: "entity", label: "Entity" },
  { key: "createdAt", label: "When" },
];

function fmt(date) {
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function AdminAuditPage({ searchParams }) {
  const current = await getCurrentUser();
  if (!hasRole(current, "ADMIN")) {
    redirect("/admin");
  }

  const sp = await searchParams;
  const page = Math.max(1, Number(sp?.page) || 1);
  const skip = (page - 1) * PAGE_SIZE;
  const sort = SORT_FIELDS.find(s => s.key === sp?.sort) ? sp.sort : "createdAt";
  const order = sp?.order === "asc" ? "asc" : "desc";

  const orderBy = { [sort]: order };

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy,
      take: PAGE_SIZE,
      skip,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        ip: true,
        createdAt: true,
        user: { select: { displayName: true, email: true } },
      },
    }),
    prisma.auditLog.count(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const sortHref = (field) => {
    const params = new URLSearchParams();
    if (page > 1) params.set("page", page);
    if (sort === field) {
      params.set("sort", field);
      params.set("order", order === "asc" ? "desc" : "asc");
    } else {
      params.set("sort", field);
      params.set("order", "desc");
    }
    const str = params.toString();
    return `/admin/audit?${str}`;
  };

  const getPageHref = (newPage) => {
    const params = new URLSearchParams();
    if (sort !== "createdAt" || order !== "desc") {
      params.set("sort", sort);
      params.set("order", order);
    }
    if (newPage > 1) params.set("page", newPage);
    const str = params.toString();
    return `/admin/audit?${str}`;
  };

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Audit log</h1>
          <p className="admin-page-sub">
            {total} event{total === 1 ? "" : "s"} · page {page} of {totalPages}
          </p>
        </div>
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

      {entries.length === 0 ? (
        <div className="admin-empty">No audit events recorded yet.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Entity</th>
                <th>User</th>
                <th>IP</th>
                <th>
                  <a href={sortHref("createdAt")} className="admin-sort-link">
                    When {sort === "createdAt" ? (order === "asc" ? "▲" : "▼") : ""}
                  </a>
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="cell-strong">{e.action}</td>
                  <td>
                    {e.entity || "—"}
                    {e.entityId && <div className="admin-table-sub">{e.entityId}</div>}
                  </td>
                  <td>
                    {e.user ? (
                      <>
                        <div>{e.user.displayName}</div>
                        <div className="admin-table-sub">{e.user.email}</div>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="admin-table-sub">{e.ip || "—"}</td>
                  <td>{fmt(e.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="admin-pagination">
          {page > 1 ? (
            <Link href={getPageHref(page - 1)} className="admin-btn">
              ← Previous
            </Link>
          ) : (
            <span className="admin-btn admin-btn-disabled" aria-disabled="true">
              ← Previous
            </span>
          )}
          <span className="admin-page-sub">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={getPageHref(page + 1)} className="admin-btn">
              Next →
            </Link>
          ) : (
            <span className="admin-btn admin-btn-disabled" aria-disabled="true">
              Next →
            </span>
          )}
        </div>
      )}
    </div>
  );
}
