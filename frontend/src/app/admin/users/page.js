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

function fmtTimeAgo(date) {
  if (!date) return "Never";
  const now = new Date();
  const diff = now - new Date(date);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return fmt(date);
}

function isOnline(lastActiveAt) {
  if (!lastActiveAt) return false;
  return new Date(lastActiveAt) > new Date(Date.now() - 5 * 60 * 1000);
}

const SORT_FIELDS = [
  { key: "displayName", label: "Name" },
  { key: "email", label: "Email" },
  { key: "role", label: "Role" },
  { key: "createdAt", label: "Joined" },
  { key: "lastActiveAt", label: "Last active" },
];

export default async function AdminUsersPage({ searchParams }) {
  const sp = await searchParams;
  const sort = SORT_FIELDS.find(s => s.key === sp?.sort) ? sp.sort : "createdAt";
  const order = sp?.order === "asc" ? "asc" : "desc";

  const current = await getCurrentUser();
  if (!hasRole(current, "ADMIN")) {
    redirect("/admin");
  }

  const orderBy = { [sort]: order };

  const users = await prisma.user.findMany({
    orderBy,
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
      lastActiveAt: true,
      sessions: {
        where: { expiresAt: { gt: new Date() } },
        select: { id: true },
        take: 1,
      },
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
    return `/admin/users?${params.toString()}`;
  };

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
              <th>
                <a href={sortHref("lastActiveAt")} className="admin-sort-link">
                  Last active {sort === "lastActiveAt" ? (order === "asc" ? "▲" : "▼") : ""}
                </a>
              </th>
              <th>
                <a href={sortHref("createdAt")} className="admin-sort-link">
                  Joined {sort === "createdAt" ? (order === "asc" ? "▲" : "▼") : ""}
                </a>
              </th>
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
                  ) : isOnline(u.lastActiveAt) ? (
                    <span className="admin-badge admin-badge-scheduled">Active</span>
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
                <td title={u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleString() : ""}>
                  {fmtTimeAgo(u.lastActiveAt)}
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
