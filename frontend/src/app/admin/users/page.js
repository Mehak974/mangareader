import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/auth";
import UserRowActions from "@/components/admin/UserRowActions";

export const metadata = { title: "Users · Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

function fmt(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ADMIN-only page. The shared layout only guards EDITOR, so re-check here and
// redirect an editor who lacks the admin role.
export default async function AdminUsersPage() {
  const current = await getCurrentUser();
  if (!hasRole(current, "ADMIN")) {
    redirect("/admin");
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      banned: true,
      bannedReason: true,
      createdAt: true,
    },
  });

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Users</h1>
          <p className="admin-page-sub">
            {users.length} account{users.length === 1 ? "" : "s"}
          </p>
        </div>
      </header>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Status</th>
              <th>Joined</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <div className="cell-strong">
                    {u.displayName}
                    {u.id === current.id && <span className="admin-table-sub"> (you)</span>}
                  </div>
                  <div className="admin-table-sub">{u.email}</div>
                </td>
                <td>
                  <span className="admin-badge admin-badge-scheduled">{u.role}</span>
                </td>
                <td>
                  {u.banned ? (
                    <span className="admin-badge admin-badge-archived" title={u.bannedReason || ""}>
                      Banned
                    </span>
                  ) : (
                    <span className="admin-badge admin-badge-published">Active</span>
                  )}
                </td>
                <td>{fmt(u.createdAt)}</td>
                <td>
                  <UserRowActions
                    id={u.id}
                    role={u.role}
                    banned={u.banned}
                    isSelf={u.id === current.id}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
