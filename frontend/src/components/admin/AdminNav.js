"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Nav groups. `role` gates the developer/security sections to admins only.
const NAV = [
  {
    label: "Overview",
    items: [{ href: "/admin", label: "Dashboard", icon: "▣" }],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/articles", label: "Blogs", icon: "✎" },
      { href: "/admin/taxonomy", label: "Taxonomy", icon: "🏷" },
      { href: "/admin/authors", label: "Authors", icon: "👥" },
    ],
  },
  {
    label: "Community",
    items: [
      { href: "/admin/users", label: "Users", icon: "👤" },
      { href: "/admin/messages", label: "Messages", icon: "✉" },
      { href: "/admin/newsletter", label: "Newsletter", icon: "📫" },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/admin/analytics", label: "Analytics", icon: "📊" },
    ],
  },
  {
    label: "Security",
    adminOnly: true,
    items: [
      { href: "/admin/audit", label: "Audit Logs", icon: "🛡" },
    ],
  },
];

export default function AdminNav({ role }) {
  const pathname = usePathname();
  const isAdmin = role === "ADMIN";

  return (
    <nav className="admin-nav" aria-label="Admin sections">
      {NAV.filter((g) => !g.adminOnly || isAdmin).map((group) => (
        <div key={group.label} className="admin-nav-group">
          <div className="admin-nav-group-label">{group.label}</div>
          {group.items.map((item) => {
            // Exact match for the dashboard root; prefix match elsewhere so
            // nested pages (e.g. /admin/articles/new) keep the parent active.
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname === item.href ||
                  (item.href !== "/admin/articles/new" && pathname.startsWith(item.href + "/"));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`admin-nav-link ${active ? "active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <span className="admin-nav-icon" aria-hidden="true">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
