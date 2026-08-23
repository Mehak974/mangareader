import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, hasRole } from "@/lib/auth";
import AdminNav from "@/components/admin/AdminNav";
import "./admin.css";

export const metadata = {
  title: "Admin · MangaReader",
  // Admin is never for search engines.
  robots: { index: false, follow: false },
};

// Server-side guard: runs before any admin UI renders. A non-editor is
// redirected to login; the real role check is a DB session lookup, so it
// cannot be bypassed from the client.
export default async function AdminLayout({ children }) {
  let user = null;
  try {
    user = await getCurrentUser();
  } catch {
    console.error("[admin] getCurrentUser threw in layout");
    redirect("/login?next=/admin");
  }

  if (!hasRole(user, "EDITOR")) {
    console.warn("[admin] access denied", user ? { role: user.role, id: user.id } : "no user");
    redirect("/login?next=/admin");
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/admin" className="admin-logo">
          Manga<span>Admin</span>
        </Link>
        <AdminNav role={user.role} />
        <div className="admin-user">
          <div className="admin-user-avatar">{user.displayName.charAt(0).toUpperCase()}</div>
          <div className="admin-user-info">
            <div className="admin-user-name">{user.displayName}</div>
            <div className="admin-user-role">{user.role}</div>
          </div>
        </div>
      </aside>
      <div className="admin-main">
        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}
