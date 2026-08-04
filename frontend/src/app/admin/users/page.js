import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/auth";
import UserRowActions from "@/components/admin/UserRowActions";
import UserRowName from "@/components/admin/UserRowName";

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
      readingHistory: true,
      readChapters: true,
      createdAt: true,
      sessions: {
        where: { expiresAt: { gt: new Date() } },
        select: { id: true },
        take: 1,
      },
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
              <th>Name / Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Read Hours</th>
              <th>Chapters Read</th>
              <th>Joined</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <UserRowName user={u} isSelf={u.id === current.id} />
                </td>
                <td>
                  <span className="admin-badge admin-badge-scheduled">{u.role}</span>
                </td>
                <td>
                  {u.banned ? (
                    <span className="admin-badge admin-badge-archived" title={u.bannedReason || ""}>
                      Banned
                    </span>
                  ) : u.sessions.length > 0 ? (
                    <span className="admin-badge admin-badge-published">Online</span>
                  ) : (
                    <span className="admin-badge admin-badge-draft">Offline</span>
                  )}
                </td>
                <td>
                  {u.readChapters ? Math.round(Object.values(u.readChapters).flat().length * 3 / 60) : 0}h
                </td>
                <td>
                  {u.readChapters ? Object.values(u.readChapters).flat().length : 0}
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
