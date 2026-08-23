import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard · Admin",
  robots: { index: false, follow: false },
};

// Real counts from the database — no mock statistics.
async function getStats() {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    newUsersWeek,
    publishedArticles,
    draftArticles,
    totalReviews,
    unreadMessages,
    newsletterSubs,
    recentArticles,
    recentMessages,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.article.count({ where: { status: "PUBLISHED" } }),
    prisma.article.count({ where: { status: "DRAFT" } }),
    prisma.review.count(),
    prisma.contactMessage.count({ where: { status: "NEW" } }),
    prisma.newsletterSubscriber.count({ where: { confirmed: true } }),
    prisma.article.findMany({
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, title: true, status: true, updatedAt: true, contentType: true },
    }),
    prisma.contactMessage.findMany({
      where: { status: "NEW" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, subject: true, createdAt: true },
    }),
  ]);

  return {
    totalUsers,
    newUsersWeek,
    publishedArticles,
    draftArticles,
    totalReviews,
    unreadMessages,
    newsletterSubs,
    recentArticles,
    recentMessages,
    dayAgo,
  };
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function AdminDashboard() {
  let user = null;
  try {
    user = await getCurrentUser();
  } catch {
    redirect("/admin");
  }
  if (!hasRole(user, "EDITOR")) {
    redirect("/admin");
  }

  let stats = null;
  try {
    stats = await getStats();
  } catch {
    stats = {
      totalUsers: 0,
      newUsersWeek: 0,
      publishedArticles: 0,
      draftArticles: 0,
      totalReviews: 0,
      unreadMessages: 0,
      newsletterSubs: 0,
      recentArticles: [],
      recentMessages: [],
      dayAgo: new Date(Date.now() - 24 * 60 * 60 * 1000),
    };
  }

  const cards = [
    { label: "Total Users", value: stats.totalUsers, sub: `+${stats.newUsersWeek} this week`, accent: "var(--accent)" },
    { label: "Published Articles", value: stats.publishedArticles, sub: `${stats.draftArticles} drafts`, accent: "var(--blue)" },
    { label: "Reviews", value: stats.totalReviews, sub: "editorial reviews", accent: "var(--gold)" },
    { label: "Unread Messages", value: stats.unreadMessages, sub: "awaiting reply", accent: "var(--red)" },
    { label: "Newsletter", value: stats.newsletterSubs, sub: "confirmed subscribers", accent: "var(--accent2)" },
  ];

  return (
    <div>
      <header className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Dashboard</h1>
          <p className="admin-page-sub">Welcome back, {user.displayName}. Here's what's happening.</p>
        </div>
      </header>

      <div className="admin-stat-grid">
        {cards.map((c) => (
          <div key={c.label} className="admin-stat-card">
            <div className="admin-stat-accent" style={{ background: c.accent }} />
            <div className="admin-stat-value">{c.value.toLocaleString()}</div>
            <div className="admin-stat-label">{c.label}</div>
            <div className="admin-stat-sub">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="admin-panel-grid">
        <section className="admin-panel">
          <div className="admin-panel-head">
            <h2>Recent Content</h2>
            <a href="/admin/articles">View all →</a>
          </div>
          {stats.recentArticles.length ? (
            <ul className="admin-list">
              {stats.recentArticles.map((a) => (
                <li key={a.id} className="admin-list-row">
                  <a href={`/admin/articles/${a.id}/edit`} className="admin-list-main">{a.title}</a>
                  <span className={`admin-badge admin-badge-${a.status.toLowerCase()}`}>{a.status}</span>
                  <span className="admin-list-meta">{fmtDate(a.updatedAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-empty">No articles yet. <a href="/admin/articles/new">Write your first →</a></p>
          )}
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head">
            <h2>Unread Messages</h2>
            <a href="/admin/messages">View all →</a>
          </div>
          {stats.recentMessages.length ? (
            <ul className="admin-list">
              {stats.recentMessages.map((m) => (
                <li key={m.id} className="admin-list-row">
                  <span className="admin-list-main">{m.subject}</span>
                  <span className="admin-list-meta">{m.name} · {fmtDate(m.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-empty">No unread messages.</p>
          )}
        </section>
      </div>
    </div>
  );
}
