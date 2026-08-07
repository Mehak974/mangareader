import { prisma } from "@/lib/prisma";

export const metadata = { title: "Analytics · Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtNum(n) {
  if (n === undefined || n === null) return "0";
  return Number(n).toLocaleString();
}

function TrafficChart({ data }) {
  if (!data?.length) return null;
  const maxViews = Math.max(...data.map((d) => d.views), 1);
  const maxVisitors = Math.max(...data.map((d) => d.visitors), 1);
  const max = Math.max(maxViews, maxVisitors);
  const padding = 4;
  const width = 100;
  const height = 180;
  const innerH = height - padding * 2;

  const points = data.map((d, i) => {
    const x = data.length === 1 ? width / 2 : (i / (data.length - 1)) * width;
    const y = height - padding - (d.views / max) * innerH;
    return { x, y, views: d.views, visitors: d.visitors, date: d.date };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const areaD = pathD + ` L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  const visitorPoints = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${height - padding - (p.visitors / max) * innerH}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="admin-chart" preserveAspectRatio="none">
      <path d={areaD} fill="var(--accent)" opacity="0.15" />
      <path d={pathD} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <path d={visitorPoints} fill="none" stroke="var(--blue)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={height - padding - (p.visitors / max) * innerH} r="0.8" fill="var(--blue)" />
      ))}
    </svg>
  );
}

function BreakdownTable({ title, items, renderRow, empty = "No data" }) {
  return (
    <div className="admin-panel">
      <div className="admin-panel-head">
        <h2>{title}</h2>
      </div>
      {items.length === 0 ? (
        <div className="admin-empty">{empty}</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Label</th>
                <th style={{ textAlign: "right" }}>Visits</th>
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 10).map((item, idx) => (
                <tr key={idx}>{renderRow(item)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default async function AdminAnalyticsPage({ searchParams }) {
  const sp = await searchParams;

  let startDate = new Date();
  let endDate = new Date();
  let rangeLabel = "Last 7 days";
  let isCustom = false;

  if (sp?.start && sp?.end) {
    startDate = new Date(sp.start);
    endDate = new Date(sp.end);
    endDate.setHours(23, 59, 59, 999);
    isCustom = true;
    rangeLabel = `${fmtDate(startDate)} — ${fmtDate(endDate)}`;
  } else {
    const range = ["24h", "7d", "30d"].includes(sp?.range) ? sp.range : "7d";
    if (range === "24h") {
      startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      rangeLabel = "Last 24 hours";
    } else if (range === "30d") {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      rangeLabel = "Last 30 days";
    } else {
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      rangeLabel = "Last 7 days";
    }
  }

  const adminFilter = `path NOT LIKE '/admin%' AND path NOT LIKE '/api/%'`;

  let visitors = 0;
  let pageViews = 0;
  let bounceRate = 0;
  let chartData = [];
  let topPages = [];
  let topReferrers = [];
  let topDevices = [];
  let topBrowsers = [];
  let topOs = [];
  let pwaInstalls = 0;
  let returnedVisitors = 0;
  let returnedVisitorPages = 0;
  let returnedLoggedIn = 0;
  let returnedLoggedInPages = 0;

  try {
    const [
      visitorsRes,
      pageViewsRes,
      bounceRes,
      chartRes,
      pagesRes,
      referrersRes,
      devicesRes,
      browsersRes,
      osRes,
      pwaRes,
      returnedRes,
      returnedLoggedInRes,
    ] = await Promise.all([
      prisma.$queryRaw`
        SELECT COUNT(DISTINCT COALESCE(user_id, visitor_id)) as count
        FROM page_views
        WHERE created_at >= ${startDate} AND created_at <= ${endDate} AND ${adminFilter}
      `,
      prisma.$queryRaw`
        SELECT COUNT(*) as count
        FROM page_views
        WHERE created_at >= ${startDate} AND created_at <= ${endDate} AND ${adminFilter}
      `,
      prisma.$queryRaw`
        SELECT 
          COUNT(*) FILTER (WHERE pv_count = 1) * 100.0 / NULLIF(COUNT(*), 0) as rate
        FROM (
          SELECT COALESCE(user_id, visitor_id) as visitor, COUNT(*) as pv_count
          FROM page_views
          WHERE created_at >= ${startDate} AND created_at <= ${endDate} AND ${adminFilter}
          GROUP BY COALESCE(user_id, visitor_id)
        ) t
      `,
      prisma.$queryRaw`
        SELECT 
          DATE(created_at) as date,
          COUNT(DISTINCT COALESCE(user_id, visitor_id)) as visitors,
          COUNT(*) as views
        FROM page_views
        WHERE created_at >= ${startDate} AND created_at <= ${endDate} AND ${adminFilter}
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at) ASC
      `,
      prisma.$queryRaw`
        SELECT path, COUNT(*) as views
        FROM page_views
        WHERE created_at >= ${startDate} AND created_at <= ${endDate} AND ${adminFilter}
        GROUP BY path
        ORDER BY views DESC
        LIMIT 10
      `,
      prisma.$queryRaw`
        SELECT referrer, COUNT(*) as visits
        FROM page_views
        WHERE created_at >= ${startDate} AND created_at <= ${endDate} AND ${adminFilter} AND referrer IS NOT NULL AND referrer != ''
        GROUP BY referrer
        ORDER BY visits DESC
        LIMIT 10
      `,
      prisma.$queryRaw`
        SELECT device, COUNT(*) as visits
        FROM page_views
        WHERE created_at >= ${startDate} AND created_at <= ${endDate} AND ${adminFilter} AND device IS NOT NULL
        GROUP BY device
        ORDER BY visits DESC
        LIMIT 10
      `,
      prisma.$queryRaw`
        SELECT browser, COUNT(*) as visits
        FROM page_views
        WHERE created_at >= ${startDate} AND created_at <= ${endDate} AND ${adminFilter} AND browser IS NOT NULL
        GROUP BY browser
        ORDER BY visits DESC
        LIMIT 10
      `,
      prisma.$queryRaw`
        SELECT os, COUNT(*) as visits
        FROM page_views
        WHERE created_at >= ${startDate} AND created_at <= ${endDate} AND ${adminFilter} AND os IS NOT NULL
        GROUP BY os
        ORDER BY visits DESC
        LIMIT 10
      `,
      prisma.$queryRaw`
        SELECT COUNT(*) as installs
        FROM page_views
        WHERE created_at >= ${startDate} AND created_at <= ${endDate} AND ${adminFilter} AND is_pwa = true
      `,
      prisma.$queryRaw`
        WITH visitor_counts AS (
          SELECT COALESCE(user_id, visitor_id) as visitor, COUNT(*) as pv_count
          FROM page_views
          WHERE created_at >= ${startDate} AND created_at <= ${endDate} AND ${adminFilter}
          GROUP BY COALESCE(user_id, visitor_id)
        )
        SELECT COUNT(*) as returned, SUM(pv_count) as pages
        FROM visitor_counts
        WHERE pv_count > 1
      `,
      prisma.$queryRaw`
        WITH visitor_counts AS (
          SELECT user_id as visitor, COUNT(*) as pv_count
          FROM page_views
          WHERE created_at >= ${startDate} AND created_at <= ${endDate} AND ${adminFilter} AND user_id IS NOT NULL
          GROUP BY user_id
        )
        SELECT COUNT(*) as returned, SUM(pv_count) as pages
        FROM visitor_counts
        WHERE pv_count > 1
      `,
    ]);

    visitors = parseInt(visitorsRes[0]?.count || 0);
    pageViews = parseInt(pageViewsRes[0]?.count || 0);
    bounceRate = parseFloat(bounceRes[0]?.rate || 0).toFixed(1);
    chartData = chartRes.map((r) => ({
      date: r.date ? new Date(r.date).toISOString().split("T")[0] : "",
      visitors: parseInt(r.visitors || 0),
      views: parseInt(r.views || 0),
    }));
    topPages = pagesRes;
    topReferrers = referrersRes;
    topDevices = devicesRes;
    topBrowsers = browsersRes;
    topOs = osRes;
    pwaInstalls = parseInt(pwaRes[0]?.installs || 0);
    returnedVisitors = parseInt(returnedRes[0]?.returned || 0);
    returnedVisitorPages = parseInt(returnedRes[0]?.pages || 0);
    returnedLoggedIn = parseInt(returnedLoggedInRes[0]?.returned || 0);
    returnedLoggedInPages = parseInt(returnedLoggedInRes[0]?.pages || 0);
  } catch {
    visitors = 0;
    pageViews = 0;
    bounceRate = "0.0";
    chartData = [];
    topPages = [];
    topReferrers = [];
    topDevices = [];
    topBrowsers = [];
    topOs = [];
    pwaInstalls = 0;
    returnedVisitors = 0;
    returnedVisitorPages = 0;
    returnedLoggedIn = 0;
    returnedLoggedInPages = 0;
  }

  const chip = (label, active, href) => (
    <a href={href} className={`admin-chip ${active ? "on" : ""}`}>
      {label}
    </a>
  );

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Analytics</h1>
          <p className="admin-page-sub">{rangeLabel}</p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {chip("24h", !isCustom && sp?.range === "24h", "/admin/analytics?range=24h")}
          {chip("7 days", !isCustom && (!sp?.range || sp?.range === "7d"), "/admin/analytics?range=7d")}
          {chip("30 days", !isCustom && sp?.range === "30d", "/admin/analytics?range=30d")}
          {chip(
            "Custom",
            isCustom,
            `/admin/analytics?start=${sp?.start || ""}&end=${sp?.end || ""}`
          )}
        </div>
      </header>

      {isCustom && (
        <form className="admin-inline-form" style={{ marginBottom: 16 }} method="get" action="/admin/analytics">
          <input type="date" name="start" defaultValue={sp?.start || ""} className="admin-input" style={{ width: "auto" }} required />
          <span style={{ color: "var(--text2)" }}>to</span>
          <input type="date" name="end" defaultValue={sp?.end || ""} className="admin-input" style={{ width: "auto" }} required />
          <button type="submit" className="admin-btn admin-btn-primary">Apply</button>
          <a href="/admin/analytics" className="admin-btn">Reset</a>
        </form>
      )}

      <div className="admin-stat-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-label">Visitors</div>
          <div className="admin-stat-value">{fmtNum(visitors)}</div>
          <div className="admin-stat-hint">Unique visits</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Page Views</div>
          <div className="admin-stat-value">{fmtNum(pageViews)}</div>
          <div className="admin-stat-hint">Total hits</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Bounce Rate</div>
          <div className="admin-stat-value">{bounceRate}%</div>
          <div className="admin-stat-hint">Single-page visits</div>
        </div>
      </div>

      <div className="admin-panel" style={{ marginBottom: "20px" }}>
        <div className="admin-panel-head">
          <h2>Traffic</h2>
        </div>
        {chartData.length === 0 ? (
          <div className="admin-empty">No data for this range.</div>
        ) : (
          <div style={{ padding: "0 4px" }}>
            <TrafficChart data={chartData} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", fontSize: "11px", color: "var(--text3)" }}>
              <span>{chartData[0]?.date}</span>
              <span style={{ display: "flex", gap: "16px" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "10px", height: "2px", background: "var(--accent)", display: "inline-block" }} />
                  Page views
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "10px", height: "2px", background: "var(--blue)", display: "inline-block" }} />
                  Visitors
                </span>
              </span>
              <span>{chartData[chartData.length - 1]?.date}</span>
            </div>
          </div>
        )}
      </div>

      <div className="admin-panel-grid">
        <BreakdownTable
          title="Top pages"
          items={topPages}
          empty="No page views yet."
          renderRow={(p) => (
            <>
              <td className="cell-strong" style={{ maxWidth: "260px" }}>{p.path}</td>
              <td style={{ textAlign: "right" }}>{fmtNum(p.views)}</td>
            </>
          )}
        />

        <BreakdownTable
          title="Referrers"
          items={topReferrers}
          empty="No referrer data."
          renderRow={(r) => (
            <>
              <td className="cell-strong" style={{ maxWidth: "260px" }}>{r.referrer}</td>
              <td style={{ textAlign: "right" }}>{fmtNum(r.visits)}</td>
            </>
          )}
        />

        <BreakdownTable
          title="Devices"
          items={topDevices}
          empty="No device data."
          renderRow={(d) => (
            <>
              <td className="cell-strong">{d.device}</td>
              <td style={{ textAlign: "right" }}>{fmtNum(d.visits)}</td>
            </>
          )}
        />

        <BreakdownTable
          title="Browsers"
          items={topBrowsers}
          empty="No browser data."
          renderRow={(b) => (
            <>
              <td className="cell-strong">{b.browser}</td>
              <td style={{ textAlign: "right" }}>{fmtNum(b.visits)}</td>
            </>
          )}
        />

        <BreakdownTable
          title="Operating systems"
          items={topOs}
          empty="No OS data."
          renderRow={(o) => (
            <>
              <td className="cell-strong">{o.os}</td>
              <td style={{ textAlign: "right" }}>{fmtNum(o.visits)}</td>
            </>
          )}
        />

        <BreakdownTable
          title="PWA installs"
          items={pwaInstalls > 0 ? [{ installs: pwaInstalls }] : []}
          empty="No PWA visits tracked."
          renderRow={(p) => (
            <>
              <td className="cell-strong">Installed / launched</td>
              <td style={{ textAlign: "right" }}>{fmtNum(p.installs)}</td>
            </>
          )}
        />
      </div>

      <div className="admin-panel" style={{ marginTop: "20px" }}>
        <div className="admin-panel-head">
          <h2>Returned visitors</h2>
        </div>
        <div className="admin-panel-grid">
          <div className="admin-stat-card">
            <div className="admin-stat-label">Returning visitors</div>
            <div className="admin-stat-value">{fmtNum(returnedVisitors)}</div>
            <div className="admin-stat-hint">Visited more than once · {fmtNum(returnedVisitorPages)} pages</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-label">Returning logged-in users</div>
            <div className="admin-stat-value">{fmtNum(returnedLoggedIn)}</div>
            <div className="admin-stat-hint">Returning accounts · {fmtNum(returnedLoggedInPages)} pages</div>
          </div>
        </div>
      </div>
    </div>
  );
}
