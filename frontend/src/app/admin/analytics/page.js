import { prisma } from "@/lib/prisma";

export const metadata = { title: "Analytics · Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

function fmtTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function BarChart({ data, height = 160 }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map((d) => d.count), 1);
  const barWidth = 100 / data.length;
  const svgHeight = height;

  return (
    <svg viewBox={`0 0 100 ${svgHeight}`} className="admin-chart" preserveAspectRatio="none">
      {data.map((d, i) => {
        const barH = (d.count / max) * (svgHeight - 20);
        const x = i * barWidth;
        const y = svgHeight - barH;
        return (
          <rect
            key={d.date}
            x={x + 1}
            y={y}
            width={barWidth - 2}
            height={barH}
            fill="var(--accent)"
            opacity={0.85}
            rx={1}
          />
        );
      })}
    </svg>
  );
}

export default async function AdminAnalyticsPage({ searchParams }) {
  const sp = await searchParams;
  const range = ["24h", "7d", "30d"].includes(sp?.range) ? sp.range : "7d";

  let startDate = new Date();
  if (range === "24h") startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
  else if (range === "7d") startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  else if (range === "30d") startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  let total = 0;
  let uniqueVisitors = 0;
  let topPages = [];
  let recent = [];
  let byDay = [];

  try {
    const [totalRes, uniqueRes, topRes, recentRes] = await Promise.all([
      prisma.pageView.count({ where: { createdAt: { gte: startDate } } }),
      prisma.pageView.count({
        where: {
          createdAt: { gte: startDate },
          userId: { not: null },
        },
      }),
      prisma.pageView.groupBy({
        by: ["path"],
        where: { createdAt: { gte: startDate } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),
      prisma.pageView.findMany({
        where: { createdAt: { gte: startDate } },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          path: true,
          userId: true,
          referrer: true,
          createdAt: true,
        },
      }),
    ]);

    total = totalRes;
    uniqueVisitors = uniqueRes;
    topPages = topRes.map((p) => ({
      path: p.path,
      views: p._count.id,
    }));
    recent = recentRes.map((r) => ({
      id: r.id,
      path: r.path,
      userId: r.userId,
      referrer: r.referrer,
      createdAt: r.createdAt,
    }));

    try {
      const raw = await prisma.$queryRaw`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count
        FROM page_views
        WHERE created_at >= ${startDate}
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at) ASC
      `;
      byDay = raw.map((r) => ({
        date: r.date ? new Date(r.date).toISOString().split("T")[0] : "",
        count: parseInt(r.count || 0),
      }));
    } catch {
      byDay = [];
    }
  } catch {
    total = 0;
    uniqueVisitors = 0;
    topPages = [];
    recent = [];
    byDay = [];
  }

  const rangeHref = (r) => {
    const params = new URLSearchParams();
    params.set("range", r);
    return `/admin/analytics?${params.toString()}`;
  };

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Analytics</h1>
          <p className="admin-page-sub">
            Internal page views · {total} total views · {uniqueVisitors} logged-in visits
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {["24h", "7d", "30d"].map((r) => (
            <a
              key={r}
              href={rangeHref(r)}
              className={`admin-chip ${range === r ? "on" : ""}`}
            >
              {r}
            </a>
          ))}
        </div>
      </header>

      <div className="admin-stat-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-label">Total Views</div>
          <div className="admin-stat-value">{total.toLocaleString()}</div>
          <div className="admin-stat-hint">Last {range}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Logged-in Visits</div>
          <div className="admin-stat-value">{uniqueVisitors.toLocaleString()}</div>
          <div className="admin-stat-hint">Users with account</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Unique Pages</div>
          <div className="admin-stat-value">{topPages.length}</div>
          <div className="admin-stat-hint">Top pages tracked</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Avg / Day</div>
          <div className="admin-stat-value">
            {byDay.length > 0 ? Math.round(total / byDay.length) : 0}
          </div>
          <div className="admin-stat-hint">Daily average</div>
        </div>
      </div>

      <div className="admin-panel" style={{ marginBottom: "20px" }}>
        <div className="admin-panel-head">
          <h2>Views per day</h2>
        </div>
        {byDay.length === 0 ? (
          <div className="admin-empty">No views in this range.</div>
        ) : (
          <div style={{ padding: "0 4px" }}>
            <BarChart data={byDay} height={160} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", fontSize: "11px", color: "var(--text3)" }}>
              <span>{byDay[0]?.date}</span>
              <span>{byDay[byDay.length - 1]?.date}</span>
            </div>
          </div>
        )}
      </div>

      <div className="admin-panel" style={{ marginBottom: "20px" }}>
        <div className="admin-panel-head">
          <h2>Top pages</h2>
        </div>
        {topPages.length === 0 ? (
          <div className="admin-empty">No page views yet.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Path</th>
                  <th>Views</th>
                </tr>
              </thead>
              <tbody>
                {topPages.map((p) => (
                  <tr key={p.path}>
                    <td className="cell-strong">{p.path}</td>
                    <td>{p.views.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head">
          <h2>Recent visits</h2>
        </div>
        {recent.length === 0 ? (
          <div className="admin-empty">No visits in this range.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Path</th>
                  <th>User</th>
                  <th>Referrer</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td className="cell-strong">{r.path}</td>
                    <td>{r.userId || "Guest"}</td>
                    <td className="admin-table-sub">{r.referrer || "Direct"}</td>
                    <td>{fmtTime(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
